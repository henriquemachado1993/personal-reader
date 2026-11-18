# Memória do projeto

- Área segura inferior no leitor: o conteúdo rola até o fim do viewport; somente controles/painéis reservam o espaço do indicador de início. `body:has(.reader-shell)` remove o padding inferior e a altura do leitor desconta apenas o inset superior. Regressão em `tests/e2e/reader-viewport.spec.ts` cobre texto/PDF, rotação, insets simulados e ausência de rolagem extra do documento.

- Leitor após auditoria de 15/11/2026: preferência de fonte governa também o celular; navegação/retomada usa `scrollToReaderPage`, preservando o padding superior. Não restaurar `scrollIntoView({block: "start"})` sobre o documento.
- Rasterização PDF independe da seleção do canvas ativo. Reaproveitar páginas prontas na mesma largura; observar o contêiner `.reader-scroll-area`. Teste comprovou 8 → 0 reinicializações de canvas na troca de página. Rolagem usa rAF e busca binária; a estrutura de todas as páginas ainda fica montada.
- EPUB gera posições em segundo plano para calcular progresso pelo CFI. Não bloquear a abertura esperando o índice completo. Notas usam texto semântico com marcador da cor escolhida; arrastar texto SVG não deve selecionar suas letras.
- Títulos do workspace são definidos em `generateMetadata` na rota. Não escrever `document.title` em efeito cliente: os metadados transmitidos pelo Next podem sobrescrevê-lo em produção.
- Evidências das correções e do polish em `docs/audits/reader-remediation-2026-11-15.md`.

- Viewport usa escala fixa, `viewport-fit=cover` e teclado que redimensiona conteúdo. Campos móveis têm ao menos 16px para evitar ampliação ao focar. CSS de áreas seguras em `app-viewport.css`; preservar desenho/rolagem do leitor.
- Manifesto em `src/app/manifest.ts` usa `display: standalone`. Ícones PNG derivam do SVG existente via `scripts/generate-app-icons.mjs`. Barra do navegador só desaparece ao abrir o app instalado.

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
- Persistência remota incremental em `LibraryEntity`, com `LibraryRevision` e recibos em `SyncOperation`. Originais e demais arquivos ficam no R2 privado.
- Ações locais disparam sincronização. O Realtime Broadcast avisa sobre novas revisões por conta. Foco e reconexão recuperam mudanças pendentes. Consulte `docs/ARQUITETURA.md`.
- Conflitos incompatíveis exigem escolha em Configurações, com backup.
- Offline usa service worker apenas em produção; testar com build/start. Recursos privados nunca passam por cache de API.
- Arquivos órfãos permanecem retidos. Recuperação administrativa disponível em `scripts/reset-password.mjs`.
- Provedor de e-mail escolhido: Mailtrap. Fluxos `/forgot-password` e `/reset-password`; link usa fragmento para evitar vazamento nos logs/referrers. Configurar MAILTRAP_API_TOKEN e MAILTRAP_FROM_EMAIL; sandbox opcional.
- Tokens de recuperação são armazenados como SHA-256 e consumidos em transação. `passwordChangedAt` revoga JWTs anteriores.
- Comparações de entidades usam JSON canônico: JSONB pode reordenar chaves e não deve gerar falsas atualizações de versão.
- `storage:collect` simula por padrão. `--apply` exclui candidatos com sete dias, sem referência, sob advisory lock compartilhado com sincronização. A revisão automática rejeitou a execução destrutiva sem confirmação; nenhuma exclusão foi feita. Simulação: zero candidatos.
- Um único e-mail de recuperação foi autorizado pelo usuário e aceito pelo Mailtrap. AUTH_URL local configurado como http://localhost:3000. Não repetir sem nova autorização.
- Busca EPUB percorre o spine; notas PDF usam rasterização Unicode e anexo UTF-8. Dias de leitura antigos não podem ser reconstruídos a partir do contador acumulado.
