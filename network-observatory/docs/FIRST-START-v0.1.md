# Diagnóstico inicial — prévia 0.1

Execute na raiz do repositório, com Node.js compatível instalado:

```powershell
node .\network-observatory\tools\first-start.mjs
# Opcional, autorizado explicitamente pelo operador:
node .\network-observatory\tools\first-start.mjs --network-details
```

A opção de rede executa exclusivamente SystemRoot/System32/ipconfig.exe com argumento /all no Windows, sem shell e com timeout de 15 segundos. Mostra a saída no terminal, sem salvar arquivo nem enviar dados. Terminal, redirecionamento ou ferramentas externas podem reter a saída; o operador deve revisar IPs, MACs, DNS, DHCP e domínios antes de compartilhar. Não executa /release, /renew, comandos livres, varreduras ou mudanças de configuração. Saída preservada em bytes: a apresentação de acentos depende da codificação do terminal Windows.

Diagnóstico padrão informa SO, Node, memória e espaço no disco do projeto; verifica existência do banco e presença/separação de tokens sem mostrar seus valores. Sem ATLAS_DB_PATH, considera a pasta padrão do Control Plane no projeto. Não abre banco, não verifica integridade, não cria arquivos, não inicia serviço, não testa portas e não ativa coleta/áudio/câmera. Portanto a classificação é parcial, nunca uma certificação de prontidão completa. Não persiste consentimento ou cria endpoint remoto de diagnóstico.

Linux não executa ipconfig e esta entrega não adiciona equivalente automático. O hardware do servidor doméstico não foi inspecionado remotamente.

Validação: 76 testes passaram no Linux/Node 24.19.0. Incluem comando/argumentos fixos sem shell usando executor simulado, bloqueio fora do Windows e ocultação de credenciais. Diagnóstico executado localmente em Linux. Execução real do ipconfig e caracteres acentuados precisam de teste no Windows.
