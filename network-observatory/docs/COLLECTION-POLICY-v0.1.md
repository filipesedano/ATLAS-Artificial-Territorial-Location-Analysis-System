# Política de coleta — implementação experimental 0.1

Base preservada: network-observatory-v0.1.1. Esta extensão inclui a prévia dos pontos e o assistente local dos commits anteriores.

## Autorização

Contrato collection-policy/0.1: identificador, responsável declarado, cliente, unidade, Collector, modo SIMULATED, estado ACTIVE/PAUSED/REVOKED, validade inicial/final, lista fechada de ativos/endereço/métricas e intervalo mínimo. Ausência, expiração, revogação e escopo diferente bloqueiam coleta e ingestão. O servidor pré-valida todos os registros do lote antes de salvar registros quando houver violação de política. Não se trata de transação geral contra toda falha de armazenamento.

Collector verifica endereço antes de chamar a sonda simulada, verifica métricas antes de enfileirar e revalida autorização antes de enviar. O Server verifica independentemente cliente, unidade, Collector, ativo, métrica e validade. Ele não consegue comprovar o endereço efetivamente consultado pelo Collector pelo contrato atual. O intervalo é controlado no processo Collector, não persistido entre reinícios nem imposto como limite de tráfego no Server. Coleta real não foi implementada/autorizada.

A configuração sintética padrão declara DEMO_ONLY_NOT_HUMAN_CONSENT, endereço 192.168.1.45 e validade de 01/09/2026 até 01/10/2026 UTC (fim exclusivo). Não é autorização de cliente real. Após a validade a demonstração bloqueia; não renova silenciosamente.

## Configuração e pausa

ATLAS_COLLECTION_POLICY_FILE aponta para JSON local com o contrato, tanto no processo Collector quanto no Server. Sem a variável, os exemplos usam explicitamente a política sintética. Um arquivo informado mas inválido nunca deve cair automaticamente na política padrão. Use o factory simulatedPolicy em packages/contracts/src/collection-policy.ts como referência dos campos. Não publique identificadores ou configurações reais no Git.

Para pausar/revogar nesta versão: encerrar os processos, alterar state para PAUSED/REVOKED nos arquivos locais e reiniciar. Não há painel de administração, assinatura de políticas, atualização remota ou revogação instantânea de processos já iniciados. Não há serviço de coleta contínua instalado. O comando demo-http continua executando três rodadas simuladas.

## Fila

O demo-http utiliza fila JSON persistente em data/collector-outbox.json relativa à pasta de execução. Execute na pasta services/collector, cujo data/ está ignorado pelo Git. Os limites padrão do wrapper são 10 MiB e 48 horas; alerta começa em 80% dos bytes serializados. Ao atingir tamanho máximo ou ter registros antigos, bloqueia novos registros e preserva os pendentes. Sincronização de pendentes ainda depende de autorização válida. O descarte/exportação manual e sua auditoria não foram implementados; 48 horas é um limite para bloquear novas entradas, não garantia de exclusão.

O limite é do payload JSON, não do uso total em disco/RAM. A persistência pode exigir simultaneamente arquivo atual e temporário. Não executar vários processos escrevendo a mesma fila. Não há benchmark de capacidade ou garantia de segurança de produção. A sonda pode produzir uma rodada antes de a fila recusar armazenamento, mas nenhum equipamento real é consultado.

## Assistente

Pergunta adicional no cartão: “O que está autorizado a coletar?”. Retorna configuração cadastrada no Server, explicitamente sem afirmar que a coleta esteja ativa ou que a autorização declarada seja consentimento humano verificado. Continua sem acesso de escrita e sem LLM.

## Verificação

69 testes passaram em Linux/Node 24.19.0. Incluem bloqueio de política ausente/pausada/revogada/expirada, métrica/endereço não autorizado, rejeição de lote misto sem salvar a parte válida, intervalo, revogação antes do envio e preservação da fila ao atingir limites. Integração adicional executou Server real com SQLite temporário, três rodadas simuladas, fila persistente e consulta de política pelo assistente; encerrou o Server com SIGTERM. Sintaxe JavaScript e git diff --check passaram. Navegador/Windows e recuperação sob falha abrupta permanecem pendentes.

## Aplicação

ATLAS-politica-coleta.patch é cumulativo desde a tag original. Não aplicar sobre os patches anteriores. Com alterações locais preservadas e o repositório limpo, criar branch a partir de network-observatory-v0.1.1, executar git apply --check no arquivo e aplicar somente se a verificação passar. Depois rodar os testes dos três pacotes. Nenhuma alteração foi publicada no GitHub; a tag original não foi movida.
