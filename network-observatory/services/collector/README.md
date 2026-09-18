# Collector Simulator v0.1

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

## Implementação atual

Esta versão é deliberadamente simulada: não envia ping, não consulta SNMP e não toca na rede real.

Ela implementa:

- cenários de impressora saudável, sem comunicação, ICMP bloqueado, sem papel e toner baixo;
- geração exclusiva de observações `MEASURED`;
- bloqueio de ativos de outro cliente ou unidade;
- lista fechada de ativos previamente autorizados pelo gestor da rede;
- fila local com deduplicação por `idempotencyKey`;
- opção de fila durável em arquivo JSON com permissão restrita;
- sincronização de saída com confirmação explícita;
- transporte HTTP limitado explicitamente a `localhost` nesta versão;
- retenção dos eventos quando o Control Plane está indisponível.

O Collector não produz diagnóstico, não abre chamado e não executa ação remota.

## Executar

Requer Node.js 22.18 ou posterior:

```bash
npm test
npm run demo
```

O armazenamento JSON existe somente para validar o comportamento offline no protótipo. Uma implementação de produção deverá usar armazenamento transacional apropriado.
