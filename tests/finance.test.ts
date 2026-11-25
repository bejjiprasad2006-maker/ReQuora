import test from 'node:test';
import assert from 'node:assert/strict';
import { resolve } from 'node:path';
import { financialCases } from '../src/domain/cases';
import { financialDemo } from '../src/demo/financial';
import { fixtureSpecification, fixtureBrief } from '../src/demo/fixture';
import { projectProfile } from '../src/domain/profile';
import { generatedSpecificationSchema } from '../src/domain/schemas';
import { validateSpecification, validateSdlc } from '../src/domain/quality';
import { analyseCompliance } from '../src/domain/compliance';
import { searchEvidence } from '../src/domain/retrieval';
import { redactSensitiveData } from '../src/domain/privacy';
import { initialQuestions } from '../src/platform/interviews';
import { annotationTemplate, evaluateAnalysis, summariseStudy } from '../src/platform/evaluation';
import type { Analysis } from '../src/domain/report';
import { rankSdlc } from '../src/domain/sdlc';
import { renderThreatModelMarkdown } from '../src/domain/threats';

const root=resolve('.');
const data=():Analysis=>{const demo=financialDemo();return {runId:'financial-test',createdAt:'2026-11-19T00:00:00Z',mode:'live',inferenceKind:'controlled-test',status:'draft',redactedBrief:demo.brief,redactions:0,elapsedMs:200,specification:demo.specification,sdlcPlan:demo.plan,ranking:rankSdlc(demo.specification.decisionFactors),findings:[],evidence:[],events:[],compliance:analyseCompliance(demo.specification)};};

test('financial cases validate without merchant module requirements and preserve explicit scope',()=>{
  assert.equal(financialCases.length,9);
  for(const item of financialCases){
    const profile=projectProfile({domain:'finance',useCase:item.useCase,regulatedEntity:item.entity}),demo=financialDemo(profile,['India']);
    assert.equal(generatedSpecificationSchema.safeParse(demo.specification).success,true,item.id);
    const findings=validateSpecification(demo.specification,demo.brief,[],profile);
    assert.deepEqual(findings.filter(f=>f.severity==='error'),[],item.id);
    assert.ok(!findings.some(f=>f.code==='MODULE_GAP'));
    assert.deepEqual(validateSdlc(demo.specification,demo.plan,rankSdlc(demo.specification.decisionFactors)[0]!.model).filter(f=>f.severity==='error'),[]);
  }
  assert.throws(()=>projectProfile({domain:'finance',useCase:'storefront'}),/financial use case/);
  assert.throws(()=>projectProfile({domain:'ecommerce',regulatedEntity:'commercial-bank'}),/finance domain/);
  const demo=financialDemo();assert.ok(validateSpecification(demo.specification,demo.brief,[],{domain:'ecommerce'}).some(f=>f.code==='PROJECT_PROFILE_MISMATCH'));
});

test('financial retrieval and interview templates remain separate from merchant and legacy sources',async()=>{
  const hits=await searchEvidence(root,'financial KYC loan banking security lifecycle','finance');
  assert.ok(hits.length>0);assert.ok(hits.every(h=>h.id.startsWith('docs/ingested/financial/')));
  assert.ok(!hits.some(h=>h.id.startsWith('docs/ingested/finance/')));
  const finance=initialQuestions({domain:'finance'}),merchant=initialQuestions();
  assert.ok(finance.some(q=>q.topic==='financial-compliance'));assert.ok(finance.some(q=>q.topic==='threats'));assert.ok(!finance.some(q=>q.topic==='returns'));
  assert.ok(merchant.some(q=>q.topic==='returns'));
});

test('regulatory candidates follow entity, jurisdiction and service scope; none establish compliance',()=>{
  const bank=financialDemo({domain:'finance',useCase:'loan-processing',regulatedEntity:'commercial-bank'},['India']).specification;
  let result=analyseCompliance(bank,'2026-11-19');
  assert.ok(result.mappings.some(m=>m.controlId==='IND-BANK-KYC'));assert.ok(result.mappings.some(m=>m.controlId==='IND-BANK-CREDIT'));
  assert.ok(!result.mappings.some(m=>['IND-NBFC-KYC','IND-ECOMMERCE','POL-RETURNS'].includes(m.controlId)));
  assert.ok(result.sources.some(s=>s.id==='SRC-RBI-BANK-KYC'&&s.url.includes('13141')));
  bank.projectContext.regulatedEntity='unknown';result=analyseCompliance(bank);
  assert.equal(result.mappings.find(m=>m.controlId==='IND-BANK-KYC')!.status,'scope-review');assert.ok(result.jurisdictionGaps.some(g=>/operating entity/.test(g)));
  const insurer=financialDemo({domain:'finance',useCase:'insurance',regulatedEntity:'insurer'},['India']).specification;
  assert.ok(analyseCompliance(insurer).mappings.some(m=>m.controlId==='IND-IRDAI-CYBER'));
  const payments=financialDemo({domain:'finance',useCase:'payments',regulatedEntity:'payment-provider'},['India']).specification;
  assert.equal(payments.projectContext.paymentIntegration,'unknown');assert.equal(analyseCompliance(payments).mappings.find(m=>m.controlId==='PCI-SCOPE')!.status,'scope-review');
  const merchant=structuredClone(fixtureSpecification);merchant.projectContext.jurisdictions=['India'];
  assert.ok(!analyseCompliance(merchant).mappings.some(m=>m.controlId.startsWith('FIN-')||m.controlId.startsWith('IND-BANK')));
});

