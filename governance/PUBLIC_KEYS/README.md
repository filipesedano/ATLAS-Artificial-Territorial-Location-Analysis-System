# PUBLIC_KEYS — README

Instruções para publicação de chaves públicas e fingerprints durante a fase de pesquisa.

- Adicione um arquivo <public_key_id>.pub contendo a chave pública (Ed25519 PEM/Base64) e um arquivo <public_key_id>.fingerprint contendo o fingerprint SHA-256.
- Faça commit assinado (git commit -S) sempre que atualizar chaves.
- Para PoC, o repositório local pode servir como Trust Anchor; para produção, mover para um repositório governance dedicado e com controles de acesso.
