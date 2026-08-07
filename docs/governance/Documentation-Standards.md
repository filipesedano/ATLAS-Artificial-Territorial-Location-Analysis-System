# Documentation Standards

Padrões de documentação adotados pelo ACAS para garantir consistência e rastreabilidade.

Formato e Convenções
- Formato principal: Markdown (UTF-8).
- Cabeçalho: título, ID (quando aplicável), autores, data, estado.
- Nomenclatura de arquivos:
  - ADRs/Decisões: `ACAS-<NNN>-<Short-Name>.md`
  - Documentos de governança: PascalCase ou kebab-case consistente.

Templates
- Use templates padrão para ADRs e para propostas (ex.: template/ADR-template.md).
- Inclua sempre seções: Objetivo, Contexto, Decisão, Alternativas Consideradas, Justificativa, Impacto, Rastreabilidade, Próximos Passos.

Links e Referências
- Sempre referencie tickets (issue/PR), componentes afetados e diagramas relevantes.
- Mantenha links relativos dentro do repositório para facilitar navegação.

Diagrama e Artefatos
- Diagramas preferenciais: PlantUML, mermaid ou SVG gerados a partir de fonte versionável.
- Armazene imagens em `docs/assets/` ou `docs/diagrams/` com versão associada.

Metadados e Labels
- Use labels padronizados em PRs relacionados à governança: `governance`, `architecture`, `ACAS-<NNN>`.

Revisão e Atualização
- Documentação arquitetural é viva — estabeleça revisões periódicas e registre alterações em changelogs.
