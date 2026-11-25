import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve, relative } from 'node:path';
import { randomBytes, randomUUID } from 'node:crypto';
import { createServer } from 'node:http';
import JSZip from 'jszip';
import { PDFDocument } from 'pdf-lib';
import { PlatformStore, loadMasterKey } from '../src/platform/store';
import { AuthService, otpCode, type Principal, type Role } from '../src/platform/auth';
import { ProjectService, findingKey } from '../src/platform/projects';
import { createPlatformHandler } from '../src/platform/server';
import { evaluateAnalysis, annotationTemplate } from '../src/platform/evaluation';
import { analyseCompliance } from '../src/domain/compliance';
import { analyseQuality, validateSpecification } from '../src/domain/quality';
import { fixtureBrief, fixtureSpecification, fixturePlan } from '../src/demo/fixture';
import { answerQuestion, initialQuestions, mergeQuestions } from '../src/platform/interviews';
import type { AgentFunctions } from '../src/domain/analysis';
import { createDataset, voteDataset, datasetFrozen, referenceFrozenBefore } from '../src/platform/datasets';
import { financialDemo } from '../src/demo/financial';
import { hybridRetrieve, cosine } from '../src/platform/retrieval';

const root=resolve('.');
const cleanup=async(path:string)=>{const within=relative(tmpdir(),path);assert.ok(!within.startsWith('..')&&!resolve(path).endsWith(resolve(tmpdir())));await rm(path,{recursive:true,force:true});};
const harness=async()=>{
  const directory=await mkdtemp(join(tmpdir(),'riku-secure-')),key=randomBytes(32),store=await PlatformStore.open(directory,key),auth=new AuthService(store),projects=new ProjectService(store,root);
  const enrollment=await auth.startSetup('owner','Test-password-123456','Test workspace'),session=auth.finishEnrollment(enrollment.enrollmentToken,otpCode(enrollment.secret));
  const owner=session.user;
  const user=async(name:string,roles:Role[])=>{const invite=auth.invite(owner,name,roles),enroll=await auth.startEnrollment(invite.token,'Independent-password-123');const session=auth.finishEnrollment(enroll.enrollmentToken,otpCode(enroll.secret));return {...session,secret:enroll.secret};};
  return {directory,key,store,auth,projects,owner,session,user,close:async()=>{store.close();await cleanup(directory);}};
};
const controlledAgents=(jurisdictions:typeof fixtureSpecification.projectContext.jurisdictions=['Unspecified']):AgentFunctions=>({
  modelId:'controlled-software-test',requirements:async()=>({...structuredClone(fixtureSpecification),openQuestions:[],projectContext:{...fixtureSpecification.projectContext,jurisdictions}}),sdlc:async()=>structuredClone(fixturePlan),
});
test('MFA enrollment is single-use; role assignment is protected; OTP replay is rejected',async()=>{
  const h=await harness();try{
    const viewer=await h.user('read.only',['viewer']);
    assert.throws(()=>h.auth.invite(viewer.user,'escalation',['admin']),/role/);
    await assert.rejects(h.auth.login(h.owner.tenantId,'read.only','Independent-password-123',otpCode(viewer.secret),'test-ip'),/already used/);
    const login=await h.auth.login(h.owner.tenantId,'read.only','Independent-password-123',otpCode(viewer.secret,Date.now()+30_000),'test-ip');
    assert.equal(login.user.id,viewer.user.id);
    await assert.rejects(h.auth.login(h.owner.tenantId,'read.only','Independent-password-123',otpCode(viewer.secret,Date.now()+30_000),'test-ip'),/already used/);
    const invite=h.auth.invite(h.owner,'one.use',['viewer']),enroll=await h.auth.startEnrollment(invite.token,'Another-password-123');h.auth.finishEnrollment(enroll.enrollmentToken,otpCode(enroll.secret));
    await assert.rejects(h.auth.startEnrollment(invite.token,'Another-password-123'),/invalid or expired/);
    h.auth.disableUser(h.owner,viewer.user.id);assert.throws(()=>h.auth.authenticate(login.token),/unavailable/);
  }finally{await h.close();}
});
test('encrypted storage binds ciphertext to tenant and record; audit detects payload and head tampering',async()=>{
  const h=await harness();try{
    const secret='PRIVATE_SOURCE_CONTENT_578719';h.store.put(h.owner.tenantId,'test','record',{secret});h.store.db.exec('PRAGMA wal_checkpoint(FULL)');
    assert.ok(!(await readFile(join(h.directory,'platform.sqlite'))).includes(Buffer.from(secret)));
    const row=h.store.db.prepare("SELECT payload FROM records WHERE tenant=? AND collection='test'").get(h.owner.tenantId) as {payload:string};
    h.store.db.prepare('INSERT INTO records VALUES(?,?,?,?,NULL)').run('other-tenant','test','record',row.payload);
    assert.throws(()=>h.store.get('other-tenant','test','record'));
    assert.ok(h.store.verifyAudit(h.owner.tenantId).valid);
    const head=h.store.db.prepare('SELECT * FROM audit_heads WHERE tenant=?').get(h.owner.tenantId) as {seq:number;hash:string;signature:string};
    h.store.db.prepare('UPDATE audit_heads SET seq=0,hash=? WHERE tenant=?').run('genesis',h.owner.tenantId);assert.equal(h.store.verifyAudit(h.owner.tenantId).valid,false);
    h.store.db.prepare('UPDATE audit_heads SET seq=?,hash=?,signature=? WHERE tenant=?').run(head.seq,head.hash,head.signature,h.owner.tenantId);
    h.store.db.prepare('UPDATE audit SET payload=? WHERE tenant=? AND seq=1').run('tampered',h.owner.tenantId);assert.equal(h.store.verifyAudit(h.owner.tenantId).valid,false);
  }finally{await h.close();}
});
test('OS-protected master key persists and reopens without exposing a raw key file on Windows',async()=>{
  const directory=await mkdtemp(join(tmpdir(),'riku-key-'));
  try{const first=await loadMasterKey(directory),second=await loadMasterKey(directory);assert.equal(first.length,32);assert.deepEqual(second,first);if(process.platform==='win32')assert.notDeepEqual(await readFile(join(directory,'master-key.dpapi')),first);}finally{await cleanup(directory);}
});
test('tenant/project membership and optimistic revisions reject unauthorised or stale changes',async()=>{
  const h=await harness();try{
    const p=h.projects.create(h.owner,{name:'Private store',brief:fixtureBrief}),stranger=await h.user('another.analyst',['analyst']);
    assert.throws(()=>h.projects.get(stranger.user,p.id),/not found/);
    const foreign={...h.owner,tenantId:randomUUID()};assert.throws(()=>h.projects.get(foreign,p.id),/not found/);
    h.projects.answer(h.owner,p.id,p.etag,p.questions[0]!.id,'The product scope is the single merchant store defined in the brief.');
    assert.throws(()=>h.projects.answer(h.owner,p.id,p.etag,p.questions[1]!.id,'The merchant serves consumers in India.'),/changed/);
    const current=h.projects.get(h.owner,p.id);h.projects.addMember(h.owner,p.id,current.etag,stranger.user.id);assert.equal(h.projects.get(stranger.user,p.id).id,p.id);
  }finally{await h.close();}
});
test('persistent interview answers remain open when vague and accept justified exclusions',()=>{
  const questions=initialQuestions(),performance=questions.find(q=>q.topic==='performance')!;
  answerQuestion(performance,'It should respond quickly for all customers.','reviewer');assert.equal(performance.status,'open');assert.match(performance.followUp!,/numeric/);
  answerQuestion(performance,'p95 <= 2 seconds under 100 concurrent users in the test environment.','reviewer');assert.equal(performance.status,'answered');
  const recovery=questions.find(q=>q.topic==='recovery')!;answerQuestion(recovery,'Recovery objectives are out of scope because this module has no persistent state.','reviewer');assert.equal(recovery.status,'answered');
  const existing=[{...performance,topic:'analysis',status:'answered' as const}];
  const merged=mergeQuestions(existing,{summary:'Follow up',questions:[{id:'new',role:'legal',topic:'analysis',question:'Which legal entity operates the store?',reason:'Needed for scope.',blocking:true,requirementIds:[]}]});assert.equal(merged.length,2);
});
test('classification, cycles, opposing requirements and impossible targets produce quality findings',()=>{
  assert.equal(analyseQuality(fixtureSpecification).filter(f=>f.code==='TESTABILITY_REVIEW').length,0,'Observable rejection, response, audit and recovery outcomes must not be flagged as untestable.');
  const spec=structuredClone(fixtureSpecification);spec.requirements[0]!.categories=['security'];spec.requirements[0]!.dependencies=[spec.requirements[1]!.id];spec.requirements[1]!.dependencies=[spec.requirements[0]!.id];
  const codes=validateSpecification(spec,fixtureBrief,['docs/ingested/ecommerce/security-evidence.md']).map(f=>f.code);assert.ok(codes.includes('CATEGORY_MISMATCH'));assert.ok(codes.includes('DEPENDENCY_CYCLE'));
  spec.requirements[0]!.statement='The system shall allow guest checkout for all shoppers.';spec.requirements[1]!.statement='The system shall not allow guest checkout for all shoppers.';spec.requirements[1]!.module=spec.requirements[0]!.module;spec.requirements[2]!.statement='The service shall provide availability of 110% for checkout.';
  const semantic=analyseQuality(spec).map(f=>f.code);assert.ok(semantic.includes('POTENTIAL_CONTRADICTION'));assert.ok(semantic.includes('INFEASIBLE_TARGET'));
});
test('jurisdiction/payment conditions create candidate controls and explicit unsupported-region gaps',()=>{
  const spec=structuredClone(fixtureSpecification);spec.projectContext.jurisdictions=['India'];let result=analyseCompliance(spec,'2026-11-18');
  assert.ok(result.mappings.some(c=>c.controlId==='IND-ECOMMERCE'));assert.ok(!result.mappings.some(c=>c.controlId==='EU-RIGHTS'));assert.ok(!result.mappings.some(c=>c.controlId==='PCI-EMBEDDED-SCRIPTS'));
  assert.equal(result.mappings.find(c=>c.controlId==='IND-DPDP-READINESS')!.temporalStatus,'unknown');
  spec.projectContext.jurisdictions=['EU'];spec.projectContext.paymentIntegration='embedded';result=analyseCompliance(spec);assert.ok(result.mappings.some(c=>c.controlId==='EU-RIGHTS'&&c.status==='gap'));assert.ok(result.mappings.some(c=>c.controlId==='PCI-EMBEDDED-SCRIPTS'));
  spec.projectContext.jurisdictions=['UK'];assert.match(analyseCompliance(spec).jurisdictionGaps[0]!,/No jurisdiction-specific/);
});
test('baseline gates enforce independent approvals, control/source reviews and invalidate after source changes',async()=>{
  const h=await harness();try{
    const people:Record<string,Principal>={};for(const role of ['product_owner','architect','security','legal','project_manager','operations'] as Role[])people[role]=(await h.user('reviewer.'+role,[role])).user;
    const p=h.projects.create(h.owner,{name:'Live workflow software test',brief:fixtureBrief,jurisdictions:['EU']});
    for(const principal of Object.values(people)){const current=h.projects.get(h.owner,p.id);h.projects.addMember(h.owner,p.id,current.etag,principal.id);}
    for(const q of p.questions){const current=h.projects.get(h.owner,p.id);h.projects.answer(h.owner,p.id,current.etag,q.id,'Reviewed scope and policy decision: 30 seconds recovery and 100 concurrent users; see the project brief.');}
    let current=h.projects.get(h.owner,p.id);const v=await h.projects.analyse(h.owner,p.id,current.etag,controlledAgents(['EU']));
    assert.ok(h.projects.blockers(h.owner,p.id).length>0);current=h.projects.get(h.owner,p.id);assert.throws(()=>h.projects.baseline(people.project_manager!,p.id,current.etag),/approval|Resolve|Control|source/);
    for(const finding of v.data.findings){current=h.projects.get(h.owner,p.id);const reviewer=/INJECTION|SECURITY|CITATION/.test(finding.code)?people.security!:/COMPLIANCE|PRIVACY/.test(finding.code)?people.legal!:people.architect!;
      h.projects.resolve(reviewer,p.id,current.etag,{key:findingKey(finding),decision:'resolved',note:'Controlled test reviewer has checked the specified issue against the test reference.',evidence:'Controlled test evidence; not an empirical human review.'});}
    for(const source of v.data.compliance!.sources){const reviewer=source.kind==='law'?people.legal!:people.security!;h.projects.reviewKnowledge(reviewer,source.id,'Controlled test source review; no claim of legal verification.',source.sha256);}
    for(const mapping of v.data.compliance!.mappings){current=h.projects.get(h.owner,p.id);h.projects.reviewControl(people[mapping.owner]!,p.id,current.etag,{controlId:mapping.controlId,decision:mapping.requirementIds.length?'mapped':'excluded',requirementIds:mapping.requirementIds,note:'Controlled test disposition validates gate mechanics only; not substantive compliance.'});}
    for(const threat of v.data.specification.threatModel!.threats){current=h.projects.get(h.owner,p.id);h.projects.reviewThreat(people.security!,p.id,current.etag,{threatId:threat.id,decision:'mitigated',note:'Controlled software test of the independent threat review gate.',evidence:'Controlled test evidence only; no real penetration or business security test is asserted.'});}
    current=h.projects.get(h.owner,p.id);h.projects.approve(people.product_owner!,p.id,current.etag,'requirements-all','approve','Controlled test product-owner acceptance for gate coverage.');
    for(const [target,role]of Object.entries({architecture:'architect',security:'security',legal:'legal',sdlc:'project_manager',release:'operations'})){current=h.projects.get(h.owner,p.id);h.projects.approve(people[role]!,p.id,current.etag,target,'approve','Controlled test independent approval for software verification.');}
    assert.deepEqual(h.projects.blockers(h.owner,p.id),[]);current=h.projects.get(h.owner,p.id);const baseline=h.projects.baseline(people.project_manager!,p.id,current.etag);assert.equal(baseline.documentHash,v.documentHash);
    current=h.projects.get(h.owner,p.id);h.projects.addSource(h.owner,p.id,current.etag,{name:'New stakeholder interview',kind:'transcript',stakeholder:'Merchant',content:'The merchant has requested a revised returns workflow for review.',classification:'internal'});
    assert.ok(h.projects.blockers(h.owner,p.id).some(message=>message.includes('Inputs changed')));assert.equal(h.projects.get(h.owner,p.id).baselines.length,1);assert.equal(h.projects.version(h.owner,p.id,v.id).documentHash,v.documentHash);
    assert.ok(h.store.verifyAudit(h.owner.tenantId).valid);
  }finally{await h.close();}
});
test('authored demos cannot become live baselines; edits create immutable versions and clear prior acceptance',async()=>{
  const h=await harness();try{
    const p=h.projects.create(h.owner,{name:'Authored demo',brief:fixtureBrief,mode:'demo'});const v=await h.projects.analyse(h.owner,p.id,p.etag,controlledAgents());assert.ok(h.projects.blockers(h.owner,p.id).some(b=>b.includes('authored demo')));
    const current=h.projects.get(h.owner,p.id),updated=structuredClone(v.data.specification.requirements[0]!);updated.businessJustification+=' Include explicit merchant review.';
    const edited=h.projects.editRequirement(h.owner,p.id,current.etag,updated.id,updated,'Controlled test clarification of business justification.');
    assert.notEqual(edited.documentHash,v.documentHash);assert.equal(edited.parentVersionId,v.id);assert.equal(h.projects.version(h.owner,p.id,v.id).data.specification.requirements[0]!.businessJustification,v.data.specification.requirements[0]!.businessJustification);assert.ok(edited.data.findings.some(f=>f.code==='SEMANTIC_REVIEW_PENDING'));
  }finally{await h.close();}
});

