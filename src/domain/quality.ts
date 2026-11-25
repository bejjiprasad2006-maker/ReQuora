import { factorKeys, type SdlcPlan, type Specification } from './schemas';
import { validateSrs } from './srs';
import { projectProfile, type ProjectProfile } from './profile';

export type Finding = { code: string; severity: 'warning' | 'error'; requirementId?: string; message: string };
export const validateSpecification = (spec: Specification, brief: string, evidenceIds: string[],expectedProfile?:Partial<ProjectProfile>): Finding[] => {
  const findings: Finding[] = validateSrs(spec), ids = new Set(spec.requirements.map(req => req.id));
  const assumptions = new Set(spec.assumptions.map(item => item.id)), allowedEvidence = new Set(evidenceIds);
  const add = (code: string, message: string, requirementId?: string, severity: Finding['severity'] = 'warning') => findings.push({ code, message, requirementId, severity });
  const seen = new Set<string>(), normalized = new Map<string, string>();
  const checkRefs = (references: string[], owner: string) => references.forEach(id => { if (!ids.has(id)) add('BROKEN_REFERENCE', `${owner} refers to unknown requirement ${id}.`, id, 'error'); });
  let profile:ProjectProfile;
  try{profile=projectProfile(spec.projectContext);}catch{add('INVALID_PROJECT_PROFILE','The generated domain, use case and entity type conflict.',undefined,'error');profile=projectProfile();}
  if(expectedProfile){const expected=projectProfile(expectedProfile);if(JSON.stringify(profile)!==JSON.stringify(expected))add('PROJECT_PROFILE_MISMATCH','The model changed the declared domain, use case or entity type.',undefined,'error');}
  if(profile.domain==='finance'&&['unknown','not-applicable'].includes(profile.regulatedEntity))add('FINANCE_ENTITY_SCOPE','Confirm the operating financial entity and applicable regulatory perimeter before baseline approval.');
  if(!spec.threatModel)add('THREAT_MODEL_MISSING','No structured threat model is recorded. Regenerate or complete a security review.');
  else{
    const threatIds=new Set<string>(),riskIds=new Set(spec.risks.map(r=>r.id));
    for(const threat of spec.threatModel.threats){
      if(threatIds.has(threat.id))add('DUPLICATE_THREAT_ID',`Duplicate threat ${threat.id}.`,undefined,'error');threatIds.add(threat.id);
      checkRefs(threat.requirementIds,threat.id);
      if(threat.riskIds.some(id=>!riskIds.has(id)))add('BROKEN_THREAT_REFERENCE',`${threat.id} refers to an unknown risk.`,undefined,'error');
      if(!spec.threatModel.assets.includes(threat.asset)||!spec.threatModel.trustBoundaries.includes(threat.trustBoundary))add('THREAT_SCOPE_MISMATCH',`${threat.id} names an asset or trust boundary outside the model.`,undefined,'error');
      if(threat.evidence.some(id=>!allowedEvidence.has(id)))add('UNSUPPORTED_THREAT_CITATION',`${threat.id} cites unavailable evidence.`,undefined,'error');
      if(threat.source.kind==='assumption'&&!assumptions.has(threat.source.reference)||threat.source.kind==='evidence'&&!allowedEvidence.has(threat.source.reference)||threat.source.kind==='stakeholder'&&!brief.toLowerCase().includes(threat.source.reference.toLowerCase()))add('UNSUPPORTED_THREAT_SOURCE',`${threat.id} has an unverified source.`,undefined,'error');
    }
  }
  for (const req of spec.requirements) {
    if (!req.categories.includes(req.category)) add('CATEGORY_MISMATCH', 'Primary category must also appear in multi-label categories.', req.id, 'error');
    if (req.approvalStatus !== 'draft') add('UNAUTHORISED_APPROVAL', 'Agents cannot approve or reject requirements. New requirements must be drafts.', req.id, 'error');
    if (seen.has(req.id)) add('DUPLICATE_ID', `Duplicate requirement ID ${req.id}.`, req.id, 'error');
    seen.add(req.id);
    const text = req.statement.toLowerCase().replace(/\W+/g, ' ').trim();
    if (normalized.has(text)) add('DUPLICATE_REQUIREMENT', `Duplicates ${normalized.get(text)}.`, req.id, 'error');
    normalized.set(text, req.id);
    if (/\b(fast|user.friendly|seamless|robust|as soon as possible|scalable|highly secure)\b/i.test(req.statement)) add('AMBIGUOUS', 'Replace vague wording with an observable acceptance target.', req.id);
    if (req.confidence < 0.7) add('LOW_CONFIDENCE', 'Self-assessed confidence below 0.70; not calibrated accuracy.', req.id);
    if (req.source.kind === 'stakeholder' && !brief.toLowerCase().includes(req.source.reference.toLowerCase())) add('UNVERIFIED_QUOTE', 'Source is not an exact excerpt of the brief.', req.id, 'error');
    if (req.source.kind === 'assumption' && !assumptions.has(req.source.reference)) add('UNKNOWN_ASSUMPTION', `Unknown assumption ${req.source.reference}.`, req.id, 'error');
    if (req.source.kind === 'evidence' && !allowedEvidence.has(req.source.reference)) add('UNSUPPORTED_SOURCE', 'Source was not retrieved for this run.', req.id, 'error');
    for (const source of req.evidence) if (!allowedEvidence.has(source)) add('UNSUPPORTED_CITATION', `Evidence was not retrieved: ${source}`, req.id, 'error');
    if (['compliance', 'security', 'privacy'].includes(req.category) && !req.evidence.length) add('NEEDS_VALIDATION', 'No retrieved evidence; verify applicability with a reviewer.', req.id);
    if (req.dependencies.includes(req.id)) add('SELF_DEPENDENCY', 'Requirement depends on itself.', req.id, 'error');
    checkRefs(req.dependencies, req.id);
  }
  for (const item of [...spec.userStories, ...spec.useCases, ...spec.risks, ...spec.dataRequirements, ...spec.interfaceRequirements]) checkRefs(item.requirementIds, item.id);
  const visiting = new Set<string>(), visited = new Set<string>();
  const visit = (id: string) => {
    if (visiting.has(id)) { add('DEPENDENCY_CYCLE', `Dependency cycle includes ${id}.`, id, 'error'); return; }
    if (visited.has(id)) return;
    visiting.add(id);
    for (const dependency of spec.requirements.find(req => req.id === id)?.dependencies ?? []) if (ids.has(dependency)) visit(dependency);
    visiting.delete(id); visited.add(id);
  };
  for (const id of ids) visit(id);
  for (const factor of factorKeys) checkRefs(spec.decisionFactors[factor].requirementIds, factor);
  // Scoped checklist, not proof of semantic completeness or contradiction detection.
  for (const [name, regex] of Object.entries(profile.domain==='finance'?{}:{ catalogue: /catalog|product|search/i, checkout: /checkout|cart/i, orders: /order|fulfil|ship/i })) {
    if (!spec.requirements.some(req => regex.test(`${req.module} ${req.statement}`))) add('MODULE_GAP', `No ${name} requirement identified; confirm whether in scope.`);
  }
  const covered = new Set(spec.userStories.flatMap(story => story.requirementIds));
  for (const req of spec.requirements) if (req.category === 'functional' && !covered.has(req.id)) add('STORY_GAP', 'Functional requirement has no linked story.', req.id);
  if (spec.openQuestions.length) add('OPEN_QUESTIONS', `${spec.openQuestions.length} clarification questions remain before baselining.`);
  return findings;
};

