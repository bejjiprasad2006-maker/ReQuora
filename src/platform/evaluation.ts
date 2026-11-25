import { z } from 'zod';
import { models } from '../domain/schemas';
import type { Analysis } from '../domain/report';
import { projectProfile } from '../domain/profile';

export const annotationSchema=z.object({
  caseId:z.string().min(2),provenance:z.enum(['authored-test','human-reviewed']),reviewerNotes:z.string().min(20),group:z.string().max(80).optional(),
  referenceDatasetId:z.string().optional(),
  referenceRequirementIds:z.array(z.string()).min(1),
  matches:z.array(z.object({extractedId:z.string(),referenceId:z.string()})),
  expectedAmbiguities:z.array(z.string()),detectedAmbiguities:z.array(z.string()),
  expectedConflicts:z.array(z.string()),detectedConflicts:z.array(z.string()),
  acceptableLifecycles:z.array(z.enum(models)).min(1),
  citations:z.array(z.object({requirementId:z.string(),evidenceId:z.string(),supported:z.boolean()})),
  claims:z.array(z.object({id:z.string(),supported:z.boolean()})),
  correctness:z.array(z.object({requirementId:z.string(),correct:z.boolean()})),
  correctedRequirementIds:z.array(z.string()),manualDurationMs:z.number().positive().optional(),
  satisfaction:z.array(z.number().min(1).max(5)),
  consistency:z.array(z.object({requirementId:z.string(),consistent:z.boolean()})).optional(),
  controls:z.array(z.object({controlId:z.string(),applicable:z.boolean(),covered:z.boolean(),requirementIds:z.array(z.string())})).optional(),
  traceability:z.array(z.object({requirementId:z.string(),sourceVerified:z.boolean(),criteriaVerified:z.boolean(),phaseVerified:z.boolean()})).optional(),
});
export type Annotation=z.infer<typeof annotationSchema>;
const fraction=(a:number,b:number)=>b?Math.round(a/b*10000)/10000:null;
const unique=(ids:string[],name:string)=>{if(new Set(ids).size!==ids.length)throw new Error(`${name} must be unique.`);};
const detection=(expected:string[],detected:string[])=>{
  unique(expected,'Reference labels');unique(detected,'Detected labels');const expectedSet=new Set(expected),tp=detected.filter(id=>expectedSet.has(id)).length;
  const precision=fraction(tp,detected.length),recall=fraction(tp,expected.length);
  return {truePositives:tp,falsePositives:detected.length-tp,falseNegatives:expected.length-tp,precision,recall,f1:precision!==null&&recall!==null&&precision+recall?2*precision*recall/(precision+recall):precision===0||recall===0?0:null};
};
export const evaluateAnalysis=(data:Analysis,input:unknown,context:{humanReferenceVerified?:boolean;referenceFrozenBeforeInference?:boolean}={})=>{
  const annotation=annotationSchema.parse(input),extracted=data.specification.requirements.map(req=>req.id),ids=new Set(extracted),reference=new Set(annotation.referenceRequirementIds);
  unique(annotation.referenceRequirementIds,'Reference requirements');unique(annotation.matches.map(m=>m.extractedId),'Matched extracted IDs');unique(annotation.matches.map(m=>m.referenceId),'Matched reference IDs');
  for(const match of annotation.matches)if(!ids.has(match.extractedId)||!reference.has(match.referenceId))throw new Error('Match references an unknown requirement.');
  for(const id of [...annotation.correctness.map(item=>item.requirementId),...annotation.correctedRequirementIds])if(!ids.has(id))throw new Error('Judgment references an unknown extracted requirement.');
  unique(annotation.correctness.map(item=>item.requirementId),'Correctness judgments');unique(annotation.correctedRequirementIds,'Corrected requirement IDs');
  const pairs=new Set(data.specification.requirements.flatMap(req=>req.evidence.map(source=>`${req.id}|${source}`)));
  unique(annotation.citations.map(item=>`${item.requirementId}|${item.evidenceId}`),'Citation judgments');unique(annotation.claims.map(item=>item.id),'Claim judgments');
  for(const item of annotation.citations)if(!pairs.has(`${item.requirementId}|${item.evidenceId}`))throw new Error('Citation judgment references an unknown citation.');
  const consistency=annotation.consistency??[],controlJudgments=annotation.controls??[],traceJudgments=annotation.traceability??[];
  unique(consistency.map(item=>item.requirementId),'Consistency judgments');unique(controlJudgments.map(item=>item.controlId),'Control judgments');unique(traceJudgments.map(item=>item.requirementId),'Traceability judgments');
  for(const item of [...consistency,...traceJudgments])if(!ids.has(item.requirementId))throw new Error('Quality judgment references an unknown requirement.');
  for(const item of controlJudgments){
    if(!data.compliance?.mappings.some(mapping=>mapping.controlId===item.controlId))throw new Error('Control judgment references an unknown control.');
    unique(item.requirementIds,'Control requirement links');
    if(item.requirementIds.some(id=>!ids.has(id))||item.covered&&(!item.applicable||!item.requirementIds.length))throw new Error('Covered controls require applicable scope and valid requirement links.');
  }
  const applicableControls=controlJudgments.filter(item=>item.applicable),phaseIds=new Set(data.sdlcPlan.phases.flatMap(phase=>phase.requirementIds));
  const tp=annotation.matches.length,precision=fraction(tp,extracted.length),recall=fraction(tp,reference.size);
  const brier=annotation.correctness.length?annotation.correctness.reduce((sum,item)=>{const confidence=data.specification.requirements.find(req=>req.id===item.requirementId)!.confidence;return sum+(confidence-(item.correct?1:0))**2;},0)/annotation.correctness.length:null;
  const calibration=[0,.2,.4,.6,.8].map(low=>{
    const items=annotation.correctness.filter(item=>{const c=data.specification.requirements.find(req=>req.id===item.requirementId)!.confidence;return c>=low&&(low===.8?c<=1:c<low+.2);});
    return {range:[low,Math.round((low+.2)*10)/10],count:items.length,observedAccuracy:fraction(items.filter(item=>item.correct).length,items.length)};
  });
  return {caseId:annotation.caseId,provenance:annotation.provenance,mode:data.mode,inferenceKind:data.inferenceKind??'unverified',profile:projectProfile(data.specification.projectContext),researchEligible:data.mode==='live'&&data.inferenceKind==='model-inference'&&annotation.provenance==='human-reviewed'&&Boolean(context.humanReferenceVerified)&&Boolean(context.referenceFrozenBeforeInference),
    extraction:{truePositives:tp,falsePositives:extracted.length-tp,falseNegatives:reference.size-tp,precision,recall,f1:precision!==null&&recall!==null&&precision+recall?2*precision*recall/(precision+recall):0},
    ambiguity:detection(annotation.expectedAmbiguities,annotation.detectedAmbiguities),conflicts:detection(annotation.expectedConflicts,annotation.detectedConflicts),
    citationCorrectness:fraction(annotation.citations.filter(item=>item.supported).length,annotation.citations.length),citationJudgmentCoverage:fraction(annotation.citations.length,pairs.size),
    unsupportedClaimRate:fraction(annotation.claims.filter(item=>!item.supported).length,annotation.claims.length),
    requirementCorrectness:fraction(annotation.correctness.filter(item=>item.correct).length,annotation.correctness.length),
    referenceCompleteness:recall,
    requirementConsistency:fraction(consistency.filter(item=>item.consistent).length,consistency.length),
    consistencyJudgmentCoverage:fraction(consistency.length,extracted.length),
    regulatoryControlCoverage:fraction(applicableControls.filter(item=>item.covered).length,applicableControls.length),
    controlJudgmentCoverage:fraction(controlJudgments.length,data.compliance?.mappings.length??0),
    verifiedTraceabilityCoverage:traceJudgments.length?fraction(traceJudgments.filter(item=>item.sourceVerified&&item.criteriaVerified&&item.phaseVerified).length,extracted.length):null,
    traceabilityJudgmentCoverage:fraction(traceJudgments.length,extracted.length),
    structuralTraceability:{source:fraction(data.specification.requirements.filter(r=>r.source.reference.length>0).length,extracted.length),criteria:fraction(data.specification.requirements.filter(r=>r.acceptanceCriteria.length>0).length,extracted.length),deliveryPhase:fraction(extracted.filter(id=>phaseIds.has(id)).length,extracted.length)},
    correctionRate:fraction(annotation.correctedRequirementIds.length,extracted.length),
    expertLifecycleAgreement:annotation.acceptableLifecycles.includes(data.sdlcPlan.selectedModel),
    processingMs:data.elapsedMs,manualDurationMs:annotation.manualDurationMs??null,timeSavedMs:annotation.manualDurationMs?annotation.manualDurationMs-data.elapsedMs:null,
    satisfactionMean:annotation.satisfaction.length?annotation.satisfaction.reduce((sum,value)=>sum+value,0)/annotation.satisfaction.length:null,
    confidenceBrierScore:brier,calibration,group:annotation.group??null,
    limitations:['Scores depend on supplied reviewer annotations, not automatic proof of correctness.','Null means not measured. Authored fixtures are excluded from empirical model-effectiveness claims.','Lifecycle agreement permits multiple acceptable expert choices.'],
  };
};
export const annotationTemplate={caseId:'replace-with-case-id',provenance:'authored-test',reviewerNotes:'Replace with the annotation method and adjudication notes.',referenceRequirementIds:['GOLD-001'],matches:[],expectedAmbiguities:[],detectedAmbiguities:[],expectedConflicts:[],detectedConflicts:[],acceptableLifecycles:['Agile + DevSecOps'],citations:[],claims:[],correctness:[],correctedRequirementIds:[],satisfaction:[],consistency:[],controls:[],traceability:[]};

