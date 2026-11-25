import { specificationSchema, sdlcSchema, srsTopics, type Requirement, type Specification } from '../domain/schemas';

export const fixtureBrief = `ShopSphere is a single-merchant e-commerce platform for physical products.
Shoppers can browse and search products and variants.
Shoppers can maintain a cart and see recalculated totals.
The server validates discounts and shipping charges.
Checkout reserves stock without overselling the last unit.
Customers pay using a hosted payment provider.
Signed payment callbacks update orders exactly once.
Customers can see only their own orders and tracking.
Warehouse staff can pack and ship paid orders.
Support staff can approve returns and initiate refunds.
Refund retries must not refund more than the paid amount.
Administrators can manage products and stock with role checks.
Order and refund state changes are recorded in an audit trail.
Customer data access is restricted by role and purpose.
Search needs an agreed measurable response target.
Operations needs tested recovery and monitoring.
The product owner is available throughout delivery. Promotions change frequently and releases should be frequent with automated security testing. The provider API is known, but retry and concurrency behaviour needs validation. Scope excludes lending, multi-vendor settlements and storing raw card numbers. Jurisdiction, retention, recovery targets and return windows need confirmation.`;

type Seed = [string, string, Requirement['category'], string];
const seeds: Seed[] = [
  ['Shoppers can browse and search products and variants.', 'Catalogue', 'functional', 'Given a visible product variant, searching its name returns that variant; hidden products are excluded.'],
  ['Shoppers can maintain a cart and see recalculated totals.', 'Cart', 'functional', 'When quantity changes, the cart recalculates using current server prices and shows the changed line total before checkout.'],
  ['The server validates discounts and shipping charges.', 'Pricing', 'functional', 'A modified client price or expired coupon is rejected; the checkout displays the server-calculated total for confirmation.'],
  ['Checkout reserves stock without overselling the last unit.', 'Inventory', 'functional', 'Given one remaining unit, two simultaneous checkout reservations produce one success and one out-of-stock result.'],
  ['Customers pay using a hosted payment provider.', 'Payments', 'integration', 'Card entry occurs on the configured provider page; merchant requests and logs contain no raw card number.'],
  ['Signed payment callbacks update orders exactly once.', 'Payments', 'security', 'A callback with an invalid signature is rejected; replaying a valid event does not create another order or payment transition.'],
  ['Customers can see only their own orders and tracking.', 'Orders', 'functional', 'A shopper receives their own shipment status; requesting another shopper order identifier returns no order data.'],
  ['Warehouse staff can pack and ship paid orders.', 'Fulfilment', 'functional', 'A permitted warehouse operator can ship a paid order; unpaid or cancelled orders cannot transition to shipped.'],
  ['Support staff can approve returns and initiate refunds.', 'Returns', 'functional', 'A support operator can approve a return under the configured policy; a shopper cannot call the approval endpoint.'],
  ['Refund retries must not refund more than the paid amount.', 'Refunds', 'functional', 'Replaying a refund request returns its recorded outcome; cumulative successful refunds cannot exceed the captured amount.'],
  ['Administrators can manage products and stock with role checks.', 'Administration', 'functional', 'An administrator can update a product; a shopper calling the same operation receives an authorisation failure.'],
  ['Order and refund state changes are recorded in an audit trail.', 'Audit', 'audit', 'Each order or refund transition records its actor, timestamp, prior/new state and correlation ID without card or secret data.'],
  ['Customer data access is restricted by role and purpose.', 'Privacy', 'privacy', 'An unauthorised role cannot export customer records; permitted exports are recorded for review.'],
  ['Search needs an agreed measurable response target.', 'Search', 'performance', 'Under the A-1 workload, measured p95 search latency is at most two seconds, with results and environment retained.'],
  ['Operations needs tested recovery and monitoring.', 'Operations', 'operational', 'A restore drill recovers the test order dataset and a failed payment callback raises an observable alert.'],
];
const securityEvidence = 'docs/ingested/ecommerce/security-evidence.md';
export const fixtureSpecification: Specification = specificationSchema.parse({
  title: 'ShopSphere e-commerce requirements', summary: 'A single-merchant online store with traceable catalogue, cart, inventory, payment, fulfilment and returns requirements. This is an authored demonstration fixture.',
  scope: ['Physical-product storefront', 'Hosted checkout and callback processing', 'Order fulfilment, returns and admin operations'],
  outOfScope: ['Lending and banking', 'Multi-vendor settlement', 'Raw card-number storage'],
  stakeholders: ['Shopper', 'Product owner', 'Merchant administrator', 'Warehouse operator', 'Support operator', 'Security reviewer', 'Payment provider'],
  assumptions: [{ id: 'A-1', statement: 'Demonstration target only: search p95 <= 2 seconds at 100 concurrent shoppers on a representative test dataset. Product owner must confirm workload and target.' }, { id: 'A-2', statement: 'Decision ratings are an analyst assessment: formal approval level 2, legacy complexity 2 and verification level 3; validate before adoption.' }],
  requirements: seeds.map(([source, module, category, criterion], index) => ({
    id: `${category === 'functional' || category === 'integration' ? 'FR' : 'NFR'}-${String(index + 1).padStart(3, '0')}`,
    statement: `The platform shall implement this behaviour: ${source}`,
    category, module, priority: index === 13 ? 'Should' : 'Must',
    categories: [...new Set([category, ...(['Payments', 'Privacy'].includes(module) ? ['security', 'privacy'] : [])])],
    businessJustification: `Support the merchant and shopper workflow for ${module.toLowerCase()} with verifiable behaviour.`,
    stakeholder: ['Administration'].includes(module) ? 'Merchant administrator' : ['Fulfilment'].includes(module) ? 'Warehouse operator' : ['Returns', 'Refunds'].includes(module) ? 'Support operator' : 'Product owner',
    riskLevel: ['Payments', 'Refunds', 'Privacy', 'Inventory'].includes(module) ? 'high' : 'medium', applicableControlIds: [], approvalStatus: 'draft',
    source: index === 13 ? { kind: 'assumption', reference: 'A-1' } : { kind: 'stakeholder', reference: source },
    acceptanceCriteria: [criterion], verification: index === 13 ? 'Repeatable load test' : 'Automated integration and negative-path test',
    dependencies: index === 5 ? ['FR-005'] : index === 9 ? ['FR-009', 'FR-005'] : [],
    evidence: ['security', 'privacy'].includes(category) ? [securityEvidence] : [], confidence: index === 13 ? 0.65 : 0.88,
  })),
  userStories: seeds.flatMap(([source, module, category, criterion], index) => category === 'functional' ? [{ id: `US-${String(index + 1).padStart(3, '0')}`, story: `As a ${['Administration'].includes(module) ? 'merchant administrator' : ['Fulfilment'].includes(module) ? 'warehouse operator' : ['Returns', 'Refunds'].includes(module) ? 'support operator' : 'shopper'}, I need ${module.toLowerCase()} behaviour so that ${source.charAt(0).toLowerCase() + source.slice(1)}`, requirementIds: [`FR-${String(index + 1).padStart(3, '0')}`], acceptanceCriteria: [criterion] }] : []),
  useCases: [
    { id: 'UC-001', title: 'Place and pay for an order', actor: 'Shopper', preconditions: ['A visible product has available stock.'], steps: ['Find a product and select a variant.', 'Add it to the cart and confirm server totals.', 'Reserve stock and open hosted payment.', 'Provider callback confirms payment and the order becomes visible.'], exceptions: ['Stock unavailable: reject the reservation.', 'Invalid signature: reject callback.', 'Repeated callback: return the existing result.'], requirementIds: ['FR-001', 'FR-002', 'FR-003', 'FR-004', 'FR-005', 'NFR-006', 'FR-007'] },
    { id: 'UC-002', title: 'Approve a return and refund', actor: 'Support operator', preconditions: ['An order is paid and a return has been requested.'], steps: ['Review the configured returns policy.', 'Approve the return.', 'Initiate an idempotent provider refund.', 'Record the provider result and audit event.'], exceptions: ['Unauthorised role: deny approval.', 'Retry: reuse the refund operation.', 'Amount exceeds captured payment: reject.'], requirementIds: ['FR-009', 'FR-010', 'NFR-012'] },
  ],
  risks: [
    { id: 'RISK-001', description: 'Concurrent reservations or callback retries corrupt stock or payment state.', severity: 'high', mitigation: 'Atomic inventory operations, idempotent transitions and replay/concurrency tests.', requirementIds: ['FR-004', 'NFR-006', 'FR-010'], sdlcImpact: 'Require automated integration gates and security tests on every release.' },
    { id: 'RISK-002', description: 'Return windows, privacy jurisdiction and recovery targets are unresolved.', severity: 'medium', mitigation: 'Product owner, operations lead and legal reviewer resolve open policy questions.', requirementIds: ['FR-009', 'NFR-013', 'NFR-015'], sdlcImpact: 'Iterate on policy-dependent requirements before baseline approval.' },
  ],
  openQuestions: ['Which jurisdictions and consumer/privacy rules apply?', 'What return window and exceptions will the merchant approve?', 'What recovery and retention targets are required?', 'Is the A-1 latency/workload target acceptable?'],
  decisionFactors: Object.fromEntries(Object.entries({
    changeFrequency: [4, 'Promotions change frequently.', ['FR-003']], securityRisk: [4, 'Payment callbacks and order isolation carry significant abuse risk.', ['NFR-006', 'FR-007']],
    uncertainty: [2, 'Provider API is known; concurrency behaviour still needs validation.', ['FR-004', 'NFR-006']], verification: [3, 'Assumed test formality under A-2 for payment and refund integrity.', ['NFR-006', 'FR-010']],
    continuousDelivery: [4, 'Frequent releases with automated security testing are requested.', ['NFR-006', 'NFR-015']], stakeholderAvailability: [4, 'The product owner is available throughout delivery.', ['FR-003']],
    legacyComplexity: [2, 'Assumed integration complexity under A-2; no legacy estate confirmed.', ['FR-005']], approvalFormality: [2, 'Assumed human review formality under A-2; no regulator-specific gate claimed.', ['NFR-013']],
    requirementStability: [1, 'Promotions change frequently; policy questions remain open.', ['FR-003', 'FR-009']],
    regulatoryCriticality: [2, 'Assumed moderate exposure under A-2; jurisdiction is unconfirmed.', ['NFR-013']],
    projectComplexity: [3, 'Inventory, payments and refunds require coordinated transitions.', ['FR-004', 'NFR-006', 'FR-010']],
    systemSize: [3, 'Assumed multi-module scope under A-2, not a measured sizing estimate.', ['FR-001', 'FR-005', 'FR-009']],
    budgetConstraint: [2, 'Budget unspecified; midpoint assumed under A-2 for review.', ['FR-001']],
    schedulePressure: [3, 'Frequent releases requested; delivery pressure assumed under A-2.', ['NFR-015']],
    formalVerification: [2, 'Assumed review and integration test evidence under A-2, not mathematical verification.', ['NFR-006']],
    failureConsequence: [3, 'Incorrect refunds and stock allocation can cause financial loss.', ['FR-004', 'FR-010']],
  }).map(([key, [rating, rationale, requirementIds]]) => [key, { rating, rationale, requirementIds }])),
  glossary: [{ term: 'Idempotent', definition: 'Repeating an operation produces no additional business effect.' }, { term: 'p95', definition: 'The latency at or below which 95 percent of observed requests complete.' }],
  projectContext: { domain:'ecommerce',useCase:'other',regulatedEntity:'unknown',jurisdictions: ['Unspecified'], personalData: true, paymentIntegration: 'redirect', businessModel: 'single-merchant' },
  dataRequirements: [{ id: 'DATA-001', entity: 'Order', fields: [{ name: 'orderId', type: 'UUID', classification: 'internal' }, { name: 'customerId', type: 'UUID', classification: 'personal' }, { name: 'state', type: 'OrderState', classification: 'internal' }], retentionPolicy: 'Unresolved; merchant and legal reviewer must confirm.', requirementIds: ['FR-007', 'NFR-012', 'NFR-013'] }],
  interfaceRequirements: [{ id: 'INT-001', name: 'Payment provider callback', protocol: 'HTTPS webhook', authentication: 'Verify configured provider signature and event identity.', inputs: ['eventId', 'orderId', 'amount', 'currency', 'status'], outputs: ['Acknowledgement and recorded transition result'], failureHandling: 'Reject invalid signatures; safely replay duplicate events; reconcile unknown outcomes.', requirementIds: ['FR-005', 'NFR-006'] }],
  threatModel:{method:'STRIDE',scope:'Authored demonstration of payment callbacks and customer order access; not an exhaustive threat assessment.',assets:['Payment/order state','Customer order data'],trustBoundaries:['Hosted provider to merchant callback endpoint','Customer session to order API'],threats:[
    {id:'THR-001',category:'tampering',asset:'Payment/order state',trustBoundary:'Hosted provider to merchant callback endpoint',actor:'External attacker',scenario:'An attacker forges or replays payment callbacks to alter paid-order state.',likelihood:'medium',impact:'high',mitigations:['Verify provider signatures and persist event identity before replay-safe state changes.'],verification:'Integration tests reject invalid signatures and duplicate callbacks without extra transitions.',residualRisk:'Provider compromise and operational reconciliation still need security review.',requirementIds:['FR-005','NFR-006'],riskIds:['RISK-001'],evidence:[securityEvidence],source:{kind:'stakeholder',reference:'Signed payment callbacks update orders exactly once.'},status:'draft'},
    {id:'THR-002',category:'information-disclosure',asset:'Customer order data',trustBoundary:'Customer session to order API',actor:'Authenticated malicious shopper',scenario:'A shopper submits another customer order identifier to disclose order and tracking data.',likelihood:'medium',impact:'high',mitigations:['Enforce server-side ownership and role checks before returning customer records.'],verification:'Negative-path tests request another shopper order and assert no order data is returned.',residualRisk:'Support exports and administrator access require additional security review.',requirementIds:['FR-007','NFR-013'],riskIds:[],evidence:[],source:{kind:'stakeholder',reference:'Customers can see only their own orders and tracking.'},status:'draft'},
  ]},
  srsContext: {
    purpose: 'Specify the ShopSphere product behavior and acceptance criteria for the product owner, developers, testers and independent reviewers. This is an authored demonstration draft.',
    productPerspective: 'ShopSphere is a single-merchant physical-product storefront. The product boundary includes catalogue, cart, stock reservation, orders, fulfilment and returns; a hosted payment provider supplies payment entry and signed callbacks. The deployment environment is TBD.',
    userCharacteristics: [
      { userClass: 'Shopper', characteristics: 'Browses products, manages a cart and accesses their own orders. Experience, device support and accessibility needs are TBD.' },
      { userClass: 'Merchant administrator', characteristics: 'Manages catalogue and stock through role-checked operations. Training and skills are TBD.' },
      { userClass: 'Warehouse operator', characteristics: 'Packs and ships paid orders. Device and training needs are TBD.' },
      { userClass: 'Support operator', characteristics: 'Approves returns and initiates refunds under merchant policy. Training needs are TBD.' },
    ],
    constraints: ['Raw card-number storage is excluded; payment entry occurs at the hosted provider.', 'Jurisdiction, retention rules and operational targets are unresolved.'],
    externalDependencies: ['Hosted payment provider availability, signature configuration and event delivery.', 'Merchant policy decisions on returns and refunds; final policy values are unresolved.'],
    apportioning: 'Release allocation is unresolved; no stakeholder-approved deferral to future versions is recorded.',
    coverage: srsTopics.map(topic => {
      const specified: Partial<Record<typeof topic, { description: string; requirementIds: string[] }>> = {
        userInterfaces: { description: 'Shoppers search visible variants, update carts and view their own order status with observable outcomes.', requirementIds: ['FR-001', 'FR-002', 'FR-007'] },
        softwareInterfaces: { description: 'Hosted provider integration uses signed, replay-safe payment callbacks; see INT-001.', requirementIds: ['FR-005', 'NFR-006'] },
        communicationsInterfaces: { description: 'INT-001 defines HTTPS callback inputs, acknowledgement, signature authentication and replay behavior.', requirementIds: ['NFR-006'] },
        security: { description: 'Provider callback verification, order access isolation, role restrictions and audit events are verified by integration tests.', requirementIds: ['NFR-006', 'FR-007', 'NFR-012', 'NFR-013'] },
      };
      if (specified[topic]) return { topic, status: 'specified', ...specified[topic] };
      return { topic, status: 'unresolved', description: `${topic}: stakeholder confirmation of scope and measurable criteria remains unresolved.`, requirementIds: topic === 'performance' ? ['NFR-014'] : topic === 'database' ? ['FR-007', 'NFR-012', 'NFR-013'] : topic === 'otherAttributes' ? ['NFR-015'] : [] };
    }),
  },
});

