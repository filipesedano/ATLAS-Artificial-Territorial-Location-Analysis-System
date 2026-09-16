# ATLAS — Observatório de Rede (Protótipo)

Protótipo visual autocontido para validar a interação central do Observatório de Rede.

## Escopo desta fase

- Dados totalmente simulados.
- Globo/topologia central sensível a mouse e toque.
- Dois nós de impressora e um roteador em estado crítico.
- Correlação visual de uma possível causa comum.
- Painéis laterais fixos e gaveta de análise contextual.
- Separação explícita entre dados medidos e inferência.
- `SimulatedLLMProvider` como contrato provisório para futura integração.

## Executar

Abra `index.html` em um navegador moderno. Nenhum servidor, pacote ou acesso à rede é necessário.

## Limites intencionais

Este protótipo não realiza ICMP, SNMP, descoberta de rede, abertura de chamados ou chamadas a modelos externos. O conteúdo do LLM é simulado e sempre exige confirmação humana.