test('financial projects bind domain, interviews, threats and assessment decisions to immutable versions',async()=>{
  const h=await harness();try{
    const profile={domain:'finance' as const,useCase:'customer-onboarding' as const,regulatedEntity:'commercial-bank' as const},demo=financialDemo(profile,['India']);
    const p=h.projects.create(h.owner,{name:'Financial threat review test',brief:demo.brief,...profile,jurisdictions:['India']});
    assert.ok(p.questions.some(q=>q.topic==='financial-compliance'));assert.ok(!p.questions.some(q=>q.topic==='returns'));
    assert.throws(()=>h.projects.create(h.owner,{name:'Invalid financial profile',brief:demo.brief,domain:'finance',useCase:'storefront'}),/financial use case/);
    const security=(await h.user('financial.security',['security'])).user,operations=(await h.user('financial.operations',['operations'])).user;
    for(const person of [security,operations])h.projects.addMember(h.owner,p.id,h.projects.get(h.owner,p.id).etag,person.id);
    const agents:AgentFunctions={modelId:'financial-controlled-test',inferenceKind:'controlled-test',requirements:async()=>structuredClone(demo.specification),sdlc:async()=>structuredClone(demo.plan)};
    const v=await h.projects.analyse(h.owner,p.id,h.projects.get(h.owner,p.id).etag,agents);
    assert.equal(v.data.specification.projectContext.domain,'finance');assert.ok(v.data.evidence.every(e=>e.id.startsWith('docs/ingested/financial/')));
    assert.ok(v.data.compliance!.mappings.some(m=>m.controlId==='IND-BANK-KYC'));assert.ok(h.projects.blockers(h.owner,p.id).some(b=>/Threat THR-001/.test(b)));
    const disposition={threatId:'THR-001',decision:'accepted-risk' as const,note:'Controlled test of independent risk acceptance; not a real assessment.',evidence:'Controlled test evidence of role, version and audit enforcement.'};
    assert.throws(()=>h.projects.reviewThreat(h.owner,p.id,h.projects.get(h.owner,p.id).etag,disposition),/role/);
    assert.throws(()=>h.projects.reviewThreat({...h.owner,roles:['security']},p.id,h.projects.get(h.owner,p.id).etag,disposition),/draft author/);
    const decision=h.projects.reviewThreat(security,p.id,h.projects.get(h.owner,p.id).etag,disposition);assert.equal(decision.documentHash,v.documentHash);
    assert.ok(!h.projects.blockers(h.owner,p.id).some(b=>/Threat THR-001/.test(b)));
    const assessment={kind:'penetration-test' as const,outcome:'failed' as const,note:'Controlled test of recording an independent assessment outcome.',evidence:'Controlled report reference; this test performs no penetration assessment.'};
    assert.throws(()=>h.projects.recordAssurance(operations,p.id,h.projects.get(h.owner,p.id).etag,assessment),/role/);
    const record=h.projects.recordAssurance(security,p.id,h.projects.get(h.owner,p.id).etag,assessment);assert.equal(record.outcome,'failed');assert.equal(record.documentHash,v.documentHash);
    const changed=structuredClone(v.data.specification.requirements[0]!);changed.businessJustification+=' Clarified in the controlled financial test.';
    h.projects.editRequirement(h.owner,p.id,h.projects.get(h.owner,p.id).etag,changed.id,changed,'Controlled change invalidates prior threat review.');
    assert.ok(h.projects.blockers(h.owner,p.id).some(b=>/Threat THR-001/.test(b)));
    assert.equal(h.projects.get(h.owner,p.id).threatDecisions![0]!.versionId,v.id);
    assert.ok(h.store.verifyAudit(h.owner.tenantId).valid);
  }finally{await h.close();}
});

