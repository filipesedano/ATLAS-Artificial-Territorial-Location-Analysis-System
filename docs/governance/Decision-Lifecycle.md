# Decision Lifecycle

Este documento descreve o ciclo de vida das decisões arquiteturais (ADRs) do ACAS.

1. Proposição
- Qualquer colaborador pode propor uma decisão arquitetural criando um documento ADR seguindo o template padrão.
- Nome do arquivo: `ACAS-<NNN>-<short-name>.md` (ex.: `ACAS-009-Adaptive-Normality-Architecture.md`).

2. Discussão e Revisão
- A proposta deve ser submetida via branch e Pull Request com escopo claro.
- Discussões devem ocorrer no PR e registradas no ADR (histórico de comentários/decisões).

3. Estado das Decisões
- Draft — proposta inicial em revisão.
- Accepted — decisão aprovada e versionada.
- Deprecated — decisão substituída por outra; manter histórico.
- Superseded — substituída por uma nova abordagem (linkar para a decisão substituta).
- Retired — decisão removida do uso ativo; manter registro.

4. Rastreabilidade
- Cada ADR deve referenciar tickets, PRs e componentes afetados.
- PRs implementando mudanças arquiteturais devem citar o ADR correspondente.

5. Responsabilidades
- Autores: responsáveis pela proposta e manutenção do documento.
- Mantenedores da arquitetura: revisar e validar conformidade com padrões.

6. Metadata recomendada
- ID: ACAS-009
- Título
- Estado
- Autores
- Data
- Justificativa
- Alternativas consideradas
- Impacto
- Próximos passos

7. Armazenamento
- Local: docs/governance/ ou docs/architecture/ conforme aplicabilidade.
