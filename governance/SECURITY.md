# SECURITY (governance pointers)

Este documento fornece direcionamentos iniciais sobre segurança da governança e como integrar os artefatos de segurança do ACAS.

- Keys: armazenar public keys em governance/PUBLIC_KEYS/ e commitar com assinatura GPG/SSH.
- Revocation: manter CRL em governance/PUBLIC_KEYS/CRL.json durante PoC.
- Audits: registros de verificações e eventos armazenados em docs/acas-foundation/audit/ (a criar).
- Incident response: criar ISSUE_TEMPLATE para incidentes que afetam continuidade.
