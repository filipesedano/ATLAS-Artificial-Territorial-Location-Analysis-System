# ATLAS — Observatório de Rede

Fundação do produto multiempresa de observabilidade e resposta operacional do ecossistema ATLAS.

## Objetivo

Monitorar a saúde de infraestruturas locais e remotas, correlacionar eventos, apresentar evidências e apoiar técnicos e clientes sem transformar inferências em diagnósticos confirmados.

## Componentes

- `apps/web`: painel web multiempresa e visualização do globo/topologia.
- `services/control-plane`: servidor central, identidade, autorização, inventário, incidentes e sincronização.
- `services/collector`: agente leve instalado na rede do cliente.
- `packages/contracts`: contratos de eventos e tipos compartilhados.
- `docs/architecture`: decisões, invariantes e evolução arquitetural.
- `tests`: testes entre componentes e invariantes sistêmicos.
- `deploy`: exemplos de implantação sem segredos reais.

## Limites da primeira fase

- Dados simulados antes da coleta real.
- Sem acesso a imagens de câmeras; somente saúde online/offline no futuro.
- Sem execução remota de comandos.
- Sem abertura de portas de entrada na rede do cliente.
- Sem LLM como fonte de autoridade.
- Sem PR ou merge automático.

## Fluxo inicial

`Collector local → Control Plane → Motor de regras → LLMProvider → recomendação → técnico humano`

O protótipo visual existente permanece em `prototype/network-observatory/`.
