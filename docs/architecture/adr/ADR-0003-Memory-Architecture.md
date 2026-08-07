# ADR-0003 — Memory Architecture

Status: Draft

## Context
Memória é central para comportamento cognitivo: registrar experiências, consolidar conhecimento e manter histórico operacional e de evolução.

## Decisão
Definir camadas de memória com responsabilidades distintas:

- Working Memory: estado operacional corrente usado pelo runtime;
- Episodic Memory: registro ordenado de experiências/eventos com proveniência;
- Semantic Memory: representações consolidadas e modelos derivados;
- Evolution Memory (OEMS/Operational Experience Memory): métricas, avaliações e resultados de validação e experimentos.

Regras e contratos:
- Todos os itens de memória devem conter metadados de proveniência (timestamp, source_id, correlation_id);
- Políticas de retenção e indexação definidas por tipo;
- Interfaces de consulta padronizadas (query APIs) e exportáveis para replay/validação.

## Consequências
- Permite reproducibilidade e auditoria de decisões;
- Requer estratégia de armazenamento e indexação (hot/cold tiers);
- Introduz necessidades de governança sobre retenção e privacidade.

## Alternativas
- Memória única (sem separação de camadas) — prejudica performance e semântica.

## Racional
Separar responsabilidades facilita otimização, compliance e evolução independente de cada camada.

## Implementação proposta
- Especificar schemas para episodic/semantic/OEMS;
- Expor APIs de gravação/consulta/replay;
- Definir políticas de retenção e testes de integridade.

## Referências
- ACAS Foundation v1.0 — Memory Architecture
- ACAS-009 Adaptive Normality

## Próximos passos
- Implementar exemplos de schemas e queries;
- Validar integração com Cognitive Runtime e ACAS-009.
