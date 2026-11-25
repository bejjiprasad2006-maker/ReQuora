import { createHash } from 'node:crypto';
import type { Specification, SdlcPlan } from './schemas';
import { financialPolicySources, financialControls } from './financial-policies';
import { projectProfile, type ProjectProfile } from './profile';

export type PolicySource = {
  id: string; title: string; publisher: string; url: string; jurisdiction: string;
  version: string; effectiveDate: string | null; checkedAt: string; reviewDue: string;
  kind: 'guidance' | 'law' | 'standard' | 'organisation-policy';
  applicability: string; excerpt: string; sha256: string;
  domains?:ProjectProfile['domain'][];
};
const source = (value: Omit<PolicySource, 'sha256' | 'checkedAt' | 'reviewDue'>): PolicySource => ({ ...value, checkedAt: '2026-11-18', reviewDue: '2027-02-16', sha256: createHash('sha256').update(JSON.stringify(value)).digest('hex') });
export const policySources: PolicySource[] = [
  source({ id: 'SRC-OWASP', title: 'Application Security Verification Standard', publisher: 'OWASP', url: 'https://owasp.org/www-project-application-security-verification-standard/', jurisdiction: 'Global', version: '5.0.0 overview', effectiveDate: '2025-05-30', kind: 'standard', applicability: 'Project-selected application security verification guidance; not legislation.', excerpt: 'ASVS provides a framework of requirements for application security verification. Select applicable controls and retain test evidence.' }),
  source({ id: 'SRC-PCI', title: 'PCI SSC FAQ 1588', publisher: 'PCI Security Standards Council', url: 'https://www.pcisecuritystandards.org/faqs/1588/', jurisdiction: 'Global', version: 'February 2025 FAQ', effectiveDate: null, kind: 'standard', applicability: 'Card-payment assessment scope depends on integration and all eligibility criteria; review with acquirer/provider.', excerpt: 'The script-related SAQ A eligibility criterion discussed in FAQ 1588 concerns embedded payment forms. Redirect flows differ. This FAQ alone does not determine SAQ eligibility.' }),
  source({ id: 'SRC-GDPR', title: 'Regulation (EU) 2016/679', publisher: 'EUR-Lex', url: 'https://eur-lex.europa.eu/eli/reg/2016/679/oj/eng', jurisdiction: 'EU', version: 'Original regulation; verify applicable consolidated text', effectiveDate: '2018-05-25', kind: 'law', applicability: 'Candidate only when material and territorial scope are met; legal reviewer must determine applicability.', excerpt: 'Articles 5 and 6 address processing principles and lawful bases. Articles 12 to 22 address data subject rights. Article 32 addresses security appropriate to risk. Map specific obligations only after scope review.' }),
  source({ id: 'SRC-IND-CONSUMER', domains:['ecommerce'], title: 'Consumer Protection (E-Commerce) Rules, 2020', publisher: 'Department of Consumer Affairs, India', url: 'https://consumeraffairs.gov.in/public/upload/files/E%20commerce%20rules_1732703966.pdf', jurisdiction: 'India', version: '2020 rules; official index also lists 2021 amendment and corrigendum', effectiveDate: '2020-07-23', kind: 'law', applicability: 'Candidate for in-scope e-commerce offers to consumers in India; verify model-specific provisions and amendments.', excerpt: 'The rules cover inventory and marketplace e-commerce models and some foreign entities systematically offering goods or services to consumers in India. Disclosures, grievance arrangements and returns policies need a provision-specific legal review.' }),
  source({ id: 'SRC-IND-DPDP', title: 'Digital Personal Data Protection Rules, 2025 and Act commencement notice', publisher: 'MeitY, India', url: 'https://www.meity.gov.in/static/uploads/2025/11/53450e6e5dc0bfa85ebd78686cadad39.pdf', jurisdiction: 'India', version: 'G.S.R. 846(E), 13 November 2025; provision-specific commencement', effectiveDate: null, kind: 'law', applicability: 'Staged commencement; individual provision dates and entity scope must be reviewed, not inferred from the publication date.', excerpt: 'Rules 1, 2 and 17 to 21 commence at publication; Rule 4 after one year; Rules 3, 5 to 16, 22 and 23 after eighteen months. Treat future provision-specific requirements as readiness work until their commencement and applicability are confirmed.' }),
  source({ id: 'SRC-IND-DPDP-ACT', title: 'DPDP Act commencement notification', publisher: 'MeitY, India', url: 'https://www.meity.gov.in/static/uploads/2025/11/c56ceae6c383460ca69577428d36828b.pdf', jurisdiction: 'India', version: 'G.S.R. 843(E), 13 November 2025; provision-specific commencement', effectiveDate: null, kind: 'law', applicability: 'Staged Act commencement; verify the specific section and date with legal reviewer.', excerpt: 'The notice commences specified sections on publication, section 6(9) and section 27(1)(d) after one year, and specified remaining provisions after eighteen months. Publication alone does not make all substantive processing duties effective.' }),
  source({ id: 'SRC-PROJECT', title: 'RikuAI organisation policy decision register', publisher: 'Project policy', url: 'project://merchant-policy/v1', jurisdiction: 'Project', version: '1', effectiveDate: null, kind: 'organisation-policy', applicability: 'The organisation must supply and approve exact policies; this template supplies no legal or business deadlines.', excerpt: 'Regulatory perimeter, jurisdiction, financial transaction rules, authorisation limits, rounding, tax/return/refund rules where relevant, data retention, recovery and service targets require accountable owner decisions.' }),
  ...financialPolicySources,
];
export type Control = { id: string; title: string; sourceId: string; jurisdictions: string[]; categories: string[]; match: string; owner: 'security' | 'legal' | 'product_owner' | 'operations'; effectiveDate?: string; condition?: 'payments' | 'personalData' | 'embedded'; domains?:ProjectProfile['domain'][];entities?:ProjectProfile['regulatedEntity'][];useCases?:ProjectProfile['useCase'][] };
export const controls: Control[] = [
  { id: 'SEC-AUTHZ', title: 'Verify resource ownership and role-based authorisation', sourceId: 'SRC-OWASP', jurisdictions: ['Global'], categories: ['security'], match: 'authori[sz]|role|ownership|own orders|access', owner: 'security' },
  { id: 'SEC-PAYMENT-INTEGRITY', title: 'Verify transaction integrity and replay-safe processing', sourceId: 'SRC-OWASP', jurisdictions: ['Global'], categories: ['security','integration'], match: 'callback|idempot|replay|signature|refund', owner: 'security', condition: 'payments' },
  { id: 'PCI-SCOPE', title: 'Confirm card-payment architecture and assessment scope', sourceId: 'SRC-PCI', jurisdictions: ['Global'], categories: ['compliance','security'], match: 'hosted|provider|card|payment', owner: 'security', condition: 'payments' },
  { id: 'PCI-EMBEDDED-SCRIPTS', title: 'Review embedded payment-page script eligibility criterion', sourceId: 'SRC-PCI', jurisdictions: ['Global'], categories: ['security','compliance'], match: 'script|iframe|embedded', owner: 'security', condition: 'embedded' },
  { id: 'EU-PRINCIPLES', title: 'Map purpose, minimisation and lawful processing basis (Arts. 5–6)', sourceId: 'SRC-GDPR', jurisdictions: ['EU'], categories: ['privacy','data'], match: 'purpose|minimi|lawful|consent|customer data', owner: 'legal', condition: 'personalData' },
  { id: 'EU-RIGHTS', title: 'Map applicable data-subject rights (Arts. 12–22)', sourceId: 'SRC-GDPR', jurisdictions: ['EU'], categories: ['privacy'], match: 'erasure|delete|rectif|portab|data subject|access request', owner: 'legal', condition: 'personalData' },
  { id: 'EU-SECURITY', title: 'Review risk-appropriate processing security (Art. 32)', sourceId: 'SRC-GDPR', jurisdictions: ['EU'], categories: ['privacy','security'], match: 'encrypt|security|restore|access|recover', owner: 'legal', condition: 'personalData' },
  { id: 'IND-ECOMMERCE', title: 'Map entity/model-specific consumer disclosures and grievance obligations', sourceId: 'SRC-IND-CONSUMER', jurisdictions: ['India'], categories: ['compliance','business'], match: 'grievance|disclos|return|refund|merchant|seller|consumer', owner: 'legal' },
  { id: 'IND-DPDP-READINESS', title: 'Review provision-specific DPDP notice/processing readiness and commencement', sourceId: 'SRC-IND-DPDP', jurisdictions: ['India'], categories: ['privacy','compliance'], match: 'notice|consent|personal|privacy|customer data', owner: 'legal', condition: 'personalData' },
  { id: 'POL-RETURNS', title: 'Approve cancellation, return and refund business policies', sourceId: 'SRC-PROJECT', jurisdictions: ['Global'], categories: ['business'], match: 'return|refund|cancel', owner: 'product_owner' },
  { id: 'POL-RETENTION', title: 'Approve data retention, deletion and legal hold policy', sourceId: 'SRC-PROJECT', jurisdictions: ['Global'], categories: ['data','privacy'], match: 'retention|delete|legal hold|archiv', owner: 'legal', condition: 'personalData' },
  { id: 'POL-TAX', title: 'Determine tax jurisdictions, invoice and rounding policies', sourceId: 'SRC-PROJECT', jurisdictions: ['Global'], categories: ['business','compliance'], match: 'tax|invoice|rounding', owner: 'legal' },
  { id: 'POL-RECOVERY', title: 'Approve and verify recovery/service objectives', sourceId: 'SRC-PROJECT', jurisdictions: ['Global'], categories: ['operational','availability'], match: 'recover|restore|backup|availability|monitor', owner: 'operations' },
  ...financialControls,
];
export type ControlMapping = { controlId: string; title: string; sourceId: string; owner: Control['owner']; temporalStatus: 'current-candidate' | 'upcoming' | 'unknown'; requirementIds: string[]; status: 'candidate' | 'gap' | 'scope-review'; reason: string };
export type ComplianceAnalysis = { catalogVersion: string; asOf: string; sources: PolicySource[]; mappings: ControlMapping[]; jurisdictionGaps: string[] };
export const complianceWorkflow=(analysis:ComplianceAnalysis,plan:SdlcPlan)=>analysis.mappings.map(mapping=>{
  const phases=plan.phases.filter(phase=>phase.requirementIds.some(id=>mapping.requirementIds.includes(id)));
  return {controlId:mapping.controlId,sourceId:mapping.sourceId,owner:mapping.owner,phases:(phases.length?phases:[plan.phases[0]!]).map(phase=>phase.name),reviewPurpose:phases.length?'Verify applicability and linked control evidence at phase exit.':'Resolve scope or missing coverage at the first phase before baseline approval.'};
});
export const analyseCompliance = (spec: Specification, asOf = new Date().toISOString().slice(0,10),catalogSources:PolicySource[]=policySources,catalogControls:Control[]=controls): ComplianceAnalysis => {
  const context = spec.projectContext,profile=projectProfile(context);
  const mappings: ControlMapping[] = [];
  for (const control of catalogControls) {
    if(control.domains&&!control.domains.includes(profile.domain))continue;
    if(profile.domain==='finance'&&['IND-ECOMMERCE','POL-RETURNS','POL-TAX'].includes(control.id))continue;
    if(control.entities&&profile.regulatedEntity!=='unknown'&&!control.entities.includes(profile.regulatedEntity))continue;
    if(control.useCases&&profile.useCase!=='other'&&!control.useCases.includes(profile.useCase))continue;
    if (control.condition === 'payments' && context.paymentIntegration === 'none') continue;
    if (control.condition === 'personalData' && !context.personalData) continue;
    if (control.condition === 'embedded' && !['embedded','unknown'].includes(context.paymentIntegration)) continue;
    const scoped = control.jurisdictions.includes('Global') || control.jurisdictions.some(j => context.jurisdictions.includes(j as typeof context.jurisdictions[number]));
    const unknown = context.jurisdictions.includes('Unspecified');
    if (!scoped && !unknown) continue;
    const ids = spec.requirements.filter(req => new RegExp(control.match, 'i').test(`${req.statement} ${req.acceptanceCriteria.join(' ')}`)).map(req => req.id);
    const scopeUncertain=!scoped||Boolean(control.entities&&profile.regulatedEntity==='unknown')||Boolean(control.useCases&&profile.useCase==='other')||Boolean(['payments','embedded'].includes(control.condition??'')&&context.paymentIntegration==='unknown');
    const effectiveDate=control.effectiveDate??catalogSources.find(source=>source.id===control.sourceId)?.effectiveDate;
    mappings.push({ controlId: control.id, title: control.title, sourceId: control.sourceId, owner: control.owner,
      temporalStatus: effectiveDate ? (asOf < effectiveDate ? 'upcoming' : 'current-candidate') : 'unknown',
      requirementIds: ids, status: scopeUncertain ? 'scope-review' : ids.length ? 'candidate' : 'gap',
      reason: scopeUncertain ? 'Jurisdiction, entity or service scope is unresolved; confirm applicability with the legal reviewer.' : ids.length ? 'Lexical candidate link only. Reviewer must verify applicability, exact provision and requirement sufficiency.' : 'No candidate requirement found. Reviewer must add coverage or justify exclusion.',
    });
  }
  const supported = new Set(['Unspecified',...catalogSources.filter(s=>s.kind==='law').map(s=>s.jurisdiction)]);
  const jurisdictionGaps = context.jurisdictions.filter(j => !supported.has(j)).map(j => `No jurisdiction-specific legal source pack is installed for ${j}; add approved sources before baseline approval.`);
  if (context.jurisdictions.includes('Unspecified')) jurisdictionGaps.push('Project jurisdiction must be confirmed before legal approval.');
  if(profile.domain==='finance'&&profile.regulatedEntity==='unknown')jurisdictionGaps.push('Financial operating entity and regulatory perimeter must be confirmed before baseline approval.');
  return { catalogVersion: createHash('sha256').update(JSON.stringify({catalogSources,catalogControls})).digest('hex'), asOf, sources: catalogSources.filter(s => mappings.some(m => m.sourceId === s.id) || s.id === 'SRC-IND-DPDP-ACT' && context.jurisdictions.includes('India')), mappings, jurisdictionGaps };
};
