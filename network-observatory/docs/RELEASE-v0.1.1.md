# Network Observatory - candidato v0.1.1

Data deste registro: 2026-09-17T23:21:45.8142706-03:00
Estado: snapshot v0.1.1 de demonstracao local; recuperacao validada conforme registro abaixo.
Versao pretendida do produto: v0.1.1.
Pacotes internos: 0.1.0. Banner atual do servidor: v0.1.
SHA-256 do HTML de trabalho: 6FD209E079C0F59B071BD4A9EC13C7A158218D1890560C7678E61D3187EE9585

## Validacao observada

- Windows, Node v24.18.0 e npm 11.16.0, conforme logs fornecidos.
- Contratos: 8 testes aprovados.
- Collector: 10 testes aprovados.
- Control Plane: 41 testes aprovados apos a migracao do painel.
- Servidor e teste de navegacao agora usam o HTML incluido no projeto.
- A copia do painel foi conferida por hash; ambos os HTMLs foram preservados.
- O codigo de inicializacao exige tokens por ambiente e escuta em 127.0.0.1.
- Ha tratamento de SIGINT/SIGTERM para fechamento do servidor e do SQLite.

## Seguranca e limites da revisao

- As buscas anteriores nao encontraram os arquivos e padroes sensiveis pesquisados.
- A lista preparada nao inclui banco operacional ou arquivo de ambiente.
- No HTML revisado nao foram encontradas credenciais fixas ou bibliotecas externas.
- O painel consulta a API por GET e mantem o token em memoria.
- Estas verificacoes nao constituem auditoria completa de seguranca do repositorio.

## Limitacoes conhecidas

- Demonstracao local com dados simulados; nao validada para producao.
- Servicos e Historico ainda mostram dados simulados com selo API LOCAL.
- Globo, detalhes e linha do tempo ainda possuem conteudo demonstrativo.
- As cores do globo nao representam o estado individual do inventario da API.
- O provedor LLM e simulado e usa INFERENCE; alinhar com INFERRED na evolucao.
- Os testes de navegacao verificam padroes no HTML; nao substituem teste no navegador.
- Corrigir a ambiguidade de proveniencia antes de uso operacional ou integracao do agente.

## Roteiro de recuperacao utilizado

- Clonar o commit em pasta limpa e repetir os testes.
- Iniciar o servidor e verificar painel e API local.
- Confirmar criacao, leitura e restauracao do SQLite nesse clone.
- Confirmar encerramento seguro e ausencia de dependencias locais esquecidas.
- Registrar o resultado da recuperacao antes da tag network-observatory-v0.1.1.
## Resultado da recuperacao e freeze

Data deste registro: 2026-09-17T23:47:07.9443742-03:00
Commit de codigo validado: 55bc413b317fd4bb33609534ba872b2141464f64
Tag prevista: network-observatory-v0.1.1

- Clone independente criado somente a partir do conteudo registrado no Git.
- Testes no clone: 8 contratos, 10 Collector e 41 Control Plane; nenhuma falha.
- Servidor iniciado em 127.0.0.1:8080.
- Banco exclusivo de recuperacao: data/atlas-recovery.db, dentro do clone.
- Integridade SQLite: ok na inicializacao e na reabertura.
- Incidentes antes do reinicio: 1. Depois: 1.
- Comparacao de id, title, status, classification e observationIds: True.
- Classificacao do incidente observado: INFERRED.
- Este registro deve ser executado somente apos confirmar o encerramento seguro por Ctrl+C.

Este freeze preserva uma demonstracao local com as limitacoes ja documentadas.
Nao representa liberacao para producao ou aprovacao da futura integracao do agente.
A verificacao manual completa da interface no navegador nao foi registrada.