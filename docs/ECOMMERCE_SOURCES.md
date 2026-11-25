# Active evidence and policy sources

Runtime retrieval combines allowlisted project guidance under `docs/ingested/ecommerce/` with reviewed workspace policy sources. Legacy finance material, the original finance brief, archived prompts and authored demos are excluded from the active corpus.

| Layer | Provenance and governance |
| --- | --- |
| `domain-guide.md` | Project-authored e-commerce design checklist; not a regulation |
| `security-evidence.md` | Labeled project paraphrases linked to official OWASP and historical PCI guidance |
| `sdlc-policy.md` | Local sixteen-factor lifecycle policy v2; not an empirically validated model |
| `src/domain/compliance.ts` | Versioned source records and candidate controls for OWASP, PCI SSC, selected India/EU sources and merchant policy decisions |
| Workspace knowledge | Authenticated source reviews, updates, custom official source/control packs and retained prior records |
| Project sources | Attributed, classified, masked source text and version history; sensitive sources need security review and policies need review before retrieval |

Official source URLs and publisher/version/jurisdiction/applicability/commencement metadata are retained in the catalogue and exported matrices. The source-note hashes in `ECOMMERCE_SHA256.txt` cover local retained files. Workspace digests cover the canonical retained content/metadata; they are not automatic hashes of the current remote webpage.

Important source boundaries:

- OWASP ASVS is application security verification guidance, not legal applicability evidence.
- PCI SSC FAQ 1588 concerns specific SAQ A script eligibility criteria and distinguishes embedded payment forms from redirect flows; assessment scope still needs the acquirer/provider and applicable eligibility criteria.
- EU GDPR mapping requires territorial/material scope review.
- Indian consumer rules need model-specific and amendment review. DPDP Act/Rules commencement is staged; the catalogue leaves individual commencement dates unresolved rather than treating notification publication as commencement of every duty.
- Merchant return, tax, retention, availability and recovery policies need actual owner decisions. Placeholder policy entries are not fabricated business commitments.

The legal reviewer must determine the complete applicable obligation set. Unsupported jurisdictions are surfaced as blockers and can be extended with reviewed source packs. Source revisions invalidate project input revisions and require re-analysis.
