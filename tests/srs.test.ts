import test from 'node:test';
import assert from 'node:assert/strict';
import { fixtureSpecification, fixturePlan, fixtureBrief } from '../src/demo/fixture';
import { generatedSpecificationSchema, specificationSchema, categories } from '../src/domain/schemas';
import { rankSdlc } from '../src/domain/sdlc';
import { validateSpecification } from '../src/domain/quality';
import { renderSrsMarkdown, validateSrs } from '../src/domain/srs';
import { renderMarkdown, renderHtml, type Analysis } from '../src/domain/report';

const analysis = (): Analysis => ({
  runId: 'srs-test', createdAt: '2026-11-19T00:00:00.000Z', mode: 'demo', status: 'draft',
  redactedBrief: fixtureBrief, redactions: 0, elapsedMs: 10,
  specification: structuredClone(fixtureSpecification), sdlcPlan: structuredClone(fixturePlan),
  ranking: rankSdlc(fixtureSpecification.decisionFactors), findings: [], evidence: [], events: [],
});

test('new generation requires SRS context while historical specifications stay readable', () => {
  assert.equal(generatedSpecificationSchema.safeParse(fixtureSpecification).success, true);
  const legacy = structuredClone(fixtureSpecification); delete legacy.srsContext;
  assert.equal(specificationSchema.safeParse(legacy).success, true);
  assert.equal(generatedSpecificationSchema.safeParse(legacy).success, false);
  const data = analysis(); data.specification = legacy;
  assert.match(renderSrsMarkdown(data), /TBD — document purpose/);
  assert.ok(validateSrs(legacy).some(f => f.code === 'SRS_CONTEXT_MISSING'));
  assert.match(renderSrsMarkdown(data), /SRS_SECTION_GAP/);
});

test('SRS dispositions distinguish exclusions, unknowns and contradictory coverage', () => {
  const spec = structuredClone(fixtureSpecification);
  const hardware = spec.srsContext!.coverage.find(item => item.topic === 'hardwareInterfaces')!;
  hardware.status = 'not-applicable'; hardware.description = 'Scope excludes custom hardware and device control interfaces.';
  assert.ok(!validateSrs(spec).some(f => /Hardware interfaces/.test(f.message)));
  const database = spec.srsContext!.coverage.find(item => item.topic === 'database')!;
  database.status = 'not-applicable'; database.requirementIds = []; database.description = 'The product has no persistent database requirements.';
  assert.ok(validateSrs(spec).some(f => f.code === 'SRS_APPLICABILITY_CONFLICT' && /database/.test(f.message)));
  const security = spec.srsContext!.coverage.find(item => item.topic === 'security')!;
  security.requirementIds = ['FR-999'];
  spec.srsContext!.coverage.push(structuredClone(hardware));
  const codes = validateSpecification(spec, fixtureBrief, ['docs/ingested/ecommerce/security-evidence.md']).map(f => f.code);
  assert.ok(codes.includes('BROKEN_SRS_REFERENCE')); assert.ok(codes.includes('SRS_DUPLICATE_TOPIC'));
  assert.ok(codes.includes('SRS_CONTEXT_UNRESOLVED')); assert.ok(codes.includes('SRS_DATA_UNRESOLVED'));
});

test('missing and falsely specified SRS topics remain visible review findings', () => {
  const spec = structuredClone(fixtureSpecification);
  spec.srsContext!.coverage = spec.srsContext!.coverage.filter(item => item.topic !== 'maintainability');
  const performance = spec.srsContext!.coverage.find(item => item.topic === 'performance')!;
  performance.status = 'specified'; performance.requirementIds = [];
  const findings = validateSrs(spec);
  assert.ok(findings.some(f => f.code === 'SRS_SECTION_GAP' && /Maintainability/.test(f.message)));
  assert.ok(findings.some(f => f.code === 'SRS_TOPIC_INCOMPLETE' && /Performance/.test(f.message)));
});

test('recommendation precedes numbered SRS and every category retains source and verification details', () => {
  const data = analysis();
  data.specification.requirements = categories.map((category, index) => ({
    ...structuredClone(fixtureSpecification.requirements[0]!), id: `FR-${String(index + 1).padStart(3, '0')}`,
    category, categories: [category], statement: `The platform shall expose observable behavior for ${category}.`,
  }));
  const srs = renderSrsMarkdown(data), report = renderMarkdown(data);
  const headings = ['## 1. Introduction', '### 1.1 Purpose', '### 1.2 Scope', '### 1.3 Definitions', '### 1.4 References', '### 1.5 Overview', '## 2. Overall description', '### 2.1 Product perspective', '### 2.2 Product functions', '### 2.3 User characteristics', '### 2.4 Constraints', '### 2.5 Assumptions', '### 2.6 Apportioning', '## 3. Specific requirements', '### 3.1 External interface', '### 3.2 Functional', '### 3.3 Performance', '### 3.4 Logical database', '### 3.5 Design constraints', '### 3.6 Software system attributes'];
  for (const heading of headings) assert.ok(srs.includes(heading), heading);
  for (const req of data.specification.requirements) {
    assert.equal(srs.split(req.statement).length - 1, 1, `${req.category} statement must appear exactly once`);
    assert.ok(srs.includes(req.acceptanceCriteria[0]!)); assert.ok(srs.includes(req.verification)); assert.ok(srs.includes(req.source.reference));
  }
  assert.ok(report.indexOf('## Recommended SDLC:') < report.indexOf('# Software Requirements Specification'));
  assert.ok(!srs.includes('## Recommended SDLC:'));
  assert.match(srs, /Appendix A\. Traceability/); assert.match(srs, /DATA-001/); assert.match(srs, /INT-001/);
});

test('HTML escapes the new SRS context, glossary and coverage prose', () => {
  const data = analysis();
  data.specification.srsContext!.purpose = '<script>alert("purpose")</script>';
  data.specification.srsContext!.coverage[0]!.description = '<img src=x onerror=alert(1)>';
  const html = renderHtml(data);
  assert.ok(!html.includes('<script>alert("purpose")')); assert.ok(!html.includes('<img src=x'));
  assert.ok(html.includes('&lt;script&gt;'));
});
