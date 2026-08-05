## Security Considerations

Esta seção descreve considerações de segurança iniciais para a criação, assinatura, transferência e verificação de Memory Snapshots. É um ponto de partida e deve ser aprofundada antes da implementação em ambientes de produção.

1. Proteção de chaves privadas
- As chaves privadas usadas para gerar attestations devem ser protegidas por HSM, TPM, ou cofres de chaves seguros (ex.: HashiCorp Vault) em ambientes não experimentais.
- Para PoC local, armazenar chaves em arquivos protegidos com permissões restritas e usar passphrases fortes.

2. Prevenção de replay attacks
- Incluir timestamps confiáveis e nonces nos snapshots/attestations quando apropriado.
- Manter um log de snapshots aceitos e rejeitados para detectar replays.
- Considere incluir um campo "valid_until" para limitar a janela temporal de aceitação.

3. Proteção contra downgrade de schema
- Validar schema_version e manter registro de versões descontinuadas.
- Políticas de escolha: rejeitar downgrades automáticos sem Change Proposal aprovada.

4. Snapshots parcialmente corrompidos
- Implementar validação por componente: permitir identificar quais blobs falharam e classificar falhas (críticas vs não-críticas).
- Em casos de corrupção parcial, preferir QUARANTINE para investigação forense.

5. Relógios confiáveis
- Timestamps são críticos; usar NTP com autenticação quando possível e registrar margem de sincronização.
- Para ambientes com requisitos fortes, integrar fontes de tempo confiáveis (ex.: GPS, RFC 3161 TSA para carimbo de tempo).

6. Geração de aleatoriedade
- Uso de RNGs seguros para geração de chaves e nonces. Evitar RNGs de baixa qualidade (ex.: rand().) em ambientes críticos.

7. Distribuição e verificação de chaves públicas
- Public keys e fingerprints devem residir em um Trust Anchor (p.ex., repositório Git assinado). Para produção, considerar sistemas de registro com autenticação e revogação.

8. Revogação de attestations
- Implementar CRL como mecanismo inicial; planejar OCSP-like para ambientes onde verificação em tempo real é necessária.

9. Proteção em trânsito
- Usar TLS para transferência de blobs; verificar hashes após transferência.

10. Monitoramento e alertas
- Integrar logs de verificação com sistemas de monitoramento e alertas para eventos de segurança (SIGNATURE_INVALID, HASH_MISMATCH, PARENT_BROKEN).

11. Considerações sobre pós-quantum
- Manter plano de transição para algoritmos pós-quânticos; versionar attestation.algorithm para permitir migração.

12. Políticas de acesso e mínimos de privilégio
- Princípio de menor privilégio para agentes que podem criar/assinar/transferir snapshots.

13. Auditoria e retenção de evidências
- Armazenar evidências de verificação com retenção apropriada para auditoria forense. Manter hashes e logs imutáveis quando possível.

---

(Adicionar mais itens conforme revisão de segurança e auditoria.)
