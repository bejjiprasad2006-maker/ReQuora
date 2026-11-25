import 'dotenv/config';
import { createServer as createHttpServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { createServer as createHttpsServer } from 'node:https';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import mammoth from 'mammoth';
import JSZip from 'jszip';
import { PlatformStore, contentHash } from './store';
import { AuthService, HttpError, requireRole, roles, type Principal } from './auth';
import { ProjectService, findingKey } from './projects';
import { evaluateAnalysis, annotationTemplate, summariseStudy, type EvaluationRecord } from './evaluation';
import { renderMarkdown, renderHtml, renderTraceabilityCsv } from '../domain/report';
import { renderSrsMarkdown } from '../domain/srs';
import { renderThreatModelMarkdown } from '../domain/threats';
import { createPdf } from '../mastra/pdf-tool';
import { fixtureBrief, fixtureSpecification, fixturePlan } from '../demo/fixture';
import type { AgentFunctions } from '../domain/analysis';
import { workspaceRoot } from '../mastra/workspace';
import { config } from '../mastra/config';
import { createDataset, voteDataset, datasetFrozen, referenceFrozenBefore, type ReferenceDataset } from './datasets';
import { complianceWorkflow } from '../domain/compliance';
import { financialDemo } from '../demo/financial';
import { projectProfile } from '../domain/profile';
import { financialCases, financialCaseBrief } from '../domain/cases';
import type { Project } from './types';

type Options={store:PlatformStore;root:string;agents?:AgentFunctions;secure?:boolean;publicUrl?:string};
export const createPlatformHandler = (options:Options) => {
  const auth=new AuthService(options.store),projects=new ProjectService(options.store,options.root,options.agents?.modelId??`${config.lmStudio.model}@${process.env.RIKU_MODEL_REVISION??'unversioned'}`);
  const queue:{id:string;principal:Principal;projectId:string;task:()=>Promise<unknown>}[]=[];let active=false;
  const drain=async()=>{
    if(active)return;active=true;
    while(queue.length){const job=queue.shift()!;const initial={id:job.id,projectId:job.projectId,startedAt:new Date().toISOString()};
      options.store.put(job.principal.tenantId,'background-jobs',job.id,{...initial,status:'running'},Date.now()+7*86400_000);
      try{await job.task();options.store.put(job.principal.tenantId,'background-jobs',job.id,{...initial,status:'completed'},Date.now()+7*86400_000);}
      catch(error){options.store.put(job.principal.tenantId,'background-jobs',job.id,{...initial,status:'failed',message:error instanceof HttpError?error.message:'Model analysis failed. Check connectivity, context capacity and authenticated job traces.'},Date.now()+7*86400_000);}
    }active=false;
  };
  const enqueue=(principal:Principal,projectId:string,task:()=>Promise<unknown>)=>{
    projects.get(principal,projectId);if(queue.length>=10)throw new HttpError(429,'Analysis queue is full.');const id=randomUUID();queue.push({id,principal,projectId,task});options.store.put(principal.tenantId,'background-jobs',id,{id,projectId,status:'queued'},Date.now()+7*86400_000);void drain();return {jobId:id};
  };
  const agents=async(mode:'live'|'demo',project:Project):Promise<AgentFunctions>=>{
    if(mode!=='demo')return options.agents??(await import('../mastra/generation')).liveAgents;
    const profile=projectProfile(project),demo=profile.domain==='finance'?financialDemo(profile,project.jurisdictions):{specification:{...structuredClone(fixtureSpecification),projectContext:{...structuredClone(fixtureSpecification.projectContext),...profile,jurisdictions:project.jurisdictions}},plan:fixturePlan};
    return {inferenceKind:'authored-fixture',modelId:'authored-demo-v4',requirements:async()=>structuredClone(demo.specification),sdlc:async()=>structuredClone(demo.plan)};
  };
  const cookie=(token:string)=>`riku_session=${token}; HttpOnly; SameSite=Strict; Path=/; Max-Age=28800${options.secure?'; Secure':''}`;
  const json=(res:ServerResponse,value:unknown,status=200)=>{res.writeHead(status,{'Content-Type':'application/json; charset=utf-8'});res.end(JSON.stringify(value));};
  const body=async(req:IncomingMessage)=>{
    if(!req.headers['content-type']?.startsWith('application/json'))throw new HttpError(415,'Send application/json.');
    const chunks:Buffer[]=[];let size=0;
    for await(const chunk of req){size+=Buffer.byteLength(chunk);if(size>2_000_000)throw new HttpError(413,'Request is too large.');chunks.push(Buffer.from(chunk));}
    try{return JSON.parse(Buffer.concat(chunks).toString('utf8')) as Record<string,unknown>;}catch{throw new HttpError(400,'Invalid JSON.');}
  };
  return async(req:IncomingMessage,res:ServerResponse)=>{
    res.setHeader('Cache-Control','no-store');res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('Referrer-Policy','no-referrer');res.setHeader('X-Frame-Options','DENY');
    res.setHeader('Permissions-Policy','camera=(), microphone=(), geolocation=()');
    res.setHeader('Content-Security-Policy',"default-src 'none'; script-src 'self'; style-src 'self'; connect-src 'self'; img-src 'self' data:; base-uri 'none'; frame-ancestors 'none'; form-action 'self'");
    if(options.secure)res.setHeader('Strict-Transport-Security','max-age=31536000');
    try{
      const host=req.headers.host??'';const protocol=options.secure?'https':'http';
      const permitted=options.publicUrl?new Set([new URL(options.publicUrl).host]):new Set([`localhost:${(req.socket.address() as {port:number}).port}`,`127.0.0.1:${(req.socket.address() as {port:number}).port}`]);
      if(!permitted.has(host))throw new HttpError(403,'Invalid host.');
      const url=new URL(req.url??'/',`${protocol}://${host}`),path=url.pathname,method=req.method??'GET';
      if(['POST','PUT','PATCH','DELETE'].includes(method)&&req.headers.origin!==`${protocol}://${host}`)throw new HttpError(403,'Request origin is not allowed.');
      if(method==='GET'&&['/','/app.js','/style.css'].includes(path)){
        const file=path==='/'?'index.html':path.slice(1);const content=await readFile(new URL(`./public/${file}`,import.meta.url));
        res.writeHead(200,{'Content-Type':file.endsWith('.js')?'text/javascript; charset=utf-8':file.endsWith('.css')?'text/css; charset=utf-8':'text/html; charset=utf-8'});res.end(content);return;
      }
      if(method==='GET'&&path==='/api/status'){json(res,{setupRequired:auth.setupRequired(),tenantId:auth.tenantId(),secureTransport:Boolean(options.secure)});return;}
      if(method==='POST'&&['/api/setup/start','/api/enroll/start','/api/enroll/finish','/api/login'].includes(path)){
        const b=await body(req);let result;
        if(path==='/api/setup/start')result=await auth.startSetup(String(b.username??''),String(b.password??''),String(b.tenantName??''));
        else if(path==='/api/enroll/start')result=await auth.startEnrollment(String(b.token??''),String(b.password??''));
        else if(path==='/api/enroll/finish')result=auth.finishEnrollment(String(b.enrollmentToken??''),String(b.code??''));
        else result=await auth.login(String(b.tenantId??''),String(b.username??''),String(b.password??''),String(b.code??''),req.socket.remoteAddress??'unknown');
        if('token'in result){res.setHeader('Set-Cookie',cookie(result.token));json(res,{user:result.user,csrf:result.csrf});}else json(res,result);return;
      }
      const token=req.headers.cookie?.match(/(?:^|;\s*)riku_session=([^;]+)/)?.[1]??'';
      const {principal,csrf}=auth.authenticate(token);
      if(method!=='GET'&&req.headers['x-csrf-token']!==csrf)throw new HttpError(403,'CSRF token missing or invalid.');
      if(method==='GET'&&path==='/api/me'){json(res,{user:principal,csrf});return;}
      if(method==='GET'&&path==='/api/model'){
        requireRole(principal,['admin','analyst','architect','security']);
        try{const response=await fetch(`${config.lmStudio.baseURL.replace(/\/$/,'')}/models`,{headers:{Authorization:`Bearer ${config.lmStudio.apiKey}`},signal:AbortSignal.timeout(3000)});if(!response.ok)throw new Error('Model server rejected the request.');const models=await response.json() as {data?:{id:string}[]};json(res,{reachable:true,configuredModel:config.lmStudio.model,loaded:models.data?.some(m=>m.id===config.lmStudio.model)??false});}
        catch{json(res,{reachable:false,configuredModel:config.lmStudio.model,loaded:false,message:'Start an OpenAI-compatible local model server and load the configured model. Demo mode remains available.'});}return;
      }
      if(method==='POST'&&path==='/api/logout'){auth.logout(token);res.setHeader('Set-Cookie','riku_session=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0');json(res,{ok:true});return;}
      if(method==='GET'&&path==='/api/users'){json(res,auth.users(principal));return;}
      if(method==='POST'&&path==='/api/users/invite'){const b=await body(req);json(res,auth.invite(principal,String(b.username??''),z.array(z.enum(roles)).parse(b.roles)));return;}
      if(method==='POST'&&path.startsWith('/api/users/')&&path.endsWith('/disable')){auth.disableUser(principal,path.split('/')[3]!);json(res,{ok:true});return;}
      if(method==='GET'&&path==='/api/knowledge'){json(res,projects.knowledge(principal));return;}
      if(method==='POST'&&path==='/api/knowledge'){json(res,projects.addKnowledge(principal,await body(req)),201);return;}
      const knowledgeMatch=path.match(/^\/api\/knowledge\/([^/]+)\/(review|update)$/);
      if(method==='POST'&&knowledgeMatch){const b=await body(req);json(res,knowledgeMatch[2]==='review'?projects.reviewKnowledge(principal,knowledgeMatch[1]!,String(b.note??''),String(b.expectedHash??'')):projects.updateKnowledge(principal,knowledgeMatch[1]!,b.source as Parameters<ProjectService['updateKnowledge']>[2],String(b.note??'')));return;}
      if(method==='GET'&&path==='/api/audit'){requireRole(principal,['admin','security','legal']);json(res,{integrity:options.store.verifyAudit(principal.tenantId),entries:options.store.auditEntries(principal.tenantId).slice(-300)});return;}
      if(method==='GET'&&path==='/api/monitor'){requireRole(principal,['admin','security','operations']);json(res,{projects:projects.list(principal),jobs:options.store.list(principal.tenantId,'background-jobs'),audit:options.store.verifyAudit(principal.tenantId),uptimeSeconds:Math.round(process.uptime()),queueLength:queue.length,modelRunning:active,transport:options.secure?'https':'loopback-http',storage:'AES-256-GCM encrypted records; SQLite metadata is not encrypted'});return;}
      if(method==='POST'&&path==='/api/retention/sweep'){json(res,projects.sweep(principal));return;}
      if(method==='GET'&&path==='/api/projects'){json(res,projects.list(principal));return;}
      if(method==='GET'&&path==='/api/cases'){json(res,financialCases.map(item=>({...item,domain:'finance',brief:financialCaseBrief(item)})));return;}
      if(method==='GET'&&path==='/api/study'){const allowed=new Set(projects.list(principal).map(p=>p.id));json(res,summariseStudy(options.store.list<EvaluationRecord>(principal.tenantId,'evaluations').filter(e=>allowed.has(e.projectId))));return;}
      if(method==='POST'&&path==='/api/projects'){const b=await body(req);json(res,projects.create(principal,b as Parameters<ProjectService['create']>[1]),201);return;}
      if(method==='POST'&&path==='/api/demo'){const b=await body(req),domain=z.enum(['finance','ecommerce']).parse(b.domain??'ecommerce');const demo=financialDemo();json(res,projects.create(principal,domain==='finance'?{name:'Financial onboarding demonstration',brief:demo.brief,mode:'demo',domain:'finance',useCase:'customer-onboarding',regulatedEntity:'commercial-bank'}:{name:'ShopSphere demonstration',brief:fixtureBrief,mode:'demo'}),201);return;}
      const match=path.match(/^\/api\/projects\/([a-f0-9-]{36})(?:\/(.*))?$/i);
      if(match){
        const id=match[1]!,action=match[2]??'',project=projects.get(principal,id);
        if(method==='GET'&&!action){const version=project.latestVersionId?projects.version(principal,id):null;json(res,{project,version,blockers:projects.blockers(principal,id),findings:version?.data.findings.map(f=>({...f,key:findingKey(f)}))??[],evaluations:options.store.list<{projectId:string}>(principal.tenantId,'evaluations').filter(e=>e.projectId===id),datasets:options.store.list<ReferenceDataset>(principal.tenantId,'datasets').filter(d=>d.projectId===id).map(d=>({...d,frozen:datasetFrozen(d)}))});return;}
        if(method==='GET'&&action==='annotation-template'){json(res,annotationTemplate);return;}
        if(method==='GET'&&action==='study'){json(res,summariseStudy(options.store.list<EvaluationRecord>(principal.tenantId,'evaluations').filter(e=>e.projectId===id)));return;}
        if(method==='GET'&&action==='readiness'){
          const version=projects.version(principal,id),current=project.assurances?.filter(a=>a.versionId===version.id&&a.documentHash===version.documentHash)??[];
          const checks={approvedBaseline:project.baselines.some(b=>b.versionId===version.id&&b.documentHash===version.documentHash),noBaselineBlockers:projects.blockers(principal,id).length===0,tls:Boolean(options.secure),supportedRuntime:Number(process.versions.node.split('.')[0])>=22,realModelEvidence:options.store.list<EvaluationRecord>(principal.tenantId,'evaluations').some(e=>e.projectId===id&&e.versionId===version.id&&e.result.researchEligible&&e.result.inferenceKind==='model-inference'),penetrationTest:current.findLast(a=>a.kind==='penetration-test')?.outcome==='passed',deploymentReview:current.findLast(a=>a.kind==='deployment-review')?.outcome==='passed'};
          json(res,{versionId:version.id,documentHash:version.documentHash,checks,readyForProductionReview:Object.values(checks).every(Boolean),blockers:projects.blockers(principal,id),assessments:current,limitations:['Assessment evidence is recorded by authenticated independent reviewers, not independently verified by the application.','This report is a readiness checklist, not a security certification or deployment approval.']});return;
        }
        if(method==='GET'&&action==='versions'){json(res,project.versions.map(versionId=>{const v=projects.version(principal,id,versionId);return {id:v.id,number:v.number,createdAt:v.createdAt,documentHash:v.documentHash,inputRevision:v.inputRevision,createdBy:v.createdBy,modelId:v.modelId,parentVersionId:v.parentVersionId,changeReason:v.changeReason};}));return;}
        if(method==='GET'&&action.startsWith('versions/')){json(res,projects.version(principal,id,action.split('/')[1]));return;}
        if(method==='GET'&&action.startsWith('jobs/')){const job=options.store.get<{projectId:string}>(principal.tenantId,'background-jobs',action.split('/')[1]!);if(!job||job.projectId!==id)throw new HttpError(404,'Job not found.');json(res,job);return;}
        if(method==='GET'&&action.startsWith('export/')){
          const version=projects.version(principal,id,url.searchParams.get('version')??undefined),data=version.data,format=action.split('/')[1];
          const files:Record<string,()=>Promise<string|Uint8Array>>={html:async()=>renderHtml(data),md:async()=>renderMarkdown(data),json:async()=>JSON.stringify({version,approvals:project.approvals.filter(a=>a.versionId===version.id),controlDecisions:project.controlDecisions.filter(d=>d.versionId===version.id),baselines:project.baselines.filter(b=>b.versionId===version.id)},null,2),csv:async()=>renderTraceabilityCsv(data),pdf:async()=>createPdf(data.specification.title,renderMarkdown(data)), 'srs-md':async()=>renderSrsMarkdown(data),'srs-pdf':async()=>createPdf(`Software Requirements Specification - ${data.specification.title}`,renderSrsMarkdown(data))};
          if(format==='zip'){
            const zip=new JSZip();for(const [ext,generate]of Object.entries(files))zip.file(ext.startsWith('srs-')?`srs.${ext.slice(4)}`:`report.${ext}`,await generate());
            zip.file('compliance.json',JSON.stringify(data.compliance,null,2));zip.file('agent-traces.json',JSON.stringify(data.traces,null,2));
            zip.file('threat-model.md',renderThreatModelMarkdown(data));zip.file('threat-model.json',JSON.stringify(data.specification.threatModel??null,null,2));
            zip.file('control-phase-crosswalk.json',JSON.stringify(complianceWorkflow(data.compliance!,data.sdlcPlan),null,2));
            zip.file('baseline-attestations.json',JSON.stringify({documentHash:version.documentHash,baselines:project.baselines.filter(b=>b.versionId===version.id),approvals:project.approvals.filter(a=>a.versionId===version.id),resolutions:project.resolutions.filter(r=>r.versionId===version.id),controlDecisions:project.controlDecisions.filter(d=>d.versionId===version.id),threatDecisions:project.threatDecisions?.filter(d=>d.versionId===version.id)??[],assessments:project.assurances?.filter(d=>d.versionId===version.id)??[]},null,2));
            zip.file('data-specification.json',JSON.stringify(data.specification.dataRequirements,null,2));zip.file('interface-specification.json',JSON.stringify(data.specification.interfaceRequirements,null,2));
            zip.file('workflow.mmd',['flowchart TD',...data.sdlcPlan.phases.map((phase,index)=>`  P${index}["${phase.name.replace(/["<>\n\r]/g,' ')}"]`),...data.sdlcPlan.phases.slice(1).map((_,index)=>`  P${index} --> P${index+1}`)].join('\n'));
            zip.file('audit.json',JSON.stringify(options.store.auditEntries(principal.tenantId).filter(entry=>entry.subject===id),null,2));
            const buffer=await zip.generateAsync({type:'nodebuffer'});res.writeHead(200,{'Content-Type':'application/zip','Content-Disposition':`attachment; filename="riku-${version.number}.zip"`});res.end(buffer);return;
          }
          if(!format||!files[format])throw new HttpError(404,'Unknown export format.');const output=await files[format]();
          const extension=format.startsWith('srs-')?format.slice(4):format,filename=format.startsWith('srs-')?`srs.${extension}`:`report.${extension}`;
          res.writeHead(200,{'Content-Type':extension==='pdf'?'application/pdf':extension==='html'?'text/html; charset=utf-8':extension==='json'?'application/json':extension==='csv'?'text/csv; charset=utf-8':'text/markdown; charset=utf-8','Content-Disposition':`attachment; filename="${filename}"`});res.end(output);return;
        }
        if(method==='POST'){
          const b=await body(req),etag=z.number().int().positive().parse(b.etag);
          if(project.etag!==etag)throw new HttpError(409,'Project changed. Refresh before saving.');
          if(action==='datasets'){json(res,createDataset(options.store,principal,id,projects.inputHash(principal,id),project.versions.length===0,b.reference,project.legalHold?undefined:project.expiresAt),201);return;}
          if(action==='dataset-vote'){json(res,voteDataset(options.store,principal,id,String(b.datasetId??''),b.decision as 'approve'|'reject',String(b.note??''),project.legalHold?undefined:project.expiresAt));return;}
          if(action==='context'){json(res,projects.updateContext(principal,id,etag,b as unknown as Parameters<ProjectService['updateContext']>[3]));return;}
          if(action==='members'){json(res,projects.addMember(principal,id,etag,String(b.userId??'')));return;}
          if(action==='answer'){json(res,projects.answer(principal,id,etag,String(b.questionId??''),String(b.answer??'')));return;}
          if(action==='sources'){
            let content=String(b.content??'');
            if(b.base64){
              const name=String(b.name??''),bytes=Buffer.from(String(b.base64),'base64');if(bytes.length>1_000_000)throw new HttpError(413,'File must be at most 1 MB.');
              if(name.toLowerCase().endsWith('.docx')){
                const archive=await JSZip.loadAsync(bytes);let total=0,count=0;
                for(const entry of Object.values(archive.files)){if(entry.dir)continue;count++;const size=(entry as unknown as {_data?:{uncompressedSize:number}})._data?.uncompressedSize??0;total+=size;if(count>500||total>8_000_000)throw new HttpError(413,'DOCX expanded size exceeds the import limit.');}
                content=(await mammoth.extractRawText({buffer:bytes})).value;
              }else if(/\.(?:txt|md|json|yaml|yml|sql|eml|csv)$/i.test(name))content=bytes.toString('utf8');else throw new HttpError(422,'Unsupported document type.');
              if(/\.json$/i.test(name)){try{JSON.parse(content);}catch{throw new HttpError(422,'JSON source is invalid.');}}
            }
            json(res,projects.addSource(principal,id,etag,{name:String(b.name??''),kind:b.kind as InputSourceKind,stakeholder:String(b.stakeholder??''),content,classification:b.classification as 'internal'|'personal'|'sensitive'}));return;
          }
          if(action==='source-revision'){json(res,projects.reviseSource(principal,id,etag,String(b.sourceId??''),String(b.content??'')));return;}
          if(action==='source-review'){json(res,projects.reviewSource(principal,id,etag,String(b.sourceId??''),String(b.note??'')));return;}
          if(action==='analyse'||action==='clarify'){
            requireRole(principal,['admin','analyst','product_owner','architect']);
            const selectedAgents=await agents(project.mode,project);
            json(res,enqueue(principal,id,()=>action==='analyse'?projects.analyse(principal,id,etag,selectedAgents):projects.clarify(principal,id,etag,selectedAgents)),202);return;
          }
          if(action==='edit-requirement'){json(res,projects.editRequirement(principal,id,etag,String(b.requirementId??''),b.requirement,String(b.note??'')));return;}
          if(action==='resolve'){json(res,projects.resolve(principal,id,etag,b as unknown as Parameters<ProjectService['resolve']>[3]));return;}
          if(action==='control'){json(res,projects.reviewControl(principal,id,etag,b as unknown as Parameters<ProjectService['reviewControl']>[3]));return;}
          if(action==='threat-review'){json(res,projects.reviewThreat(principal,id,etag,b as unknown as Parameters<ProjectService['reviewThreat']>[3]));return;}
          if(action==='assurance'){json(res,projects.recordAssurance(principal,id,etag,b as unknown as Parameters<ProjectService['recordAssurance']>[3]));return;}
          if(action==='approve'){json(res,projects.approve(principal,id,etag,String(b.target??''),b.decision as 'approve'|'reject',String(b.note??'')));return;}
          if(action==='baseline'){json(res,projects.baseline(principal,id,etag));return;}
          if(action==='retention'){json(res,projects.retention(principal,id,etag,Number(b.days),z.boolean().parse(b.legalHold),String(b.note??'')));return;}
          if(action==='evaluate'){
            requireRole(principal,['analyst','architect','product_owner']);const version=projects.version(principal,id);if(project.etag!==etag)throw new HttpError(409,'Project changed.');
            const annotation=b.annotation as {provenance?:string;referenceDatasetId?:string;referenceRequirementIds?:string[];expectedAmbiguities?:string[];expectedConflicts?:string[];acceptableLifecycles?:string[]};let verified=false,before=false;
            if(annotation.provenance==='human-reviewed'){
              const dataset=options.store.get<ReferenceDataset>(principal.tenantId,'datasets',annotation.referenceDatasetId??'');
              if(!dataset||dataset.projectId!==id||!datasetFrozen(dataset)||dataset.inputHash!==contentHash(version.data.redactedBrief))throw new HttpError(422,'Human-reviewed evaluation needs an independently adjudicated reference dataset for the exact input.');
              if(JSON.stringify(annotation.referenceRequirementIds)!==JSON.stringify(dataset.reference.requirements.map(r=>r.id))||JSON.stringify(annotation.expectedAmbiguities)!==JSON.stringify(dataset.reference.ambiguities)||JSON.stringify(annotation.expectedConflicts)!==JSON.stringify(dataset.reference.conflicts)||JSON.stringify(annotation.acceptableLifecycles)!==JSON.stringify(dataset.reference.acceptableLifecycles))throw new HttpError(422,'Annotation reference labels must match the frozen dataset.');
              verified=true;before=referenceFrozenBefore(dataset,version.data.createdAt);
            }
            const result=evaluateAnalysis(version.data,b.annotation,{humanReferenceVerified:verified,referenceFrozenBeforeInference:before}),record={id:randomUUID(),projectId:id,versionId:version.id,documentHash:version.documentHash,reviewer:principal.id,at:new Date().toISOString(),annotation:b.annotation,result};
            options.store.transaction(()=>{options.store.put(principal.tenantId,'evaluations',record.id,record,project.legalHold?undefined:project.expiresAt);options.store.audit(principal.tenantId,principal.id,'evaluation.recorded',id,{evaluationId:record.id,annotationHash:contentHash(b.annotation),researchEligible:result.researchEligible});});json(res,record);return;
          }
        }
      }
      throw new HttpError(404,'Route not found.');
    }catch(error){
      const status=error instanceof HttpError?error.status:error instanceof z.ZodError?422:500;
      json(res,{error:error instanceof HttpError?error.message:error instanceof z.ZodError?error.issues.map(issue=>`${issue.path.join('.')}: ${issue.message}`).join('; '):'Request failed. Check the authenticated job or audit record.'},status);
    }
  };
};
type InputSourceKind='brief'|'transcript'|'email'|'meeting'|'questionnaire'|'api'|'database'|'legacy'|'incident'|'policy';
export const startPlatform=async()=>{
  const tls=process.env.RIKU_TLS_CERT&&process.env.RIKU_TLS_KEY?{cert:await readFile(process.env.RIKU_TLS_CERT),key:await readFile(process.env.RIKU_TLS_KEY)}:undefined;
  if(process.env.NODE_ENV==='production'&&!tls)throw new Error('Production startup requires RIKU_TLS_CERT and RIKU_TLS_KEY.');
  const host=process.env.RIKU_HOST??'127.0.0.1',port=Number(process.env.RIKU_PORT??4120);
  if(!tls&&!['127.0.0.1','localhost','::1'].includes(host))throw new Error('Non-loopback binding requires TLS.');
  const store=await PlatformStore.open(resolve(process.env.RIKU_DATA_DIR??'.runtime/platform'));
  new ProjectService(store,workspaceRoot).recoverInterruptedJobs();
  const handler=createPlatformHandler({store,root:workspaceRoot,secure:Boolean(tls),publicUrl:process.env.RIKU_PUBLIC_URL});
  const server=tls?createHttpsServer(tls,handler):createHttpServer(handler);
  server.headersTimeout=15_000;server.requestTimeout=30_000;
  server.listen(port,host,()=>console.log(`RikuAI secure workspace: ${process.env.RIKU_PUBLIC_URL??`${tls?'https':'http'}://localhost:${port}`}\n${new AuthService(store).setupRequired()?'Open the workspace to create your administrator account and enroll an authenticator.':'Sign in with your password and authenticator.'}`));
  const sweepTimer=setInterval(()=>{for(const tenantId of store.tenantIds())try{new ProjectService(store,workspaceRoot).sweep({id:'system-retention',tenantId,username:'retention-worker',roles:['admin'],disabled:false});}catch{console.error('Retention worker failed; inspect audit integrity.');}},15*60_000);sweepTimer.unref();
  const stop=()=>{clearInterval(sweepTimer);server.close(()=>{store.close();process.exit(0);});};process.on('SIGINT',stop);process.on('SIGTERM',stop);
  return server;
};
if(process.argv[1]&&pathToFileURL(resolve(process.argv[1])).href===import.meta.url)await startPlatform();
