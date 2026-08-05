# ACAS — Change Proposal Template (ACP)

Status: Research Draft — use este template para propor mudanças formais em axiomas, specs, protocolos e políticas do ACAS.

Identificador
- ACP-ID: ACP-0001 (atribua um código sequencial)

Metadados
- Título: 
- Autor: Filipe Moreira Sedano
- Data: 2026-08-05
- Estado: Draft / Under Review / Accepted / Rejected

Motivação
- Resumo do problema que esta proposta resolve (máx. 200 palavras).
- Justificativa técnica, de segurança e de governança.

Escopo e artefatos afetados
- Documentos afetados (paths):
  - docs/acas-foundation/ACAS-Memory-Snapshot-Spec.md
  - docs/acas-foundation/ACAS-Continuity-Verification-Protocol.md
  - etc.
- Código/implementações afetadas (se aplicável)

Axiomas impactados
- Liste qualquer axioma potencialmente impactado (Axiom 001, Axiom 003, ...)

Compatibilidade
- Quebras (Breaking / Non-breaking)
- Estratégia de migração (passos para compatibilidade retroativa)

Impacto na continuidade cognitiva
- Descreva como a proposta afeta verificação de continuidade, invariantes e provas.

Impacto na arquitetura de memória
- Descreva alterações necessárias no Memory Core, manifests, snapshots e storage.

Impacto na governança
- Quais aprovações são necessárias? (Owner, Primary Reviewer, Governança)
- Requisitos de auditoria e logs.

Estratégia de migração e rollout
- Rollout steps (stages): draft → test → pilot → production
- Backout plan / rollback

Critérios de aceitação
- Condições objetivas para que a proposta seja considerada aprovada (tests, evidências, auditorias).

Risks & Mitigations
- Principais riscos e medidas de mitigação.

Segurança e compliance
- Requisitos de segurança adicionais
- Privacidade e compliance (se aplicável)

Testes e validação
- Planos de teste, casos de aceitação e critérios de sucesso

Histórico de revisões
- Versão, autor, data, sumário das mudanças

Aprovações
- Owner: Filipe Moreira Sedano
- Primary Reviewer: Filipe Moreira Sedano
- Additional Reviewers: (list)
- Approved by: (signatures / commits / links)

---

Instruções de submissão
1. Preencha este template como um novo arquivo em governance/CHANGE_PROPOSALS/ACP-XXXX.md
2. Abra um PR apontando para feature/axiom-009-cognitive-continuity para revisão inicial.
3. Registrar decisão e fechar o ACP com o status apropriado.
