# Login local e recuperação — prévia 0.1

Escopo: um administrador local chamado admin, limitado ao cliente configurado no servidor. Não é usuário do Windows, conta global do futuro ATLAS SO nem nova autoridade para o agente. A sessão oferece as consultas atuais; não autoriza ingestão, comandos, alterações de equipamentos ou acesso a outro cliente.

## Primeiro uso

Usar banco de laboratório separado, conforme VALIDATION-LAYERS-v0.1.md. Iniciar o Server e abrir http://127.0.0.1:8080 (ou a porta configurada). A primeira tela solicita ATLAS_OPERATOR_TOKEN como token de configuração inicial, uma senha escolhida pelo operador de 15–128 caracteres e sua confirmação. O token continua sendo definido localmente no processo; não há senha padrão nem cadastro aberto ao primeiro visitante. Guardar o código de recuperação exibido em um gerenciador de senhas. Em seguida entrar como admin usando a senha criada.

Depois da criação, o token de configuração não permite consultar APIs nem redefinir a conta. O token do Collector permanece separado. O bootstrap de servidor mantém os tokens exigidos pela configuração anterior; esta entrega não elimina essas variáveis.

## Proteções implementadas

- Senha com scrypt (N=131072, r=8, p=1, salt aleatório de 16 bytes), nunca armazenada em texto claro. Referência: https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html
- Sessão aleatória de 256 bits, mantida em memória do servidor sob hash, duração fixa de 30 minutos, até oito sessões. Cookie HttpOnly, SameSite=Strict e Path=/. Sair, recuperar senha ou reiniciar o servidor invalida as sessões correspondentes.
- Cinco falhas bloqueiam novas tentativas por 60 segundos. Contador persiste no SQLite. Uma operação de hash por vez limita consumo de memória; isso pode gerar 429 para acessos concorrentes.
- POST de autenticação exige Origin de localhost/127.0.0.1 com a porta do servidor; Host também limitado. Sem CORS, cadastro remoto, redirecionamento externo ou tokens em URL.
- Auditoria registra tipos de eventos e horários, sem senha/código/token. Ainda não é log inviolável nem tem política completa de retenção.

HTTP é permitido exclusivamente para o laboratório em loopback. Cookie Secure não é ativado neste modo HTTP. Não expor à LAN/internet, colocar atrás de proxy ou remover a restrição de Host: implantação remota exige HTTPS, cookie Secure, origem de confiança explícita e revisão própria. A CSP ainda permite scripts inline por causa do painel legado; o login não equivale a uma auditoria completa de segurança.

## Recuperação

“Esqueci minha senha” aceita o código guardado e uma nova senha. O código tem 256 bits aleatórios, hash SHA-256 no banco, validade de um ano e uso único. O uso bem-sucedido substitui o código, mostra o novo uma vez e encerra todas as sessões. Código perdido ou expirado não tem recuperação automática nesta entrega. Backup antigo do banco também pode restaurar credenciais/códigos antigos: proteger backups e planejar recuperação antes de produção. Referência: https://cheatsheetseries.owasp.org/cheatsheets/Forgot_Password_Cheat_Sheet.html

E-mail e SMS NÃO implementados. A tela informa isso e não coleta telefone/e-mail sem necessidade. A evolução requer provedor, verificação de propriedade do contato, tokens expirantes, limites de envio, consentimento e testes contra enumeração. Nenhuma mensagem foi enviada.

## Banco e compatibilidade

Migração aditiva eleva o schema SQLite para 2 e cria local_admin, auth_throttle e auth_audit. Mantém as tabelas de observações/incidentes. Versões antigas que aceitam somente schema 1 não devem abrir esse banco; para voltar à versão anterior, utilizar backup anterior à migração. Não alterar o banco preservado da v0.1.1 durante o laboratório.

## Validação

Testes exercitam setup com token e origem, hash de senha, recuperação de uso único, expiração/revogação de sessões, limite persistente de tentativas, bloqueio de token legado para consultas, isolamento entre clientes e proibição de ingestão com sessão administrativa. Interface visual e digitação no navegador doméstico ainda pendentes. Nenhuma conta real foi criada para Filipe nesta implementação; as contas de teste foram temporárias e removidas.
