import { srsTopics, type Specification } from './schemas';
import type { Analysis } from './report';
import type { Finding } from './quality';
import { projectProfile } from './profile';

type Topic = typeof srsTopics[number];
const topicLabels: Record<Topic, string> = {
  userInterfaces: 'User interfaces', hardwareInterfaces: 'Hardware interfaces',
  softwareInterfaces: 'Software interfaces', communicationsInterfaces: 'Communications interfaces',
  performance: 'Performance requirements', database: 'Logical database requirements',
  designConstraints: 'Design constraints', reliability: 'Reliability', availability: 'Availability',
  security: 'Security and privacy', maintainability: 'Maintainability', portability: 'Portability',
  otherAttributes: 'Other software attributes',
};
const topicCategories: Partial<Record<Topic, Specification['requirements'][number]['category'][]>> = {
  softwareInterfaces: ['integration'], performance: ['performance'], database: ['data'],
  designConstraints: ['design-constraint', 'compliance'], reliability: ['reliability'],
  availability: ['availability'], security: ['security', 'privacy', 'audit'],
  maintainability: ['maintainability'], portability: ['portability'], otherAttributes: ['usability', 'operational'],
};
const list = (items: string[], fallback = 'TBD — no information recorded; stakeholder review required.') => items.length ? items.map(item => `- ${item}`).join('\n') : fallback;
const table = (headers: string[], rows: string[][]) => [headers, headers.map(() => '---'), ...rows].map(row => `| ${row.map(value => value.replace(/\|/g, '\\|').replace(/[\r\n]+/g, ' ')).join(' | ')} |`).join('\n');
const unresolved = /\b(TBD|TBC|unresolved|unknown|unspecified|unconfirmed|not (?:yet )?(?:agreed|confirmed|defined)|needs? confirmation)\b/i;

const linkedRequirements = (spec: Specification, topic: Topic) => {
  const explicit = spec.srsContext?.coverage.find(item => item.topic === topic)?.requirementIds ?? [];
  const contractLinks = topic === 'database' ? spec.dataRequirements.flatMap(item => item.requirementIds) : ['softwareInterfaces', 'communicationsInterfaces'].includes(topic) ? spec.interfaceRequirements.flatMap(item => item.requirementIds) : [];
  return spec.requirements.filter(req => explicit.includes(req.id) || contractLinks.includes(req.id) || req.categories.some(category => topicCategories[topic]?.includes(category)));
};

export const validateSrs = (spec: Specification): Finding[] => {
  const findings: Finding[] = [];
  const add = (code: string, message: string, severity: Finding['severity'] = 'warning') => findings.push({ code, severity, message });
  const context = spec.srsContext;
  if (!context) add('SRS_CONTEXT_MISSING', 'IEEE 830 introduction and product context are missing from this older draft. Regenerate the analysis to populate them.');
  else {
    const ids = new Set(spec.requirements.map(req => req.id)), seen = new Set<Topic>();
    for (const item of context.coverage) {
      if (seen.has(item.topic)) add('SRS_DUPLICATE_TOPIC', `Multiple dispositions for ${topicLabels[item.topic]}.`, 'error');
      seen.add(item.topic);
      if (item.requirementIds.some(id => !ids.has(id))) add('BROKEN_SRS_REFERENCE', `${topicLabels[item.topic]} refers to an unknown requirement.`, 'error');
      if (item.status === 'specified' && (!item.requirementIds.length || unresolved.test(item.description))) add('SRS_TOPIC_INCOMPLETE', `${topicLabels[item.topic]} is marked specified but lacks requirement links or contains unresolved information.`);
      if (item.status === 'not-applicable' && (linkedRequirements(spec, item.topic).length || unresolved.test(item.description))) add('SRS_APPLICABILITY_CONFLICT', `${topicLabels[item.topic]} is excluded despite linked requirements or an unresolved rationale.`, 'error');
    }
    const prose = [context.purpose, context.productPerspective, ...context.userCharacteristics.map(item => item.characteristics), ...context.constraints, ...context.externalDependencies, context.apportioning];
    if (prose.some(value => unresolved.test(value))) add('SRS_CONTEXT_UNRESOLVED', 'Product context contains TBD/unresolved information. Resolve it with stakeholders before adopting the SRS.');
  }
  for (const topic of srsTopics) {
    const item = context?.coverage.find(entry => entry.topic === topic);
    if (!item || item.status === 'unresolved') add('SRS_SECTION_GAP', `${topicLabels[topic]}: ${item?.description ?? 'no section disposition recorded; specify requirements or justify non-applicability.'}`);
  }
  if (!spec.glossary.length) add('SRS_GLOSSARY_GAP', 'Define project terms, abbreviations and acronyms in section 1.3.');
  if (!spec.dataRequirements.length && context?.coverage.find(item => item.topic === 'database')?.status !== 'not-applicable') add('SRS_DATA_GAP', 'Logical database entities, fields and retention policies are not recorded.');
  if (spec.dataRequirements.some(item => unresolved.test(item.retentionPolicy))) add('SRS_DATA_UNRESOLVED', 'Data retention policies remain unresolved in section 3.4.');
  if (!spec.interfaceRequirements.length && context?.coverage.some(item => ['softwareInterfaces', 'communicationsInterfaces'].includes(item.topic) && item.status === 'specified')) add('SRS_INTERFACE_GAP', 'Specified software/communications interfaces need contracts including inputs, outputs, authentication and failure behavior.');
  return findings;
};

