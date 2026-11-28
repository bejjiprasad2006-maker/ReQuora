import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { config } from '../mastra/config';
import { callLlmJson, sanitizeUserBrief } from './llm';
import { formatEvidenceBlock, retrieveEcommerceEvidence } from './rag';
import {
  buildAlternativeJustification,
  buildTailoredWorkflow,
  computeSdlcRankings,
  DECISION_FACTOR_LABELS,
  describeFactorScore,
} from './sdlc-engine';
import { compileIeee830SrsDocument, type SrsSectionNarrative } from './srs-compiler';
import { saveRun } from './storage';
import type {
  DecisionFactorKey,
  PipelineAuditEntry,
  PipelineProgressEvent,
  ProjectOverview,
  RequirementCategory,
  RequirementItem,
  ReQuoraRunRecord,
  SdlcAnalysisResult,
} from './types';

const FACTOR_KEYS: DecisionFactorKey[] = [
  'requirementStability',
  'regulatoryCriticality',
  'securityRisk',
  'projectComplexity',
  'systemSize',
  'legacyDependence',
  'changeFrequency',
  'continuousDeliveryNeed',
  'stakeholderAvailability',
  'testingFormality',
  'timeToMarketPressure',
  'formalVerificationNeed',
  'failureConsequence',
];

const CompactSpecSchema = z.object({
  projectName: z.string().min(2),
  summary: z.string().min(15),
  inScope: z.array(z.string()).min(3),
  outOfScope: z.array(z.string()).min(2),
  stakeholders: z.array(z.string()).min(3),
  risks: z.array(z.string()).min(2),
  factorScores: z.array(z.number().min(1).max(5)).length(13),
  frs: z
    .array(
      z.object({
        title: z.string(),
        priority: z.enum(['Must', 'Should', 'Could']).default('Must'),
        what: z.string(),
      }),
    )
    .min(6),
  nfrs: z
    .array(
      z.object({
        title: z.string(),
        category: z.enum([
          'Security',
          'Privacy',
          'Compliance',
          'Performance',
          'Availability',
          'Usability',
          'DataManagement',
          'Integration',
          'Audit',
          'Operational',
        ]),
        target: z.string(),
      }),
    )
    .min(2),
  entities: z.array(z.string()).min(3),
});

function inferStakeholderDescription(role: string): {
  description: string;
  proficiency: string;
  concerns: string;
} {
  const lower = role.toLowerCase();
  if (lower.includes('admin') || lower.includes('operator') || lower.includes('compliance')) {
    return {
      description: 'Platform governance, catalog moderation, and compliance operations staff',
      proficiency: 'High (web dashboards, audit tools)',
      concerns: 'RBAC security, audit trails, dispute resolution, and regulatory adherence',
    };
  }
  if (lower.includes('seller') || lower.includes('vendor') || lower.includes('merchant')) {
    return {
      description: 'Merchants managing SKUs, pricing, inventory levels, and order fulfillment',
      proficiency: 'Medium (portal workflows, CSV/API feeds)',
      concerns: 'Accurate inventory sync, timely payouts, and clear order notifications',
    };
  }
  if (lower.includes('courier') || lower.includes('logistics') || lower.includes('delivery')) {
    return {
      description: 'Shipping and fulfillment partners updating pickup and delivery milestones',
      proficiency: 'Medium (carrier APIs, mobile scanner apps)',
      concerns: 'Reliable webhook updates, manifest accuracy, and SLA adherence',
    };
  }
  return {
    description: 'End-user shoppers browsing products, managing carts, and placing orders',
    proficiency: 'Low to Medium (mobile and desktop web browsers)',
    concerns: 'Fast search, transparent pricing, secure checkout, and easy returns',
  };
}

