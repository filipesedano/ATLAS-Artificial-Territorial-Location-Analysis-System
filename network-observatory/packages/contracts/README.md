# Contracts

Contratos compartilhados entre Collector, Control Plane e Web.

Primeiros tipos previstos:

- `Tenant`
- `Site`
- `UserRole`
- `CollectorIdentity`
- `Asset`
- `Observation`
- `Evidence`
- `Incident`
- `Ticket`
- `LLMAnalysis`

Toda informação analítica deve carregar uma classificação explícita: `MEASURED`, `ESTIMATED`, `INFERRED` ou `INDETERMINATE`.

## Primeira implementação

O pacote contém contratos TypeScript sem dependências de banco, transporte ou interface:

- `src/contracts.ts`: vocabulário de domínio;
- `src/invariants.ts`: validações nas fronteiras do sistema;
- `src/index.ts`: API pública do pacote;
- `test/invariants.test.ts`: testes executáveis dos primeiros invariantes.

### Executar os testes

Requer Node.js 22.18 ou posterior, com suporte nativo à remoção de tipos TypeScript:

```bash
npm test
```

Os validadores devem ser aplicados nas fronteiras de entrada. Tipos TypeScript ajudam durante o desenvolvimento, mas não substituem validação em tempo de execução para dados vindos da rede, do banco ou de integrações externas.
