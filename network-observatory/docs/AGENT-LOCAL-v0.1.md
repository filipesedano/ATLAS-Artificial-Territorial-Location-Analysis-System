# Assistente local ATLAS — prévia 0.1

Implementação determinística, sem LLM, memória de conversa, execução de comandos ou coleta adicional. Não representa integração com um sistema operacional.

No painel servido pelo Control Plane, selecione API LOCAL, autentique-se com o token do operador, clique em um equipamento e escolha uma das três perguntas do cartão. O modo simulado permanece apenas demonstrativo.

GET /v1/tenants/{tenantId}/assets/{assetId}/assistant?question=status|evidence|limits

A rota reutiliza a autenticação de leitura com escopo de cliente configurado no servidor. Perguntas fora da lista são rejeitadas. O componente de resposta recebe somente observações já autorizadas, sem acesso a repositório, comandos ou rede. Cada resposta informa versão do contrato, política, provedor, classificação, horário, referências e execution=NONE.

Observações com mais de cinco minutos ou horário futuro não sustentam descrição atual. A origem legada continua UNVERIFIED; por isso esta versão mantém INDETERMINATE nas respostas e não confirma diagnósticos. Referências históricas são identificadas como tal. Não há geração livre nem mecanismo que execute texto recebido como instrução.

Evolução proposta: origem real/simulada registrada por observação, intenções adicionais com testes, provedor LLM opcional para explicações e memória com consentimento, retenção e exclusão definidos. A futura integração ao SO deve preservar a fronteira de permissões e decisões humanas, sem entregar ferramentas de execução ao leitor.

Validação: 65 testes passaram em Linux/Node 24.19.0; sintaxe JavaScript e diff verificados. Interação visual e teste no Windows permanecem pendentes. Não instalado nem publicado no GitHub.

## Aplicação da entrega cumulativa

O arquivo ATLAS-agente-local.patch inclui a prévia dos pontos e o assistente. Aplicar sobre a tag original, em branch nova; não aplicar sobre o patch anterior. Preservar alterações locais antes de trocar de branch.

No PowerShell, com o repositório original limpo e o arquivo baixado em Downloads:

```powershell
cd C:\Users\Filipe\ATLAS-v0.1.1-freeze
git status --short
# Continue somente se a saída acima estiver vazia.
git switch -c feature/atlas-agent-local network-observatory-v0.1.1
git apply --check "$env:USERPROFILE\Downloads\ATLAS-agente-local.patch"
# Continue somente se a verificação acima terminar sem erro.
git apply "$env:USERPROFILE\Downloads\ATLAS-agente-local.patch"
npm.cmd --prefix .\network-observatory\services\control-plane test
```

A tag original não é alterada. As alterações ficam disponíveis para revisão antes de commit/publicação.