test('threat validation rejects unsupported sources, assets, evidence, risks and duplicate identifiers',()=>{
  const spec=structuredClone(fixtureSpecification),threat=spec.threatModel!.threats[0]!;
  threat.asset='Unknown ledger';threat.riskIds=['RISK-999'];threat.source={kind:'assumption',reference:'A-999'};threat.evidence=['invented-source'];
  spec.threatModel!.threats.push(structuredClone(threat));
  const codes=validateSpecification(spec,fixtureBrief,['docs/ingested/ecommerce/security-evidence.md']).map(f=>f.code);
  for(const code of ['THREAT_SCOPE_MISMATCH','BROKEN_THREAT_REFERENCE','UNSUPPORTED_THREAT_SOURCE','UNSUPPORTED_THREAT_CITATION','DUPLICATE_THREAT_ID'])assert.ok(codes.includes(code),code);
  assert.match(renderThreatModelMarkdown(data()),/THR-001/);assert.match(renderThreatModelMarkdown(data()),/Delivery gates/);
});

test('financial identifier masking preserves measurable engineering targets',()=>{
  const masked=redactSensitiveData('Synthetic PAN ABCDE1234F; Aadhaar 2345 6789 0123; account no: 12345678; IBAN GB82WEST12345698765432; p95 2 seconds at 100 users.');
  for(const value of ['ABCDE1234F','2345','12345678','GB82WEST'])assert.ok(!masked.text.includes(value));
  assert.match(masked.text,/p95 2 seconds at 100 users/);assert.ok(masked.redactions>=4);
});

test('evaluation measures reviewed control coverage and preserves unmeasured quality metrics',()=>{
  const run=data(),control=run.compliance!.mappings[0]!,req=run.specification.requirements[0]!.id;
  const annotation={...annotationTemplate,referenceRequirementIds:['GOLD-1','GOLD-2'],matches:[{extractedId:req,referenceId:'GOLD-1'}],consistency:[{requirementId:req,consistent:true}],controls:[{controlId:control.controlId,applicable:true,covered:true,requirementIds:[req]}],traceability:[{requirementId:req,sourceVerified:true,criteriaVerified:true,phaseVerified:true}]};
  const result=evaluateAnalysis(run,annotation);
  assert.equal(result.referenceCompleteness,.5);assert.equal(result.regulatoryControlCoverage,1);assert.equal(result.requirementConsistency,1);assert.ok(result.verifiedTraceabilityCoverage!>0);assert.equal(result.researchEligible,false);
  const empty=evaluateAnalysis(run,annotationTemplate);assert.equal(empty.regulatoryControlCoverage,null);assert.equal(empty.verifiedTraceabilityCoverage,null);assert.equal(empty.requirementConsistency,null);
  assert.throws(()=>evaluateAnalysis(run,{...annotation,controls:[{...annotation.controls[0],covered:true,applicable:false}]}),/Covered controls/);
  assert.throws(()=>evaluateAnalysis(run,{...annotation,consistency:[{requirementId:'FR-999',consistent:true}]}),/unknown requirement/);
});

test('study summaries exclude demos and controlled outputs and supersede corrected annotations',()=>{
  const run=data(),input={...annotationTemplate,caseId:'onboarding',provenance:'human-reviewed',manualDurationMs:1000};
  const controlled=evaluateAnalysis(run,input,{humanReferenceVerified:true,referenceFrozenBeforeInference:true});assert.equal(controlled.researchEligible,false);
  run.inferenceKind='model-inference';const eligible=evaluateAnalysis(run,input,{humanReferenceVerified:true,referenceFrozenBeforeInference:true});assert.equal(eligible.researchEligible,true);
  const summary=summariseStudy([{id:'1',projectId:'p1',versionId:'v1',at:'2026-11-19T01:00:00Z',result:eligible},{id:'2',projectId:'p1',versionId:'v1',at:'2026-11-19T02:00:00Z',result:{...eligible,timeSavedMs:900}},{id:'3',projectId:'p2',versionId:'v2',at:'2026-11-19T01:00:00Z',result:controlled}]);
  assert.equal(summary.distinctRuns,2);assert.equal(summary.researchEligibleRuns,1);assert.equal(summary.metrics.timeSavedMs.mean,900);
  assert.equal(summariseStudy([]).metrics.extractionF1.mean,null);
});
