import type {
  DecisionFactorKey,
  DecisionFactorScore,
  RequirementItem,
  SdlcModelId,
  SdlcWorkflowPhase,
} from './types';

export const DECISION_FACTOR_LABELS: Record<DecisionFactorKey, string> = {
  requirementStability: 'Requirement Stability',
  regulatoryCriticality: 'Regulatory & PCI-DSS/Privacy Criticality',
  securityRisk: 'Cybersecurity & Payment Fraud Risk',
  projectComplexity: 'Domain & Architectural Complexity',
  systemSize: 'System Scope & Size',
  legacyDependence: 'Third-Party / Legacy Integration Dependence',
  changeFrequency: 'Expected Feature & Market Change Frequency',
  continuousDeliveryNeed: 'Need for Continuous Deployment',
  stakeholderAvailability: 'Stakeholder & Merchant Availability',
  testingFormality: 'Testing & Compliance Documentation Formality',
  timeToMarketPressure: 'Time-to-Market / Competitive Pressure',
  formalVerificationNeed: 'Need for Formal Verification Gates',
  failureConsequence: 'Business & Financial Consequence of Failure',
};

export function describeFactorScore(key: DecisionFactorKey, score: number): string {
  const level = score >= 4 ? 'High' : score <= 2 ? 'Low' : 'Moderate';
  const notes: Record<DecisionFactorKey, string> = {
    requirementStability: `${level} stability (${score}/5) reflects how frequently storefront, catalog, and business rules evolve.`,
    regulatoryCriticality: `${level} compliance sensitivity (${score}/5) driven by PCI-DSS payment rules, privacy laws, and consumer disclosures.`,
    securityRisk: `${level} threat exposure (${score}/5) due to public checkout, authentication, and third-party payment integrations.`,
    projectComplexity: `${level} domain complexity (${score}/5) across multi-actor commerce flows, inventory locks, and fulfillment.`,
    systemSize: `${level} functional footprint (${score}/5) spanning storefront, backend orchestration, and operational portals.`,
    legacyDependence: `${level} integration coupling (${score}/5) with payment gateways, logistics carriers, and tax/ERP services.`,
    changeFrequency: `${level} release cadence (${score}/5) for promotions, UX experiments, and catalog capabilities.`,
    continuousDeliveryNeed: `${level} CI/CD demand (${score}/5) for safe zero-downtime updates and rapid security patching.`,
    stakeholderAvailability: `${level} stakeholder engagement (${score}/5) from merchants, product owners, and operations reviewers.`,
    testingFormality: `${level} QA rigor (${score}/5) required across integration, concurrency, and payment settlement checks.`,
    timeToMarketPressure: `${level} launch urgency (${score}/5) in competitive e-commerce markets.`,
    formalVerificationNeed: `${level} formal gate strictness (${score}/5) around financial settlement and data integrity.`,
    failureConsequence: `${level} business impact (${score}/5) where checkout downtime or overselling directly affects revenue and trust.`,
  };
  return notes[key];
}

interface ModelProfile {
  id: SdlcModelId;
  name: string;
  tagline: string;
  /** Ideal factor rating (1..5) where this SDLC excels */
  ideal: Record<DecisionFactorKey, number>;
  /** Weight of each factor when evaluating suitability for this SDLC */
  weights: Record<DecisionFactorKey, number>;
  strengths: string[];
  weaknesses: string[];
}

