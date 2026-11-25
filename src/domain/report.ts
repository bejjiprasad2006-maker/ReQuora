import type { Specification, SdlcPlan } from './schemas';
import type { Evidence } from './retrieval';
import type { Finding } from './quality';
import type { rankSdlc } from './sdlc';
import { complianceWorkflow, type ComplianceAnalysis } from './compliance';
import type { SemanticReview } from './schemas';
import type { AgentTrace } from './analysis';
import { renderSrsMarkdown } from './srs';
import { renderThreatModelMarkdown } from './threats';

export type Analysis = {
  runId: string; createdAt: string; mode: 'live' | 'demo'; status: 'draft';
  redactedBrief: string; redactions: number; elapsedMs: number;
  specification: Specification; sdlcPlan: SdlcPlan; ranking: ReturnType<typeof rankSdlc>;
  findings: Finding[]; evidence: Evidence[];
  events: { at: string; actor: string; action: string }[];
  compliance?:ComplianceAnalysis; semanticReview?:SemanticReview; traces?:AgentTrace[];
  inferenceKind?:'model-inference'|'authored-fixture'|'controlled-test'|'unverified';
};
export const metrics = (data: Analysis) => {
  const reqs = data.specification.requirements;
  const covered = new Set(data.sdlcPlan.phases.flatMap(phase => phase.requirementIds));
  return {
    requirements: reqs.length, mustHave: reqs.filter(req => req.priority === 'Must').length,
    phaseCoverage: Math.round(reqs.filter(req => covered.has(req.id)).length / (reqs.length || 1) * 100),
    linkedEvidence: reqs.filter(req => req.evidence.length > 0).length,
    errors: data.findings.filter(item => item.severity === 'error').length,
    warnings: data.findings.filter(item => item.severity === 'warning').length,
  };
};
const cell = (value: string) => value.replace(/\|/g, '\\|').replace(/[\r\n]+/g, ' ');
const table = (headers: string[], rows: string[][]) => [headers, headers.map(() => '---'), ...rows].map(row => `| ${row.map(cell).join(' | ')} |`).join('\n');
const list = (items: string[]) => items.length ? items.map(item => `- ${item}`).join('\n') : '- None recorded.';
export const renderMarkdown = (data: Analysis) => {
  const spec = data.specification, plan = data.sdlcPlan, stats = metrics(data);
  return `# ${spec.title} — SDLC recommendation and SRS

Status: DRAFT — human review required. Mode: ${data.mode.toUpperCase()}${data.mode === 'demo' ? ' (authored fixture; no LLM calls)' : ''}.
Run: ${data.runId} | Created (UTC): ${data.createdAt} | Processing: ${data.elapsedMs} ms

## Recommended SDLC: ${plan.selectedModel}
${list(plan.justification.map(item => `${item.reason} (${item.requirementIds.join(', ')})`))}

### Ranked SDLC recommendations — Agent (ii)
${table(['Rank', 'Model', 'Suitability / 100'], data.ranking.map((item, i) => [String(i + 1), item.model, String(item.score)]))}
Policy v2 uses equal-weight profile distance. Scores are heuristic suitability indices, not probabilities. Ties use declared model order. Human judgment is required, particularly for close scores.

### Alternatives and tradeoffs
${list(plan.alternatives.map(item => `${item.model}: ${item.tradeoff} (${item.requirementIds.join(', ')})`))}

### Decision factors
${table(['Factor', 'Rating (0–4)', 'Rationale', 'Requirements'], Object.entries(spec.decisionFactors).map(([key, value]) => [key, String(value.rating), value.rationale, value.requirementIds.join(', ')]))}

### Project-specific SDLC workflow
${plan.phases.map((phase, i) => `#### ${i + 1}. ${phase.name}
Activities: ${phase.activities.join('; ')}
Roles: ${phase.roles.join(', ')}
Deliverables: ${phase.deliverables.join('; ')}
Entry gate: ${phase.entryGate}
Exit gate: ${phase.exitGate}
Security checkpoint: ${phase.securityCheckpoint}
Requirements: ${phase.requirementIds.join(', ')}`).join('\n\n')}

### Residual risks and review
${list(plan.residualRisks)}
Product owner and technical lead must review the requirements baseline; project manager, architect and security reviewer must approve SDLC adoption. Legal interpretations need an authorised reviewer. This file does not record approval.

${renderSrsMarkdown(data)}

${renderThreatModelMarkdown(data)}

# Review and audit supplement

## Evaluation checklist
${stats.requirements} requirements; ${stats.mustHave} Must; ${stats.phaseCoverage}% linked to a delivery phase; ${stats.linkedEvidence} have evidence links; ${stats.errors} errors; ${stats.warnings} warnings.
These are structural checks, not measured correctness, completeness or legal compliance. Confidence values are agent self-assessments.

## Compliance-control matrix (candidate mappings; reviewer determination required)
${data.compliance ? table(['Control', 'Source', 'Owner', 'Temporal status', 'Requirements', 'Status'], data.compliance.mappings.map(item => [item.controlId + ': ' + item.title, item.sourceId, item.owner, item.temporalStatus, item.requirementIds.join(', '), item.status])) : 'Compliance analysis unavailable.'}
${list(data.compliance?.jurisdictionGaps ?? [])}
${data.compliance?.sources.map(item => `${item.id} | ${item.title} | ${item.jurisdiction} | ${item.version} | effective: ${item.effectiveDate ?? 'provision-specific / review required'} | ${item.url} | ${item.sha256}`).join('\n') ?? ''}

## Compliance checkpoints in the delivery workflow
${data.compliance ? table(['Control', 'Owner', 'Phases', 'Exit-gate evidence'], complianceWorkflow(data.compliance, plan).map(item => [item.controlId, item.owner, item.phases.join('; '), item.reviewPurpose])) : 'No control crosswalk available.'}

## Quality findings
${list(data.findings.map(item => `[${item.severity.toUpperCase()}] ${item.code}${item.requirementId ? ' / ' + item.requirementId : ''}: ${item.message}`))}

## Audit trail
${table(['UTC timestamp', 'Actor', 'Action'], data.events.map(item => [item.at, item.actor, item.action]))}
`;
};
export const escapeHtml = (text: string) => text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
export const renderHtml = (data: Analysis) => {
  const e = escapeHtml, spec = data.specification, stats = metrics(data);
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${e(spec.title)} | RikuAI</title>
<style>
:root{font-family:Segoe UI,system-ui,sans-serif;color:#172b3b;background:#f3f6f8;font-size:15px}*{box-sizing:border-box}body{margin:0}aside{position:fixed;inset:0 auto 0 0;width:220px;background:#112c32;color:#e7f1ed;padding:34px 24px}aside strong{font-size:26px;letter-spacing:-1px}aside small{display:block;color:#9bb9b4;margin:8px 0 40px}aside a{display:block;color:#bdd0cd;text-decoration:none;padding:12px 0}aside a:hover{color:white}main{max-width:1250px;margin-left:220px;padding:40px 48px}header>div{min-width:0}header{display:flex;justify-content:space-between;gap:20px;align-items:start}h1{font-size:34px;line-height:1.2;margin:12px 0;letter-spacing:-1px}h2{font-size:23px;margin:32px 0 16px}p{line-height:1.7;color:#4c626e}.eyebrow{color:#367a6c;font-size:12px;letter-spacing:2px;font-weight:700}.badge{font-size:12px;background:#fcf0cb;color:#745824;padding:7px 11px;border-radius:6px;white-space:nowrap}.stats{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:15px;margin:28px 0}.card{min-width:0;overflow-wrap:anywhere;background:white;border:1px solid #dfe8e9;border-radius:12px;padding:22px}.stats b{display:block;font-size:30px;margin-bottom:6px}.stats span{font-size:12px;color:#637b83}.columns{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:20px}.rank{display:grid;grid-template-columns:150px 1fr 35px;align-items:center;gap:10px;margin:15px 0;font-size:13px}.track{background:#ecf2f1;border-radius:5px;height:7px}.bar{height:7px;border-radius:5px;background:#378a78}.subtle{font-size:12px;color:#6b8187}input,select,button{font:inherit;padding:10px 13px;border:1px solid #ccd9da;border-radius:7px;background:white}button{cursor:pointer}button:hover{background:#e7f0ed}.tools{display:flex;gap:10px;margin:18px 0;flex-wrap:wrap}.tools input{flex:1;min-width:180px}details{background:white;border:1px solid #dfe8e9;border-radius:9px;margin:9px 0;padding:16px}summary{cursor:pointer;line-height:1.7}summary strong{color:#237565;margin-right:12px}.req p{margin:10px 0;font-size:14px}.req ul{line-height:1.8}.tag{font-size:11px;float:right;color:#5a7177;margin-left:12px}pre{white-space:pre-wrap;overflow-wrap:anywhere;font:13px/1.8 Consolas,monospace;background:white;padding:24px;border:1px solid #dfe8e9;border-radius:12px}a{color:#287c68}li{margin:8px 0;line-height:1.6}section{scroll-margin-top:20px}footer{font-size:12px;color:#6c8187;margin:25px 0}[hidden]{display:none!important}@media(max-width:900px){aside{position:static;width:auto;padding:22px}aside small{margin:8px 0}aside a{display:inline-block;margin-right:20px;padding:8px 0}main{margin:0;padding:25px;width:100%;min-width:0}header{flex-direction:column}.columns{grid-template-columns:1fr}.stats{grid-template-columns:repeat(2,minmax(0,1fr))}h1{font-size:28px}}@media print{aside,.tools,button{display:none}main{margin:0;padding:10px;max-width:none}body{background:white}.card,details,pre{break-inside:avoid}.columns{display:block}.card{margin-bottom:15px}details{display:block}summary{list-style:none}}
</style></head><body><aside><strong>Riku<span style="color:#74c6aa">AI</span></strong><small>Requirements engineering</small><a href="#overview">Overview</a><a href="#requirements">Requirements</a><a href="#lifecycle">SDLC decision</a><a href="#review">Review findings</a><a href="#document">Full specification</a></aside>
<main><header><div><div class="eyebrow">TWO AGENTS · ONE TRACEABLE SPECIFICATION</div><h1>${e(spec.title)}</h1><span class="subtle">${e(data.runId)} · ${e(data.createdAt)} · ${data.mode.toUpperCase()}</span></div><span class="badge">Draft · review required</span></header>
${data.mode === 'demo' ? '<p class="card">DEMO FIXTURE: This authored example demonstrates the workflow and report. No language model was called.</p>' : ''}
<section id="overview"><p>${e(spec.summary)}</p><div class="stats">${[[stats.requirements,'Requirements identified'],[stats.mustHave,'Must-have requirements'],[stats.phaseCoverage+'%','Linked to delivery phases'],[stats.errors+stats.warnings,'Review findings']].map(([value,label]) => `<div class="card"><b>${value}</b><span>${label}</span></div>`).join('')}</div></section>
<section id="lifecycle" class="columns"><div class="card"><div class="eyebrow">AGENT 02 / SDLC SELECTION</div><h2>${e(data.sdlcPlan.selectedModel)}</h2>${data.ranking.map(item => `<div class="rank"><span>${e(item.model)}</span><div class="track"><div class="bar" style="width:${item.score}%"></div></div><b>${item.score}</b></div>`).join('')}<p class="subtle">Suitability / 100. Heuristic profile fit, not probability. See factors and tradeoffs in the full specification.</p></div><div class="card"><div class="eyebrow">DECISION RATIONALE</div><ul>${data.sdlcPlan.justification.map(item => `<li>${e(item.reason)} <span class="subtle">${e(item.requirementIds.join(', '))}</span></li>`).join('')}</ul></div></section>
<section id="requirements"><h2>Requirements <span class="subtle">/ Agent 01</span></h2><div class="tools"><input id="search" type="search" aria-label="Search requirements" placeholder="Search by ID, module, or requirement..."><select id="priority" aria-label="Filter by priority"><option value="">All priorities</option><option>Must</option><option>Should</option><option>Could</option></select><button id="expand">Expand all</button><button id="print">Print / Save PDF</button></div><p id="count" class="subtle" aria-live="polite"></p>
${spec.requirements.map(req => `<details class="req" data-priority="${req.priority}"><summary><span class="tag">${e(req.module)} · ${req.priority}</span><strong>${req.id}</strong>${e(req.statement)}</summary><p>Category: ${req.category} · Self-assessed confidence: ${req.confidence}</p><ul>${req.acceptanceCriteria.map(text => `<li>${e(text)}</li>`).join('')}</ul><p><b>Verification:</b> ${e(req.verification)}</p><p><b>Source (${req.source.kind}):</b> ${e(req.source.reference)}</p><p><b>Evidence:</b> ${e(req.evidence.join(', ') || 'NEEDS-VALIDATION')}</p><p><b>Dependencies:</b> ${e(req.dependencies.join(', ') || 'None')}</p></details>`).join('')}</section>
<section id="review"><h2>Review findings</h2><div class="card"><p>Structural checks cannot establish semantic completeness, correctness or legal compliance.</p><ul>${data.findings.map(item => `<li><b>${item.severity.toUpperCase()} · ${e(item.code)}</b> ${e(item.requirementId || '')}: ${e(item.message)}</li>`).join('') || '<li>No structural findings. Human review is still required.</li>'}</ul></div></section>
<section id="document"><h2>IEEE 830 SRS and delivery report</h2><p class="subtle">SDLC recommendation followed by the IEEE 830-aligned SRS, traceability, review findings and audit events. Also available as report.md, report.json, report.pdf and traceability.csv beside this file. Standalone SRS: srs.md and srs.pdf.</p><pre>${e(renderMarkdown(data))}</pre></section><footer>RikuAI · Local requirements engineering · All outputs are drafts until reviewed.</footer></main>
<script>
const rows=[...document.querySelectorAll('.req')],search=document.getElementById('search'),priority=document.getElementById('priority');
function filter(){let shown=0;for(const row of rows){row.hidden=!(row.textContent.toLowerCase().includes(search.value.toLowerCase())&&(!priority.value||row.dataset.priority===priority.value));if(!row.hidden)shown++;}document.getElementById('count').textContent=shown+' of '+rows.length+' requirements';}
search.addEventListener('input',filter);priority.addEventListener('change',filter);filter();
document.getElementById('expand').addEventListener('click',()=>{const open=rows.some(row=>!row.hidden&&!row.open);rows.filter(row=>!row.hidden).forEach(row=>row.open=open);document.getElementById('expand').textContent=open?'Collapse all':'Expand all';});
document.getElementById('print').addEventListener('click',()=>window.print());
</script></body></html>`;
};
export const renderTraceabilityCsv = (data: Analysis) => {
  const safe = (value: string) => `"${(/^\s*[=+@\-\t\r]/.test(value) ? "'" : '') + value.replace(/"/g, '""')}"`;
  const rows = [['ID','Category','Module','Priority','Statement','Source type','Source','Evidence','Acceptance criteria','Dependencies','User stories','Use cases','SDLC phases'], ...data.specification.requirements.map(req => [req.id, req.category, req.module, req.priority, req.statement, req.source.kind, req.source.reference, req.evidence.join('; '), req.acceptanceCriteria.join('; '), req.dependencies.join('; '), data.specification.userStories.filter(item => item.requirementIds.includes(req.id)).map(item => item.id).join('; '), data.specification.useCases.filter(item => item.requirementIds.includes(req.id)).map(item => item.id).join('; '), data.sdlcPlan.phases.filter(item => item.requirementIds.includes(req.id)).map(item => item.name).join('; ')])];
  return rows.map(row => row.map(safe).join(',')).join('\r\n');
};
