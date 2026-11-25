# Financial requirements engineering — project-authored guidance

This is engineering guidance, not a legal source or an approved institution policy.
Use the explicitly declared service and operating entity. Digital banking, loan processing, payments, fraud detection, insurance, investment services, regulatory reporting, onboarding/KYC and financial analytics have different boundaries. A software vendor or merchant is not automatically a regulated financial institution.

For digital banking and payments, elicit account ownership, transaction authorisation, amount/currency validation, balance consistency, duplicate requests, reconciliation, disputes, reversals and auditable state transitions. Monetary values require declared precision and rounding rules; never silently use floating-point balances or invent transaction limits.

For lending, elicit application evidence, consent, decision explanations, fairness review, maker/checker boundaries, disclosures, disbursement, repayment, exceptions and complaint handling. For fraud detection, distinguish an alert from an authorised block, preserve investigation evidence and ask about false positives and appeals. For insurance, cover proposals, underwriting, policy changes, claims, beneficiary access and human claim decisions. For investment services, ask about customer suitability, order lifecycle, reconciliation and market-data provenance. For reporting and analytics, ask about lineage, calculation versions, completeness, correction, submission evidence and access to sensitive data.

Onboarding/KYC requires the entity's approved verification process, beneficial-owner scope where applicable, evidence handling, review queues, screening and periodic review policies. Do not invent documentary requirements, retention periods, risk thresholds or regulator reporting deadlines. Record unknowns as assumptions or clarification questions. Candidate regulations need exact sources and legal approval.