const SDLC_PROFILES: ModelProfile[] = [
  {
    id: 'agile-devsecops',
    name: 'Agile–DevSecOps Hybrid',
    tagline: 'Iterative sprint delivery embedded with automated security, PCI/privacy gates, and CI/CD validation',
    ideal: {
      requirementStability: 2.2,
      regulatoryCriticality: 4.2,
      securityRisk: 4.6,
      projectComplexity: 4.2,
      systemSize: 4.0,
      legacyDependence: 3.6,
      changeFrequency: 4.5,
      continuousDeliveryNeed: 4.8,
      stakeholderAvailability: 4.0,
      testingFormality: 4.0,
      timeToMarketPressure: 4.5,
      formalVerificationNeed: 3.8,
      failureConsequence: 4.5,
    },
    weights: {
      requirementStability: 1.2,
      regulatoryCriticality: 1.6,
      securityRisk: 1.8,
      projectComplexity: 1.3,
      systemSize: 1.0,
      legacyDependence: 1.1,
      changeFrequency: 1.7,
      continuousDeliveryNeed: 1.8,
      stakeholderAvailability: 1.1,
      testingFormality: 1.3,
      timeToMarketPressure: 1.4,
      formalVerificationNeed: 1.2,
      failureConsequence: 1.5,
    },
    strengths: [
      'Adapts rapidly to evolving storefront UX, promotions, and merchant workflows without sacrificing release velocity.',
      'Embeds automated SAST/DAST, dependency scanning, and PCI-DSS/privacy checks into every sprint pipeline.',
      'Maintains traceability and formal validation gates before payment and order-management releases.',
    ],
    weaknesses: [
      'Requires disciplined CI/CD automation and security engineering maturity from sprint 1.',
      'Slightly higher initial pipeline setup overhead compared to plain Scrum.',
    ],
  },
  {
    id: 'devsecops',
    name: 'DevSecOps',
    tagline: 'Continuous automated build, security testing, and zero-downtime deployment pipeline',
    ideal: {
      requirementStability: 2.8,
      regulatoryCriticality: 3.8,
      securityRisk: 4.8,
      projectComplexity: 3.8,
      systemSize: 3.8,
      legacyDependence: 3.2,
      changeFrequency: 4.2,
      continuousDeliveryNeed: 5.0,
      stakeholderAvailability: 3.2,
      testingFormality: 3.6,
      timeToMarketPressure: 4.4,
      formalVerificationNeed: 3.2,
      failureConsequence: 4.4,
    },
    weights: {
      requirementStability: 0.9,
      regulatoryCriticality: 1.4,
      securityRisk: 1.8,
      projectComplexity: 1.1,
      systemSize: 1.0,
      legacyDependence: 1.0,
      changeFrequency: 1.4,
      continuousDeliveryNeed: 2.0,
      stakeholderAvailability: 0.8,
      testingFormality: 1.1,
      timeToMarketPressure: 1.4,
      formalVerificationNeed: 1.0,
      failureConsequence: 1.4,
    },
    strengths: [
      'Automates security verification, container/API scanning, and zero-downtime canary deployments.',
      'Reduces mean-time-to-remediate vulnerabilities in public-facing checkout and auth APIs.',
    ],
    weaknesses: [
      'Less structured around stakeholder product discovery and formal business sign-off ceremonies than Agile–DevSecOps Hybrid.',
      'Can under-emphasize upfront requirements traceability for complex multi-actor business rules.',
    ],
  },
  {
    id: 'agile',
    name: 'Agile (Scrum / Iterative)',
    tagline: 'Short time-boxed sprints focused on rapid customer feedback and incremental feature delivery',
    ideal: {
      requirementStability: 1.8,
      regulatoryCriticality: 2.2,
      securityRisk: 2.4,
      projectComplexity: 3.2,
      systemSize: 3.2,
      legacyDependence: 2.5,
      changeFrequency: 4.8,
      continuousDeliveryNeed: 4.0,
      stakeholderAvailability: 4.8,
      testingFormality: 2.4,
      timeToMarketPressure: 4.8,
      formalVerificationNeed: 2.0,
      failureConsequence: 2.6,
    },
    weights: {
      requirementStability: 1.4,
      regulatoryCriticality: 1.5,
      securityRisk: 1.5,
      projectComplexity: 1.0,
      systemSize: 0.9,
      legacyDependence: 0.9,
      changeFrequency: 1.8,
      continuousDeliveryNeed: 1.3,
      stakeholderAvailability: 1.5,
      testingFormality: 1.2,
      timeToMarketPressure: 1.6,
      formalVerificationNeed: 1.1,
      failureConsequence: 1.3,
    },
    strengths: [
      'Fastest iteration on customer-facing UI, search, cart UX, and promotional experiments.',
      'Continuous stakeholder feedback minimizes wasted effort on unwanted features.',
    ],
    weaknesses: [
      'Pure Agile lacks mandatory security, PCI-DSS compliance, and formal audit gates by default.',
      'Documentation and end-to-end traceability often lag behind sprint velocity.',
    ],
  },
  {
    id: 'spiral',
    name: 'Spiral',
    tagline: 'Risk-driven iterative cycles combining prototyping with formal risk evaluation per loop',
    ideal: {
      requirementStability: 2.0,
      regulatoryCriticality: 3.8,
      securityRisk: 4.2,
      projectComplexity: 4.8,
      systemSize: 4.6,
      legacyDependence: 4.4,
      changeFrequency: 3.2,
      continuousDeliveryNeed: 2.4,
      stakeholderAvailability: 3.5,
      testingFormality: 3.8,
      timeToMarketPressure: 2.2,
      formalVerificationNeed: 3.8,
      failureConsequence: 4.4,
    },
    weights: {
      requirementStability: 1.1,
      regulatoryCriticality: 1.3,
      securityRisk: 1.5,
      projectComplexity: 1.8,
      systemSize: 1.4,
      legacyDependence: 1.5,
      changeFrequency: 1.1,
      continuousDeliveryNeed: 1.2,
      stakeholderAvailability: 0.9,
      testingFormality: 1.2,
      timeToMarketPressure: 1.3,
      formalVerificationNeed: 1.2,
      failureConsequence: 1.4,
    },
    strengths: [
      'Explicitly mitigates high architectural uncertainty, unproven AI/fraud engines, or complex legacy ERP integrations.',
      'Combines early prototyping with structured risk assessment in every iteration.',
    ],
    weaknesses: [
      'Heavy risk-analysis overhead slows down routine storefront releases and continuous delivery.',
      'Higher project management complexity for small-to-medium feature increments.',
    ],
  },
  {
    id: 'v-model',
    name: 'V-Model',
    tagline: 'Verification-centric sequential model pairing every specification phase with a formal test phase',
    ideal: {
      requirementStability: 4.6,
      regulatoryCriticality: 4.8,
      securityRisk: 4.0,
      projectComplexity: 3.4,
      systemSize: 3.8,
      legacyDependence: 3.8,
      changeFrequency: 1.5,
      continuousDeliveryNeed: 1.8,
      stakeholderAvailability: 2.5,
      testingFormality: 5.0,
      timeToMarketPressure: 1.8,
      formalVerificationNeed: 5.0,
      failureConsequence: 4.8,
    },
    weights: {
      requirementStability: 1.8,
      regulatoryCriticality: 1.7,
      securityRisk: 1.3,
      projectComplexity: 1.0,
      systemSize: 1.0,
      legacyDependence: 1.1,
      changeFrequency: 1.8,
      continuousDeliveryNeed: 1.5,
      stakeholderAvailability: 0.8,
      testingFormality: 1.9,
      timeToMarketPressure: 1.4,
      formalVerificationNeed: 1.9,
      failureConsequence: 1.6,
    },
    strengths: [
      'Guarantees strict requirement-to-test traceability and formal verification before deployment.',
      'Ideal when specifications are frozen upfront and regulatory audit sign-off is mandatory.',
    ],
    weaknesses: [
      'Rigid against evolving e-commerce UX, pricing/promo changes, and mid-project market pivots.',
      'Delays working software feedback until late system/acceptance testing phases.',
    ],
  },
  {
    id: 'waterfall',
    name: 'Waterfall',
    tagline: 'Linear sequential phases with frozen upfront scope and formal stage-gate approvals',
    ideal: {
      requirementStability: 5.0,
      regulatoryCriticality: 3.8,
      securityRisk: 2.8,
      projectComplexity: 2.2,
      systemSize: 2.8,
      legacyDependence: 2.5,
      changeFrequency: 1.0,
      continuousDeliveryNeed: 1.2,
      stakeholderAvailability: 2.0,
      testingFormality: 4.0,
      timeToMarketPressure: 1.4,
      formalVerificationNeed: 3.6,
      failureConsequence: 3.2,
    },
    weights: {
      requirementStability: 2.0,
      regulatoryCriticality: 1.1,
      securityRisk: 1.0,
      projectComplexity: 1.2,
      systemSize: 1.0,
      legacyDependence: 0.9,
      changeFrequency: 2.0,
      continuousDeliveryNeed: 1.6,
      stakeholderAvailability: 0.9,
      testingFormality: 1.3,
      timeToMarketPressure: 1.6,
      formalVerificationNeed: 1.2,
      failureConsequence: 1.1,
    },
    strengths: [
      'Simple milestone governance and predictable upfront documentation when requirements never change.',
      'Low coordination overhead for small, static brochure-style or fixed-contract builds.',
    ],
    weaknesses: [
      'Fails when e-commerce requirements evolve, payments/APIs change, or rapid time-to-market is needed.',
      'Integration, performance, and security defects are discovered dangerously late in the lifecycle.',
    ],
  },
];

