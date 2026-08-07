# ADR-0001 — Identity Layer

Status: Draft

## Context
A identidade do sistema ACAS deve ser verificável, versionável e capaz de distinguir entre instâncias, núcleo (kernel) e configurações/variantes. Identidade é a base para rastreabilidade, segurança, assinaturas e mapeamento de capacidades (Genome/Capability Model).

## Decisão
Definir um modelo padronizado de identidade para ACAS que inclua:
- ID único da instância (UUID v4 ou similar);
- Metadados de emissão (issuer, issued_at);
- Chave pública associada (formato PEM/PKI);
- Versão de configuração e conjunto de capabilities (referência ao Genome descriptor);
- Referências a artefatos de provisionamento (manifests) e origem.

O modelo será representado como um artefato JSON/JSON-LD com schema versionado.

## Consequências
- Permite verificação criptográfica de artefatos e eventos;
- Facilita mapeamento entre instâncias e capability-sets;
- Requer infra para gerir chaves e ciclos de rotação;
- Impacta APIs de bootstrap e resolução de identidade.

## Alternativas consideradas
1. Identidade mínima (somente UUID) — rejeitada por não suportar verificação/assinatura.
2. Identidade centralizada (serviço global) — rejeitada por reduzir resiliência e aumentar acoplamento.

## Racional
Um artefato de identidade rico permite auditoria, assinatura de artefatos e ligação direta entre decisões arquiteturais (ADRs) e instâncias que executam capacidades específicas.

## Implementação proposta
- Schema: docs/schemas/identity-v1.json (definir como próximo passo);
- Endpoints: identity/resolve, identity/verify;
- Seed ADR em docs/architecture/ADRs para mapear dependências.

## Referências
- ACAS Foundation v1.0 — Identity Layer

## Próximos passos
- Definir schema JSON e exemplos;
- Criar ADRs complementares para chaveamento e rotação;
- Validar com ACAS-009 PoC.
