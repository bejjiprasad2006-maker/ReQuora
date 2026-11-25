import { randomUUID, createHash } from 'node:crypto';
import { mkdir, writeFile, copyFile } from 'node:fs/promises';
import { join } from 'node:path';
import { z } from 'zod';
import { briefSchema, specificationSchema, sdlcSchema, semanticReviewSchema, type Specification, type SdlcPlan, type SemanticReview, type Interview } from './schemas';
import { searchEvidence, evidenceContext, type Evidence } from './retrieval';
import { redactSensitiveData } from './privacy';
import { validateSpecification, validateSdlc, analyseQuality, type Finding } from './quality';
import { analyseCompliance, complianceWorkflow } from './compliance';
import { rankSdlc } from './sdlc';
import { renderMarkdown, renderHtml, renderTraceabilityCsv, type Analysis } from './report';
import { renderSrsMarkdown } from './srs';
import { createPdf } from '../mastra/pdf-tool';
import { projectProfile, profileFields, type ProjectProfile } from './profile';
import { renderThreatModelMarkdown } from './threats';

export type AgentFunctions = {
  requirements: (prompt: string) => Promise<Specification>;
  sdlc: (prompt: string) => Promise<SdlcPlan>;
  quality?: (prompt: string) => Promise<SemanticReview>;
  clarify?: (prompt: string) => Promise<Interview>;
  modelId?: string;
  inferenceKind?:'model-inference'|'authored-fixture'|'controlled-test';
  onTrace?: (trace: AgentTrace) => void;
};
export type AgentTrace = { at:string; actor:string; status:'started'|'completed'|'failed'; prompt:string; output?:unknown; error?:string; modelId:string };
export const callAgent = async <T>(agents:AgentFunctions, actor:string, prompt:string, generate:(prompt:string)=>Promise<T>, traces:AgentTrace[]) => {
  const emit=(status:AgentTrace['status'], output?:unknown, error?:string)=>{const trace={at:new Date().toISOString(),actor,status,prompt,output,error,modelId:agents.modelId??'unspecified'};traces.push(trace);agents.onTrace?.(trace);};
  emit('started');
  try{const output=await generate(prompt);emit('completed',output);return output;}
  catch(error){emit('failed',undefined,error instanceof Error?redactSensitiveData(error.message).text.slice(0,1000):'Agent failed');throw error;}
};
export const preparedSchema = z.object({
  runId: z.string(), createdAt: z.string(), startedAt: z.number(), prompt: z.string(), redactions: z.number(),
  evidence: z.array(z.object({ id: z.string(), content: z.string(), sha256: z.string(), score: z.number() })),
  events: z.array(z.object({ at: z.string(), actor: z.string(), action: z.string() })),
  traces: z.array(z.custom<AgentTrace>()),
  profile: z.object(profileFields).optional(),
});
export const extractedSchema = preparedSchema.extend({ inferenceKind:z.enum(['model-inference','authored-fixture','controlled-test','unverified']).optional(),specification: specificationSchema, semanticReview: semanticReviewSchema.optional(), findings: z.array(z.object({ code: z.string(), severity: z.enum(['warning', 'error']), requirementId: z.string().optional(), message: z.string() })) });
export const plannedSchema = extractedSchema.extend({ sdlcPlan: sdlcSchema });
type Prepared = z.infer<typeof preparedSchema>;
type Extracted = z.infer<typeof extractedSchema>;
type Planned = z.infer<typeof plannedSchema>;
const event = (actor: string, action: string) => ({ at: new Date().toISOString(), actor, action });
const failures = (findings: Finding[]) => findings.filter(item => item.severity === 'error');