type EvaluationResult=ReturnType<typeof evaluateAnalysis>;
export type EvaluationRecord={id:string;projectId:string;versionId:string;at:string;result:EvaluationResult};
export const summariseStudy=(records:EvaluationRecord[])=>{
  // A corrected annotation supersedes the same case/version; repeated model versions remain distinct runs.
  const latest=new Map<string,EvaluationRecord>();
  for(const record of [...records].sort((a,b)=>a.at.localeCompare(b.at)))latest.set(`${record.projectId}:${record.versionId}:${record.result.caseId}`,record);
  const all=[...latest.values()],eligible=all.filter(item=>item.result.researchEligible&&item.result.inferenceKind==='model-inference'),results=eligible.map(item=>item.result);
  const mean=(values:(number|null|undefined)[])=>{const measured=values.filter((value):value is number=>typeof value==='number'&&Number.isFinite(value));return {n:measured.length,mean:measured.length?measured.reduce((a,b)=>a+b,0)/measured.length:null};};
  return {recordCount:records.length,distinctRuns:all.length,researchEligibleRuns:eligible.length,excludedRuns:all.length-eligible.length,caseCount:new Set(results.map(r=>r.caseId)).size,projects:new Set(eligible.map(r=>r.projectId)).size,
    metrics:{extractionF1:mean(results.map(r=>r.extraction.f1)),completeness:mean(results.map(r=>r.referenceCompleteness)),correctness:mean(results.map(r=>r.requirementCorrectness)),consistency:mean(results.map(r=>r.requirementConsistency)),controlCoverage:mean(results.map(r=>r.regulatoryControlCoverage)),traceability:mean(results.map(r=>r.verifiedTraceabilityCoverage)),unsupportedClaims:mean(results.map(r=>r.unsupportedClaimRate)),timeSavedMs:mean(results.map(r=>r.timeSavedMs)),satisfaction:mean(results.map(r=>r.satisfactionMean)),lifecycleAgreement:mean(results.map(r=>r.expertLifecycleAgreement?1:0))},
    groups:[...new Set(results.map(r=>r.group??r.profile.useCase))].map(group=>({group,runs:results.filter(r=>(r.group??r.profile.useCase)===group).length})),
    limitations:['Only independently adjudicated, pre-inference reference datasets and declared real model runs enter these means.','Repeated runs may be correlated; these descriptive means are not confidence intervals or causal evidence.','Null means no eligible measured observations. Reviewer judgments and operating conditions must be reported with results.']};
};