export const analyseQuality = (spec: Specification): Finding[] => {
  const result: Finding[] = [];
  const words = (value: string) => new Set((value.toLowerCase().match(/[a-z]{3,}/g) ?? []).filter(word => !['the','shall','system','platform','must','not','never','allow','require'].includes(word)));
  const negated = (value: string) => /\b(not|never|prohibit|forbid|disable)\b/i.test(value);
  for (const [index, req] of spec.requirements.entries()) {
    if (/\b(?:availability|uptime)\b.*\b(?:10[1-9]|1[1-9]\d|[2-9]\d{2})\s*%/i.test(req.statement)) result.push({code:'INFEASIBLE_TARGET',severity:'error',requirementId:req.id,message:'Availability above 100% is not feasible; correct the target.'});
    if (req.acceptanceCriteria.every(text => !/\b(given|when|then|return(?:s|ed)?|reject(?:s|ed)?|record(?:s|ed)?|display(?:s|ed)?|verif(?:y|ies|ied)|assert(?:s|ed)?|measur(?:e|es|ed)|within|receiv(?:e|es|ed)|recover(?:s|ed)?|rais(?:e|es|ed)|occur(?:s|red)?|contain(?:s|ed)?|denied|cannot|must|shall|exact(?:ly)?|at most|at least)\b|\d/i.test(text))) result.push({code:'TESTABILITY_REVIEW',severity:'warning',requirementId:req.id,message:'No observable outcome found by the testability heuristic. Reviewer must define a measurable pass/fail criterion.'});
    const acronyms = req.statement.match(/\b[A-Z]{2,6}\b/g) ?? [];
    const known = new Set(['API','HTTPS','HTTP','ID','UUID','PDF','CSV','JSON','SQL','UI','SRS','SDLC','TLS','PCI','DSS','MFA','RBAC',...spec.glossary.map(item=>item.term.toUpperCase())]);
    for (const term of new Set(acronyms)) if (!known.has(term)) result.push({code:'UNDEFINED_TERM',severity:'warning',requirementId:req.id,message:`Define ${term} in the project glossary or identify the approved reference.`});
    const left=words(req.statement);
    for (const other of spec.requirements.slice(index+1)) {
      if(req.module!==other.module || negated(req.statement)===negated(other.statement))continue;
      const right=words(other.statement), intersection=[...left].filter(word=>right.has(word)).length;
      const union=new Set([...left,...right]).size;
      if(union && intersection/union>=0.65) result.push({code:'POTENTIAL_CONTRADICTION',severity:'warning',requirementId:req.id,message:`Potentially opposite requirement ${other.id}; clarify stakeholder intent. Lexical screening requires semantic review.`});
    }
  }
  return result;
};
export const validateSdlc = (spec: Specification, plan: SdlcPlan, expectedModel: string): Finding[] => {
  const findings: Finding[] = [], ids = new Set(spec.requirements.map(req => req.id));
  if (plan.selectedModel !== expectedModel) findings.push({ code: 'MODEL_MISMATCH', severity: 'error', message: 'SDLC Agent did not follow the highest-ranked policy result.' });
  for (const item of [...plan.justification, ...plan.alternatives, ...plan.phases]) for (const id of item.requirementIds) if (!ids.has(id)) findings.push({ code: 'BROKEN_SDLC_REFERENCE', severity: 'error', requirementId: id, message: `Unknown SDLC requirement reference ${id}.` });
  const coverage = new Set(plan.phases.flatMap(phase => phase.requirementIds));
  for(const threat of spec.threatModel?.threats??[])if(!threat.requirementIds.some(id=>coverage.has(id)))findings.push({code:'THREAT_PHASE_GAP',severity:'warning',message:`Threat ${threat.id} has no linked verification phase.`});
  for (const req of spec.requirements) if (req.priority === 'Must' && !coverage.has(req.id)) findings.push({ code: 'WORKFLOW_GAP', severity: 'warning', requirementId: req.id, message: 'Must requirement is not allocated to a phase.' });
  if (new Set(plan.alternatives.map(item => item.model)).size < 2 || plan.alternatives.some(item => item.model === plan.selectedModel)) findings.push({ code: 'INVALID_ALTERNATIVES', severity: 'error', message: 'Compare two distinct alternatives other than the chosen model.' });
  return findings;
};
