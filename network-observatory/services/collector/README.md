# Collector

Serviço leve instalado em um servidor ou computador autorizado na rede do cliente.

Responsabilidades futuras:

- descobrir somente ativos dentro do escopo autorizado;
- executar verificações de saúde com baixo consumo;
- armazenar eventos durante perda de conectividade;
- sincronizar eventos de forma idempotente;
- iniciar conexão de saída autenticada com o Control Plane;
- não abrir portas de entrada por padrão;
- não executar comandos remotos na primeira fase.

O Collector deve continuar útil sem interface gráfica e sem LLM.
