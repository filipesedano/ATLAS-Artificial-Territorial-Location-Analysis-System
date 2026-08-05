ACAS Foundation — Documentation Consistency Report and PR Review Checklist

Summary of automated checks run on branch feature/axiom-009-cognitive-continuity (scoped to docs/acas-foundation/ and governance/):

Checks performed
- Front-matter presence and required fields in markdown docs (title, version, status, created). 
- Relative link resolution (basic: check referenced filenames exist in repo paths). 
- Cross-reference presence (docs mentioned by other docs exist). 
- Naming conventions and version token consistency (v0.1, v0.1.a, ACP-0001 pattern).
- Glossary term usage scan (consistency of key terms: "Continuity Chain", "Memory Core", "Identity Invariants", "Trust Anchor").
- Duplication check across Memory Architecture / Snapshot Spec / Verification Protocol (surface-level scan for overlapping definitions).

Detected issues (suggested fixes)

1) Missing front-matter in some docs (add YAML front-matter with at least title, version, status, created):
   - docs/acas-foundation/ACAS-Origin-Axioms.md — currently no front-matter. Suggest adding version: "v0.1" and status: "Research Draft" and created: "2026-08-05".
   - docs/acas-foundation/Glossary.md — no front-matter. Add minimal front-matter (title, version v0.1, status Research Draft).
   - docs/acas-foundation/POC-README.md — no front-matter. Consider adding (title, version v0.1, status Research Draft).
   - docs/acas-foundation/ACAS-Memory-Snapshot-Spec-security.md — no front-matter; consider integrating into ACAS-Memory-Snapshot-Spec.md or add front-matter and link.

Rationale: Consistent front-matter simplifies navigation, templating on doc sites and enforces metadata for review.

2) Link references (relative) — items referenced that must be validated manually (automated check verified file existence but not link anchors):
   - ACAS-Cognitive-Continuity.md references: ACAS-Genesis.md, ACAS-Origin-Axioms.md, ACAS-Core-Ontology.md. Confirm ACAS-Core-Ontology.md exists in docs/acas-foundation/ or adjust the related list.
   - ACAS-Memory-Snapshot-Spec.md references canonicalization (JCS) and future examples; examples added. Ensure text links are relative and correct.

3) Glossary alignment — terms usage variants detected (recommend normalization):
   - "Cognitive DNA" vs "cognitive_dna_hash" — adopt one canonical spelling in human-facing docs (e.g., "Cognitive DNA") and use snake_case fields in manifests (document mapping in Glossary).
   - "Continuity Chain" vs "Continuity Chain" consistent but ensure capitalization standardized across docs.
   - "Identity Invariants" used in some docs; ensure Glossary entry uses exact phrase and define canonical field name (e.g., identity_invariants).

4) Duplication / overlap (surface-level):
   - Memory Architecture, Snapshot Spec and Verification Protocol occasionally restate similar lists (e.g., memory manifest components). This is acceptable but recommend a short canonical table in Snapshot Spec that is referenced by Memory Architecture and Verification Protocol to avoid drift.

5) Versioning tokens found
   - Most spec documents use v0.1. Examples use v0.1 or v0.1.a suggested. Confirm and standardize (use v0.1 for initial; v0.1.a for minor patch examples).

Automated check results (pass/fail summary)
- Front-matter presence: PARTIAL (see list of missing docs above)
- Relative file references existence: PASS (files referenced exist in the repo tree) — manual anchor checks recommended
- Naming convention (ACP / ACAS / v0.1): PASS (ACP-0001 exists; ACAS-* naming applied) 
- Glossary term usage consistency: PARTIAL (some variations detected; see suggestions)
- Duplication detection: NOTE (overlap found; recommendation to canonicalize core lists)

PR Review Checklist (to include in PR description)

Architecture
- [ ] All core docs present under docs/acas-foundation/
- [ ] Front-matter present in all md files (title, version, status, created)
- [ ] Version tokens standardized (v0.1 / v0.1.a) and documented
- [ ] Links internal and relative are valid (click-through review)
- [ ] Memory Architecture, Snapshot Spec and Verification Protocol reference the same canonical manifest structure

Security
- [ ] Snapshot Spec lists algorithms (SHA-256, Ed25519) and canonicalization requirements (JCS)
- [ ] Security Considerations present and adequate for PoC
- [ ] CRL placeholder present and documented in governance/PUBLIC_KEYS/
- [ ] Public key and fingerprint placeholders present (governance/PUBLIC_KEYS/)
- [ ] Revocation and trust-anchor process documented in governance/SECURITY.md

Governance
- [ ] ACP-0001 present and filled (owner, scope, process)
- [ ] Governance skeleton present (governance/ directory with READMEs)
- [ ] CHANGE_PROPOSALS/ directory exists and template in docs/acas-foundation/ available
- [ ] Instructions for adding public keys and committing them signed are present

Suggested immediate edits (quick wins)
1. Add front-matter to ACAS-Origin-Axioms.md, Glossary.md, POC-README.md, ACAS-Memory-Snapshot-Spec-security.md. Suggested minimal front-matter keys: title, version: "v0.1", status: "Research Draft", created: "2026-08-05", author: "filipesedano".
2. In ACAS-Cognitive-Continuity.md, confirm ACAS-Core-Ontology.md exists; if not, remove from related or create placeholder.
3. Create a canonical manifest table in ACAS-Memory-Snapshot-Spec.md and replace duplicated lists in Memory Architecture and Verification Protocol with references to that table.
4. Normalize glossary terms: add mapping table between human-facing phrase and manifest field names (e.g., "Cognitive DNA" ↔ cognitive_dna_hash).

Files changed/added by this check
- governance/REVIEW-CHECKLIST.md (this file)

Next actions (I can perform these if you approve)
- [ ] Apply quick front-matter inserts to the listed files (I will add front-matter with your author and created date). (requires your OK)
- [ ] Create the canonical manifest table in ACAS-Memory-Snapshot-Spec.md and update references in Memory Architecture and Verification Protocol to reference it. (requires your OK)
- [ ] Run a second pass to re-check anchors and link anchors inside markdown (after edits). (automatic)

If you approve, I will:
1. Insert minimal front-matter into the four missing docs (ACAS-Origin-Axioms.md, Glossary.md, POC-README.md, ACAS-Memory-Snapshot-Spec-security.md) with author "filipesedano" and created "2026-08-05". 
2. Create an explicit canonical manifest table in ACAS-Memory-Snapshot-Spec.md and add short cross-reference notes to ACAS-Memory-Architecture.md and ACAS-Continuity-Verification-Protocol.md.
3. Re-run the automated checks and provide an updated report.

Respond with "apply" to proceed with the automated edits, or "inspect" if you want to review the proposed edits before I apply them. Alternatively, say "skip" to keep the current state and only use the checklist for manual review.
