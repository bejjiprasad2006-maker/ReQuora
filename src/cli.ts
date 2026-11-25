import 'dotenv/config';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { resolve, extname, join } from 'node:path';
import { parseArgs } from 'node:util';
import mammoth from 'mammoth';
import { runAnalysis } from './domain/analysis';
import { metrics, type Analysis } from './domain/report';
import { fixtureBrief, fixtureSpecification, fixturePlan } from './demo/fixture';
import { workspaceRoot } from './mastra/workspace';
import { config } from './mastra/config';
import { projectProfile, type ProjectProfile } from './domain/profile';
import { financialCases, financialCaseBrief } from './domain/cases';
import { financialDemo } from './demo/financial';

const { values, positionals } = parseArgs({ allowPositionals: true, options: {
  file: { type: 'string', short: 'f' }, prompt: { type: 'string', short: 'p' },
  run: { type: 'string' }, reviewer: { type: 'string' }, decision: { type: 'string' }, note: { type: 'string' }, help: { type: 'boolean', short: 'h' },
  domain:{type:'string'},'use-case':{type:'string'},entity:{type:'string'},case:{type:'string'},limit:{type:'string'},
} });
const command = positionals[0] ?? 'help';
const doctor = async () => {
  console.log(`Node: ${process.version} (requires >=22.22; Node 24 LTS recommended)`);
  console.log(`Project: ${workspaceRoot}`);
  console.log(`Model: ${config.lmStudio.model}`);
  try {
    const response = await fetch(`${config.lmStudio.baseURL.replace(/\/$/, '')}/models`, { headers: { Authorization: `Bearer ${config.lmStudio.apiKey}` }, signal: AbortSignal.timeout(5000) });
    if (!response.ok) throw new Error(`Model server returned HTTP ${response.status}`);
    const body = await response.json() as { data?: { id: string }[] };
    const loaded = body.data?.map(item => item.id) ?? [];
    if (!loaded.includes(config.lmStudio.model)) throw new Error('Configured model is not listed by the server. Set LM_STUDIO_MODEL to a loaded model ID.');
    console.log('LM Studio: reachable; configured model is loaded. Structured-output support is checked by a live analysis.');
    return true;
  } catch (error) {
    console.log(`LM Studio: unavailable — ${error instanceof Error ? error.message : 'connection failed'}`);
    console.log('Start the LM Studio local server, load a model supporting JSON schema output, and check .env. The authored demo works without LM Studio.');
    return false;
  }
};
const readBrief = async (path: string) => {
  const file = resolve(path), ext = extname(file).toLowerCase();
  if (ext === '.docx') return (await mammoth.extractRawText({ path: file })).value;
  if (!['.txt', '.md'].includes(ext)) throw new Error('Input must be .txt, .md or .docx.');
  return readFile(file, 'utf8');
};