test('financial case, study, readiness and demo routes preserve membership and evidence boundaries',async()=>{
  const h=await harness(),server=createServer(createPlatformHandler({store:h.store,root,agents:controlledAgents()}));
  await new Promise<void>(resolve=>server.listen(0,'127.0.0.1',resolve));const address=server.address();assert.ok(address&&typeof address!=='string');
  const base=`http://127.0.0.1:${address.port}`,headers={Cookie:`riku_session=${h.session.token}`};
  try{
    const cases=await(await fetch(base+'/api/cases',{headers})).json() as {domain:string;brief:string}[];assert.equal(cases.length,9);assert.ok(cases.every(c=>c.domain==='finance'));
    const created=await fetch(base+'/api/demo',{method:'POST',headers:{...headers,Origin:base,'Content-Type':'application/json','X-CSRF-Token':h.session.csrf},body:JSON.stringify({domain:'finance'})});assert.equal(created.status,201);
    const p=await created.json() as {id:string;etag:number;brief:string};assert.match(p.brief,/Customer onboarding/);
    const generated=await fetch(`${base}/api/projects/${p.id}/analyse`,{method:'POST',headers:{...headers,Origin:base,'Content-Type':'application/json','X-CSRF-Token':h.session.csrf},body:JSON.stringify({etag:p.etag})});assert.equal(generated.status,202);
    const job=await generated.json() as {jobId:string};
    for(let i=0;i<100;i++){const state=await(await fetch(`${base}/api/projects/${p.id}/jobs/${job.jobId}`,{headers})).json() as {status:string};if(state.status==='completed')break;assert.notEqual(state.status,'failed');await new Promise(resolve=>setTimeout(resolve,20));}
    const ready=await fetch(`${base}/api/projects/${p.id}/readiness`,{headers});assert.equal(ready.status,200);
    const readiness=await ready.json() as {readyForProductionReview:boolean;checks:Record<string,boolean>};assert.equal(readiness.readyForProductionReview,false);assert.equal(readiness.checks.realModelEvidence,false);assert.equal(readiness.checks.tls,false);
    const study=await(await fetch(base+'/api/study',{headers})).json() as {researchEligibleRuns:number};assert.equal(study.researchEligibleRuns,0);
    const bundle=await fetch(`${base}/api/projects/${p.id}/export/zip`,{headers});assert.equal(bundle.status,200);const zip=await JSZip.loadAsync(await bundle.arrayBuffer());assert.ok(zip.file('threat-model.md'));assert.match(await zip.file('report.md')!.async('string'),/Domain: finance/);
    const outsider=await h.user('financial.outsider',['viewer']),foreign={Cookie:`riku_session=${outsider.token}`};
    assert.equal((await fetch(`${base}/api/projects/${p.id}/readiness`,{headers:foreign})).status,404);
    assert.equal((await fetch(`${base}/api/projects/${p.id}/study`,{headers:foreign})).status,404);
  }finally{server.closeAllConnections();await new Promise<void>((resolve,reject)=>server.close(error=>error?reject(error):resolve()));await h.close();}
});

