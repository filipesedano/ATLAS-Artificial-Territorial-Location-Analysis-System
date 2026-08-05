# GOVERNANCE

Mission

Definir processos, papéis e princípios que garantem que mudanças na fundação ACAS sejam realizadas de forma coordenada, auditável e segura.

Governance Principles

- Transparência: decisões documentadas e versionadas.
- Auditabilidade: logs e evidências preservados.
- Conservadorismo: rupturas na continuidade exigem aprovação explícita.
- Evolução dirigida: mudanças devem atravessar Change Proposal.

Roles

- Owner: Filipe Moreira Sedano — responsável final pelas decisões iniciais.
- Maintainers: (a definir)
- Reviewers: (a definir)

Decision Process

- Submissão: criar ACP em governance/CHANGE_PROPOSALS/ ou usar template em docs/acas-foundation/.
- Revisão: Owner + Primary Reviewer (mínimo) avaliam impacto.
- Aprovação: Owner aprova; para mudanças críticas, consultar painel de governança.

Approval Levels

- Level 1: Non-breaking docs/typos — Owner can approve.
- Level 2: Breaking changes to schemas/invariants — Owner + Governing Panel.

Change Proposal Workflow

1. Preencher o template (ACP)
2. Discutir em PR na branch de pesquisa
3. Registrar comentários e revisões
4. Aprovação e merge para branch principal (após frozen)

Release Process

- Após aprovação e testes (PoC), publicar release v0.1 com changelog.

Security Governance

- Gestão de chaves e trust anchors centralizada no diretório PUBLIC_KEYS/.

Trust Model

- Trust Anchor inicial: repositório Git assinado (this repo) contendo public keys.

Future Governance

- Migrar governance/ para repositório dedicado ATLAS-ACAS-Governance quando estiver consolidado.
