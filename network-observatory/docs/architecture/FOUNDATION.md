# Architecture Foundation — Draft 0

Status: rascunho para revisão antes do primeiro código.

## Produto

O ATLAS Observatório de Rede é uma plataforma multiempresa de observabilidade e resposta operacional. Um Collector local observa o ambiente autorizado; o Control Plane mantém identidade, estado, histórico e políticas; a interface Web apresenta o contexto; uma camada de LLM opcional explica e recomenda.

## Invariantes iniciais

1. Proveniência não implica verdade.
2. Inferência não implica diagnóstico.
3. Herança não implica autoridade.
4. O LLM não cria autoridade operacional.
5. Um cliente nunca acessa dados de outro cliente.
6. Credenciais e segredos nunca aparecem em URLs ou códigos públicos.
7. Chamados correlacionados não devem ser duplicados para a mesma causa provável.
8. O monitoramento básico funciona sem LLM e sem interface aberta.
9. Falha de internet não pode apagar eventos locais ainda não sincronizados.
10. Toda ação material deve produzir registro de auditoria.

## Identidade do cliente

- Código público legível: exemplo `A4527`.
- Identidade interna: UUID não previsível.
- Login individual por usuário.
- Papel resolvido pelo servidor.
- MFA previsto para contas privilegiadas.
- Token de instalação do Collector é temporário e diferente da senha humana.

## Perfis operacionais

Cada unidade possui calendário, horário de funcionamento, janelas de manutenção e criticidade próprios. Um dispositivo desligado fora do expediente não deve ser automaticamente classificado como incidente.

## LLMProvider

O contrato de LLM recebe somente contexto estruturado e minimizado. Sua saída deve conter classificação, confiança, evidências relacionadas e a indicação obrigatória de confirmação humana quando houver inferência.

## Câmeras

A evolução inicial monitora apenas disponibilidade e saúde de câmera/NVR. Acesso ou armazenamento de vídeo permanece fora do escopo até existir uma análise específica de segurança, privacidade, autorização e capacidade.

## Decisões adiadas

- provedor de identidade;
- banco de dados definitivo;
- tecnologia final do frontend 3D;
- modelo LLM local ou externo;
- sistema externo de chamados;
- empacotamento do Collector.
