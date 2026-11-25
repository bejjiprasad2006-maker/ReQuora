# Problem statement coverage after the v3 implementation

The project now supports both the financial scope in the supplied problem statement and existing e-commerce projects. Domain, service, operating entity and jurisdiction are explicit project inputs; document contents remain specification data rather than executable instructions.

The missing application capabilities identified in the prior audit now have code paths and review interfaces. The table distinguishes implemented mechanisms from external validation that software cannot manufacture.

| DOCX section | Implemented coverage | Evidence / boundary |
| --- | --- | --- |
| 1. Scope | Financial and e-commerce projects/modules, declared entity/service scope, exclusions, specifications and control matrices | `schemas.ts`, workspace projects and exports |
| 2. Stakeholders | Role-specific interview templates, attributed persistent answers and invited reviewer accounts | `interviews.ts`, `auth.ts`; professional qualifications are not externally verified |
| 3. Inputs | Multiple versioned sources, typed metadata, TXT/MD/DOCX/JSON/YAML/SQL/EML/CSV imports, classification and masking | File size/expansion bounds; structured formats are analysed as data, never executed; no automatic email/account connector |
| 4. Agents | Requirements, independent Quality/Evidence, SDLC and adaptive Interview agents; deterministic orchestration and validation | Core screenshot tasks remain separate agents; suggested additional roles are consolidated |
| 5. Knowledge | Source/publisher/URL, jurisdiction, version, date uncertainty, applicability, freshness and digests; custom source/control packs and revisions | Seed catalogue covers selected India/EU financial, consumer, privacy, OWASP and PCI topics; actual complete legal scope needs a qualified reviewer |
| 6. RAG | Allowlisted BM25 retrieval, reviewed project policy sources, optional cosine reranking, encrypted vector cache, citations and evidence-support review | Semantic model verdicts are not proof of entailment; unsupported/uncertain claims become review findings |
| 7. Conversations | Persistent interviews, adaptive follow-up agent, vague-answer handling, answered-question history and model regeneration | Requires a real configured model for generated follow-ups; templates/answer persistence work without it |
| 8. Requirement metadata | Justification, stakeholder, source, risk, categories, priority, criteria, dependencies, confidence, controls and approval state | AI outputs start as drafts; authenticated decisions are stored separately and bound to version digests |
| 9. Classification | Primary category plus multi-label categories covering business, stakeholder, functional, security, privacy, compliance, performance, availability, usability, data, integration, audit and operations | Classification accuracy needs an annotated evaluation |
| 10. Quality | Structural/source/dependency validation, cycle/duplicate/ambiguity checks, lexical contradiction screening and separate semantic review for conflict, feasibility, terminology, testability, bias and omissions | Detection is fallible; explicit resolution and supporting evidence are required before baselining |
| 11. Compliance | Jurisdiction/date-aware candidate controls, gaps, custom packs, source reviews, applicability/exclusion decisions and legal/security owners | Candidate linking does not determine legal compliance; staged commencement is not treated as universally effective |
| 12. Artifacts | Requirements, stories, use cases, criteria, IEEE 830-aligned SRS, data/interface specifications, glossary, structured STRIDE threats, risks, assumptions, issues, traceability, compliance matrix and Mermaid process workflow | Downloadable ZIP plus PDF/HTML/Markdown/JSON/CSV |
| 13. SDLC factors | Sixteen explained factors covering the full factor set, including regulatory criticality, size, budget, schedule, formal verification and consequences | Unspecified factor values are assumptions for review |
| 14. SDLC engine | Deterministic multi-criteria profile ranking plus LLM explanation and expert review | Scores are heuristic suitability, not validated probabilities |
| 15. Delivery workflow | Phases, activities, roles, deliverables, entry/exit gates, security checkpoints and control-to-phase review crosswalk | Reviewer roles and final decision gates are separately enforced by the platform |
| 16. Human oversight | Authenticated individual/bulk requirement decisions, six independent baseline gates, finding resolutions, control decisions, immutable version history and stale-baseline blocking | Distinct accounts are enforced; the system cannot prove that accounts belong to different real people |
| 17. Platform security | Password hashing, TOTP/replay protection, sessions, RBAC, membership, tenant-bound encryption, CSRF/origin checks, CSP, tool restrictions, source gates, TLS enforcement for non-loopback/production, legal holds and retention | Tested software controls; independent penetration testing and deployment hardening remain external |
| 18. Prototype stack | Four agents, Mastra orchestration, encrypted SQLite records/normalized requirements, optional semantic vectors, rules, web interface, document generation, identity and operations views | Mastra Studio/CLI remain separate developer surfaces; production starts the authenticated workspace |
| 19. Evaluation | Metric engine, reference datasets, independent adjudication, one-to-one annotation checks, live/test provenance, manual-time comparison, satisfaction fields, reviewed control/consistency/traceability metrics, study summaries and calibration diagnostics | Actual expert annotations, participants, manual baselines and real model runs must be supplied; none are invented |
| 20. Operations | Persistent jobs, serialized model queue, failed/interrupted job handling, monitoring view, signed audit history/checkpoints, original masked call traces, change history and knowledge/model-revision re-evaluation gates | Source updates are reviewer-driven; there is no claim of automatic discovery of every legal amendment |

## Verification

TypeScript checks, automated tests and production build are run against this implementation. Browser checks cover setup and MFA, authored demo analysis, requirement filtering/editing, preserved history, blocked demo baselines and responsive layouts. Tests use controlled models and authored data and therefore do not establish AI accuracy or legal correctness.

## External work that remains

- Start/configure a real local model and evaluate its generated outputs and follow-up questions.
- Have qualified reviewers determine actual jurisdiction, institution/business policies, complete control coverage and source currency.
- Collect independently annotated cases, expert lifecycle judgments, manual baseline timings and real stakeholder feedback; use the implemented evaluation workflow to compute results.
- Supply trusted TLS certificates/secrets and assess the intended production deployment independently.

These are real-world inputs and validation activities. The application mechanisms needed to support them are implemented; their outcomes are not asserted as already achieved.

## Financial completion boundary - 19 November 2026

Financial domain selection, nine service examples, entity-scoped candidate controls, separate financial retrieval/interviews, structured threat modelling and independent threat decisions are implemented. Domain-specific SRS and threat exports, real-model benchmark execution, reviewed evaluation metrics, study summaries, version-bound external assessment records and deployment readiness reports are available. Older e-commerce records remain supported.

Source metadata and curated notes do not establish a complete or current legal perimeter. IRDAI/DORA discovery records explicitly require manual official-text verification; payment-provider and additional entity/activity/jurisdiction source packs remain reviewer-supplied through the custom-pack workflow. Actual model effectiveness, stakeholder studies, external assessments and professional legal conclusions still require real evidence. The configured model endpoint was unavailable during this verification; authored and controlled runs are labelled accordingly.
