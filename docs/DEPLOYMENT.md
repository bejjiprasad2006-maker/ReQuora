# Local and production deployment

## Local coursework use

Run `start_workspace.cmd` or Node 24 `npm run dev`; open http://localhost:4120. Create the administrator and enroll a TOTP authenticator. The app defaults to `.runtime/platform`; keep this directory and its DPAPI-protected key out of source control. On Windows the key is tied to the current OS user's protection context. Use an approved backup and recovery procedure; losing the key makes encrypted records unavailable.

Use `npm run studio` only for developer inspection. It listens on loopback 4111 and is separate from workspace authentication and baseline decisions. Stop Studio before rebuilding on Windows to avoid native-library file locks.

## Build

`npm run check` checks types, tests, builds Mastra, and bundles the authenticated server and static UI under `dist/platform/`. `npm start` starts the workspace bundle under Node 24. Runtime packages are declared in dependencies; `tsx`/esbuild/TypeScript are build/development dependencies.

## Production configuration

Set `NODE_ENV=production`, a trusted certificate/key with `RIKU_TLS_CERT` / `RIKU_TLS_KEY`, the intended bind address and `RIKU_PUBLIC_URL`. The app refuses production startup without TLS material and refuses non-loopback HTTP. A non-local inference provider must use HTTPS. Keep inference keys and the optional base64 32-byte `RIKU_MASTER_KEY` in a secret manager rather than repository files. The automatic non-Windows development key is not the production key-management path.

Preserve storage consistency and encryption keys when moving deployments. Restrict host access, protect backups and certificates, monitor capacity, and independently assess the deployment. Built-in MFA proves account possession rather than professional qualifications or real-world separation of reviewers.

## Operations and recovery

The operations screen shows queued/running/failed jobs, queue depth, process uptime, transport and audit integrity. The local inference queue is serialized. Calls have bounded timeouts. A restart marks interrupted project analyses failed, preserving audit evidence; regenerate explicitly rather than treating an interrupted run as successful.

Project retention defaults to 90 days and can be changed by authorised users. The retention worker runs every 15 minutes; an administrator can also trigger it. Holds preserve project history, versions, references, judgments and call traces. Audit pruning keeps signed chain checkpoints; audit retention is one year unless a project hold prevents pruning. Test backups and restore procedures against an isolated copy.

## Model and policy changes

Assign a new `RIKU_MODEL_REVISION` when model weights or generation configuration changes. Updated knowledge sources require review and invalidate project revisions. Preserve old baseline digests; regenerate and re-evaluate before adopting new inputs, policies or model revisions. No automated source check guarantees discovery of every legal amendment.

## External verification

The Reviews tab records independent penetration-test and deployment-assessment evidence with passed/failed outcomes. Security records penetration-test evidence; operations records deployment reviews. The draft author cannot attest their own independent assessment. Records bind to exact version/document digests and do not carry forward to edited versions. These are evidence records, not an automated assessment service.

The deployment readiness report (`/api/projects/:id/readiness`, linked from Reviews) checks a current approved baseline, outstanding blockers, TLS, supported Node runtime, eligible real-model evaluation evidence and current passed security/deployment assessments. It remains a review checklist rather than a security certification or automatic deployment approval. It cannot establish the authenticity or quality of an external report supplied by a reviewer.

A live model, a complete applicable source pack, qualified human review, real annotated evaluation data and an independent security assessment are deployment/evaluation inputs. Fixture tests and the included demonstration do not substitute for them.