export const fixturePlan = sdlcSchema.parse({
  selectedModel: 'Agile + DevSecOps',
  justification: [
    { reason: 'Frequent promotion changes and available product ownership benefit from a regularly refined backlog and review of increments.', requirementIds: ['FR-003', 'FR-002'] },
    { reason: 'Secure delivery gates continuously verify callback replay safety, inventory races and refund limits before deployment.', requirementIds: ['FR-004', 'NFR-006', 'FR-010'] },
  ],
  alternatives: [
    { model: 'Waterfall', tradeoff: 'Sequential baselines offer predictable approvals but responding to ongoing promotion changes would require more formal change handling.', requirementIds: ['FR-003'] },
    { model: 'V-Model', tradeoff: 'Strong test traceability is useful; a pure sequential interpretation provides less direct support for the requested frequent release cadence.', requirementIds: ['NFR-006', 'NFR-015'] },
  ],
  phases: [
    { name: 'Discover and baseline the next increment', activities: ['Refine the backlog with the product owner.', 'Resolve policy questions and rank requirements.', 'Repeat discovery before each increment.'], roles: ['Product owner', 'Business analyst', 'Technical lead'], deliverables: ['Reviewed SRS increment', 'Acceptance-test backlog'], entryGate: 'Stakeholder brief and evidence register available.', exitGate: 'Product owner and technical lead approve scope; project manager, architect and security reviewer adopt the lifecycle.', securityCheckpoint: 'Review privacy purpose and payment-provider scope; legal applicability remains pending authorised review.', requirementIds: ['FR-001', 'FR-002', 'FR-003', 'FR-009', 'NFR-013'] },
    { name: 'Design and implement an increment', activities: ['Design state transitions and threat scenarios.', 'Implement catalogue, inventory and payment contracts.', 'Review code and dependencies.'], roles: ['Developers', 'Architect', 'Security reviewer'], deliverables: ['Versioned code', 'Threat model', 'Integration contracts'], entryGate: 'Increment scope and acceptance criteria reviewed.', exitGate: 'Peer review passed and required build/security checks green.', securityCheckpoint: 'Verify order ownership, role checks and idempotency design.', requirementIds: ['FR-001', 'FR-002', 'FR-003', 'FR-004', 'FR-005', 'NFR-006', 'FR-007', 'FR-008', 'FR-009', 'FR-010', 'FR-011', 'NFR-012', 'NFR-013'] },
    { name: 'Verify and release through secure gates', activities: ['Run replay, stock-race, refund and access-control tests.', 'Load-test search against the provisional target.', 'Demonstrate the increment in sprint review and decide release readiness.'], roles: ['QA engineer', 'Product owner', 'Security reviewer', 'Release operator'], deliverables: ['Test evidence linked to requirements', 'Release decision', 'Rollback procedure'], entryGate: 'Reviewed implementation and test environment ready.', exitGate: 'Product owner accepts the increment; release operator and security reviewer approve tested release and rollback evidence.', securityCheckpoint: 'No unreviewed high-risk findings; payment sandbox contract tests pass.', requirementIds: ['FR-004', 'FR-005', 'NFR-006', 'FR-007', 'FR-010', 'FR-011', 'NFR-013', 'NFR-014'] },
    { name: 'Operate, recover and improve', activities: ['Monitor order/payment/refund events.', 'Exercise restore and rollback.', 'Feed incidents and retrospective findings into the next backlog.'], roles: ['Operations lead', 'Support operator', 'Product owner'], deliverables: ['Monitoring evidence', 'Restore drill record', 'Improvement backlog'], entryGate: 'Approved release and operational handover complete.', exitGate: 'Operations lead verifies recovery evidence; product owner prioritises follow-up work for the next increment.', securityCheckpoint: 'Audit privileged operations and investigate suspicious state changes.', requirementIds: ['FR-007', 'FR-008', 'FR-009', 'FR-010', 'NFR-012', 'NFR-015'] },
  ],
  residualRisks: ['The scoring policy is an uncalibrated project heuristic; model scores do not establish lifecycle correctness.', 'Jurisdiction, returns, retention and recovery policies need stakeholder review.', 'Generated confidence and structural checks do not measure extraction accuracy.'],
});
