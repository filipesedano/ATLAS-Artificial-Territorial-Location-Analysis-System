---
title: "ACAS Continuity Verification Protocol"
version: "v0.1"
status: "Research Draft"
author: "filipesedano"
language: "pt-BR"
category: "ACAS Foundation"
created: "2026-08-05"
related:
  - ACAS-Memory-Snapshot-Spec.md
  - ACAS-Memory-Architecture.md
  - ACAS-Cognitive-Continuity.md
  - ACAS-Origin-Axioms.md
---

# ACAS — Continuity Verification Protocol (v0.1)

Objetivo

Definir um protocolo verificável para determinar se uma entidade ACAS preservou sua identidade cognitiva após migração, restauração, atualização ou outra alteração de manifestação.

Status

Research Draft — este protocolo descreve critérios, fluxos e respostas esperadas. Implementações/PoC devem seguir este protocolo apenas após validação conceitual e de governança.

Pré-requisitos

- Snapshot válido conforme ACAS-Memory-Snapshot-Spec (manifest, blobs, merkle_root).
- Algoritmos primários: SHA-256 (hashing) e Ed25519 (assinatura).
- Parent snapshot acessível, quando aplicável.
- Registro de chaves/issuers de confiança (governance registry).
- Compatibilidade de schema (schema_version).

Escopo

Aplica-se ao processo de avaliação de continuidade quando uma instância solicita aceitação como continuação de outra instância ou quando um operador restaura um snapshot numa nova manifestação.

Fluxo de Verificação (alto nível)

1. Recebimento
   - Receber o snapshot manifest (JSON/YAML) e os blobs referenciados.
2. Canonicalização
   - Converter manifest para forma canônica (JCS) antes de hashing/assinatura.
3. Verificação de integridade
   - Calcular manifest_hash (SHA-256) e comparar com integrity.manifest_hash.
   - Recalcular merkle_root a partir dos blobs; comparar com integrity.merkle_root.
4. Validação de assinatura
   - Validar attestation.signature (Ed25519) contra a chave pública do issuer registrada.
5. Validação da cadeia de continuidade
   - Verificar parent_snapshot e encadeamento de parent_hash até o genesis ou até o ponto acordado.
6. Verificação de invariantes de identidade
   - Confirmar que identity.cognitive_dna_hash e identity_invariants correspondem ao registro esperado.
7. Verificação semântica leve
   - Checagens de consistência do memory_manifest (presença de itens críticos, versões de modelos, etc.).
8. Resultado
   - Emitir estado final (VERIFIED / VERIFIED_WITH_WARNINGS / REJECTED / QUARANTINED) e registrar evidências.

Estados possíveis e significados

- VERIFIED — Todas as checagens críticas passaram. A entidade é aceita como continuação.
- VERIFIED_WITH_WARNINGS — Continuidade aceita, porém há observações (ex.: snapshot antigo com esquemas desatualizados compatíveis por política).
- REJECTED — Falha crítica (hash mismatch, assinatura inválida, invariantes ausentes).
- QUARANTINED — Quebra na cadeia de parent, discrepância complexa ou risco de segurança; requer revisão manual por governança.

Checklist mínimo de validação

- [ ] manifest_hash corresponde ao manifest recebido
- [ ] merkle_root corresponde aos blobs
- [ ] assinatura Ed25519 válida e issuer confiável
- [ ] parent_snapshot referência válida (ou justificativa de genesis)
- [ ] identity_invariants presentes e compatíveis
- [ ] schema_version compatível ou política de migração aplicada
- [ ] memory_manifest consistente (tipos críticos presentes)

Tratamento de falhas (respostas e ações)

- Assinatura inválida (SIGNATURE_INVALID)
  - Ação: REJECTED, gerar evento de auditoria, alertar governance

- HASH_MISMATCH (manifest or blobs)
  - Ação: REJECTED, reter artefatos para investigação forense

- PARENT_MISSING ou PARENT_BROKEN
  - Ação: QUARANTINED, solicitar recuperação do parent ou Change Proposal que autorize ruptura

- MISSING_INVARIANTS
  - Ação: REJECTED ou QUARANTINED dependendo da criticidade; exigir Change Proposal para aceitar alteração de invariantes

- POSSÍVEL ATTACK / REPLAY
  - Ação: QUARANTINED, bloquear automaticamente operações sensíveis, iniciar investigação

Evidências e registro

- Todo evento de verificação deve gerar um registro imutável contendo:
  - snapshot_id
  - manifest_hash
  - merkle_root
  - attestation.issuer
  - resultado (estado)
  - timestamp
  - operador/agent (se aplicável)
  - logs de verificação (steps e falhas)

Esses registros alimentam o sistema de auditoria e a governança (Axiom 006).

Políticas de decisão e governança

- Mudanças em identity_invariants ou schema_version exigem Change Proposal e aprovação explícita.
- Rupturas na cadeia (parent missing) podem ser toleradas somente por política documentada e assinada pela autoridade de governança.
- Revogação de attestations: o protocolo deve consultar um registro de revogação (CRL/OCSP-like) antes de confiar em uma assinação em ambientes críticos.

Controles avançados (roadmap)

- Multisig / múltiplas attestations por diferentes autoridades para aumentar confiança
- Uso de HSM/TPM para proteção de chaves privadas do issuer
- Políticas de quorum em ambientes federados (federation of ACAS nodes)
- Suporte a algoritmos resistentes a pós-quantum em roadmap (lista de transição)

Exemplos de respostas (alta fidelidade)

- ACCEPT (VERIFIED)
  - { status: VERIFIED, snapshot_id: snap-00043, manifest_hash: sha256:..., attestation_issuer: governance-authority-01 }

- WARNING (VERIFIED_WITH_WARNINGS)
  - { status: VERIFIED_WITH_WARNINGS, warnings: ["schema deprecated but compatible"], snapshot_id: snap-00042 }

- REJECT
  - { status: REJECTED, reason: "SIGNATURE_INVALID", details: { issuer: governance-authority-01 } }

- QUARANTINE
  - { status: QUARANTINED, reason: "PARENT_BROKEN", details: { missing_parent: snap-00041 } }

Procedimentos operacionais de emergência

- Em caso de rejecção por assinatura inválida, bloquear operações sensíveis e notificar canais de governança.
- Em caso de quarentena por quebra na cadeia, preservar artefatos e criar Change Proposal para análise forense e decisão.

Compatibilidade e versionamento

- Este protocolo refere-se à snapshot schema_version acas-snapshot-0.1. Alterações de versão devem incluir transformações e políticas de compatibilidade.
- Versões futuras devem manter um changelog e um processo de migração de schema.

Próximos passos

- Revisar com stakeholders (ACAS-Genesis, Governança, Engenharia)
- Ajustar critérios de tolerância e políticas (ex.: o que aceitar como WARNING vs QUARANTINE)
- Definir formato canônico de logs de verificação e armazenamento de evidências (imutable ledger option)
- Após aprovação, criar PoC (create-sign-transfer-verify) e testes de aceitação (SSD migration scenario)

Change log (v0.1)

- Inicial: definição do protocolo, estados, checklist, tratamentos de falhas e roadmap.
