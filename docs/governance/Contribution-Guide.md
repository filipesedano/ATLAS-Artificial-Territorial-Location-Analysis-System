# Contribution Guide — Governança Arquitetural (ACAS)

Como contribuir para os artefatos de governança do ACAS.

Fluxo sugerido
1. Crie um branch a partir do branch padrão do repositório.
   - Convenção de nome: `new/<área>-<descrição>` ou `feature/ACAS-<NNN>-short`.
2. Adicione/edite o(s) documento(s) em `docs/governance/` ou em `docs/architecture/` conforme apropriado.
3. Commit metadata
   - Mensagem de commit exemplar (para esta entrega):
     `feat(governance): establish ACAS architectural governance framework v1`
4. Abra um Pull Request em Draft se a entrega for inicial ou precisar de discussão.
   - Inclua no body: Objetivo, Escopo dos artefatos, Justificativa arquitetural, Checklist de validação e Próximos passos.
5. Não adicione implementação funcional no mesmo PR que estabelece a governança inicial — mantenha foco documental.

Revisão
- Mantenedores da arquitetura serão notificados para revisão.
- Comentários e requests de mudança devem ser tratados no PR; atualize o ADR/documentos conforme necessário.

Aceitação
- Critérios básicos: clareza do objetivo, rastreabilidade (IDs/links), checklist completado, e alinhamento com padrões de documentação.
