# ADR-0004 — Event Driven Cognitive System

Status: Draft

## Context
O ACAS precisa de um sistema de eventos confiável para conectar sensores, runtime, memória e atuadores, garantindo ordenação, versionamento e reprodutibilidade.

## Decisão
Adotar um Event Bus orientado a eventos com as seguintes características:
- Schemas versionados e registro de esquema (schema registry);
- Garantia de ordenação por stream/correlation_id;
- Persistência para replay e validação (event sourcing parcial quando apropriado);
- Contratos de compatibilidade entre versões de eventos.

Componentes principais:
- Producers (sensors, ingestion);
- Event Bus / Broker (ex.: Kafka, NATS JetStream, ou alternativa compatível);
- Consumers (runtime, memory writers, adapters);
- Schema Registry + compatibility rules.

## Consequências
- Facilita replay e validação determinística;
- Exige políticas de versão e migração de schemas;
- Impacta operações (capacidade, retenção, observabilidade).

## Alternativas
- HTTP-based messaging (push) — menos adequado para ordenação e replay.

## Racional
Um event-driven backbone fornece o substrato para observabilidade, teste e reprodutibilidade essenciais para um sistema cognitivo em evolução.

## Implementação proposta
- Definir topologias iniciais de tópicos/streams para sensors, runtime, memory, actions;
- Escolher um broker compatível com retenção e replay;
- Definir esquema inicial em docs/schemas/events-v1.json.

## Próxim passos
- Prototipar ingestão de eventos com replay;
- Documentar padrões de schema e versionamento;
- Integrar com ADR-0002 e ADR-0003.
