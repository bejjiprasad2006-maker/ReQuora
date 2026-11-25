import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, cp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { createHash } from 'node:crypto';
import { createServer } from 'node:http';
import { PDFDocument } from 'pdf-lib';
import { fixtureBrief, fixtureSpecification, fixturePlan } from '../src/demo/fixture';
import { specificationSchema, factorKeys, models } from '../src/domain/schemas';
import { rankSdlc } from '../src/domain/sdlc';
import { validateSpecification, validateSdlc } from '../src/domain/quality';
import { redactSensitiveData } from '../src/domain/privacy';
import { searchEvidence } from '../src/domain/retrieval';
import { runAnalysis } from '../src/domain/analysis';
import { renderHtml, renderTraceabilityCsv, type Analysis } from '../src/domain/report';

const root = resolve('.');
test('contrasting project conditions produce distinct suitable lifecycle rankings', () => {
  const cases = [
    { model: 'Agile', ratings: [4,0,1,1,2,4,0,0,0,0,1,1,3,4,0,1] }, // Changing low-risk UX with available stakeholders.
    { model: 'DevSecOps', ratings: [2,4,1,3,4,2,2,2,2,2,3,3,2,3,2,3] }, // Known secure service with frequent releases.
    { model: 'Spiral', ratings: [2,4,4,3,0,2,4,2,1,3,4,4,1,1,3,4] }, // Uncertain high-risk legacy integration.
    { model: 'V-Model', ratings: [0,3,0,4,0,1,3,4,4,4,3,3,2,1,4,4] }, // Stable scope with formal verification.
    { model: 'Waterfall', ratings: [0,1,0,2,0,0,1,4,4,2,2,2,3,1,2,2] }, // Stable low-risk scope and sequential signoffs.
    { model: 'Agile + DevSecOps', ratings: [4,4,2,3,4,4,1,2,1,2,3,3,2,3,2,3] }, // Evolving secure checkout with fast feedback.
    { model: 'Agile + V-Model', ratings: [3,3,2,4,1,3,3,4,2,4,3,3,2,2,4,4] }, // Evolving scope with formal acceptance gates.
  ];
  for (const { model, ratings } of cases) {
    const factors = structuredClone(fixtureSpecification.decisionFactors);
    factorKeys.forEach((key, index) => factors[key].rating = ratings[index]!);
    const ranking = rankSdlc(factors);
    assert.equal(ranking[0]!.model, model);
    assert.ok(ranking.every(item => item.score >= 0 && item.score <= 100));
  }
});
test('schema rejects invalid confidence, unknown priorities and out-of-range factors', () => {
  const spec = structuredClone(fixtureSpecification); spec.requirements[0]!.confidence = 2;
  assert.equal(specificationSchema.safeParse(spec).success, false);
  spec.requirements[0]!.confidence = .9; spec.decisionFactors.securityRisk.rating = 5;
  assert.equal(specificationSchema.safeParse(spec).success, false);
  spec.decisionFactors.securityRisk.rating = 3;
  const invalidPriority = { ...spec, requirements: [{ ...spec.requirements[0], priority: 'Critical' }] };
  assert.equal(specificationSchema.safeParse(invalidPriority).success, false);
});
test('retrieval excludes finance, embedded instructions and legacy user attachments', async () => {
  const hits = await searchEvidence(root, 'RBI KYC lender checkout payment ecommerce lifecycle');
  assert.ok(hits.length > 0); assert.ok(hits.every(item => item.id.startsWith('docs/ingested/ecommerce/')));
  assert.ok(hits.every(item => /^[a-f0-9]{64}$/.test(item.sha256)));
});
test('validator identifies unsupported citations, fabricated quotes, duplicate IDs and broken links', () => {
  const spec = structuredClone(fixtureSpecification);
  spec.requirements[0]!.source.reference = 'fabricated stakeholder quote';
  spec.requirements[0]!.evidence = ['https://invented.example'];
  spec.requirements[1]!.id = spec.requirements[0]!.id;
  spec.requirements[2]!.dependencies = ['FR-999'];
  const codes = new Set(validateSpecification(spec, fixtureBrief, []).map(item => item.code));
  for (const code of ['UNVERIFIED_QUOTE', 'UNSUPPORTED_CITATION', 'DUPLICATE_ID', 'BROKEN_REFERENCE']) assert.ok(codes.has(code));
});
test('SDLC validation rejects a model change and unknown requirement references', () => {
  const plan = structuredClone(fixturePlan); plan.selectedModel = 'Waterfall'; plan.phases[0]!.requirementIds = ['FR-999'];
  const codes = new Set(validateSdlc(fixtureSpecification, plan, 'Agile + DevSecOps').map(item => item.code));
  assert.ok(codes.has('MODEL_MISMATCH')); assert.ok(codes.has('BROKEN_SDLC_REFERENCE'));
});
test('privacy masks common sensitive patterns while preserving requirement targets', () => {
  const result = redactSensitiveData('Contact user@example.com, +91 9876543210; card 4111 1111 1111 1111; api_key=secretvalue. p95 <= 2 seconds, 100 shoppers.');
  assert.ok(!/user@example|9876543210|4111|secretvalue/.test(result.text));
  assert.match(result.text, /2 seconds, 100 shoppers/); assert.ok(result.redactions >= 4);
});
test('end-to-end demo exports valid PDF, immutable run folders, traceability, audit and safe HTML', async () => {
  const temp = await mkdtemp(join(tmpdir(), 'riku-commerce-'));
  try {
    await mkdir(join(temp, 'docs/ingested'), { recursive: true });
    await cp(join(root, 'docs/ingested/ecommerce'), join(temp, 'docs/ingested/ecommerce'), { recursive: true });
    const agents = { requirements: async () => structuredClone(fixtureSpecification), sdlc: async () => structuredClone(fixturePlan) };
    const output = await runAnalysis(fixtureBrief, temp, agents, 'demo');
    const data = JSON.parse(await readFile(output.jsonPath, 'utf8')) as Analysis;
    assert.equal(data.mode, 'demo'); assert.equal(data.status, 'draft');
    assert.equal(data.findings.filter(item => item.severity === 'error').length, 0);
    assert.ok((await PDFDocument.load(await readFile(output.pdfPath))).getPageCount() > 1);
    const srs = await readFile(output.srsMarkdownPath, 'utf8');
    assert.match(srs, /## 1\. Introduction/);
    assert.match(srs, /## 2\. Overall description/);
    assert.match(srs, /## 3\. Specific requirements/);
    assert.ok(output.document.indexOf('## Recommended SDLC:') < output.document.indexOf('# Software Requirements Specification'));
    assert.ok(output.document.includes(srs));
    assert.ok((await PDFDocument.load(await readFile(output.srsPdfPath))).getPageCount() > 1);
    const manifest = JSON.parse(await readFile(join(temp, 'artifacts/ecommerce', data.runId, 'manifest.json'), 'utf8')) as { files: { file: string; sha256: string }[] };
    for (const item of manifest.files) assert.equal(createHash('sha256').update(await readFile(join(temp, 'artifacts/ecommerce', data.runId, item.file))).digest('hex'), item.sha256);
    assert.match(await readFile(output.csvPath, 'utf8'), /FR-004/);
    const malicious = structuredClone(data); malicious.specification.title = '</script><script>alert(1)</script>';
    malicious.specification.requirements[0]!.statement = '<img src=x onerror=alert(1)>';
    const html = renderHtml(malicious);
    assert.ok(!html.includes('<img src=x')); assert.ok(!html.includes('<script>alert(1)'));
    malicious.specification.requirements[0]!.source.reference = '=HYPERLINK("bad")';
    assert.ok(renderTraceabilityCsv(malicious).includes("'=HYPERLINK"));
    const second = await runAnalysis(fixtureBrief, temp, agents, 'demo');
    assert.notEqual(output.runId, second.runId);
    assert.equal(await readFile(output.jsonPath, 'utf8'), JSON.stringify(data, null, 2));
  } finally { await rm(temp, { recursive: true, force: true }); }
});
test('invalid agent output gets one repair, then fails without a final report', async () => {
  const temp = await mkdtemp(join(tmpdir(), 'riku-failure-'));
  try {
    await mkdir(join(temp, 'docs/ingested'), { recursive: true });
    await cp(join(root, 'docs/ingested/ecommerce'), join(temp, 'docs/ingested/ecommerce'), { recursive: true });
    let calls = 0;
    const spec = structuredClone(fixtureSpecification); spec.requirements[0]!.source.reference = 'fabricated quote';
    await assert.rejects(runAnalysis(fixtureBrief, temp, { requirements: async () => { calls++; return spec; }, sdlc: async () => { throw new Error('must not run'); } }), /failed validation after repair/);
    assert.equal(calls, 2);
  } finally { await rm(temp, { recursive: true, force: true }); }
});

test('all four Mastra agents consume structured responses from an OpenAI-compatible test server', async () => {
  let requests = 0;
  const server = createServer(async (req, res) => {
    const chunks: Buffer[] = [];
    for await (const chunk of req) chunks.push(Buffer.from(chunk));
    const body = JSON.parse(Buffer.concat(chunks).toString()) as { stream?: boolean; response_format?: unknown };
    assert.ok(body.response_format, 'model request must include a structured response format');
    const content = JSON.stringify([fixtureSpecification,fixturePlan,{issues:[],citations:[]},{summary:'Controlled follow-up test.',questions:[]}][requests++]);
    const base = { id: 'test-completion', model: 'test-model', created: 1 };
    if (body.stream) {
      res.writeHead(200, { 'Content-Type': 'text/event-stream' });
      res.write(`data: ${JSON.stringify({ ...base, object: 'chat.completion.chunk', choices: [{ index: 0, delta: { role: 'assistant', content }, finish_reason: null }] })}\n\n`);
      res.write(`data: ${JSON.stringify({ ...base, object: 'chat.completion.chunk', choices: [{ index: 0, delta: {}, finish_reason: 'stop' }], usage: { prompt_tokens: 10, completion_tokens: 20, total_tokens: 30 } })}\n\ndata: [DONE]\n\n`);
      res.end();
    } else {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ ...base, object: 'chat.completion', choices: [{ index: 0, message: { role: 'assistant', content }, finish_reason: 'stop' }], usage: { prompt_tokens: 10, completion_tokens: 20, total_tokens: 30 } }));
    }
  });
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
  const address = server.address(); assert.ok(address && typeof address !== 'string');
  const oldUrl = process.env.LM_STUDIO_BASE_URL, oldModel = process.env.LM_STUDIO_MODEL;
  process.env.LM_STUDIO_BASE_URL = `http://127.0.0.1:${address.port}/v1`;
  process.env.LM_STUDIO_MODEL = 'test-model';
  try {
    const { liveAgents } = await import('../src/mastra/generation');
    const spec = await liveAgents.requirements('RIKU_EVIDENCE_ATTACHED. This is a controlled integration test, not real model inference.');
    const plan = await liveAgents.sdlc('RIKU_EVIDENCE_ATTACHED. This is a controlled integration test, not real model inference.');
    assert.equal(spec.title, fixtureSpecification.title);
    assert.equal(plan.selectedModel, fixturePlan.selectedModel);
    assert.deepEqual(await liveAgents.quality!('RIKU_EVIDENCE_ATTACHED. Controlled test response.'),{issues:[],citations:[]});
    assert.deepEqual(await liveAgents.clarify!('RIKU_EVIDENCE_ATTACHED. Controlled test response.'),{summary:'Controlled follow-up test.',questions:[]});
    assert.equal(requests, 4);
  } finally {
    if (oldUrl === undefined) delete process.env.LM_STUDIO_BASE_URL; else process.env.LM_STUDIO_BASE_URL = oldUrl;
    if (oldModel === undefined) delete process.env.LM_STUDIO_MODEL; else process.env.LM_STUDIO_MODEL = oldModel;
    server.closeAllConnections(); await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
  }
});