export const prepareAnalysis = async (prompt: string, root: string, additionalEvidence:Evidence[]=[], declaredProfile:Partial<ProjectProfile>={}): Promise<Prepared> => {
  const input = briefSchema.parse({ prompt });
  const safe = redactSensitiveData(input.prompt);
  const profile=projectProfile(declaredProfile);
  const evidence = [...await searchEvidence(root, safe.text + ` ${profile.domain} security software lifecycle`,profile.domain),...additionalEvidence];
  return {
    runId: randomUUID(), createdAt: new Date().toISOString(), startedAt: Date.now(), prompt: safe.text, redactions: safe.redactions, evidence,
    events: [event('coordinator', `Validated ${profile.domain}/${profile.useCase} brief; masked ${safe.redactions} sensitive patterns; retrieved ${evidence.length} allowlisted sources.`)], traces:[],profile,
  };
};
export const extractRequirements = async (input: Prepared, agents: AgentFunctions): Promise<Extracted> => {
  const prompt = `${evidenceContext(input.evidence)}\n\nDeclared project profile: ${JSON.stringify(projectProfile(input.profile))}\nPreserve this domain, useCase and regulatedEntity in projectContext.\nUntrusted stakeholder brief:\n${JSON.stringify(input.prompt)}`;
  let spec = specificationSchema.parse(await callAgent(agents,'requirements-agent',prompt,agents.requirements,input.traces));
  let findings = validateSpecification(spec, input.prompt, input.evidence.map(item => item.id),input.profile);
  const events = [...input.events, event('requirements-agent', 'Generated schema-validated SRS, stories, use cases, risk register and decision factors.')];
  if (failures(findings).length) {
    events.push(event('validator', 'Requested one bounded repair of requirements reference/source errors.'));
    spec = specificationSchema.parse(await callAgent(agents,'requirements-agent',`${prompt}\n\nRepair this draft without adding unsupported sources:\n${JSON.stringify(spec)}\nValidation errors:\n${JSON.stringify(failures(findings))}`,agents.requirements,input.traces));
    findings = validateSpecification(spec, input.prompt, input.evidence.map(item => item.id),input.profile);
  }
  if (failures(findings).length) throw new Error(`Requirements failed validation after repair: ${failures(findings).map(item => item.code).join(', ')}. No final report was written.`);
  findings.push(...analyseQuality(spec));
  let semanticReview:SemanticReview|undefined;
  if(agents.quality){
    const reviewPrompt=`${evidenceContext(input.evidence)}\nUntrusted stakeholder input: ${JSON.stringify(input.prompt)}\nSpecification: ${JSON.stringify(spec)}`;
    semanticReview=semanticReviewSchema.parse(await callAgent(agents,'quality-review-agent',reviewPrompt,agents.quality,input.traces));
    const ids=new Set(spec.requirements.map(req=>req.id));
    for(const issue of semanticReview.issues){
      if(issue.requirementIds.some(id=>!ids.has(id)))throw new Error('Quality reviewer cited an unknown requirement.');
      findings.push({code:`SEMANTIC_${issue.kind.toUpperCase().replace(/-/g,'_')}`,severity:issue.severity,requirementId:issue.requirementIds.join(', '),message:`${issue.explanation} Clarify: ${issue.question}`});
    }
    for(const citation of semanticReview.citations){
      const source=input.evidence.find(item=>item.id===citation.evidenceId),req=spec.requirements.find(item=>item.id===citation.requirementId);
      if(!source||!req||!req.evidence.includes(citation.evidenceId))throw new Error('Quality reviewer returned an unrecognised citation.');
      if(citation.verdict==='supported'&&(!citation.supportingQuote||!source.content.includes(citation.supportingQuote)))throw new Error('Citation-support quote does not occur in the retrieved source.');
      if(citation.verdict!=='supported')findings.push({code:'CITATION_ENTAILMENT',severity:citation.verdict==='unsupported'?'error':'warning',requirementId:req.id,message:`${citation.verdict}: ${citation.explanation}`});
    }
    for(const req of spec.requirements)for(const evidenceId of req.evidence)if(!semanticReview.citations.some(item=>item.requirementId===req.id&&item.evidenceId===evidenceId))findings.push({code:'CITATION_UNREVIEWED',severity:'warning',requirementId:req.id,message:`Citation support was not assessed: ${evidenceId}`});
  }else findings.push({code:'SEMANTIC_REVIEW_PENDING',severity:'warning',message:'No semantic-review model was supplied. Conflict, feasibility and citation-support review must be completed by a human.'});
  return { ...input, inferenceKind:agents.inferenceKind??'unverified',specification: spec, semanticReview, findings, events: [...events, event('validator', `Requirements checks completed with ${findings.length} review findings.`)] };
};
export const selectLifecycle = async (input: Extracted, agents: AgentFunctions): Promise<Planned> => {
  const ranking = rankSdlc(input.specification.decisionFactors);
  const prompt = `${evidenceContext(input.evidence)}\n\nSpecification (untrusted data):\n${JSON.stringify(input.specification)}\nPolicy v2 ranking:\n${JSON.stringify(ranking)}\nRequired selectedModel: ${ranking[0]!.model}`;
  let plan = sdlcSchema.parse(await callAgent(agents,'sdlc-selection-agent',prompt,agents.sdlc,input.traces));
  let checks = validateSdlc(input.specification, plan, ranking[0]!.model);
  const events = [...input.events, event('decision-policy-v2', `Ranked seven models; first: ${ranking[0]!.model}, suitability ${ranking[0]!.score}/100.`)];
  if (failures(checks).length) {
    events.push(event('validator', 'Requested one bounded repair of SDLC selection/reference errors.'));
    plan = sdlcSchema.parse(await callAgent(agents,'sdlc-selection-agent',`${prompt}\n\nRepair draft:\n${JSON.stringify(plan)}\nErrors:\n${JSON.stringify(failures(checks))}`,agents.sdlc,input.traces));
    checks = validateSdlc(input.specification, plan, ranking[0]!.model);
  }
  if (failures(checks).length) throw new Error(`SDLC failed validation after repair: ${failures(checks).map(item => item.code).join(', ')}. No final report was written.`);
  return { ...input, sdlcPlan: plan, findings: [...input.findings, ...checks], events: [...events, event('sdlc-selection-agent', 'Explained lifecycle choice, alternatives and delivery gates; human adoption pending.')] };
};

