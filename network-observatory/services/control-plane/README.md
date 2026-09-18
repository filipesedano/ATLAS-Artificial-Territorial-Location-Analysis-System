# Control Plane mínimo + Motor de Triagem v0.1

Servidor central do Observatório de Rede.

Responsabilidades futuras:

- clientes, unidades, usuários, papéis e sessões;
- UUID interno e código público de cliente, como `A4527`;
- registro e autenticação dos Collectors;
- inventário, eventos, incidentes e auditoria;
- correlação determinística antes do uso de LLM;
- API e canal de atualização em tempo real;
- isolamento obrigatório entre clientes.

O código público do cliente não é segredo e nunca substitui autenticação ou autorização.

## Implementação atual

O protótipo implementa, sem servidor HTTP e sem banco externo:

- cadastro fechado de Collectors e seus escopos;
- ingestão de observações com isolamento por cliente e unidade;
- deduplicação por `idempotencyKey`;
- rejeição de colisões em que a mesma chave carrega conteúdo diferente;
- repositório em memória substituível;
- auditoria de ingestão, reenvio e triagem;
- regras determinísticas para impressoras;
- separação explícita entre medição, inferência e estado indeterminado.

O Motor de Triagem reconhece inicialmente:

- três protocolos sem resposta;
- ICMP bloqueado com outro protocolo acessível;
- estado `PAPER_OUT`;
- toner preto igual ou inferior a 10%;
- estado `READY`;
- medições insuficientes.

Ele não executa ações, não confirma causa física, não abre chamados e não depende de LLM.

## Incident Manager v0.1

O gerenciador de incidentes internos implementa:

- três triagens consecutivas antes de abrir falha de comunicação;
- abertura imediata para falta de papel e toner baixo medidos;
- deduplicação de incidentes ativos;
- rejeição da mesma triagem reapresentada como nova confirmação;
- atualização do incidente existente com novas observações;
- duas avaliações saudáveis distintas antes da resolução;
- nenhuma ação quando o estado é indeterminado;
- auditoria ordenada de todas as decisões.

Um incidente interno não equivale a um chamado externo. Integrações com e-mail ou sistemas de atendimento continuam fora desta versão.

## Servidor HTTP local v0.1

A API usa somente recursos nativos do Node.js e, por padrão, escuta exclusivamente em `127.0.0.1`.

Rotas iniciais:

```text
GET  /health
POST /v1/collectors/{collectorId}/observations
GET  /v1/tenants/{tenantId}/status
GET  /v1/tenants/{tenantId}/incidents
```

Proteções desta fase:

- token individual do Collector no cabeçalho `Authorization`;
- token separado para consultas do operador;
- nenhum segredo em URL;
- limite de 1 MiB por requisição;
- somente JSON na ingestão;
- respostas sem cache e com `nosniff`;
- erros sem exposição de pilha interna;
- vinculação local, sem exposição à rede ou à internet.

Para iniciar manualmente, defina tokens locais e execute:

```bash
ATLAS_OPERATOR_TOKEN='substitua-por-token-seguro' \
ATLAS_COLLECTOR_TOKEN='substitua-por-outro-token-seguro' \
npm start
```

O endereço será `http://127.0.0.1:8080`. Esta versão ainda não oferece TLS, usuários, sessões ou persistência de produção e não deve ser publicada na internet.

## Inventory & Status Manager v0.1

O inventário registra explicitamente clientes, unidades e ativos autorizados, vinculando cada ativo ao Collector responsável e às observações obrigatórias para sua cobertura.

Estados projetados:

```text
HEALTHY  ATTENTION  UNREACHABLE  STALE
UNKNOWN  MAINTENANCE  RETIRED
```

`HEALTHY` exige todas as observações obrigatórias recentes. Ausência de incidentes, resposta parcial ou um único protocolo acessível não bastam.

Rotas adicionais:

```text
GET /v1/tenants/{tenantId}/overview
GET /v1/tenants/{tenantId}/assets
GET /v1/tenants/{tenantId}/assets/{assetId}
GET /v1/tenants/{tenantId}/printers
GET /v1/tenants/{tenantId}/servers
GET /v1/tenants/{tenantId}/network
```

O painel consome essas rotas no modo `API LOCAL`. Serviços e histórico continuam demonstrativos até receberem contratos próprios.

## Local Persistence v0.1

O servidor iniciado por `npm start` utiliza SQLite por padrão:

```text
services/control-plane/data/atlas-local.db
```

É possível escolher outro arquivo com `ATLAS_DB_PATH`. O diretório é criado automaticamente e permanece ignorado pelo Git.

Persistido nesta versão:

- inventário de clientes, unidades, Collectors e ativos;
- observações e chaves de idempotência;
- incidentes e seus estados;
- contadores de confirmação e recuperação;
- assinaturas de triagens já processadas;
- auditoria do Incident Manager;
- versão do esquema e migrações aplicadas.

Na inicialização, o servidor aplica somente migrações pendentes e executa uma verificação de integridade. `SIGINT` e `SIGTERM` fecham o servidor HTTP e o banco de forma ordenada.

O arquivo local ainda não possui criptografia própria ou rotina automática de backup. Não armazene dados sensíveis de clientes nesta fase.

## Executar

Requer Node.js 22.18 ou posterior:

```bash
npm test
npm run demo
```