export interface ComputedSdlcScore {
  id: SdlcModelId;
  name: string;
  tagline: string;
  percentage: number;
  rank: number;
  isRecommended: boolean;
  strengths: string[];
  weaknesses: string[];
}

/**
 * Deterministic Multi-Criteria Decision Analysis (MCDA) engine.
 * Computes calibrated suitability percentages (0-100%) across all 6 SDLC models
 * from the 13 extracted project decision factors.
 */
export function computeSdlcRankings(factors: DecisionFactorScore[]): ComputedSdlcScore[] {
  const factorMap = new Map<DecisionFactorKey, number>();
  for (const f of factors) {
    const clamped = Math.max(1, Math.min(5, Math.round(f.score)));
    factorMap.set(f.key, clamped);
  }

  const rawScores = SDLC_PROFILES.map((profile) => {
    let weightedMatchSum = 0;
    let totalWeight = 0;

    for (const key of Object.keys(profile.ideal) as DecisionFactorKey[]) {
      const actual = factorMap.get(key) ?? 3;
      const ideal = profile.ideal[key];
      const weight = profile.weights[key];
      const distance = Math.abs(actual - ideal); // 0..4
      const match = Math.max(0, 1 - distance / 4);
      weightedMatchSum += weight * match;
      totalWeight += weight;
    }

    const ratio = totalWeight > 0 ? weightedMatchSum / totalWeight : 0.5;
    // Calibrate into intuitive 18%-97% spread so clear winners and weak fits are unambiguous
    const percentage = Math.max(18, Math.min(97, Math.round(ratio * 100)));

    return {
      id: profile.id,
      name: profile.name,
      tagline: profile.tagline,
      percentage,
      strengths: profile.strengths,
      weaknesses: profile.weaknesses,
    };
  });

  rawScores.sort((a, b) => b.percentage - a.percentage);

  // Break exact ties deterministically by 1% margin so there is a clear #1 recommendation
  for (let i = 1; i < rawScores.length; i++) {
    if (rawScores[i].percentage >= rawScores[i - 1].percentage) {
      rawScores[i].percentage = Math.max(15, rawScores[i - 1].percentage - 1);
    }
  }

  return rawScores.map((entry, idx) => ({
    ...entry,
    rank: idx + 1,
    isRecommended: idx === 0,
  }));
}

