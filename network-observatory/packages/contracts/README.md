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
