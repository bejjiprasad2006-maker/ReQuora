# RikuAI - Financial and e-commerce requirements engineering workspace

RikuAI gathers stakeholder inputs, produces traceable financial or e-commerce requirements, reviews their quality and evidence, recommends a lifecycle, and manages authenticated review through an approved baseline.

## Open the application

On this Windows machine, double-click **`start_workspace.cmd`**, then open **http://localhost:4120**. The launcher uses a temporary Node 24 runtime because the machine's default Node 20 does not support the application's SQLite runtime.

Alternatively:

```powershell
cd 'C:\Users\M K Vasudev\OneDrive\Desktop\SE new\RikuAI'
npm install
npx --yes --package=node@24 --call "npm run dev"
```

With Node 24 installed as your default, `npm run dev` works directly. Copy `.env.example` to `.env` for first-time custom configuration; preserve an existing `.env`.

The first-run screen creates the administrator and requires authenticator enrollment. Enter the displayed Base32 secret in a TOTP authenticator, then confirm a current six-digit code. Subsequent sign-ins require a password and a fresh authenticator code. No default password or shared reviewer account is shipped.

## First demonstration

1. Create your workspace account and enroll an authenticator.
2. Choose **Open authored demo**, then **Run analysis**.
3. Explore Overview, Interview, Sources, Requirements, Controls, Reviews, History and Evaluation.
4. Search or edit requirements; edits produce independent versions and invalidate prior acceptance.
5. Download a PDF or the complete ZIP artifact bundle.

The demonstration uses an authored ShopSphere fixture and makes **no LLM calls**. It cannot become a live approved baseline. Its scores and counts are not measurements of AI effectiveness.

## Financial projects, threats and studies

Choose **New project**, select **finance**, then declare the use case and financial entity. Nine fictitious case templates cover banking, lending, payments, fraud detection, insurance, investment, regulatory reporting, onboarding/KYC and analytics. **Open financial demo** generates an explicitly authored onboarding example without model calls; existing store projects and their history remain supported. Domain/profile changes reset interview questions and invalidate the input revision. The model cannot change the declared domain, service or entity type.

Financial projects retrieve only the curated `docs/ingested/financial/` guidance plus reviewed in-scope sources. Candidate source packs cover selected RBI bank/NBFC KYC, bank credit, SEBI, insurance and EU financial-resilience topics; [source verification boundaries](docs/FINANCIAL_SOURCES.md) identify discovery-only and incomplete coverage. Add reviewed domain-scoped sources and exact organisation policies through Knowledge. No seed pack establishes complete legal coverage.

The **Threats** tab shows a STRIDE scope, assets, trust boundaries, scenarios, likelihood/impact, mitigations, verification, residual risk, sources and linked requirements/risks. Independent security dispositions and evidence are mandatory before baseline adoption. ZIP/CLI exports include `threat-model.md` and `threat-model.json`. The Reviews tab records actual independent penetration-test/deployment reports and exposes a production readiness checklist.

Evaluation accepts reviewer judgments for completeness, consistency, regulatory-control coverage and traceability. Study summaries exclude demos, controlled tests and unverified runs, require independent references approved before inference and preserve unmeasured values. Real evidence collection remains necessary; the application does not manufacture expert decisions or satisfaction scores.

```powershell
npx --yes --package=node@24 --call "npm run demo -- --domain finance"
npx --yes --package=node@24 --call "npm run analyse -- --case lending"
npx --yes --package=node@24 --call "npm run benchmark -- --limit 1"
```

## Live agent configuration

Start LM Studio's OpenAI-compatible server and load a model supporting structured JSON-schema responses. Configure the exact loaded model ID:

```dotenv
LM_STUDIO_BASE_URL=http://127.0.0.1:1234/v1
LM_STUDIO_API_KEY=lm-studio
LM_STUDIO_MODEL=qwen/qwen3.5-9b
RIKU_MODEL_REVISION=local-v1
```

Run `npm run doctor` using Node 24 to check connectivity. Create a **new project** for actual model inference. Declare the project domain, use case, operating entity and jurisdiction rather than accepting a geographic default. The sample needs substantial model context; 32k is a useful starting configuration, while larger source collections may require more. Each generation call has a timeout; schema or validation errors fail explicitly. There is no silent substitution of a fixture for a live run.

| Agent | Responsibility |
| --- | --- |
| Requirements Agent | Extract requirements, multi-label categories, business justification, stakeholder, criteria, dependencies, risks, assumptions, stories, use cases, data/interface specifications and sixteen SDLC factors |
| Requirements Quality and Evidence Agent | Independently review contradictions, infeasibility, undefined terms, testability, omissions, stakeholder conflicts, potential bias and citation support |
| SDLC Selection Agent | Explain the ranked recommendation, compare alternatives and define project-specific phases, responsibilities, deliverables and gates |
| Stakeholder Interview Agent | Generate adaptive follow-ups from persistent questions, answers, sources and findings |