function enrichFunctionalContract(title: string, what: string): {
  inputs: string;
  processingAndErrors: string;
  outputs: string;
  acceptanceCriteria: string[];
  stakeholderSource: string;
} {
  const lower = `${title} ${what}`.toLowerCase();
  if (lower.includes('pay') || lower.includes('checkout') || lower.includes('upi') || lower.includes('card')) {
    return {
      inputs: 'Cart ID, shipping address, selected payment rail (UPI/card token), and client idempotency key',
      processingAndErrors: 'Validates stock reservation and payment token; triggers 3DS2/UPI challenge; releases soft lock and returns structured error on decline/timeout.',
      outputs: 'Confirmed Order ID, tokenized payment receipt, and HMAC-verified settlement status',
      acceptanceCriteria: [
        'Given valid cart and verified payment token, When checkout executes, Then order transitions to Confirmed without duplicate charges',
        'Given gateway timeout or declined payment, Then soft stock lock releases and buyer receives retryable error',
      ],
      stakeholderSource: 'Shopper & Payment Gateway',
    };
  }
  if (lower.includes('inventory') || lower.includes('stock')) {
    return {
      inputs: 'SKU identifier, warehouse/seller ID, quantity delta, and reservation TTL token',
      processingAndErrors: 'Performs atomic stock check and reservation/decrement; rejects negative stock with HTTP 409 conflict notice.',
      outputs: 'Updated available quantity, reservation confirmation, and low-stock alert event',
      acceptanceCriteria: [
        'Given concurrent requests for the last unit, When checkout locks stock, Then only one order succeeds and overselling is zero',
        'Given expired reservation TTL, Then held units automatically return to available stock',
      ],
      stakeholderSource: 'Merchant & Operations',
    };
  }
  if (lower.includes('payout') || lower.includes('settlement') || lower.includes('commission')) {
    return {
      inputs: 'Delivered order ID, merchant account ID, commission rate, and return-window status',
      processingAndErrors: 'Verifies return window expiry and reconciles fees; holds disbursement and flags audit alert on bank/KYC mismatch.',
      outputs: 'Settled payout ledger entry, merchant statement, and bank transfer reference',
      acceptanceCriteria: [
        'Given delivered order past return window, When settlement runs, Then net payout (minus commission/tax) is scheduled',
        'Given active return dispute or invalid bank details, Then payout is held with clear audit reason',
      ],
      stakeholderSource: 'Merchant & Finance Admin',
    };
  }
  if (lower.includes('search') || lower.includes('catalog') || lower.includes('filter') || lower.includes('browse')) {
    return {
      inputs: 'Search keywords, category/price/attribute filters, sort order, and page cursor',
      processingAndErrors: 'Sanitizes query, applies facets and stock availability filters; returns suggested alternatives on zero results.',
      outputs: 'Paginated matching SKU cards with price, tax-inclusive summary, and availability badge',
      acceptanceCriteria: [
        'Given valid keywords and filters, When submitted, Then matching published SKUs display in sorted order',
        'Given invalid filter bounds or zero matches, Then system displays clear empty-state fallback without error',
      ],
      stakeholderSource: 'Shopper',
    };
  }
  if (lower.includes('cart')) {
    return {
      inputs: 'Session/user token, SKU ID, requested quantity (>= 1), and optional promo code',
      processingAndErrors: 'Validates SKU availability, quantity limits, and coupon rules; rejects expired/ineligible promos with explanatory message.',
      outputs: 'Updated itemized cart total (subtotal, discount, estimated tax/shipping)',
      acceptanceCriteria: [
        'Given valid SKU and quantity, When added to cart, Then line item and itemized totals update immediately',
        'Given out-of-stock item or invalid promo code, Then system preserves cart state and displays exact validation reason',
      ],
      stakeholderSource: 'Shopper',
    };
  }
  if (lower.includes('return') || lower.includes('refund') || lower.includes('track') || lower.includes('order')) {
    return {
      inputs: 'Authenticated user ID, Order ID, item selection, and return/cancellation reason',
      processingAndErrors: 'Checks order state machine and eligibility window; rejects ineligible requests with policy timestamp details.',
      outputs: 'Updated order/RMA status, carrier tracking link or refund initiation reference',
      acceptanceCriteria: [
        'Given eligible order state, When action is requested, Then order/RMA state transitions and notification dispatches',
        'Given closed return window or invalid order ID, Then system blocks transition and logs reason',
      ],
      stakeholderSource: 'Shopper & Support',
    };
  }
  return {
    inputs: 'Authenticated actor credentials, validated JSON request payload, and target entity ID',
    processingAndErrors: 'Validates schema, RBAC permissions, and business rules; returns descriptive HTTP 4xx error on invalid input without partial state mutation.',
    outputs: 'Confirmed operation result, updated entity state, and immutable audit log entry',
    acceptanceCriteria: [
      `Given valid authorized request for ${title}, When executed, Then state updates deterministically`,
      'Given unauthorized actor or malformed input, Then request is rejected safely with structured feedback',
    ],
    stakeholderSource: 'Platform User / Admin',
  };
}