test('authenticated SRS downloads and bundles preserve selected historical versions',async()=>{
  const h=await harness(),server=createServer(createPlatformHandler({store:h.store,root,agents:controlledAgents()}));
  await new Promise<void>(resolve=>server.listen(0,'127.0.0.1',resolve));const address=server.address();assert.ok(address&&typeof address!=='string');
  const base=`http://127.0.0.1:${address.port}`,headers={Cookie:`riku_session=${h.session.token}`};
  try{
    const p=h.projects.create(h.owner,{name:'IEEE SRS download test',brief:fixtureBrief,mode:'demo'});
    const v=await h.projects.analyse(h.owner,p.id,p.etag,controlledAgents());
    const download=(format:string,version?:string)=>fetch(`${base}/api/projects/${p.id}/export/${format}${version?'?version='+version:''}`,{headers});
    assert.equal((await fetch(`${base}/api/projects/${p.id}/export/srs-md`)).status,401);
    const md=await download('srs-md');assert.equal(md.status,200);assert.match(md.headers.get('content-type')!,/text\/markdown/);assert.match(md.headers.get('content-disposition')!,/srs\.md/);
    const original=await md.text();assert.match(original,/## 1\. Introduction/);assert.match(original,/## 3\. Specific requirements/);
    const pdf=await download('srs-pdf');assert.equal(pdf.status,200);assert.match(pdf.headers.get('content-type')!,/application\/pdf/);assert.match(pdf.headers.get('content-disposition')!,/srs\.pdf/);
    assert.ok((await PDFDocument.load(await pdf.arrayBuffer())).getPageCount()>1);
    const zipResponse=await download('zip');assert.equal(zipResponse.status,200);const zip=await JSZip.loadAsync(await zipResponse.arrayBuffer());
    assert.equal(await zip.file('srs.md')!.async('string'),original);assert.ok(zip.file('srs.pdf'));assert.ok(zip.file('report.pdf'));
    const combined=await zip.file('report.md')!.async('string');assert.ok(combined.indexOf('## Recommended SDLC:')<combined.indexOf('# Software Requirements Specification'));
    const updated=structuredClone(v.data.specification.requirements[0]!);updated.businessJustification+=' Changed for a later SRS version.';
    h.projects.editRequirement(h.owner,p.id,h.projects.get(h.owner,p.id).etag,updated.id,updated,'Controlled historical SRS export verification.');
    assert.equal(await (await download('srs-md',v.id)).text(),original);
    assert.match(await (await download('srs-md')).text(),/Changed for a later SRS version/);
  }finally{server.closeAllConnections();await new Promise<void>((resolve,reject)=>server.close(error=>error?reject(error):resolve()));await h.close();}
});
test('annotation metrics use one-to-one matches, preserve unmeasured values and reject duplicate judgments',async()=>{
  const h=await harness();try{
    const p=h.projects.create(h.owner,{name:'Evaluation test',brief:fixtureBrief,mode:'demo'}),v=await h.projects.analyse(h.owner,p.id,p.etag,controlledAgents());
    const input={...annotationTemplate,referenceRequirementIds:['GOLD-001','GOLD-002'],matches:[{extractedId:'FR-001',referenceId:'GOLD-001'}],correctness:[{requirementId:'FR-001',correct:true}],manualDurationMs:1000};
    const result=evaluateAnalysis(v.data,input);assert.equal(result.extraction.recall,.5);assert.equal(result.extraction.falsePositives,14);assert.equal(result.researchEligible,false);assert.equal(result.citationCorrectness,null);assert.equal(result.satisfactionMean,null);assert.ok(result.confidenceBrierScore!==null);
    assert.throws(()=>evaluateAnalysis(v.data,{...input,matches:[...input.matches,{extractedId:'FR-001',referenceId:'GOLD-002'}]}),/unique/);
  }finally{await h.close();}
});
test('HTTP workspace enforces origin, sessions, CSRF and roles, and serves CSP-protected assets',async()=>{
  const directory=await mkdtemp(join(tmpdir(),'riku-http-')),store=await PlatformStore.open(directory,randomBytes(32)),server=createServer(createPlatformHandler({store,root,agents:controlledAgents()}));
  await new Promise<void>(resolve=>server.listen(0,'127.0.0.1',resolve));const address=server.address();assert.ok(address&&typeof address!=='string');const base=`http://127.0.0.1:${address.port}`;
  const post=(path:string,data:unknown,headers:Record<string,string>={})=>fetch(base+path,{method:'POST',headers:{'Content-Type':'application/json',Origin:base,...headers},body:JSON.stringify(data)});
  try{
    const asset=await fetch(base+'/');assert.equal(asset.status,200);assert.match(asset.headers.get('content-security-policy')!,/frame-ancestors 'none'/);assert.equal((await fetch(base+'/app.js')).status,200);
    const wrong=await post('/api/setup/start',{username:'admin',password:'Test-password-123456',tenantName:'HTTP workspace'},{Origin:'https://evil.example'});assert.equal(wrong.status,403);
    assert.equal((await fetch(base+'/api/projects')).status,401);
    const enrollment=await (await post('/api/setup/start',{username:'admin',password:'Test-password-123456',tenantName:'HTTP workspace'})).json() as {enrollmentToken:string;secret:string};
    const enrolled=await post('/api/enroll/finish',{enrollmentToken:enrollment.enrollmentToken,code:otpCode(enrollment.secret)});assert.equal(enrolled.status,200);const cookie=enrolled.headers.get('set-cookie')!.split(';')[0]!,identity=await enrolled.json() as {csrf:string};
    assert.match(enrolled.headers.get('set-cookie')!,/HttpOnly; SameSite=Strict/);
    assert.equal((await post('/api/demo',{}, {Cookie:cookie})).status,403);
    const headers={Cookie:cookie,'X-CSRF-Token':identity.csrf};const created=await post('/api/demo',{},headers);assert.equal(created.status,201);const project=await created.json() as {id:string};
    const exported=await fetch(base+`/api/projects/${project.id}/export/zip`,{headers:{Cookie:cookie}});assert.equal(exported.status,404);
    const details=await fetch(base+`/api/projects/${project.id}`,{headers:{Cookie:cookie}});assert.equal(details.status,200);
    const inviteResponse=await post('/api/users/invite',{username:'viewer',roles:['viewer']},headers);const invite=await inviteResponse.json() as {token:string};
    const start=await (await post('/api/enroll/start',{token:invite.token,password:'Viewer-password-1234'})).json() as {enrollmentToken:string;secret:string};
    const viewerResponse=await post('/api/enroll/finish',{enrollmentToken:start.enrollmentToken,code:otpCode(start.secret)}),viewer=await viewerResponse.json() as {csrf:string},viewerCookie=viewerResponse.headers.get('set-cookie')!.split(';')[0]!;
    assert.equal((await post('/api/users/invite',{username:'malicious',roles:['admin']},{Cookie:viewerCookie,'X-CSRF-Token':viewer.csrf})).status,403);
    assert.equal((await fetch(base+`/api/projects/${project.id}`,{headers:{Cookie:viewerCookie}})).status,404);
  }finally{server.closeAllConnections();await new Promise<void>((resolve,reject)=>server.close(error=>error?reject(error):resolve()));store.close();await cleanup(directory);}
});

test('custom jurisdiction packs are versioned, pending review and invalidate prior input revisions',async()=>{
  const h=await harness();try{
    const legal=(await h.user('policy.reviewer',['legal'])).user,p=h.projects.create(h.owner,{name:'UK requirements test',brief:fixtureBrief,jurisdictions:['UK']});
    const result=h.projects.addKnowledge(legal,{title:'Controlled UK policy reference',publisher:'Test publisher',url:'https://www.legislation.gov.uk/',jurisdiction:'UK',version:'test-1',effectiveDate:'2028-01-01',reviewDue:'2029-01-01',kind:'law',applicability:'Controlled software test applicability; not a real legal source pack.',excerpt:'Test reference covers customer access requests and nothing else.',controlTitle:'Controlled access-request review requirement',keywords:['access request','(a+)+$']});
    assert.equal(h.projects.knowledge(legal).find(k=>k.id===result.source.id)!.reviewedBy,undefined);assert.equal(h.projects.get(h.owner,p.id).revision,p.revision+1);
    const spec=structuredClone(fixtureSpecification);spec.projectContext.jurisdictions=['UK'];
    const matrix=analyseCompliance(spec,'2026-11-18',h.projects.knowledge(legal).map(k=>k.source),h.projects.catalogControls(legal));
    assert.deepEqual(matrix.jurisdictionGaps,[]);assert.equal(matrix.mappings.find(m=>m.controlId===result.control.id)!.temporalStatus,'upcoming');
    h.projects.reviewKnowledge(legal,result.source.id,'Controlled test review establishes mechanics, not legal validity.',result.source.sha256);
    assert.ok(h.projects.knowledge(legal).find(k=>k.id===result.source.id)!.reviewedBy);
  }finally{await h.close();}
});
test('research references require two independent reviewers and cannot be self-adjudicated',async()=>{
  const h=await harness();try{
    const input={caseId:'blind-reference',requirements:[{id:'GOLD-1',statement:'The storefront shall display visible products.'}],ambiguities:[],conflicts:[],acceptableLifecycles:['Agile'],notes:'Controlled test reference, authored before the inference step.'};
    const reference=createDataset(h.store,h.owner,'project-test','input-hash',true,input);
    assert.equal(datasetFrozen(reference),false);
    const ownerWithRole={...h.owner,roles:['architect'] as Role[]};assert.throws(()=>voteDataset(h.store,ownerWithRole,'project-test',reference.id,'approve','Controlled self-approval attempt should fail.'),/cannot adjudicate/);
    const architect=(await h.user('gold.architect',['architect'])).user,product=(await h.user('gold.product',['product_owner'])).user;
    assert.equal(datasetFrozen(voteDataset(h.store,architect,'project-test',reference.id,'approve','Controlled independent architecture reference review.')),false);
    assert.equal(datasetFrozen(voteDataset(h.store,product,'project-test',reference.id,'approve','Controlled independent product reference review.')),true);
    const frozen=h.store.get<typeof reference>(h.owner.tenantId,'datasets',reference.id)!;
    assert.equal(referenceFrozenBefore(frozen,'2020-01-01T00:00:00Z'),false);
    assert.equal(referenceFrozenBefore(frozen,'2099-01-01T00:00:00Z'),true);
  }finally{await h.close();}
});
test('retention preserves legal holds, purges project data and maintains signed audit checkpoints',async()=>{
  const h=await harness();try{
    const p=h.projects.create(h.owner,{name:'Retention test',brief:fixtureBrief,mode:'demo'});await h.projects.analyse(h.owner,p.id,p.etag,controlledAgents());
    let current=h.projects.get(h.owner,p.id);h.projects.retention(h.owner,p.id,current.etag,1,true,'Controlled legal hold for the retention test.');current=h.projects.get(h.owner,p.id);current.expiresAt=Date.now()-1000;h.store.put(h.owner.tenantId,'projects',p.id,current);
    assert.equal(h.projects.sweep(h.owner).deleted,0);
    current.legalHold=false;h.store.put(h.owner.tenantId,'projects',p.id,current);assert.equal(h.projects.sweep(h.owner).deleted,1);
    assert.equal((h.store.db.prepare('SELECT count(*) AS count FROM requirements WHERE project=?').get(p.id) as {count:number}).count,0);
    assert.equal(h.store.get(h.owner.tenantId,'projects',p.id),undefined);
    h.store.transaction(()=>h.store.pruneAudit(h.owner.tenantId,new Date(Date.now()+10_000).toISOString()));assert.ok(h.store.verifyAudit(h.owner.tenantId).valid);
    h.store.audit(h.owner.tenantId,h.owner.id,'test.after-prune','subject');assert.ok(h.store.verifyAudit(h.owner.tenantId).valid);assert.equal(h.store.auditEntries(h.owner.tenantId).length,1);
  }finally{await h.close();}
});
test('semantic review rejects invented supporting quotations and retains failed-call traces',async()=>{
  const h=await harness();try{
    const p=h.projects.create(h.owner,{name:'Citation support test',brief:fixtureBrief}),agents=controlledAgents();
    agents.quality=async()=>({issues:[],citations:[{requirementId:'NFR-006',evidenceId:'docs/ingested/ecommerce/security-evidence.md',verdict:'supported',supportingQuote:'An invented quotation not in any retrieved source.',explanation:'Controlled negative test.'}]});
    await assert.rejects(h.projects.analyse(h.owner,p.id,p.etag,agents),/quote does not occur/);
    assert.equal(h.projects.get(h.owner,p.id).status,'failed');assert.equal(h.projects.get(h.owner,p.id).versions.length,0);assert.ok(h.store.list(h.owner.tenantId,'agent-traces').length>0);
  }finally{await h.close();}
});
test('semantic retrieval caches encrypted vectors per tenant/project and validates cosine dimensions',async()=>{
  const h=await harness();let calls=0;
  const server=createServer(async(req,res)=>{let input='';for await(const chunk of req)input+=chunk;const parsed=JSON.parse(input) as {input:string};calls++;res.writeHead(200,{'Content-Type':'application/json'});res.end(JSON.stringify({data:[{embedding:/payment|refund/i.test(parsed.input)?[1,0]:[0,1]}]}));});
  await new Promise<void>(resolve=>server.listen(0,'127.0.0.1',resolve));const address=server.address();assert.ok(address&&typeof address!=='string');
  try{
    const settings={model:'controlled-embedding-test',baseURL:`http://127.0.0.1:${address.port}/v1`,apiKey:'test'};
    const first=await hybridRetrieve(root,'payment retry',[],h.store,h.owner.tenantId,settings,'project-one');assert.equal(first.mode,'hybrid-bm25-cosine');const originalCalls=calls;
    await hybridRetrieve(root,'payment retry',[],h.store,h.owner.tenantId,settings,'project-one');assert.equal(calls,originalCalls);
    await hybridRetrieve(root,'payment retry',[],h.store,'different-tenant',settings,'project-one');assert.ok(calls>originalCalls);
    assert.equal(cosine([1,0],[1,0]),1);assert.throws(()=>cosine([1],[1,2]),/dimensions/);
  }finally{server.closeAllConnections();await new Promise<void>((resolve,reject)=>server.close(error=>error?reject(error):resolve()));await h.close();}
});

test('classified sensitive sources stay out of model prompts until security review',async()=>{
  const h=await harness();try{
    const security=(await h.user('source.security',['security'])).user,p=h.projects.create(h.owner,{name:'Source protection test',brief:fixtureBrief,mode:'demo'});h.projects.addMember(h.owner,p.id,p.etag,security.id);
    let current=h.projects.get(h.owner,p.id);const source=h.projects.addSource(h.owner,p.id,current.etag,{name:'Sensitive source',kind:'incident',stakeholder:'Operations lead',classification:'sensitive',content:'RESTRICTED_TEST_MARKER describes an incident requiring a security review.'});
    const prompts:string[]=[],agents=controlledAgents(),original=agents.requirements;agents.requirements=async prompt=>{prompts.push(prompt);return original(prompt);};
    current=h.projects.get(h.owner,p.id);await h.projects.analyse(h.owner,p.id,current.etag,agents);assert.ok(!prompts[0]!.includes('RESTRICTED_TEST_MARKER'));assert.ok(h.projects.blockers(h.owner,p.id).some(b=>b.includes('Source review required')));
    current=h.projects.get(h.owner,p.id);h.projects.reviewSource(security,p.id,current.etag,source.id,'Controlled security review confirms the source has been sanitised for processing.');current=h.projects.get(h.owner,p.id);await h.projects.analyse(h.owner,p.id,current.etag,agents);assert.ok(prompts[1]!.includes('RESTRICTED_TEST_MARKER'));
  }finally{await h.close();}
});
