# Ações do painel — incident-actions/1.0

Prévia local. O painel usa o primeiro incidente ativo exibido. Sem incidente ativo, ou em modo simulado, não há escrita.

- Analisar: GET /v1/tenants/{tenant}/incidents/{id}/analysis. Leitura determinística das observações vinculadas; sem LLM, execução ou diagnóstico confirmado.
- Ver evidências: GET no mesmo prefixo /evidence. Mostra observações vinculadas entre as 100 mais recentes do ativo, origem não verificada e referências indisponíveis explicitamente. Não implementa recuperação de anexos Evidence.
- Histórico: GET no mesmo prefixo /history. Eventos persistidos vinculados ao incidente e atribuição humana separada. Não representa histórico completo de triagens sem vínculo.
- Assumir chamado: POST no mesmo prefixo /assume, JSON {"confirm":true}. Sessão admin obrigatória, cliente autorizado pelo servidor, origem local obrigatória. Token Collector e token antigo não autorizam esta operação. O cliente não escolhe ator. Incidente deve estar OPEN ou ACKNOWLEDGED. Registra admin, data, política human-assignment/1.0 e muda estado para ACKNOWLEDGED numa única transação. Repetição retorna o mesmo registro. Sem transferência, encerramento manual ou chamado externo.

O registro incident_assignment funciona como trilha da única atribuição permitida: ator, instante, alvo (cliente/incidente) e política. Não é log resistente a adulteração por administrador do banco. O agente permanece sem ferramenta de escrita; a sessão do operador não deve ser entregue a um LLM.

Schema SQLite 3: testar com banco separado e preservar backups; versões anteriores não devem abrir banco migrado. Nenhuma tag de freeze alterada.

Testes HTTP cobrem falta de sessão, origem proibida, outro cliente, ator injetado, leituras sem atribuição, evidência indisponível, análise indeterminada, repetição idempotente e persistência após reinício. Validação visual no navegador do usuário continua pendente.