The screenshot's two required responsibilities remain separate agents. The other specialist roles in the DOCX are consolidated into agents, deterministic analysis and authenticated human decisions.

## Stakeholder and source workflow

Projects persist their interviews and source versions across browser sessions. Role-specific templates cover scope, jurisdiction, returns, payment architecture, authorisation, performance, recovery, retention, delivery constraints and integrations. Adaptive follow-ups use the configured model. Vague answers remain open; measurable targets or justified exclusions are required for performance/recovery questions.

Import TXT, Markdown, DOCX, JSON, YAML, SQL, EML or CSV through **Sources**, identifying the source type, stakeholder and classification. Supported types include interviews, meeting notes, emails, questionnaires, policies, API/database specifications, legacy documentation and incidents. File imports are capped at 1 MB; DOCX expansion and source text are bounded. Formats such as SQL are analysed as data and are never executed.

Common email, phone, card-like, PAN, Aadhaar-like, labelled account-number, IBAN, credential, bearer-token and private-key patterns are masked. Masking is best-effort, not comprehensive entity recognition. Classified sensitive sources are withheld from model prompts until security review. Unreviewed policies are excluded from retrieval evidence. Instruction-like content is flagged and treated as data; agents have no enabled workspace execution tools.

## Knowledge, controls and lifecycle selection

The separately allowlisted source notes under `docs/ingested/ecommerce/` and `docs/ingested/financial/` provide selected-domain engineering guidance; the legacy raw finance directory is excluded. The versioned catalogue in `src/domain/compliance.ts` adds official-source metadata for OWASP, PCI SSC, EU GDPR and Indian consumer/data-protection sources, plus merchant policy decisions. Sources record publisher, URL, jurisdiction, version, effective/commencement uncertainty, review date, applicability and a digest of the versioned record.

Control analysis produces **candidate links and gaps**, never a compliance certificate. Dates distinguish upcoming, current-candidate and unresolved commencement. India's DPDP staging is explicitly unresolved at the individual provision level until legal review; publication is not treated as commencement of all obligations. Unsupported jurisdictions block baselining until a suitable source pack is added. Legal/security reviewers can add official source/control packs and publish revisions. Updating knowledge invalidates project input revisions and requires re-analysis. A source digest verifies retained content/metadata, not the current remote webpage.

Each control has a responsible reviewer, requirement links and a delivery-phase checkpoint crosswalk. The assigned reviewer must map verified requirements or document an exclusion. Source reviews, overdue review dates and jurisdiction gaps participate in baseline gates. The seed catalogue is a starting point: the legal reviewer must determine the complete set of obligations for the actual institution/business, activity and jurisdiction.

SDLC policy v2 compares sixteen explained factors with seven declared profiles: Agile, DevSecOps, Spiral, V-Model, Waterfall, Agile + DevSecOps and Agile + V-Model. Equal-weight profile distance produces suitability indices; these are not probabilities or empirically calibrated expert decisions. Ranking, contributions, assumptions, alternatives and workflow phases are retained.

Optional semantic reranking:

```dotenv
LM_STUDIO_EMBEDDING_MODEL=your-loaded-embedding-model-id
```

When configured, the app uses BM25 candidates plus cosine reranking and encrypted tenant/project-scoped vector caches. Without it, retrieval is explicitly labeled lexical. A configured but failing embeddings endpoint raises an error rather than silently claiming semantic retrieval.

## Review and baseline controls

Use **People & roles** to create single-use invitations. Reviewers choose their own passwords and authenticators. Add enrolled people to projects through project membership.

A baseline requires distinct authenticated reviewer accounts for:

| Decision | Role |
| --- | --- |
| Individual requirements and requirements baseline | Product owner |
| Architecture | Architect |
| Security | Security reviewer |
| Legal applicability and control interpretation | Legal reviewer |
| Lifecycle adoption | Project manager |
| Operational/release readiness | Operations reviewer |

The draft author cannot approve their own version. Every requirement needs acceptance; all mandatory questions, review findings, policy/source decisions and gates must be addressed. Structural errors cannot be waived. Semantic warnings/errors require an authorised recorded disposition and supporting evidence. An account's authentication does not externally verify the person's professional qualifications or prove that different accounts belong to different people.

**Reviews** shows explicit baseline blockers. Approvals bind to the exact version digest. Edits create a new immutable version; source, interview, context, model-revision or knowledge changes prevent adoption of a stale result. Old baselines and attestations remain in history. The old self-declared CLI review command cannot create platform baselines.

## Research evaluation

The **Evaluation** tab supports reference datasets, independent architect/product-owner adjudication and metric computation from supplied annotations. A reference created after inference is exploratory. Human-reviewed evaluations must use an adjudicated reference for the exact input, with matching labels. Empirical eligibility additionally requires a live run and a reference created before inference.

Metrics include extraction precision/recall/F1, ambiguity/conflict detection, citation correctness and judgment coverage, unsupported-claim rate, requirement correctness/correction rate, expert lifecycle agreement, processing/manual time, satisfaction and confidence calibration diagnostics. Unmeasured values remain null. Group labels can support bias comparisons across case studies. The app does not manufacture survey participants, expert decisions or experimental results.