try {
  if (values.help || command === 'help') {
    console.log(`RikuAI — financial and e-commerce requirements and SDLC engineering

npm run demo                         Authored fixture; no LLM needed
npm run doctor                       Check model connectivity
npm run analyse -- --file brief.docx  Live analysis (.txt/.md/.docx)
npm run analyse -- --prompt "..."      Live analysis of a full brief
npm run demo -- --domain finance      Authored onboarding demonstration
npm run analyse -- --case lending     Live analysis of a fictitious financial case
npm run benchmark -- --limit 1        Run real model on selected financial cases
Financial flags: --domain finance --use-case customer-onboarding --entity commercial-bank
Open the authenticated workspace Reviews tab for review and baseline decisions.

Mastra Studio: npm run studio -> Workflows -> requirements-then-sdlc
Generated artifacts: artifacts/ecommerce/<run-id>/ and artifacts/evaluation/latest.html
Input text is treated as project data, not executable instructions.`);
  } else if (command === 'doctor') {
    if (!await doctor()) process.exitCode = 1;
  } else if(command==='benchmark'){
    if(!await doctor())throw new Error('Benchmark requires a reachable configured model. No model-effectiveness results were created.');
    const selected=values.case?financialCases.filter(item=>item.id===values.case):financialCases;
    if(!selected.length)throw new Error('Unknown case. Choose '+financialCases.map(c=>c.id).join(', '));
    const count=values.limit===undefined?selected.length:Number(values.limit);if(!Number.isInteger(count)||count<1||count>selected.length)throw new Error('Limit must be a positive integer within the selected case count.');
    const directory=join(workspaceRoot,'artifacts/benchmarks',randomUUID());await mkdir(directory,{recursive:true});
    const manifest:{createdAt:string;model:string;provenance:string;runs:unknown[];limitations:string[]}={createdAt:new Date().toISOString(),model:config.lmStudio.model,provenance:'real-model-on-fictitious-cases',runs:[],limitations:['No independent gold annotations, manual timings or stakeholder feedback are generated.','Use the authenticated Evaluation workflow with pre-inference adjudicated references for empirical study results.']};
    const agents=(await import('./mastra/generation')).liveAgents;
    for(const item of selected.slice(0,count)){
      const profile:ProjectProfile={domain:'finance',useCase:item.useCase,regulatedEntity:item.entity};
      try{const result=await runAnalysis(financialCaseBrief(item),workspaceRoot,agents,'live',profile);manifest.runs.push({caseId:item.id,profile,status:'completed',runId:result.runId,jsonPath:result.jsonPath,srsPdfPath:result.srsPdfPath,effectiveness:'unmeasured'});}
      catch(error){manifest.runs.push({caseId:item.id,profile,status:'failed',error:error instanceof Error?error.message:'Model run failed',effectiveness:'unmeasured'});process.exitCode=1;}
      await writeFile(join(directory,'manifest.json'),JSON.stringify(manifest,null,2));
    }
    console.log(JSON.stringify({manifest:join(directory,'manifest.json'),...manifest},null,2));
  } else if (command === 'review') {
    throw new Error('Use the authenticated workspace Reviews tab. Local self-declared review files cannot create a platform baseline.');
  } else if (command === 'demo' || command === 'analyse') {
    if (command === 'demo' && (values.file || values.prompt)) throw new Error('Demo uses the authored ShopSphere fixture only. Use analyse for your own input.');
    if (command === 'analyse' && [values.file,values.prompt,values.case].filter(Boolean).length!==1) throw new Error('Supply exactly one of --file, --prompt or --case.');
    const demo = command === 'demo';
    if (!demo && !await doctor()) throw new Error('Live analysis needs a reachable model server.');
    const item=values.case?financialCases.find(c=>c.id===values.case):undefined;if(values.case&&!item)throw new Error('Unknown financial case.');
    const profile=projectProfile({domain:(values.domain??(item?'finance':'ecommerce')) as ProjectProfile['domain'],useCase:(values['use-case']??item?.useCase??(values.domain==='finance'&&demo?'customer-onboarding':'other')) as ProjectProfile['useCase'],regulatedEntity:(values.entity??item?.entity??(values.domain==='finance'&&demo?'commercial-bank':'unknown')) as ProjectProfile['regulatedEntity']});
    const fixture=profile.domain==='finance'?financialDemo(profile):{brief:fixtureBrief,specification:fixtureSpecification,plan:fixturePlan};
    const prompt = demo ? fixture.brief : values.file ? await readBrief(values.file) : item?financialCaseBrief(item):values.prompt!;
    const agents = demo ? { inferenceKind:'authored-fixture' as const,requirements: async () => structuredClone(fixture.specification), sdlc: async () => structuredClone(fixture.plan) } : (await import('./mastra/generation')).liveAgents;
    console.log(demo ? 'Running authored demonstration fixture (no LLM calls)...' : 'Running Requirements Agent, validation, then SDLC Selection Agent. Local inference may take several minutes...');
    const result = await runAnalysis(prompt, workspaceRoot, agents, demo ? 'demo' : 'live',profile);
    const data = JSON.parse(await readFile(result.jsonPath, 'utf8')) as Analysis;
    console.log(JSON.stringify({ runId: result.runId, mode: data.mode, selectedSdlc: data.sdlcPlan.selectedModel, metrics: metrics(data), html: result.htmlPath, pdf: result.pdfPath, markdown: result.markdownPath, json: result.jsonPath, csv: result.csvPath, srsPdfPath: result.srsPdfPath, srsMarkdownPath: result.srsMarkdownPath }, null, 2));
  } else throw new Error(`Unknown command: ${command}. Use --help.`);
} catch (error) {
  console.error(error instanceof Error ? error.message : 'Command failed');
  process.exitCode = 1;
}
