# Verification record — 2026-11-18

Environment: Windows, Node 24.22.3 invoked through the provided Node 24 wrapper. The machine's default Node 20 remains unchanged.

Completed checks:

- TypeScript checking of source and tests.
- Automated coverage of lifecycle scenarios, schema validation, source/reference integrity, four-agent OpenAI-compatible response handling, MFA/replay, encrypted storage and OS-protected key persistence, tenant/project boundaries, stale revisions, interviews, semantic quality screening, jurisdiction controls, baseline gates, immutable edits, research metrics/adjudication, HTTP origin/CSRF/role boundaries, source packs, retention/audit checkpoints, fabricated citation quotes, semantic-vector caches and classified-source gates.
- Mastra production build and a separate authenticated workspace server/UI build.
- Compiled workspace HTTP checks: `/`, `/app.js` and `/api/status` respond successfully on port 4120; the user's administrator has not been pre-created.
- Isolated browser QA on a separate test database: setup, authenticator enrollment, authored demo analysis, search, editing, two-version history and blocked demo baseline. Viewport widths 375, 430, 1024 and 1440 showed no horizontal document overflow. No JavaScript exceptions were observed.
- Standalone authored demo export with PDF/HTML/Markdown/JSON/CSV and additional compliance, trace and workflow artifacts.

The UI QA account and database are isolated under `.runtime/qa-platform`; they are not the user's real workspace or credentials. No real account password was selected on the user's behalf.

Live model diagnostics: the configured LM Studio endpoint was unavailable. Four-agent protocol tests use controlled server responses. Fixtures, test approvals and software-test reference annotations do not constitute real AI performance results, professional legal judgments or a stakeholder study.

See README.md for startup, docs/EVALUATION.md for empirical study procedures, and docs/PROBLEM_STATEMENT_COVERAGE.md for the current implementation/validation boundary.

## Financial extension verification — 2026-11-19

- TypeScript checking passed under Node 24.22.3.
- All 41 automated tests passed, including nine financial case schemas, declared-profile enforcement, domain-isolated retrieval/interviews, entity/jurisdiction/service-sensitive candidate controls, unknown card scope, financial identifier masking, structured threat integrity, independent version-bound threat/assessment decisions, authenticated financial demos and exports, reviewer-driven metrics, study exclusions and pre-inference adjudication timing.
- Mastra production build and authenticated workspace bundle passed. An initial npm tarball 404 during a newly published dependency was resolved when the registry made that tarball available; the normal build then completed. Installed root dependency versions were not changed for this workaround.
- Compiled workspace smoke checks passed for assets, the nine-case catalogue, financial demo analysis, structured threats and the financial SRS download.
- Isolated headless browser checks passed for the financial project defaults, all nine case options, lending template/profile population, financial interviews, authored onboarding analysis, threat register, SRS links, review/readiness and evaluation/study links. Widths 375, 430, 1024 and 1440 showed no horizontal overflow or JavaScript exceptions. Artifacts are under `.runtime/financial-ui-71914161-fe42-4d87-a493-8373c4b1e13b/`; no real workspace account or customer records were used.
- Authored financial SRS, PDF/report, traceability and threat-model exports were generated under `artifacts/financial/620eefd1-c4b9-4ce8-9adc-cad794ab7c4e/`. Unresolved policies remain review findings rather than invented approved facts.

The configured LM Studio endpoint remained unavailable during diagnostics. No real-model benchmark, expert legal determination, stakeholder study or external penetration test is asserted. Financial source discovery/verification limits are documented in `FINANCIAL_SOURCES.md`; use the implemented review, evaluation and assessment workflows to supply actual evidence.