export async function runReQuoraPipeline(
  rawBrief: string,
  onProgress?: (event: PipelineProgressEvent) => void,
): Promise<ReQuoraRunRecord> {
  const totalStart = Date.now();
  const brief = sanitizeUserBrief(rawBrief);
  const auditTrail: PipelineAuditEntry[] = [];

  const emit = (
    stage: PipelineProgressEvent['stage'],
    status: PipelineProgressEvent['status'],
    message: string,
    progressPct: number,
  ) => {
    onProgress?.({ stage, status, message, progressPct });
  };

  // Stage 0: RAG Evidence Retrieval
  emit('rag', 'running', 'Retrieving e-commerce domain, PCI-DSS, privacy, SDLC, and IEEE 830-1998 evidence...', 8);
  const evidence = await retrieveEcommerceEvidence(
    `${brief} ecommerce catalog cart checkout payment PCI-DSS privacy order returns SDLC IEEE 830`,
    3,
  );
  const evidenceBlock = formatEvidenceBlock(evidence);
  const evidenceCitations = Array.from(new Set(evidence.map((e) => e.id)));
  const primaryCitation = evidenceCitations[0] ?? 'docs/ingested/ecommerce/ecommerce-domain-controls.txt';
  emit('rag', 'done', `Grounded with ${evidenceCitations.length} local knowledge-base documents.`, 16);

  // Stage 1-2: Ultra-Lean Single-Pass LLM Extraction (~320-450 tokens, zero duplicate calls)
  emit('overview', 'running', 'Agent 1 & 2: Analyzing brief & generating overview and requirements...', 24);
  const genStart = Date.now();

  const prompt = `You are ReQuora AI for E-Commerce (IEEE 830-1998 black-box SRS, NO UML).
Output ONLY compact JSON (short strings, max 12 words per string, NO extra prose):
{
  "projectName": "Name",
  "summary": "2 short sentences describing platform and goal",
  "inScope": ["5 short capabilities"],
  "outOfScope": ["3 short exclusions"],
  "stakeholders": ["4 role names"],
  "risks": ["3 short risk titles"],
  "factorScores": [13 integers 1-5: requirementStability, regulatoryCriticality, securityRisk, projectComplexity, systemSize, legacyDependence, changeFrequency, continuousDeliveryNeed, stakeholderAvailability, testingFormality, timeToMarketPressure, formalVerificationNeed, failureConsequence],
  "frs": [
    { "title": "Short title", "priority": "Must|Should|Could", "what": "The system shall ..." }
  ],
  "nfrs": [
    { "title": "Short title", "category": "Security|Privacy|Compliance|Performance|Availability|Usability|DataManagement|Integration|Audit|Operational", "target": "The system shall ... (with measurable number)" }
  ],
  "entities": ["4 data entity names"]
}
REQUIRED: Output 6 to 8 distinct frs and 4 measurable nfrs.
Ref: ${evidenceBlock.slice(0, 300)}`;

  const { data: parsed, repaired: mainRepaired } = await callLlmJson(
    [
      { role: 'system', content: prompt },
      { role: 'user', content: `Brief: ${brief}` },
    ],
    CompactSpecSchema,
    {
      maxTokens: 2200,
      temperature: 0.15,
      onChunk: (chars) => {
        const pct = Math.min(68, 26 + Math.round((chars / 1500) * 42));
        const stage = chars < 550 ? 'overview' : 'requirements';
        emit(
          stage,
          'running',
          chars < 550
            ? `Agent 1 (Overview Analyst): Drafting project overview & SDLC factors (${chars} chars)...`
            : `Agent 2 (Requirements Engineer): Generating black-box requirements (${chars} chars)...`,
          pct,
        );
      },
    },
  );

  const decisionFactors = FACTOR_KEYS.map((key, idx) => {
    const score = parsed.factorScores[idx] ?? 3;
    return {
      key,
      label: DECISION_FACTOR_LABELS[key],
      score,
      rationale: describeFactorScore(key, score),
    };
  });

  const overview: ProjectOverview = {
    projectName: parsed.projectName,
    domain: 'E-Commerce',
    brief,
    executiveSummary: `${parsed.summary} Built specifically for the e-commerce domain, ${parsed.projectName} covers ${parsed.inScope.slice(0, 3).join(', ').toLowerCase()}, while enforcing payment tokenization, consumer transparency, and verifiable performance SLAs.`,
    businessCase: `${parsed.projectName} increases conversion reliability and operational scalability by automating ${parsed.inScope.slice(0, 2).join(' and ').toLowerCase()} while minimizing payment compliance scope and inventory overselling.`,
    operationalConcept: `End users (${parsed.stakeholders.join(', ')}) interact through authenticated web portals and APIs across catalog discovery, cart persistence, atomic inventory reservation, tokenized checkout settlement, and post-order fulfillment/returns.`,
    inScope: parsed.inScope,
    outOfScope: parsed.outOfScope,
    stakeholders: parsed.stakeholders.map((role) => {
      const info = inferStakeholderDescription(role);
      return {
        role,
        description: info.description,
        technicalProficiency: info.proficiency,
        primaryConcerns: info.concerns,
      };
    }),
    assumptions: [
      {
        id: 'A-1',
        statement: 'Cardholder payment capture is delegated to a PCI-DSS Level 1 payment gateway via hosted tokenization and 3DS2/UPI authentication.',
        needsValidation: false,
      },
      {
        id: 'A-2',
        statement: 'Regional tax rates (GST/VAT) and consumer return/grievance windows follow applicable jurisdictional e-commerce regulations.',
        needsValidation: true,
      },
    ],
    constraints: [
      'PCI-DSS v4.0 payment scope minimization (no raw PAN or CVV storage on platform servers)',
      'GDPR / India DPDP Act 2023 explicit consent, PII masking, and data deletion workflows',
      'HTTPS over TLS 1.3 transport encryption and idempotent payment/order APIs',
    ],
    risks: parsed.risks.map((title, idx) => ({
      id: `RISK-${idx + 1}`,
      title,
      severity: idx === 0 ? 'High' : 'Medium',
      description: `${title} could disrupt checkout conversion, data integrity, or compliance posture in ${parsed.projectName}.`,
      mitigation:
        idx === 0
          ? 'Enforce atomic validation, idempotency keys, and automated security/load gates in CI/CD.'
          : 'Apply role-based access control, automated monitoring alerts, and structured error handling.',
      sdlcImpact: 'Increases need for continuous automated security checks, integration testing, and release gates.',
    })),
    decisionFactors,
  };

  const requirements: RequirementItem[] = [
    ...parsed.frs.map((fr, idx) => {
      const statement = fr.what.startsWith('The system')
        ? fr.what
        : `The system shall ${fr.what.charAt(0).toLowerCase()}${fr.what.slice(1)}`;
      const contract = enrichFunctionalContract(fr.title, statement);
      return {
        id: `FR-${String(idx + 1).padStart(3, '0')}`,
        title: fr.title,
        type: 'FR' as const,
        category: 'Functional' as RequirementCategory,
        priority: fr.priority,
        statement,
        overview: statement,
        inputs: contract.inputs,
        processingAndErrors: contract.processingAndErrors,
        outputs: contract.outputs,
        acceptanceCriteria: contract.acceptanceCriteria,
        verificationMethod: 'Test' as const,
        stakeholderSource: contract.stakeholderSource,
        complianceRef: 'Core Commerce',
        confidence: 91,
        citation: primaryCitation,
      };
    }),
    ...parsed.nfrs.map((nfr, idx) => ({
      id: `NFR-${String(idx + 1).padStart(3, '0')}`,
      title: nfr.title,
      type: 'NFR' as const,
      category: nfr.category as RequirementCategory,
      priority: 'Must' as const,
      statement: nfr.target.startsWith('The system') ? nfr.target : `The system shall ensure ${nfr.target}`,
      overview: nfr.target,
      inputs: 'Production user traffic, API requests, and operational telemetry',
      processingAndErrors: 'Enforced via gateway, encryption, rate-limiting, and circuit-breaker controls with audit logging.',
      outputs: 'Measurable SLA compliance, masked logs, and verifiable audit records',
      acceptanceCriteria: [nfr.target],
      verificationMethod: (nfr.category === 'Performance' || nfr.category === 'Availability' ? 'Test' : 'Inspection') as RequirementItem['verificationMethod'],
      stakeholderSource: 'Security & Operations',
      complianceRef: nfr.category === 'Security' || nfr.category === 'Compliance' ? 'PCI-DSS v4.0 / OWASP' : 'SLA / DPDP',
      confidence: 92,
      citation: 'docs/ingested/ecommerce/ecommerce-compliance-privacy.txt',
    })),
  ];

  const genDuration = Date.now() - genStart;
  auditTrail.push({
    stage: 'overview',
    agentName: 'Domain & Overview Analyst',
    durationMs: Math.round(genDuration * 0.4),
    status: mainRepaired ? 'repaired' : 'completed',
    notes: `Generated overview, ${overview.stakeholders.length} user classes, ${overview.risks.length} risks, and 13 SDLC factors.`,
  });
  auditTrail.push({
    stage: 'requirements',
    agentName: 'Requirements Engineer',
    durationMs: Math.round(genDuration * 0.6),
    status: mainRepaired ? 'repaired' : 'completed',
    notes: `Extracted ${requirements.length} requirements (${parsed.frs.length} FR, ${parsed.nfrs.length} NFR).`,
  });

  emit('overview', 'done', `Overview complete for "${overview.projectName}".`, 72);
  emit('requirements', 'done', `Validated ${requirements.length} requirements (${parsed.frs.length} FR, ${parsed.nfrs.length} NFR).`, 78);

  // Stage 3: Deterministic MCDA SDLC Selection Engine & Percentages
  emit('sdlc', 'running', 'Agent 3 (SDLC Selection Engine): Computing MCDA percentages across all 6 SDLC models...', 84);
  const sdlcStart = Date.now();
  const computedRankings = computeSdlcRankings(decisionFactors);
  const winner = computedRankings[0];
  const runnerUp = computedRankings[1];

  const topFactors = [...decisionFactors]
    .sort((a, b) => b.score - a.score)
    .slice(0, 3)
    .map((f) => `${f.label} (${f.score}/5)`)
    .join(', ');

  const sdlc: SdlcAnalysisResult = {
    recommendedId: winner.id,
    recommendedName: winner.name,
    recommendedPercentage: winner.percentage,
    perfectFitSummary: `${winner.name} achieved the highest Multi-Criteria Decision Analysis suitability score at ${winner.percentage}% (ahead of ${runnerUp.name} at ${runnerUp.percentage}%). Driven by ${topFactors}, ${overview.projectName} requires iterative storefront delivery across ${parsed.frs.slice(0, 3).map((_, i) => `FR-00${i + 1}`).join(', ')} paired with mandatory automated security, payment compliance, and verification gates before every release.`,
    factorAnalysis: decisionFactors.map((f) => ({
      factor: f.label,
      score: f.score,
      implication: f.rationale,
      citedIds: requirements.slice(0, 2).map((r) => r.id),
    })),
    rankings: computedRankings.map((r) => ({
      id: r.id,
      name: r.name,
      percentage: r.percentage,
      rank: r.rank,
      isRecommended: r.isRecommended,
      tagline: r.tagline,
      whyFitsOrSummary: r.strengths.join(' '),
      whyNotChosenOrTradeoffs: buildAlternativeJustification(r, winner, decisionFactors, requirements),
      keyStrengths: r.strengths,
      keyWeaknesses: r.weaknesses,
    })),
    workflowPhases: buildTailoredWorkflow(winner.id, overview.projectName, requirements),
    humanApprovalGates: [
      'Product Owner & Architect sign-off on IEEE 830-1998 SRS baseline prior to sprint execution',
      'Security & Compliance lead approval on PCI-DSS v4.0 payment tokenization and privacy consent flows',
      'Release Manager production go/no-go gate following SAST/DAST, load testing, and UAT verification',
    ],
    residualRisks: [
      'Third-party payment gateway or shipping carrier API downtime requires circuit breakers and idempotent retries.',
      'Periodic updates to regional tax rules or privacy regulations require scheduled compliance reviews.',
    ],
  };

  auditTrail.push({
    stage: 'sdlc',
    agentName: 'SDLC Selection Engine (MCDA)',
    durationMs: Date.now() - sdlcStart,
    status: 'completed',
    notes: `Ranked all 6 SDLC models; selected ${sdlc.recommendedName} at ${sdlc.recommendedPercentage}%.`,
  });
  emit('sdlc', 'done', `Selected ${sdlc.recommendedName} (${sdlc.recommendedPercentage}%) with all 6 models scored.`, 90);

  // Stage 4: IEEE 830-1998 Standard SRS Compiler (No UML)
  emit('srs', 'running', 'Agent 4 (IEEE 830-1998 SRS Compiler): Compiling & verifying IEEE 830-1998 SRS...', 94);
  const srsStart = Date.now();

  const narrative: SrsSectionNarrative = {
    purpose: `This Software Requirements Specification (SRS) defines the black-box functional, external interface, performance, logical database, and quality requirements for ${overview.projectName}. It establishes the authoritative agreement baseline for customers, product owners, analysts, developers, QA testers, and compliance reviewers.`,
    audience: [
      'Customers & Product Owners (scope validation and acceptance)',
      'Systems & Requirements Analysts (traceability and baseline governance)',
      'Software Engineers & Architects (black-box behavioral contract)',
      'QA & Security Testers (verification and acceptance criteria derivation)',
      'Project & Release Managers (milestone and compliance tracking)',
    ],
    definitions: [
      { term: 'SRS', definition: 'Software Requirements Specification structured per IEEE Std 830-1998 (No-UML Profile).' },
      { term: 'SKU', definition: 'Stock Keeping Unit identifying a unique purchasable product variant.' },
      { term: 'PCI-DSS', definition: 'Payment Card Industry Data Security Standard governing cardholder payment flows.' },
      { term: '3DS2', definition: '3D Secure 2 authentication protocol for strong customer authentication.' },
      { term: 'RTM', definition: 'Requirements Traceability Matrix linking requirements to sources, compliance, and verification.' },
      { term: 'Idempotency Key', definition: 'Unique request token preventing duplicate payment charges or orders on retries.' },
    ],
    references: [
      { id: 'REF-2', title: 'PCI-DSS v4.0 Requirements and Security Assessment Procedures', source: 'PCI Security Standards Council' },
      { id: 'REF-3', title: 'OWASP Application Security Verification Standard (ASVS)', source: 'OWASP Foundation' },
    ],
    externalInterfaces: {
      userInterfaces: `Responsive web storefront and role-specific operational portals for ${parsed.stakeholders.join(', ')} adhering to WCAG 2.1 AA accessibility.`,
      hardwareInterfaces: 'Standard desktop, tablet, and mobile devices running evergreen web browsers; standard shipping label/receipt printers for fulfillment.',
      softwareInterfaces: 'PCI-DSS Level 1 payment gateway APIs (hosted tokenization, 3DS2, UPI/card callbacks), shipping carrier rate/tracking APIs, and transactional email/SMS services.',
      communicationsInterfaces: 'All external client and partner integrations shall communicate over HTTPS (TLS 1.3) using JSON payloads and HMAC-SHA256 webhook verification.',
    },
    logicalDatabaseEntities: parsed.entities.map((entityName) => ({
      entity: entityName,
      description: `Core logical entity representing ${entityName} data in ${overview.projectName}`,
      keyAttributes: ['id', 'createdAt', 'updatedAt', 'status'],
      relationships: `Linked via foreign keys to related ${parsed.entities[0] ?? 'User'} and ${parsed.entities[parsed.entities.length - 1] ?? 'Order'} records`,
      retentionRule: 'Retained per active account lifecycle and statutory tax/audit retention requirements.',
    })),
    designConstraints: [
      ...overview.constraints,
      'Raw payment card numbers (PAN) and CVV values shall never be persisted on platform servers.',
      'All storefront and portal interfaces shall support current Chrome, Edge, Firefox, and Safari browsers.',
    ],
    decisionTableName: 'Checkout Payment, Inventory & Fraud Decision Rules',
    decisionTableConditions: ['Payment Token Verified', 'Inventory Reserved', 'Fraud Score Within Threshold'],
    decisionTableRules: [
      {
        scenario: 'R1: Standard Approved Order',
        conditions: { 'Payment Token Verified': 'Yes', 'Inventory Reserved': 'Yes', 'Fraud Score Within Threshold': 'Yes' },
        actions: ['Commit stock decrement', 'Transition order to Confirmed', 'Emit digital invoice & confirmation'],
      },
      {
        scenario: 'R2: Payment Failed or Timed Out',
        conditions: { 'Payment Token Verified': 'No', 'Inventory Reserved': 'Yes', 'Fraud Score Within Threshold': '—' },
        actions: ['Release soft inventory reservation', 'Keep order PendingPayment/Failed', 'Prompt buyer to retry payment'],
      },
      {
        scenario: 'R3: High Fraud Risk Flagged',
        conditions: { 'Payment Token Verified': 'Yes', 'Inventory Reserved': 'Yes', 'Fraud Score Within Threshold': 'No' },
        actions: ['Hold fulfillment for step-up/manual review', 'Restrict high-risk payment method', 'Log security audit event'],
      },
      {
        scenario: 'R4: Out-of-Stock Race Condition',
        conditions: { 'Payment Token Verified': '—', 'Inventory Reserved': 'No', 'Fraud Score Within Threshold': '—' },
        actions: ['Abort checkout before charge capture', 'Notify buyer of updated stock availability'],
      },
    ],
  };

  const srs = compileIeee830SrsDocument({
    overview,
    requirements,
    narrative,
    evidenceCitations,
  });

  auditTrail.push({
    stage: 'srs',
    agentName: 'IEEE 830-1998 SRS Compiler',
    durationMs: Date.now() - srsStart,
    status: 'completed',
    notes: `Compiled ${srs.documentId}; compliant=${srs.compliance.isCompliant}, umlExcluded=${srs.compliance.umlExcluded}.`,
  });
  emit('srs', 'done', `IEEE 830-1998 SRS compiled (${srs.compliance.functionalRequirementCount} FRs).`, 96);

  // Stage 5: Save & Export
  emit('save', 'running', 'Saving run record and Markdown/HTML artifacts...', 98);
  const runRecord: ReQuoraRunRecord = {
    id: randomUUID(),
    createdAt: new Date().toISOString(),
    brief,
    projectName: overview.projectName,
    modelUsed: config.lmStudio.model,
    durationMs: Date.now() - totalStart,
    evidenceCitations,
    overview,
    requirements,
    sdlc,
    srs,
    auditTrail,
  };

  await saveRun(runRecord);
  emit('save', 'done', 'Complete! Specification ready.', 100);
  return runRecord;
}