See [evaluation protocol](docs/EVALUATION.md). Real human-annotated studies and real-model performance remain external validation work.

## Security and operations

- Password hashing, TOTP MFA with replay rejection, expiring sessions, HttpOnly/SameSite cookies, origin and CSRF checks, role checks and explicit project membership.
- AES-256-GCM encryption of record bodies, requirements, vectors and audit payloads, with tenant/record-bound authenticated context. SQLite collection names, opaque IDs and timing/index metadata remain visible.
- On Windows, the generated master key is protected by current-user DPAPI. On other systems, local development uses an owner-mode key file; production requires a secret-manager-supplied `RIKU_MASTER_KEY`. Back up the encrypted data and key material together under an approved recovery procedure.
- HMAC-protected audit entries, signed chain heads and retention checkpoints. Original masked prompts, responses, failed calls, revisions, decisions and evidence are retained in encrypted storage.
- Default 90-day project retention, configurable per project, legal holds, an automatic retention worker and one-year audit retention when no hold prevents pruning. Expired project data, normalized requirements, references, evaluations, vectors and associated traces are purged.
- Operations view exposes queue/job status, failures, audit integrity and transport status. Interrupted jobs are marked failed on restart.

The normal workspace binds to loopback. Non-loopback serving and `NODE_ENV=production` require TLS certificate/key files:

```dotenv
RIKU_HOST=127.0.0.1
RIKU_PORT=4120
RIKU_DATA_DIR=.runtime/platform
RIKU_TLS_CERT=C:/path/to/server-cert.pem
RIKU_TLS_KEY=C:/path/to/server-key.pem
RIKU_PUBLIC_URL=https://your-approved-host:4120
```

Use the correct trusted certificate, hostname, host firewall, backups and secret management for your deployment. Non-loopback model endpoints must use HTTPS. These implemented controls have software tests; an independent production security assessment has not been performed.

## Developer interfaces and exports

`npm run studio` starts Mastra Studio on loopback port 4111. Studio and the standalone CLI are developer interfaces, separate from authenticated project approvals. `npm run analyse -- --file examples/shopsphere.md` runs a standalone draft analysis; `npm run demo` writes labeled fixture reports. Neither path bypasses a workspace baseline gate.

Optional Telegram requires a token, username and `TELEGRAM_ALLOWED_USER_IDS`. The allowlist is deny-by-default. Telegram produces independent draft documents; confidential project/reviewer records are not exposed to the bot.

Reports present the SDLC recommendation, rationale, alternatives and project workflow first, followed by an IEEE Std 830-1998-aligned SRS. The SRS includes numbered Introduction, Overall Description and Specific Requirements sections, with interface types, performance, database requirements, design constraints and software attributes. Appendices preserve requirement sources, acceptance criteria, verification, traceability, scenarios, risks, open issues and evidence. New model output requires product context and an explicit disposition for each SRS topic; unspecified details remain TBD and produce review findings. Older saved analyses remain readable, with missing context clearly identified. Alignment describes the tailored structure and coverage; it is not a certification of completeness or correctness.

The workspace provides **SRS PDF** and **SRS Markdown** downloads after analysis. Workspace ZIP downloads include standalone `srs.pdf` and `srs.md` alongside the combined HTML/PDF/Markdown report, JSON, traceability CSV, a compliance matrix, control/phase crosswalk, data/interface specifications, a Mermaid workflow, exact agent traces and baseline attestations. Exports are intentional plaintext copies; workspace records remain encrypted at rest. PDF uses the built-in Latin font and substitutes unsupported characters. CLI draft exports remain under `artifacts/ecommerce/<run-id>/` or `artifacts/financial/<run-id>/`; their `latest.*` previews are convenience copies. Standalone CLI SRS paths are returned as `srsPdfPath` and `srsMarkdownPath`.

## Build and verify

```powershell
npx --yes --package=node@24 --call "npm run check"
npx --yes --package=node@24 --call "npm start"
```

`check` performs TypeScript checking, automated tests, the Mastra build and a separate workspace server/UI bundle. Stop a running **Studio** before rebuilding on Windows because its native LibSQL module can lock build files. The workspace's own SQLite process does not use that build directory.

Tests cover authorization, MFA replay, encrypted storage, tampered audit logs, retention, interviews, source gates, immutable revisions, jurisdiction controls, adjudication, metrics, semantic retrieval, PDF/HTML/CSV exports and OpenAI-compatible integration for all four agents. Browser checks cover setup/MFA, demo analysis, requirement search/editing, history, baseline blocking and mobile/desktop layout.

See [current coverage](docs/PROBLEM_STATEMENT_COVERAGE.md), [architecture](docs/PROJECT_SPECIFICATION.md), [source register](docs/ECOMMERCE_SOURCES.md) and [deployment guide](docs/DEPLOYMENT.md).
