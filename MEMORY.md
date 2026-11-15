# Memória do projeto

- Especificação: `docs/PRODUCT.md`; referências visuais em `docs/design/images-reference/`.
- Next.js App Router, NextAuth com e-mail/senha, Prisma e PostgreSQL do Supabase; arquivos privados no R2.
- IndexedDB é o cache local por conta. Alterações offline precisam sobreviver a recarregamento e sincronizar com controle de versão.
- Não substituir alterações de outro dispositivo silenciosamente. Arquivos originais permanecem imutáveis.
- Não registrar credenciais. `.env` é privado.
- Estado e critérios de conclusão estão em `TASKS.md`.
- Implementação remota: `LibraryReplica` (JSONB, revisão por conta e UUID da última operação); originais em `<ownerId>/originals/<documentId>` no R2 privado.
- Migração `202611150002_library_replica` aplicada no Supabase em 15/11/2026; acesso ao bucket e upload/download verificados.
- Sincronização a cada 15 segundos, ao foco e ao recuperar conexão; IndexedDB armazena baseline, operação pendente e originais já enviados.
- Conflitos no mesmo documento exigem escolha em Configurações, com backup automático. Não substituir o baseline por uma lista vazia durante bootstrap: as amostras têm IDs estáveis.
- Offline usa service worker apenas em produção; testar com build/start. Recursos privados nunca passam por cache de API.
- Arquivos órfãos permanecem retidos. Recuperação administrativa disponível em `scripts/reset-password.mjs`.
- Provedor de e-mail escolhido: Mailtrap. Fluxos `/forgot-password` e `/reset-password`; link usa fragmento para evitar vazamento nos logs/referrers. Configurar MAILTRAP_API_TOKEN e MAILTRAP_FROM_EMAIL; sandbox opcional. Não há credenciais Mailtrap no ambiente atual.
- Migração `202611150003_password_recovery` aplicada; tokens armazenados apenas como SHA-256, consumidos em transação; passwordChangedAt revoga JWTs anteriores.