export function buildAlternativeJustification(
  candidate: ComputedSdlcScore,
  winner: ComputedSdlcScore,
  factors: DecisionFactorScore[],
  requirements: RequirementItem[],
): string {
  const byKey = new Map(factors.map((f) => [f.key, f.score]));
  const frIds = requirements.filter((r) => r.type === 'FR').slice(0, 3).map((r) => r.id).join(', ');
  const secNfr = requirements.find((r) => r.category === 'Security' || r.category === 'Compliance')?.id ?? 'NFR-001';

  if (candidate.isRecommended) {
    return `Selected at ${candidate.percentage}% suitability. Manage initial CI/CD security automation overhead early so sprint velocity remains high across ${frIds}.`;
  }

  switch (candidate.id) {
    case 'waterfall':
      return `Scored ${candidate.percentage}% (vs ${winner.percentage}% for ${winner.name}) because e-commerce change frequency (${byKey.get('changeFrequency') ?? 3}/5) and continuous delivery needs (${byKey.get('continuousDeliveryNeed') ?? 3}/5) penalize frozen linear stages for ${frIds}.`;
    case 'v-model':
      return `Scored ${candidate.percentage}% (vs ${winner.percentage}%) because strict sequential verification delays iterative storefront feedback on ${frIds} despite strong testing alignment.`;
    case 'agile':
      return `Scored ${candidate.percentage}% (vs ${winner.percentage}%) because pure Scrum lacks mandatory built-in PCI-DSS/OWASP security gates required by ${secNfr} (security risk ${byKey.get('securityRisk') ?? 4}/5).`;
    case 'devsecops':
      return `Scored ${candidate.percentage}% (vs ${winner.percentage}%) because continuous deployment pipelines alone under-emphasize structured merchant/stakeholder discovery ceremonies for ${frIds}.`;
    case 'spiral':
      return `Scored ${candidate.percentage}% (vs ${winner.percentage}%) because formal risk-prototyping loops add unnecessary management overhead compared to ${winner.name} for routine commerce releases.`;
    case 'agile-devsecops':
      return `Scored ${candidate.percentage}% (vs ${winner.percentage}%) because this project profile favors ${winner.name}'s stricter upfront verification or linear governance.`;
  }
}

