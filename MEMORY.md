# Memória do projeto

- Estado inicial vazio em `src/modules/library/initial-state.ts`; não recriar amostras em produção. Dados de teste vivem em `tests/*fixture.ts`.
- Leitor renderiza páginas em sequência e atualiza o progresso por rolagem. PDFs compartilham recurso com contagem de referências e renderização próxima da área visível; EPUB usa gerenciador contínuo.
- Campos de data usam `@mantine/dates` em português; selects usam combobox Mantine. Sliders precisam de `thumbLabel` para nome acessível.

- Refinamento de 15/11/2026: navegação em duas linhas até 380px; título do leitor usa a tinta da página e fica oculto no celular. Preservar o visual das referências.
- Desfazer/refazer anotações mantém até 100 operações por documento durante a sessão, incluindo mover, editar e apagar. Recusar operações sobre objetos alterados remotamente.
- Configuração de banco não comprova sincronização. Exibir sucesso e horário somente após conclusão; novas alterações locais voltam ao estado pendente.

- MantineProvider usa deduplicateCssVariables=false para emitir variáveis CSS de forma determinística entre SSR e cliente. Não substituir por suppressHydrationWarning na tag style; manter a escala 16/14.

- Mantine 9.8.1 integrado: controles em `src/components/ui/controls.tsx`, tema e esquema claro/escuro em `provider.tsx`, menus em `dropdown.tsx`, modal e ActionIcon em `src/components/ui.tsx`.
- Manter a ordem CSS `theme, base, mantine, components, utilities`. Carregar estilos Mantine pelo globals.css após declarar as camadas; importar primeiro em layout.tsx deixa o reset Tailwind anular padding/bordas.
- A fonte raiz existente é 14px; o tema Mantine usa scale=16/14 para preservar as dimensões declaradas. A preferência Zustand/IndexedDB é a fonte única do tema.

- Build de deploy deve executar `npm run build`: regenera Prisma Client e copia o worker PDF antes do Next.js. Isso evita modelos ausentes com node_modules em cache na Vercel. Não substituir por `next build` no painel.

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
- Migração `202611150004_entities` aplicada: LibraryEntity registra versões e exclusões; projeções relacionais são atômicas com a réplica. `npm run db:project` executado para sete bibliotecas existentes (incluindo sessões de QA).
- Comparações de entidades usam JSON canônico: JSONB pode reordenar chaves e não deve gerar falsas atualizações de versão.
- `storage:collect` simula por padrão. `--apply` exclui candidatos com sete dias, sem referência, sob advisory lock compartilhado com sincronização. A revisão automática rejeitou a execução destrutiva sem confirmação; nenhuma exclusão foi feita. Simulação: zero candidatos.
- Um único e-mail de recuperação foi autorizado pelo usuário e aceito pelo Mailtrap. AUTH_URL local configurado como http://localhost:3000. Não repetir sem nova autorização.
- Busca EPUB percorre o spine; notas PDF usam rasterização Unicode e anexo UTF-8. Dias de leitura antigos não podem ser reconstruídos a partir do contador acumulado.
