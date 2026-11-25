# Financial application threat analysis — project-authored guidance

Apply STRIDE to declared assets and trust boundaries: customer-to-application, application-to-ledger, reviewer-to-case-management and institution-to-third-party interfaces where in scope. Capture actor, attack scenario, likelihood, impact, mitigations, residual risk, requirement IDs, source, verification and evidence. Threats remain drafts until independently reviewed.

Consider account takeover, forged payment instructions, duplicate/replayed transactions, ledger tampering, unauthorised customer-record access, repudiated approvals, denial of service, insider privilege escalation and prompt injection through uploaded evidence. Verify transaction integrity, idempotency, role segregation, tamper-evident auditing, safe reconciliation and recovery using observable tests. Do not claim these controls eliminate threats.

Include data minimisation, masking, purpose restrictions, retention and lawful processing decisions. Scope raw card data separately from account/identity data. A hosted payment redirect does not establish the entire institution's payment compliance. Institution risk acceptance must be recorded by an authorised security reviewer with evidence.