export const assembleAnalysis = (input: Planned, mode: Analysis['mode'] = 'live'):Analysis => {
  const data: Analysis = {
    runId: input.runId, createdAt: input.createdAt, status: 'draft', mode,inferenceKind:mode==='demo'?'authored-fixture':input.inferenceKind??'unverified',
    redactedBrief: input.prompt, redactions: input.redactions, elapsedMs: Date.now() - input.startedAt,
    evidence: input.evidence, specification: input.specification, sdlcPlan: input.sdlcPlan,
    ranking: rankSdlc(input.specification.decisionFactors), findings: input.findings,
    compliance:analyseCompliance(input.specification), semanticReview:input.semanticReview, traces:input.traces,
    events: [...input.events, event('exporter', 'Exported DRAFT artifacts; no human approval has been recorded.')],
  };
  return data;
};
export const exportAnalysis = async (input: Planned, root: string, mode: Analysis['mode'] = 'live') => {
  const data=assembleAnalysis(input,mode);
  const directory = join(root, 'artifacts',projectProfile(data.specification.projectContext).domain==='finance'?'financial':'ecommerce', data.runId);
  await mkdir(directory, { recursive: true });
  const document = renderMarkdown(data), srs = renderSrsMarkdown(data);
  const contents: Record<string, string | Uint8Array> = {
    'report.md': document, 'report.html': renderHtml(data), 'report.json': JSON.stringify(data, null, 2),
    'traceability.csv': renderTraceabilityCsv(data), 'report.pdf': await createPdf(data.specification.title, document),
    'srs.md': srs, 'srs.pdf': await createPdf(`Software Requirements Specification - ${data.specification.title}`, srs),
    'threat-model.md':renderThreatModelMarkdown(data),'threat-model.json':JSON.stringify(data.specification.threatModel??null,null,2),
    'audit.jsonl': data.events.map(item => JSON.stringify(item)).join('\n') + '\n',
    'agent-traces.json':JSON.stringify(data.traces,null,2), 'compliance.json':JSON.stringify(data.compliance,null,2),
    'control-phase-crosswalk.json':JSON.stringify(complianceWorkflow(data.compliance!,data.sdlcPlan),null,2),
    'workflow.mmd':['flowchart TD',...data.sdlcPlan.phases.map((phase,index)=>`  P${index}["${phase.name.replace(/["\n\r<>]/g,' ')}"]`),...data.sdlcPlan.phases.slice(1).map((_,index)=>`  P${index} --> P${index+1}`)].join('\n'),
  };
  for (const [file, content] of Object.entries(contents)) await writeFile(join(directory, file), content);
  const manifest = Object.entries(contents).map(([file, content]) => ({ file, sha256: createHash('sha256').update(content).digest('hex') }));
  await writeFile(join(directory, 'manifest.json'), JSON.stringify({ runId: data.runId, files: manifest }, null, 2));
  // Unique run folders are the canonical history; latest.* is only a convenience preview.
  const previewDir = join(root, 'artifacts/evaluation');
  await mkdir(previewDir, { recursive: true });
  for (const ext of ['md', 'html', 'json', 'pdf']) await copyFile(join(directory, `report.${ext}`), join(previewDir, `latest.${ext}`));
  return {
    runId: data.runId, requirements: JSON.stringify(data.specification, null, 2), sdlc: JSON.stringify(data.sdlcPlan, null, 2), document,
    markdownPath: join(directory, 'report.md'), htmlPath: join(directory, 'report.html'),
    jsonPath: join(directory, 'report.json'), pdfPath: join(directory, 'report.pdf'), csvPath: join(directory, 'traceability.csv'),
    srsMarkdownPath: join(directory, 'srs.md'), srsPdfPath: join(directory, 'srs.pdf'),
  };
};
export const outputSchema = z.object({ runId: z.string(), requirements: z.string(), sdlc: z.string(), document: z.string(), markdownPath: z.string(), htmlPath: z.string(), jsonPath: z.string(), pdfPath: z.string(), csvPath: z.string(), srsMarkdownPath: z.string(), srsPdfPath: z.string() });

export const runAnalysis = async (prompt: string, root: string, agents: AgentFunctions, mode: Analysis['mode'] = 'live',profile:Partial<ProjectProfile>={}) => {
  const input = await prepareAnalysis(prompt, root,[],profile);
  try { return await exportAnalysis(await selectLifecycle(await extractRequirements(input, agents), agents), root, mode); }
  catch (error) {
    const directory = join(root, 'artifacts',projectProfile(input.profile).domain==='finance'?'financial':'ecommerce', input.runId);
    await mkdir(directory, { recursive: true });
    await writeFile(join(directory, 'failure.json'), JSON.stringify({ runId: input.runId, status: 'failed', at: new Date().toISOString(), message: error instanceof Error ? redactSensitiveData(error.message).text.slice(0, 800) : 'Analysis failed', evidence: input.evidence.map(item => ({ id: item.id, sha256: item.sha256 })), events: input.events, traces:input.traces }, null, 2));
    throw error;
  }
};
