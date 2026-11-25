# Architecture and adapted specification

## Objective

Build an agentic assistant for explicitly scoped financial and e-commerce requirement gathering, analysis and justified SDLC identification. Preserve the two core agent responsibilities required by the screenshot while implementing the wider DOCX's elicitation, quality, evidence, review and evaluation workflows.

## Components

```text
Browser workspace (MFA + session + CSRF)
  -> tenant/project membership and role checks
  -> versioned stakeholder sources and interview answers
  -> privacy masking and sensitive-source review gates
  -> allowlisted BM25 / optional encrypted semantic cache
  -> Requirements Agent
  -> deterministic schema/source/quality checks and bounded repair
  -> independent Quality and Evidence Agent
  -> sixteen-factor deterministic SDLC ranking
  -> SDLC Selection Agent and project-specific workflow
  -> encrypted project versions, normalized requirements and exact call traces
  -> human finding/control/requirement decisions
  -> independent threat dispositions, source decisions and six authenticated review gates
  -> immutable approved-baseline attestation
```

The Interview Agent separately adapts follow-ups from current questions, answers, sources and unresolved findings. It cannot approve outputs or execute tools. Neither generated requirements nor semantic model verdicts are authoritative legal conclusions.

## Persistent model

`PlatformStore` uses SQLite tables for encrypted records, normalized requirements, append-only audit entries, signed audit heads and retention anchors. AES-256-GCM AAD binds encrypted bodies to tenant, collection and record ID. A project contains source versions, questions, role-attributed answers, content revision, optimistic update token, version references, decisions and baseline history. Exact masked model requests/responses and failed attempts are retained as encrypted traces.

Knowledge records freeze publisher, provenance, jurisdiction, version, applicability, commencement uncertainty, next review and a content-record digest. A changed source increments project revisions. Model IDs include an operator-managed revision. Baseline review rejects stale input, knowledge or configured model revisions.

## Approval rules

Requirements need product-owner acceptance. Baselines additionally require independent architect, security, legal, project-manager and operations decisions. Draft authors cannot approve their own version; gate accounts must be distinct. Open mandatory questions, unresolved findings, missing control decisions, unreviewed/overdue sources, unsupported jurisdictions and stale inputs block baseline creation. Edits produce new versions and require fresh review.

Signed attestations identify exact document digests and authenticated account IDs. They are platform records, not externally certified legal/professional signatures.

## Artifact model

The workspace exports the original draft specification and separate baseline attestations. ZIP bundles include reports, requirements traceability, compliance-control/phase crosswalks, data/interface specifications, Mermaid workflow, exact call traces and project audit events. The immutable draft and later reviewer decisions remain distinguishable.

The combined report presents the SDLC recommendation and workflow before the IEEE Std 830-1998-aligned SRS. Standalone `srs.md` and `srs.pdf` are available in workspace ZIPs, individual authenticated downloads and CLI run folders. SRS sections cover introduction, product context, external interfaces, functions, performance, logical data, constraints and software attributes; appendices retain verification traceability, scenarios, risks, unresolved decisions and evidence. New generation requires `srsContext`; historical records without it remain readable with explicit TBD sections. Per-topic dispositions distinguish specified requirements, justified exclusions and unresolved information. Coverage validation flags missing topics and rejects broken references, duplicate dispositions and conflicting exclusions. These checks do not certify substantive completeness.

## Security boundary

The default app listens only on loopback. Production/non-loopback startup requires TLS material. Windows master keys use current-user DPAPI; an external master key can be supplied through secret management. SQLite metadata remains visible, while record values and audit payloads are encrypted. Project membership grants access to project records and exports; administrators should assign it deliberately. Masking and injection screening are best-effort and are reinforced by disabled agent tools, validation and review gates.

Mastra Studio, CLI exports and allowlisted Telegram are developer/advisory interfaces. They do not create authenticated platform baselines or expose encrypted workspace projects to unauthenticated users.

## Research boundary

The implementation provides data collection, blind reference creation, independent adjudication, metric computation and recorded provenance. It does not create real stakeholder opinions, validated legal judgments or successful model evaluation by itself. Controlled tests establish software behaviour; empirical effectiveness requires actual model runs and human-reviewed datasets.

## Financial profile and threat model extension

Projects declare domain, service and operating entity. Historical projects without these fields retain e-commerce defaults. Creation/context revision validates combinations, regenerates domain interviews and binds the profile to the versioned input hash. Extraction validates the returned profile before selecting a lifecycle. Retrieval selects the separately curated financial corpus and reviewed domain-scoped sources; candidate compliance controls filter entity, jurisdiction and use case.

New generated specifications require structured STRIDE models. Asset/boundary membership, duplicate threats, requirement/risk links and source/evidence references are validated. Independent security dispositions bind to exact version/document hashes and block baselining until recorded. Changes invalidate prior dispositions. Assessment evidence and project readiness records preserve the separation between implemented mechanisms and actual security validation.

Study summaries include only declared real model inference with independently adjudicated, pre-inference references. Corrected annotations supersede the same case/version. Financial case templates and benchmark manifests record provenance without supplying artificial effectiveness results.
