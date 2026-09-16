# Control Plane

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
