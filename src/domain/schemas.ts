import { z } from 'zod';
import { profileFields } from './profile';

export const models = ['Agile', 'DevSecOps', 'Spiral', 'V-Model', 'Waterfall', 'Agile + DevSecOps', 'Agile + V-Model'] as const;
export const factorKeys = ['changeFrequency', 'securityRisk', 'uncertainty', 'verification', 'continuousDelivery', 'stakeholderAvailability', 'legacyComplexity', 'approvalFormality', 'requirementStability', 'regulatoryCriticality', 'projectComplexity', 'systemSize', 'budgetConstraint', 'schedulePressure', 'formalVerification', 'failureConsequence'] as const;
const factor = z.object({ rating: z.number().int().min(0).max(4), rationale: z.string().min(5), requirementIds: z.array(z.string()).min(1) });
export const factorsSchema = z.object({ changeFrequency: factor, securityRisk: factor, uncertainty: factor, verification: factor, continuousDelivery: factor, stakeholderAvailability: factor, legacyComplexity: factor, approvalFormality: factor, requirementStability: factor, regulatoryCriticality: factor, projectComplexity: factor, systemSize: factor, budgetConstraint: factor, schedulePressure: factor, formalVerification: factor, failureConsequence: factor });
export const categories = ['business', 'stakeholder', 'functional', 'security', 'privacy', 'compliance', 'performance', 'availability', 'usability', 'data', 'integration', 'audit', 'operational', 'reliability', 'maintainability', 'portability', 'design-constraint'] as const;
export const srsTopics = ['userInterfaces', 'hardwareInterfaces', 'softwareInterfaces', 'communicationsInterfaces', 'performance', 'database', 'designConstraints', 'reliability', 'availability', 'security', 'maintainability', 'portability', 'otherAttributes'] as const;
export const srsContextSchema = z.object({
  purpose: z.string().trim().min(10), productPerspective: z.string().trim().min(10),
  userCharacteristics: z.array(z.object({ userClass: z.string().trim().min(2), characteristics: z.string().trim().min(10) })).min(1),
  constraints: z.array(z.string().trim().min(5)).min(1),
  externalDependencies: z.array(z.string().trim().min(5)).min(1),
  apportioning: z.string().trim().min(10),
  coverage: z.array(z.object({ topic: z.enum(srsTopics), status: z.enum(['specified', 'not-applicable', 'unresolved']), description: z.string().trim().min(10), requirementIds: z.array(z.string()) })).min(1),
});
export const threatModelSchema = z.object({
  method: z.literal('STRIDE'), scope: z.string().trim().min(10),
  assets: z.array(z.string().trim().min(3)).min(1), trustBoundaries: z.array(z.string().trim().min(5)).min(1),
  threats: z.array(z.object({
    id: z.string().regex(/^THR-\d{3}$/), category: z.enum(['spoofing', 'tampering', 'repudiation', 'information-disclosure', 'denial-of-service', 'elevation-of-privilege']),
    asset: z.string().min(3), trustBoundary: z.string().min(5), actor: z.string().min(3), scenario: z.string().min(15),
    likelihood: z.enum(['low', 'medium', 'high']), impact: z.enum(['low', 'medium', 'high', 'critical']),
    mitigations: z.array(z.string().min(10)).min(1), verification: z.string().min(10), residualRisk: z.string().min(10),
    requirementIds: z.array(z.string()).min(1), riskIds: z.array(z.string()), evidence: z.array(z.string()),
    source: z.object({ kind: z.enum(['stakeholder', 'assumption', 'evidence']), reference: z.string().min(1) }),
    status: z.literal('draft'),
  })).min(1).max(30),
});
export const requirementSchema = z.object({
  id: z.string().regex(/^(FR|NFR|BR)-\d{3}$/), statement: z.string().min(15),
  category: z.enum(categories), categories: z.array(z.enum(categories)).min(1),
  businessJustification: z.string().min(10), stakeholder: z.string().min(2),
  riskLevel: z.enum(['low', 'medium', 'high', 'critical']),
  applicableControlIds: z.array(z.string()), approvalStatus: z.enum(['draft', 'proposed', 'approved', 'rejected']),
  module: z.string().min(2), priority: z.enum(['Must', 'Should', 'Could']),
  source: z.object({ kind: z.enum(['stakeholder', 'assumption', 'evidence']), reference: z.string().min(1) }),
  acceptanceCriteria: z.array(z.string().min(10)).min(1), verification: z.string().min(5),
  dependencies: z.array(z.string()), evidence: z.array(z.string()), confidence: z.number().min(0).max(1),
});
export const specificationSchema = z.object({
  title: z.string().min(3), summary: z.string().min(20), scope: z.array(z.string()).min(1), outOfScope: z.array(z.string()),
  stakeholders: z.array(z.string()).min(2),
  assumptions: z.array(z.object({ id: z.string().regex(/^A-\d+$/), statement: z.string().min(5) })),
  requirements: z.array(requirementSchema).min(4).max(50),
  userStories: z.array(z.object({ id: z.string(), story: z.string(), requirementIds: z.array(z.string()).min(1), acceptanceCriteria: z.array(z.string()).min(1) })).min(1),
  useCases: z.array(z.object({ id: z.string(), title: z.string(), actor: z.string(), preconditions: z.array(z.string()), steps: z.array(z.string()).min(1), exceptions: z.array(z.string()), requirementIds: z.array(z.string()).min(1) })).min(1),
  risks: z.array(z.object({ id: z.string(), description: z.string(), severity: z.enum(['low', 'medium', 'high']), mitigation: z.string(), requirementIds: z.array(z.string()), sdlcImpact: z.string() })),
  openQuestions: z.array(z.string()), decisionFactors: factorsSchema,
  glossary: z.array(z.object({ term: z.string().min(1), definition: z.string().min(5) })),
  projectContext: z.object({ ...profileFields, jurisdictions: z.array(z.enum(['India', 'EU', 'UK', 'US', 'Unspecified'])).min(1), personalData: z.boolean(), paymentIntegration: z.enum(['redirect', 'embedded', 'direct', 'none', 'unknown']), businessModel: z.enum(['single-merchant', 'marketplace', 'module', 'financial-service', 'unknown']) }),
  dataRequirements: z.array(z.object({ id: z.string(), entity: z.string(), fields: z.array(z.object({ name: z.string(), type: z.string(), classification: z.enum(['public', 'internal', 'personal', 'sensitive']) })).min(1), retentionPolicy: z.string(), requirementIds: z.array(z.string()).min(1) })),
  interfaceRequirements: z.array(z.object({ id: z.string(), name: z.string(), protocol: z.string(), authentication: z.string(), inputs: z.array(z.string()), outputs: z.array(z.string()), failureHandling: z.string(), requirementIds: z.array(z.string()).min(1) })),
  // Optional only for reading older saved analyses. New model output requires this context.
  srsContext: srsContextSchema.optional(),
  threatModel: threatModelSchema.optional(),
});
export const generatedSpecificationSchema = specificationSchema.extend({ srsContext: srsContextSchema, threatModel: threatModelSchema, projectContext: specificationSchema.shape.projectContext.extend({domain:profileFields.domain.unwrap(),useCase:profileFields.useCase.unwrap(),regulatedEntity:profileFields.regulatedEntity.unwrap()}) });
export const sdlcSchema = z.object({
  selectedModel: z.enum(models),
  justification: z.array(z.object({ reason: z.string().min(10), requirementIds: z.array(z.string()).min(1) })).min(2),
  alternatives: z.array(z.object({ model: z.enum(models), tradeoff: z.string().min(10), requirementIds: z.array(z.string()).min(1) })).min(2),
  phases: z.array(z.object({ name: z.string(), activities: z.array(z.string()).min(1), roles: z.array(z.string()).min(1), deliverables: z.array(z.string()).min(1), entryGate: z.string().min(5), exitGate: z.string().min(5), securityCheckpoint: z.string().min(5), requirementIds: z.array(z.string()).min(1) })).min(3),
  residualRisks: z.array(z.string()).min(1),
});
export const briefSchema = z.object({ prompt: z.string().trim().min(20).max(60000), ...profileFields });
export type Specification = z.infer<typeof specificationSchema>;
export type Requirement = z.infer<typeof requirementSchema>;
export type DecisionFactors = z.infer<typeof factorsSchema>;
export type SdlcPlan = z.infer<typeof sdlcSchema>;
export type Model = typeof models[number];

export const semanticReviewSchema = z.object({
  issues: z.array(z.object({ id: z.string(), kind: z.enum(['contradiction', 'infeasible', 'undefined-term', 'untestable', 'incomplete', 'stakeholder-conflict', 'bias', 'security-gap']), severity: z.enum(['warning', 'error']), requirementIds: z.array(z.string()).min(1), explanation: z.string().min(10), question: z.string().min(5) })),
  citations: z.array(z.object({ requirementId: z.string(), evidenceId: z.string(), verdict: z.enum(['supported', 'unsupported', 'unclear']), supportingQuote: z.string(), explanation: z.string() })),
});
export const interviewSchema = z.object({ questions: z.array(z.object({ id: z.string(), role: z.string(), topic: z.string(), question: z.string().min(10), reason: z.string().min(5), blocking: z.boolean(), requirementIds: z.array(z.string()) })).max(12), summary: z.string() });
export type SemanticReview = z.infer<typeof semanticReviewSchema>;
export type Interview = z.infer<typeof interviewSchema>;
