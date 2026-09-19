# Retomada por camadas — prévia posterior à v0.1.1

Esta entrega permanece no PR #2, sem merge nem nova tag de freeze. A versão 0.1.2-preview no package.json da pasta é apenas identificação de desenvolvimento. O Node validado foi 24.19.0; versões aceitas pelo projeto começam em 22.18. O teste automatizado do GitHub usa 24.19.0 em Windows e Linux, não garante versões distintas ou o hardware doméstico.

## 0 — Preservar o computador

Antes de iniciar: guardar trabalho local, conferir git status, preservar os bancos existentes e seus backups. Não formatar discos. Usar a branch feature/atlas-agent-policy-preview em clone/pasta separada. Não aplicar patches cumulativos sobre essa branch.

Os comandos seguintes partem da pasta network-observatory do clone da prévia, no PowerShell. Não postar tokens nem a saída completa de ipconfig sem revisão.

## 1 — Diagnóstico sem iniciar o servidor

```powershell
node --version
npm.cmd test
npm.cmd run diagnose
# Opcional: detalhes locais de rede, sem upload ou gravação pelo ATLAS.
npm.cmd run diagnose -- --network-details
```

Sem os tokens, PRECISA DE CONFIGURAÇÃO é esperado. O diagnóstico lê configuração e valida a estrutura/escopo da política; testa apenas conexão TCP em 127.0.0.1 na porta configurada. Não envia credenciais ao listener encontrado nem conclui que seja ATLAS. Uma conexão ocupada/indeterminada impede o início pelo inicializador. Porta livre no diagnóstico é uma observação pontual; o listen do servidor decide no momento real.

O banco não é aberto pelo diagnóstico. Ausência significa instalação nova, não erro. Integridade é verificada pelo servidor após abrir o banco; não há reparo automático. Presença de política pausada, revogada ou vencida é informada como coleta bloqueada, mas não proíbe consultar o histórico.

## 2 — Início manual isolado

No primeiro teste, escolher uma pasta de dados nova e uma porta livre. Não apontar para o banco original:

```powershell
$env:ATLAS_DB_PATH = Join-Path $env:LOCALAPPDATA 'ATLAS-Lab-Preview\atlas-test.db'
$env:ATLAS_HTTP_PORT = '8080'
$env:ATLAS_OPERATOR_TOKEN = node -e "process.stdout.write(require('node:crypto').randomBytes(32).toString('hex'))"
$env:ATLAS_COLLECTOR_TOKEN = node -e "process.stdout.write(require('node:crypto').randomBytes(32).toString('hex'))"
npm.cmd run diagnose
npm.cmd start
```

Guardar os tokens no gerenciador de senhas se desejar reutilizá-los; este exemplo gera novos valores a cada execução. Não os colocar no Git, nos argumentos de URL ou em capturas. Abrir o endereço exibido pelo inicializador manualmente; ele não abre navegador automaticamente. Para testes autenticados usar o token leitor localmente no painel.

O inicializador inicia apenas o Control Plane, não inicia o Collector, nem áudio/câmera. Espera mensagem de prontidão do processo filho e confirma /health no localhost. Esse health indica serviço disponível, não saúde da rede. Ctrl+C solicita encerramento. O processo não é instalado como serviço nem configurado para iniciar com o Windows.

O próprio server-entry também adquire trava exclusiva antes do SQLite. Uma segunda instância desta prévia usando o mesmo caminho canônico não abre o banco. Não executar versões antigas sobre o mesmo banco: elas não participam deste protocolo. Hard links, armazenamento de rede e manipulação externa de travas não são suportados pelo laboratório.

Após encerramento normal, a trava .atlas.lock deve desaparecer. Após desligamento abrupto ela pode permanecer: o próximo início bloqueia. Não apagar automaticamente. Conferir que nenhum processo ATLAS usa o banco, preservar backup e investigar antes de remover uma trava comprovadamente abandonada. Não simular queda de energia como primeiro teste.

## 3 — Painel, assistente e simulação

- Abrir painel e alternar SIMULADO/API LOCAL; conferir rótulos de origem.
- Consultar cada ponto por mouse, Tab/Enter e toque quando disponível; conferir ID e IP cadastrado.
- Conferir ativo sem observações: não declarar saudável.
- Testar token errado e fechar/reabrir cartão durante consulta.
- Testar perguntas do agente; nenhum comando operacional deve ser executado.
- No ensaio de voz, microfone deve continuar indisponível. Editar após revisar deve exigir nova revisão; cancelar deve limpar tudo.
- Testar indisponibilidade da API: exibir erro/indeterminação, nunca substituir por dados aparentemente reais.

O Collector demo-http executa três rodadas simuladas. Caso seja executado em segundo terminal, configurar o token de coleta e URL da mesma sessão. Sua fila data/ fica relativa à pasta services/collector. Não iniciar coleta real. A política sintética padrão expira em 01/10/2026 UTC; atualizar uma política exige decisão explícita, nunca renovação silenciosa. Contrato customizado deve corresponder ao cliente/unidade/Collector, com métricas suportadas. Alterações de política requerem reiniciar os processos nesta prévia.

## 4 — Persistência e aceitação

Anotar IDs/estados/referências de um incidente antes de Ctrl+C. Reiniciar com o mesmo ATLAS_DB_PATH e conferir os campos. Confirmar que segundo início simultâneo é bloqueado. Testar erro de configuração/porta ocupada sem encerrar outros programas.

Registrar resultado de cada camada: data, commit, SO, Node, PASSOU/FALHOU/PENDENTE e erro sem segredo. Só depois revisar merge/freeze. Testes do runner Windows no GitHub não substituem teste do ipconfig, do terminal, da interface e do computador doméstico.

## Evidência desta entrega

82 testes passaram localmente em Linux/Node 24.19.0, incluindo startup HTTP com SQLite temporário, segundo processo bloqueado e reinício após encerramento. Workflow configurado com permissões contents:read, ações fixadas por SHA, sem instalação de dependências externas do projeto e sem exportar bancos/segredos como artefatos. Consultar o resultado efetivo no PR: arquivo de workflow publicado não significa execução aprovada.

## Atualização — login local

A prévia agora utiliza login admin em vez de colar o token leitor no modo API LOCAL. Na primeira abertura, usar ATLAS_OPERATOR_TOKEN apenas como token de bootstrap para definir sua senha e guardar o código de recuperação. Depois, entrar com admin e a senha. Ler LOCAL-LOGIN-v0.1.md antes do teste: schema 2 é incompatível com o binário antigo da v0.1.1; usar banco de laboratório separado e preservar backup anterior. Não há recuperação por e-mail/SMS nem instalação de usuário no Windows.
