import type { Analysis } from './report';

export const renderThreatModelMarkdown=(data:Analysis)=>{
  const model=data.specification.threatModel;
  if(!model)return '# Threat model and register\n\nTBD — no structured threat model recorded. Regenerate this analysis and obtain an independent security review.\n';
  return `# Threat model and register — ${data.specification.title}

Run: ${data.runId} | Method: ${model.method} | Status: DRAFT — independent security review required.
${model.scope}

## Assets
${model.assets.map(value=>`- ${value}`).join('\n')}

## Trust boundaries
${model.trustBoundaries.map(value=>`- ${value}`).join('\n')}

## Threat register
${model.threats.map(threat=>`### ${threat.id}: ${threat.category}
Asset: ${threat.asset}
Trust boundary: ${threat.trustBoundary}
Actor: ${threat.actor}
Scenario: ${threat.scenario}
Likelihood: ${threat.likelihood} | Impact: ${threat.impact} | Status: ${threat.status}
Requirements: ${threat.requirementIds.join(', ')}
Risks: ${threat.riskIds.join(', ')||'None linked'}
Source (${threat.source.kind}): ${threat.source.reference}
Evidence: ${threat.evidence.join(', ')||'No source evidence attached; reviewer validation required'}
Mitigations:
${threat.mitigations.map(value=>`- ${value}`).join('\n')}
Verification: ${threat.verification}
Delivery gates: ${data.sdlcPlan.phases.filter(phase=>phase.requirementIds.some(id=>threat.requirementIds.includes(id))).map(phase=>`${phase.name}: ${phase.securityCheckpoint}`).join('; ')||'TBD — allocate threat verification to a delivery phase'}
Residual risk: ${threat.residualRisk}`).join('\n\n')}

Security reviewers must record mitigated, accepted-risk or not-applicable dispositions with evidence for the exact document version. These drafts do not assert successful tests, exhaustive threat detection or accepted risk. Workspace baseline attestations contain the subsequent human decisions.
`;
};
