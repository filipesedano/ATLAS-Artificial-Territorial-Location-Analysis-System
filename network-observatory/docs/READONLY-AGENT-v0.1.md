# Permissões do agente de consulta — versão 0.1 (proposta)

Base: tag network-observatory-v0.1.1, commit 17b8f4a. Esta branch não altera a tag.

O agente futuro pode consultar inventário, estado calculado, incidentes e observações do cliente autorizado e produzir explicações com referências. Não pode escrever registros operacionais, executar comandos, abrir/encerrar chamados, mudar configurações ou consultar outro cliente. Não há LLM ou agente executável nesta entrega.

O servidor vincula o token de leitura a operatorTenantIds; o cliente na URL não concede autoridade. O token de coleta é distinto e não deve ser entregue ao agente. O bootstrap local autoriza somente ATLAS_TENANT_ID. Esta configuração é local, não um sistema de identidade multiusuário de produção.

Contrato aditivo asset-preview/1.0: GET /v1/tenants/{tenantId}/assets/{assetId}. Reutiliza a rota existente; acrescenta contractVersion, source e observations (até 100 mais recentes, sem paginação). observations contém registros de suporte, não um novo contrato de Evidence. O IP é cadastrado, não descoberto. O GET não dispara coleta ou triagem persistente.

MEASURED, ESTIMATED, INFERRED e INDETERMINATE são as únicas classificações analíticas. Cada observação mantém sua classificação declarada. O estado agregado do cartão é apresentado conservadoramente como INFERRED, ou INDETERMINATE quando ausente, antigo ou administrativo. Inferência não é diagnóstico.

API_LOCAL identifica transporte. acquisition=UNVERIFIED indica que o contrato legado não registra se a aquisição foi real ou simulada. Os dados do simulador não podem ser usados como prova de medição real. A prévia visual informa explicitamente DADOS SIMULADOS. Não inferir saúde pela ausência de incidentes ou indisponibilidade por ping isolado.

Limites: inventário não georreferenciado; pontos distribuídos apenas para seleção, sem representar topologia física. Serviços/histórico demonstrativos continuam rotulados como simulados. Sem acesso remoto, instalação, coleta real, notificações, chat ou LLM. Sem alegação de auditoria completa de segurança. Retenção/exportação/exclusão e origem por observação exigem contratos posteriores.

Validação Windows antes de integração: testar clique, toque, Tab/Enter e Escape; trocar modo durante consulta; token incorreto; falha da API; ativo sem observação/antigo; conferir IDs no cartão. Manter tokens fora de arquivos versionados. A aprovação do freeze anterior não aprova automaticamente esta extensão.

## Resultado desta implementação

Em 18/09/2026, no ambiente Linux com Node v24.19.0: 61 testes passaram (8 contratos, 10 Collector, 43 Control Plane). Verificação de sintaxe do JavaScript e git diff --check passaram. Os testes novos exercitam bloqueio de outro cliente em todas as rotas de consulta, proibição de ingestão com token leitor e preservação de incidentes durante consultas repetidas.

A validação visual/interativa não foi concluída: o navegador não estava instalado e o download foi bloqueado pelo ambiente. Portanto, clique/toque/teclado e layout continuam pendentes de conferência no Windows. A tag congelada permanece inalterada.