export function buildTailoredWorkflow(
  winnerId: SdlcModelId,
  projectName: string,
  requirements: RequirementItem[],
): SdlcWorkflowPhase[] {
  const frs = requirements.filter((r) => r.type === 'FR').map((r) => r.id);
  const nfrs = requirements.filter((r) => r.type !== 'FR').map((r) => r.id);
  const firstBatch = frs.slice(0, 3);
  const secondBatch = frs.slice(3);

  if (winnerId === 'v-model' || winnerId === 'waterfall') {
    return [
      {
        phase: 'Phase 1: Baseline Requirements & Compliance Sign-Off',
        objective: `Freeze IEEE 830-1998 black-box scope and regulatory controls for ${projectName}.`,
        activities: ['Validate functional specifications', 'Confirm PCI-DSS/privacy obligations', 'Sign off traceability baseline'],
        roles: ['Business Analyst', 'Compliance Officer', 'Product Owner'],
        deliverables: ['Approved IEEE 830-1998 SRS', 'Requirements Traceability Matrix'],
        securityComplianceCheckpoint: 'Privacy & payment compliance review gate',
        entryCriteria: 'Approved project brief and stakeholder alignment',
        exitCriteria: 'Formal SRS sign-off with zero unresolved ambiguities',
        requirementIds: [...frs.slice(0, 4), ...nfrs.slice(0, 2)],
      },
      {
        phase: 'Phase 2: System Architecture & Verification Planning',
        objective: 'Design modular interfaces, data schemas, and paired acceptance test suites.',
        activities: ['Define API & payment gateway contracts', 'Author system and UAT test specifications', 'Conduct threat modeling'],
        roles: ['Software Architect', 'QA Lead', 'Security Engineer'],
        deliverables: ['Interface Specification', 'Threat Model', 'System Test Plan'],
        securityComplianceCheckpoint: 'STRIDE threat model & tokenization architecture approval',
        entryCriteria: 'Baselined SRS approved',
        exitCriteria: 'Architecture & test plans signed off',
        requirementIds: [...frs, ...nfrs],
      },
      {
        phase: 'Phase 3: Controlled Implementation & Unit/Integration Verification',
        objective: 'Implement core commerce modules and verify against interface specs.',
        activities: ['Build catalog, cart, checkout, and order modules', 'Run SAST & unit/integration suites', 'Verify error/abnormal handling'],
        roles: ['Backend/Frontend Engineers', 'Security Engineer'],
        deliverables: ['Verified Build Artifact', 'SAST & Integration Test Report'],
        securityComplianceCheckpoint: 'Zero critical SAST/dependency findings',
        entryCriteria: 'Design baseline approved',
        exitCriteria: '100% integration test pass rate',
        requirementIds: frs,
      },
      {
        phase: 'Phase 4: System Validation, UAT & Production Release',
        objective: 'Execute end-to-end performance, security, and acceptance testing before launch.',
        activities: ['Run checkout load tests & DAST', 'Complete stakeholder UAT sign-off', 'Deploy with audit logging active'],
        roles: ['QA Team', 'Release Manager', 'Product Owner'],
        deliverables: ['UAT Sign-off Report', 'Production Release Notes'],
        securityComplianceCheckpoint: 'Pre-production VA/PT & PCI-DSS checklist sign-off',
        entryCriteria: 'Integration testing passed',
        exitCriteria: 'All RTM acceptance criteria verified and approved',
        requirementIds: [...frs, ...nfrs],
      },
    ];
  }

  return [
    {
      phase: 'Phase 1: Discovery, Threat Modeling & Sprint Backlog Baseline',
      objective: `Translate the IEEE 830-1998 SRS for ${projectName} into prioritized sprint increments and security guardrails.`,
      activities: ['Refine user stories & acceptance criteria', 'Run STRIDE threat model on payment/auth flows', 'Configure CI/CD security scanners'],
      roles: ['Product Owner', 'Software Architect', 'Security Engineer'],
      deliverables: ['Prioritized Backlog', 'Threat Model', 'CI/CD Pipeline Config'],
      securityComplianceCheckpoint: 'PCI-DSS scope minimization & privacy consent architecture review',
      entryCriteria: 'IEEE 830-1998 SRS baseline approved',
      exitCriteria: 'Sprint 1 ready with automated SAST/SCA gates active',
      requirementIds: [...firstBatch, ...nfrs.slice(0, 2)],
    },
    {
      phase: 'Phase 2: Core Storefront & Catalog Sprints (Iterative Delivery)',
      objective: 'Deliver catalog, discovery, cart, and user onboarding increments with automated testing.',
      activities: ['Implement core storefront & search endpoints', 'Write automated API/UI acceptance tests', 'Conduct sprint review with stakeholders'],
      roles: ['Full-Stack Engineers', 'QA Engineer', 'Product Owner'],
      deliverables: ['Storefront MVP Build', 'Automated Test Suite'],
      securityComplianceCheckpoint: 'OWASP ASVS auth/session check & dependency audit',
      entryCriteria: 'Backlog & CI pipeline active',
      exitCriteria: 'All covered FR acceptance criteria pass in staging',
      requirementIds: firstBatch.length > 0 ? firstBatch : frs.slice(0, 3),
    },
    {
      phase: 'Phase 3: Checkout, Payment Tokenization & Order Fulfillment Sprints',
      objective: 'Implement payment gateway integration, atomic inventory reservation, and order/return workflows.',
      activities: ['Integrate tokenized checkout & webhook verification', 'Test concurrency & payment idempotency', 'Run automated DAST & performance benchmarks'],
      roles: ['Backend Engineers', 'Security Engineer', 'QA Engineer'],
      deliverables: ['Checkout & OMS Release Candidate', 'Load & DAST Report'],
      securityComplianceCheckpoint: 'Payment webhook HMAC verification & zero raw PAN storage audit',
      entryCriteria: 'Core storefront increment verified',
      exitCriteria: 'Latency SLAs & security gates green with zero high/critical defects',
      requirementIds: [...(secondBatch.length > 0 ? secondBatch : frs), ...nfrs],
    },
    {
      phase: 'Phase 4: Release Hardening, UAT & Continuous Secure Deployment',
      objective: 'Execute final compliance sign-off, canary rollout, and post-release observability.',
      activities: ['Conduct stakeholder UAT & grievance-flow check', 'Deploy via blue/green or canary pipeline', 'Enable real-time error & fraud alerting'],
      roles: ['Release Manager', 'DevSecOps Engineer', 'Compliance Reviewer'],
      deliverables: ['Production Deployment', 'Audit & Observability Runbook'],
      securityComplianceCheckpoint: 'Mandatory human go/no-go approval before production cutover',
      entryCriteria: 'DAST, load tests, and UAT complete',
      exitCriteria: 'Production telemetry healthy & all RTM rows verified',
      requirementIds: [...frs, ...nfrs],
    },
  ];
}