const requirementSection = (category: Specification['requirements'][number]['category']) => {
  if (category === 'integration') return '3.1';
  if (['business', 'stakeholder', 'functional'].includes(category)) return '3.2';
  if (category === 'performance') return '3.3';
  if (category === 'data') return '3.4';
  if (['design-constraint', 'compliance'].includes(category)) return '3.5';
  return '3.6';
};

export const renderSrsMarkdown = (data: Analysis) => {
  const spec = data.specification, context = spec.srsContext;
  const profile=projectProfile(spec.projectContext);
  const requirementDetails = (section: string) => spec.requirements.filter(req => requirementSection(req.category) === section).map(req => `#### ${req.id} · ${req.module} · ${req.priority}
${req.statement}

Category: ${req.category}; labels: ${req.categories.join(', ')}
Stakeholder: ${req.stakeholder} | Risk: ${req.riskLevel} | Approval: ${req.approvalStatus}
Business justification: ${req.businessJustification}
Source (${req.source.kind}): ${req.source.reference}
Evidence: ${req.evidence.join(', ') || 'NEEDS-VALIDATION / no source attached'}
Dependencies: ${req.dependencies.join(', ') || 'None recorded'}
Candidate controls: ${req.applicableControlIds.join(', ') || 'See reviewer control matrix'}
Confidence (self-assessed): ${req.confidence}
Verification: ${req.verification}

Acceptance criteria:
${list(req.acceptanceCriteria)}`).join('\n\n');
  const topic = (key: Topic) => {
    const item = context?.coverage.find(entry => entry.topic === key);
    return `Disposition: ${item?.status ?? 'unresolved'}\n${item?.description ?? 'TBD — specify this area or record a justified scope exclusion.'}\nRequirement references: ${linkedRequirements(spec, key).map(req => req.id).join(', ') || 'None recorded'}`;
  };
  const findings = validateSrs(spec);
  return `# Software Requirements Specification — ${spec.title}

Document ID: SRS-${data.runId} | Issued (UTC): ${data.createdAt}
Status: DRAFT — human review required. Mode: ${data.mode.toUpperCase()}${data.mode === 'demo' ? ' (authored fixture; no LLM calls)' : ''}.
Structure: IEEE Std 830-1998, tailored by requirement type. Section coverage is not certification of correctness or completeness.
Revision history: this run is an immutable draft; workspace version history and baseline attestations record subsequent changes and approvals.

## Contents
1. Introduction (1.1–1.5)
2. Overall description (2.1–2.6)
3. Specific requirements (3.1–3.6)
Appendix A: Traceability and verification
Appendix B: Supporting scenarios and risks
Appendix C: Open issues and SRS coverage
Appendix D: Evidence register
Index: Requirement identifiers

## 1. Introduction

### 1.1 Purpose
${context?.purpose ?? 'TBD — document purpose and intended audience were not captured in this older analysis.'}

### 1.2 Scope
${spec.summary}

In scope:
${list(spec.scope)}

Out of scope:
${list(spec.outOfScope, 'No exclusions recorded; confirm the product boundary with stakeholders.')}

### 1.3 Definitions, acronyms and abbreviations
${table(['Term', 'Definition'], [['SRS', 'Software Requirements Specification'], ['SDLC', 'Software Development Life Cycle'], ['TBD', 'To be determined through stakeholder review'], ...spec.glossary.filter(item => !['SRS', 'SDLC', 'TBD'].includes(item.term.toUpperCase())).map(item => [item.term, item.definition])])}

### 1.4 References
- IEEE Std 830-1998, IEEE Recommended Practice for Software Requirements Specifications, IEEE, 20 October 1998: https://standards.ieee.org/ieee/830/1222/ (document structure reference).
- Stakeholder brief for run ${data.runId}; requirement source excerpts and Appendix D identify the input and supporting evidence.
${list(data.evidence.map(item => `${item.id} | SHA-256: ${item.sha256}`), 'No retrieved supporting references recorded.')}
${data.compliance?.sources.map(item => `- ${item.id}: ${item.title} | ${item.version} | ${item.url} | SHA-256: ${item.sha256} (candidate applicability; human review required)`).join('\n') ?? ''}

### 1.5 Overview
Section 2 describes the product and its context. Section 3 states interface, functional, performance, data, constraint and software attribute requirements. Appendices provide verification traceability, scenarios, risks, unresolved decisions and evidence. The accompanying delivery report presents the SDLC recommendation before this SRS.

## 2. Overall description

### 2.1 Product perspective
${context?.productPerspective ?? 'TBD — system boundary, operating environment and relationships to other systems need stakeholder confirmation.'}
Business model: ${spec.projectContext.businessModel}. Payment integration: ${spec.projectContext.paymentIntegration}.
Domain: ${profile.domain}. Use case: ${profile.useCase}. Declared financial entity: ${profile.regulatedEntity}.
Declared jurisdictions: ${spec.projectContext.jurisdictions.join(', ')}. Personal data in scope: ${spec.projectContext.personalData ? 'Yes' : 'No'}.

### 2.2 Product functions
${list([...new Set(spec.requirements.filter(req => ['functional', 'integration'].includes(req.category)).map(req => req.module))])}
The detailed behavior and acceptance criteria are specified in section 3.

### 2.3 User characteristics
${context ? table(['User class', 'Characteristics / needs'], context.userCharacteristics.map(item => [item.userClass, item.characteristics])) : 'TBD — user skills, experience and accessibility needs were not recorded.'}

Stakeholders:
${list(spec.stakeholders)}

### 2.4 Constraints
${list(context?.constraints ?? [])}
Detailed mandatory design and standards constraints appear in section 3.5; candidate legal mappings require independent applicability review.

### 2.5 Assumptions and dependencies
Assumptions:
${list(spec.assumptions.map(item => `${item.id}: ${item.statement}`), 'No assumptions recorded; confirm with stakeholders.')}

External dependencies:
${list(context?.externalDependencies ?? [])}

Requirement dependencies are retained beside each requirement and in Appendix A.

### 2.6 Apportioning of requirements
${context?.apportioning ?? 'TBD — no agreed allocation to future releases was recorded.'}
Must, Should and Could indicate priority; they do not independently establish release commitments.

## 3. Specific requirements
Each requirement retains its identifier, source, priority, dependencies, acceptance criteria and verification method. Primary categories determine placement; section references preserve overlapping concerns.

### 3.1 External interface requirements
#### 3.1.1 User interfaces
${topic('userInterfaces')}

#### 3.1.2 Hardware interfaces
${topic('hardwareInterfaces')}

#### 3.1.3 Software interfaces
${topic('softwareInterfaces')}

#### 3.1.4 Communications interfaces
${topic('communicationsInterfaces')}

#### 3.1.5 Interface contracts and associated requirements
${spec.interfaceRequirements.map(item => `##### ${item.id}: ${item.name}\nProtocol: ${item.protocol}\nAuthentication: ${item.authentication}\nInputs: ${item.inputs.join(', ')}\nOutputs: ${item.outputs.join(', ')}\nFailure handling: ${item.failureHandling}\nRequirements: ${item.requirementIds.join(', ')}`).join('\n\n') || 'No interface contracts recorded; review dispositions above.'}

${requirementDetails('3.1')}

### 3.2 Functional requirements
${requirementDetails('3.2') || 'TBD — no functional requirements recorded.'}

### 3.3 Performance requirements
${topic('performance')}

${requirementDetails('3.3')}

### 3.4 Logical database requirements
${topic('database')}

${spec.dataRequirements.map(item => `#### ${item.id}: ${item.entity}\n${table(['Field', 'Type', 'Classification'], item.fields.map(field => [field.name, field.type, field.classification]))}\nRetention: ${item.retentionPolicy}\nRequirements: ${item.requirementIds.join(', ')}`).join('\n\n') || 'No entity definitions recorded; review the disposition above.'}

${requirementDetails('3.4')}

### 3.5 Design constraints
${topic('designConstraints')}

${requirementDetails('3.5')}

### 3.6 Software system attributes
${(['reliability', 'availability', 'security', 'maintainability', 'portability', 'otherAttributes'] as const).map((key, index) => `#### 3.6.${index + 1} ${topicLabels[key]}\n${topic(key)}`).join('\n\n')}

#### Attribute requirements
${requirementDetails('3.6')}

## Appendix A. Traceability and verification
${table(['ID', 'SRS section', 'Source', 'Stories', 'Use cases', 'Dependencies', 'Delivery phases', 'Verification'], spec.requirements.map(req => [req.id, requirementSection(req.category), req.source.reference, spec.userStories.filter(item => item.requirementIds.includes(req.id)).map(item => item.id).join(', '), spec.useCases.filter(item => item.requirementIds.includes(req.id)).map(item => item.id).join(', '), req.dependencies.join(', '), data.sdlcPlan.phases.filter(item => item.requirementIds.includes(req.id)).map(item => item.name).join(', '), req.verification]))}

## Appendix B. Supporting scenarios and risks
### User stories
${spec.userStories.map(item => `#### ${item.id}\n${item.story}\nRequirements: ${item.requirementIds.join(', ')}\n${list(item.acceptanceCriteria)}`).join('\n\n')}

### Use cases
${spec.useCases.map(item => `#### ${item.id}: ${item.title}\nActor: ${item.actor}. Requirements: ${item.requirementIds.join(', ')}\nPreconditions: ${item.preconditions.join('; ')}\n${item.steps.map((step, i) => `${i + 1}. ${step}`).join('\n')}\nExceptions: ${item.exceptions.join('; ') || 'None recorded'}`).join('\n\n')}

### Risks
${table(['ID / severity', 'Risk', 'Mitigation', 'Requirements', 'SDLC implication'], spec.risks.map(item => [`${item.id} / ${item.severity}`, item.description, item.mitigation, item.requirementIds.join(', '), item.sdlcImpact]))}

### Threat model cross-reference
${spec.threatModel?`Method: ${spec.threatModel.method}. Scope: ${spec.threatModel.scope}\n${table(['Threat','Category','Asset','Impact','Requirements','Verification'],spec.threatModel.threats.map(item=>[item.id,item.category,item.asset,item.impact,item.requirementIds.join(', '),item.verification]))}\nThe accompanying threat-model.md contains scenarios, trust boundaries, mitigations, residual risks and delivery gates. Independent dispositions are retained with the baseline attestations.`:'TBD — no structured threat model recorded; obtain a security review.'}

## Appendix C. Open issues and SRS coverage
${list(spec.openQuestions, 'No clarification questions recorded; independent review is still required.')}

${list(findings.map(item => `[${item.severity.toUpperCase()}] ${item.code}: ${item.message}`), 'No automated SRS coverage gaps found; substantive completeness requires human review.')}

Quality review must assess correctness, clarity, completeness, consistency, prioritization, verifiability, modifiability and traceability. Automated section checks cannot establish these qualities. Product owner and technical reviewers must review the draft before adoption; approvals are recorded separately in workspace baseline attestations.

## Appendix D. Evidence register
${data.evidence.map(item => `### ${item.id}\nSHA-256: ${item.sha256}\n${item.content}`).join('\n\n') || 'No supporting evidence retrieved.'}

## Index. Requirement identifiers
${list(spec.requirements.map(req => `${req.id} — section ${requirementSection(req.category)} — ${req.module}`))}
`;
};
