# SDLC selection policy v2

Source kind: project-authored course decision policy, version 2, 2026-11-18. This is not an externally validated predictive model.

Waterfall fits stable, understood scope with sequential approvals. V-Model emphasises specification-to-test traceability and formal verification. Spiral centres repeated risk analysis and prototypes under uncertainty. Agile supports changing scope and recurring stakeholder feedback. DevSecOps supports frequent deployment with security, tests, monitoring and recovery. Agile + DevSecOps combines iteration with secure release pipelines. Agile + V-Model combines iterative discovery with verification gates.

The implementation in src/domain/sdlc.ts rates sixteen factors from 0 to 4 with an explanation and requirement links. They cover change frequency, security risk, uncertainty, verification/testing, continuous delivery, stakeholder availability, legacy complexity, approval formality, requirement stability, regulatory criticality, project complexity, system size, budget constraint, schedule pressure, formal verification and failure consequences.

Each factor has equal weight. Score = 100 times the sum of (4 minus absolute distance from the declared target profile) divided by 64, rounded. Scores are suitability indices, not probabilities or measured accuracy. Declared model order breaks ties. Assumed factors and close recommendations require human review.

The SDLC Agent explains the top recommendation, compares alternatives and defines activities, roles, deliverables and entry/exit gates. The report links policy controls to delivery phases. The authenticated workspace separately enforces owner, architect, security, legal, project-manager and operations decisions before a baseline can be created.
