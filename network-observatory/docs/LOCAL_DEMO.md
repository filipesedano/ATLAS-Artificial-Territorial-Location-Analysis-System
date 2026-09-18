# ATLAS — Demonstração local v0.1

Esta demonstração funciona inteiramente no mesmo computador e não consulta nenhum equipamento da rede. Não é necessário domínio, internet, servidor externo ou alteração no roteador.

## O que será executado

```text
Collector Simulator → HTTP localhost → Control Plane → Triagem → Incident Manager → Painel
```

Todos os endereços, medições e falhas são simulados. O servidor aceita conexões somente em `127.0.0.1`.

## Requisito

- Node.js 22.18 ou posterior.

## 1. Iniciar o Control Plane

Abra o PowerShell no diretório:

```text
foundation/network-observatory/services/control-plane
```

Defina dois tokens temporários para a demonstração:

```powershell
$env:ATLAS_OPERATOR_TOKEN="atlas-operador-demo-local"
$env:ATLAS_COLLECTOR_TOKEN="atlas-collector-demo-local"
npm start
```

O terminal deverá informar:

```text
ATLAS HTTP local v0.1 em http://127.0.0.1:8080
```

Mantenha esse terminal aberto.

## 2. Abrir o painel

No navegador, acesse:

```text
http://127.0.0.1:8080
```

O painel começará em `SIMULADO`. Ainda não selecione `API LOCAL`.

## 3. Executar as três verificações simuladas

Abra outro PowerShell no diretório:

```text
foundation/network-observatory/services/collector
```

Use o mesmo token do Collector e execute:

```powershell
$env:ATLAS_COLLECTOR_TOKEN="atlas-collector-demo-local"
npm run demo:http
```

O resultado esperado é:

```text
1ª rodada: 3 medições, 3 confirmadas, 0 pendentes
2ª rodada: 3 medições, 3 confirmadas, 0 pendentes
3ª rodada: 3 medições, 3 confirmadas, 0 pendentes
Incidente interno esperado após a terceira rodada.
```

Internamente, o Incident Manager registra `PENDING_CONFIRMATION` nas duas primeiras rodadas e `CREATED` na terceira.

O comando não executa ping, SNMP, descoberta ou conexão com `192.168.1.45`. Esse endereço existe apenas dentro do cenário simulado.

## 4. Consultar a API no painel

No navegador:

1. selecione `API LOCAL`;
2. informe o token `atlas-operador-demo-local`;
3. confira o incidente `Impressora sem comunicação`;
4. selecione `SIMULADO` para voltar à apresentação visual original.

O token do operador permanece apenas na memória da página e é descartado ao atualizar ou fechar a guia.

## 5. Encerrar

Volte ao primeiro PowerShell e pressione `Ctrl+C`.

O terminal deverá informar:

```text
Encerramento seguro solicitado por SIGINT.
ATLAS encerrado; estado local preservado.
```

Inventário, observações, incidentes e estado de confirmação permanecem no arquivo:

```text
services/control-plane/data/atlas-local.db
```

Ao iniciar novamente, o ATLAS restaura esse estado. Para fazer uma demonstração completamente nova, pare o servidor e preserve a pasta `data` com outro nome antes de iniciar; não apague o banco enquanto o servidor estiver aberto.

## Limites de segurança

- não alterar `127.0.0.1` para `0.0.0.0`;
- não criar redirecionamento de porta no roteador;
- não publicar esta versão na internet;
- não utilizar tokens pessoais ou credenciais de clientes;
- não executar em rede profissional sem autorização formal;
- utilizar somente os cenários simulados nesta etapa.
- não enviar o arquivo `atlas-local.db` para GitHub, e-mail ou armazenamento público.
