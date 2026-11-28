export type PriorityLevel = 'Must' | 'Should' | 'Could';

export type RequirementCategory =
  | 'Functional'
  | 'Security'
  | 'Privacy'
  | 'Compliance'
  | 'Performance'
  | 'Availability'
  | 'Usability'
  | 'DataManagement'
  | 'Integration'
  | 'Audit'
  | 'Operational';

export type DecisionFactorKey =
  | 'requirementStability'
  | 'regulatoryCriticality'
  | 'securityRisk'
  | 'projectComplexity'
  | 'systemSize'
  | 'legacyDependence'
  | 'changeFrequency'
  | 'continuousDeliveryNeed'
  | 'stakeholderAvailability'
  | 'testingFormality'
  | 'timeToMarketPressure'
  | 'formalVerificationNeed'
  | 'failureConsequence';

export interface DecisionFactorScore {
  key: DecisionFactorKey;
  label: string;
  score: number; // 1 to 5
  rationale: string;
}

export interface StakeholderItem {
  role: string;
  description: string;
  technicalProficiency: string;
  primaryConcerns: string;
}

export interface AssumptionItem {
  id: string;
  statement: string;
  needsValidation: boolean;
}

export interface RiskItem {
  id: string;
  title: string;
  severity: 'High' | 'Medium' | 'Low';
  description: string;
  mitigation: string;
  sdlcImpact: string;
}

export interface ProjectOverview {
  projectName: string;
  domain: 'E-Commerce';
  brief: string;
  executiveSummary: string;
  businessCase: string;
  operationalConcept: string;
  inScope: string[];
  outOfScope: string[];
  stakeholders: StakeholderItem[];
  assumptions: AssumptionItem[];
  constraints: string[];
  risks: RiskItem[];
  decisionFactors: DecisionFactorScore[];
}

export interface RequirementItem {
  id: string;
  title: string;
  type: 'FR' | 'NFR';
  category: RequirementCategory;
  priority: PriorityLevel;
  statement: string;
  overview: string;
  inputs: string;
  processingAndErrors: string;
  outputs: string;
  acceptanceCriteria: string[];
  verificationMethod: 'Test' | 'Inspection' | 'Demonstration' | 'Analysis';
  stakeholderSource: string;
  complianceRef: string;
  confidence: number; // 0-100
  citation: string;
}

export type SdlcModelId =
  | 'agile-devsecops'
  | 'agile'
  | 'devsecops'
  | 'spiral'
  | 'v-model'
  | 'waterfall';

export interface SdlcRankingEntry {
  id: SdlcModelId;
  name: string;
  percentage: number;
  rank: number;
  isRecommended: boolean;
  tagline: string;
  whyFitsOrSummary: string;
  whyNotChosenOrTradeoffs: string;
  keyStrengths: string[];
  keyWeaknesses: string[];
}

export interface SdlcWorkflowPhase {
  phase: string;
  objective: string;
  activities: string[];
  roles: string[];
  deliverables: string[];
  securityComplianceCheckpoint: string;
  entryCriteria: string;
  exitCriteria: string;
  requirementIds: string[];
}

export interface SdlcAnalysisResult {
  recommendedId: SdlcModelId;
  recommendedName: string;
  recommendedPercentage: number;
  perfectFitSummary: string;
  factorAnalysis: Array<{
    factor: string;
    score: number;
    implication: string;
    citedIds: string[];
  }>;
  rankings: SdlcRankingEntry[];
  workflowPhases: SdlcWorkflowPhase[];
  humanApprovalGates: string[];
  residualRisks: string[];
}

export interface DecisionTableRule {
  scenario: string;
  conditions: Record<string, string>;
  actions: string[];
}

export interface Ieee830ComplianceReport {
  isCompliant: boolean;
  umlExcluded: boolean;
  requirementCount: number;
  functionalRequirementCount: number;
  missingSections: string[];
  checks: Array<{ name: string; passed: boolean; detail: string }>;
}

export interface Ieee830SrsDocument {
  title: string;
  documentId: string;
  version: string;
  date: string;
  standard: 'IEEE Std 830-1998 (No-UML Profile)';
  markdown: string;
  compliance: Ieee830ComplianceReport;
}

export interface PipelineAuditEntry {
  stage: 'overview' | 'requirements' | 'sdlc' | 'srs';
  agentName: string;
  durationMs: number;
  status: 'completed' | 'repaired';
  notes: string;
}

export interface ReQuoraRunRecord {
  id: string;
  createdAt: string;
  brief: string;
  projectName: string;
  modelUsed: string;
  durationMs: number;
  evidenceCitations: string[];
  overview: ProjectOverview;
  requirements: RequirementItem[];
  sdlc: SdlcAnalysisResult;
  srs: Ieee830SrsDocument;
  auditTrail: PipelineAuditEntry[];
}

export type PipelineStage = 'rag' | 'overview' | 'requirements' | 'sdlc' | 'srs' | 'save';

export interface PipelineProgressEvent {
  stage: PipelineStage;
  status: 'running' | 'done' | 'error';
  message: string;
  progressPct: number;
}
