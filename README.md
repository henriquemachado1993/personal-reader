# Le-Books

Biblioteca pessoal em Next.js, com direção visual baseada nas referências do Apple Books fornecidas em `docs/design/images-reference/`. A especificação está em [docs/PRODUCT.md](docs/PRODUCT.md).


A [documentação de arquitetura](docs/ARQUITETURA.md) descreve os componentes e os fluxos de leitura, armazenamento e sincronização entre aparelhos.

## Executar

Requer Node.js 22 ou superior e um PostgreSQL acessível.

```sh
npm ci
```

Copie `.env.example` para `.env` e configure as URLs do Postgres e `AUTH_SECRET`. Use um banco vazio para a versão incremental. Configure o bucket privado em `R2_BUCKET_NAME`. As senhas na URL precisam de percent-encoding se contiverem caracteres reservados. Use a URL do transaction pooler para `DATABASE_URL` e a do session pooler para `DIRECT_URL`. Copie o host exato mostrado em Connect no seu projeto Supabase.

```sh
npm run db:generate
npx prisma migrate deploy
npm run dev
```

Abra http://localhost:3000. O primeiro acesso permite criar a conta proprietária, que será a única administradora de convites. Depois disso, novos cadastros exigem convite válido. Em Configurações → Convites, a administradora informa um e-mail e gera um link para enviar pessoalmente. O link vale por 48 horas, permite um único cadastro para aquele e-mail e pode ser revogado. Gerar outro convite para o mesmo e-mail revoga os anteriores ainda não utilizados. Cada conta tem sua própria biblioteca; convites não compartilham livros ou permissões administrativas. NextAuth usa e-mail/senha, JWT em cookie HttpOnly e hashes bcrypt com custo 12. As tabelas ficam no schema `reader`, separado de `public`. Não exponha o schema `reader` pela Data API do Supabase.

O `.env` é ignorado pelo controle de versão. Nunca use variáveis `NEXT_PUBLIC_*` para as credenciais do banco, R2 ou `AUTH_SECRET`.

## O que funciona nesta entrega

- Início, biblioteca em lista/grade, busca, filtros, ordenação e coleções, com criação direta ao organizar um livro.
- Importação de PDF, EPUB, DOCX e TXT; capas extraídas de PDFs e EPUBs quando disponíveis.
- Leitor com navegação, progresso, marcadores, seleção de texto e busca. Um clique/toque alterna a leitura focada; o pincel abre as ferramentas. O rodapé tem miniaturas clicáveis, com previews reais de PDF.
- Caneta, marca-texto, formas, borracha e desfazer/refazer adições de marcações.
- Notas, destaques, capturas de PDFs e central de conhecimento com exportação em Markdown.
- Download de originais e exportação de PDFs com marcações incorporadas.
- Temas claro/escuro, preferências de leitura, histórico e tempo de leitura acumulado.
- Login real com NextAuth, usuários no Supabase via Prisma e armazenamento local separado por conta.

Os oito livros iniciais são amostras de demonstração. Suas capas vetoriais são criações tipográficas próprias, e as apresentações estão identificadas como tal. Elas não representam arquivos completos de edições comerciais. Importe seus arquivos para ler seu próprio acervo.

## Persistência e limites atuais

**Autenticação:** Supabase PostgreSQL + Prisma. O schema e a migração incluem também as entidades dos demais módulos.

**Sincronização:** `LibraryEntity` é a fonte de dados da biblioteca, com um registro por documento, posição, coleção, anotação, marcador e preferência. `GET /api/library/sync?since=<revisão>` lê a revisão e retorna apenas as entidades alteradas desde esse ponto. `POST /api/library/sync` confirma alterações, revisão e recibo na mesma transação. O progresso atualiza somente a posição do livro. O navegador envia ações agrupadas, tenta enviar a posição e o tempo ao sair e recupera alterações ao abrir, voltar à aba ou reconectar. Exclusões ficam registradas. Alterações incompatíveis podem ser resolvidas em Configurações com backup JSON.

**Realtime:** configure `NEXT_PUBLIC_SUPABASE_URL` e `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`. No Supabase hospedado, gere uma chave com `supabase gen signing-key --algorithm ES256`, importe a JWK nas JWT Signing Keys do projeto e ative a chave. Defina a JWK privada completa em `SUPABASE_REALTIME_SIGNING_JWK` no servidor. Mantenha o schema `reader` fora da Data API. Ative o Realtime antes de aplicar a migração, que cria a política de recebimento no canal privado da conta. A sessão Auth.js emite um token de curta duração para esse canal. Cada evento informa somente a revisão confirmada. A conferência por revisão continua disponível se a conexão ao Realtime cair.

**Arquivos:** originais, capas, capturas, imagens anexadas e o texto paginado de TXT/DOCX ficam em um bucket privado do R2. `POST /api/library/files/:id` autoriza upload direto com URL assinada. O GET autentica e redireciona para download. O bucket é definido por `R2_BUCKET_NAME`. Cada objeto tem uma chave imutável com o ID da conta. Configure CORS com [docs/storage-cors.json](docs/storage-cors.json). As exclusões entram em retenção de sete dias. `npm run storage:collect` simula a coleta e `npm run storage:collect -- --apply` remove arquivos cujo prazo venceu e que continuam sem referência. O cache offline fica no IndexedDB por conta.

**Teste isolado:** inicie o Supabase local em uma pasta independente com a CLI e Docker. Use o endereço local mostrado em `supabase status` e a mesma conexão direta em `DATABASE_URL` e `DIRECT_URL`. Configure o segredo JWT local em `SUPABASE_REALTIME_LOCAL_JWT_SECRET`. Aplique `npx prisma migrate deploy` e inicie o app. Para os testes Playwright de sincronização, defina `TEST_DATABASE_URL` com a conexão do banco descartável. Habilite `TEST_REALTIME=1` para testar a entrega ao vivo. Para testar arquivos, habilite `TEST_R2=1` e configure `R2_BUCKET_NAME` para um bucket de teste. Mantenha as mesmas variáveis do servidor no processo dos testes.

**Offline:** o service worker de produção guarda páginas visitadas e recursos. Documentos abertos ficam no IndexedDB. Visite a página online após a instalação do worker antes de depender da recarga offline. Primeiro login, download de original ausente e troca de progresso entre dispositivos exigem rede. Leitura offline permanece local e é reenviada ao reconectar; encerrar o processo à força não garante o envio imediato ao outro dispositivo. O cache de navegação é apagado ao voltar ao login online.

Em **Configurações → Dados da biblioteca**, **Limpar dados locais** baixa a cópia da conta e substitui o estado deste navegador. A ação descarta alterações ainda pendentes e remove arquivos offline, que serão baixados conforme necessário.

**Editor:** texto, imagens PNG/JPEG, cor, espessura, opacidade, sublinhado, lápis fino, arraste de objetos e ferramenta para mover a página. Após selecionar um objeto, “Aplicar ao objeto selecionado” atualiza suas propriedades. DOCX é convertido para texto. A busca EPUB percorre todos os capítulos; o conhecimento filtra por intervalo de datas; estatísticas mostram o total acumulado, a meta de hoje e os últimos sete dias. Tempos anteriores à implementação do registro diário permanecem somente no total acumulado.

**PDF Unicode:** notas são renderizadas com as fontes e o fallback do navegador, preservando a aparência de acentos, outros alfabetos e emoji disponíveis no sistema. O conteúdo integral também acompanha o PDF como anexo TXT UTF-8; a imagem da nota não é texto selecionável no PDF. Imagens e capturas permanecem incorporadas.

**Recuperação por e-mail:** configure `MAILTRAP_API_TOKEN`, `MAILTRAP_FROM_EMAIL` (remetente verificado) e `AUTH_URL` (endereço público confiável do app). Opcionalmente, use `MAILTRAP_SANDBOX_ID` para capturar mensagens no sandbox sem enviá-las aos destinatários. O link “Esqueci minha senha” solicita um token com validade de 30 minutos e uso único. A nova senha revoga sessões anteriores. O link usa fragmento e não é registrado nos logs de acesso.

**Recuperação administrativa:** no servidor confiável, execute `node scripts/reset-password.mjs EMAIL ARQUIVO_PRIVADO_COM_NOVA_SENHA`. Apague o arquivo privado após usar. Esse comando também revoga sessões anteriores.

Um envio real de recuperação foi autorizado e aceito pelo Mailtrap em 15/11/2026. O link deste ambiente usa `http://localhost:3000`; em produção, altere `AUTH_URL` para o endereço público. A aceitação pela API não comprova a chegada à caixa de entrada.

Veja TASKS.md para evoluções e limites ainda abertos.

## Verificação

### Build na Vercel

Use `npm run build` como Build Command. O script regenera o Prisma Client antes do Next.js, mesmo quando a Vercel reutiliza o cache de dependências, e copia o worker PDF para `public`. O `postinstall` também prepara ambos em instalações novas. Não configure `next build` diretamente, pois isso pula a geração. Aplicar migrações (`npx prisma migrate deploy`) é uma etapa separada da geração do cliente.

```sh
npm run typecheck
npm test
npm run build
```

Com o servidor local em execução, os testes de navegador usam Chromium:

```sh
npx playwright install chromium
npm run test:e2e
```

Para reutilizar um navegador instalado, defina `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH` com seu caminho. Os testes precisam de um `.env` local com `AUTH_SECRET` e criam somente sessões efêmeras para o navegador de teste, sem cadastrar usuários no Supabase. Verificam organização, quatro formatos, persistência após recarregar, notas, marcadores, desenho, exportação e proteção de rotas.

## Estrutura

A interface usa Mantine para campos, selects nativos, checkboxes, botões, menus e modais. O tema está em `src/components/ui/provider.tsx` e as adaptações visuais em `controls.css`. Os componentes de formulário compartilhados ficam em `controls.tsx`; preservam os contratos de eventos e referências dos fluxos existentes. O claro/escuro acompanha a preferência da biblioteca.

`src/modules/` agrupa biblioteca, documentos, leitor, conhecimento, autenticação e preferências. `src/infrastructure/` contém IndexedDB, Prisma e R2. A camada de anotação usa coordenadas normalizadas e permanece separada do arquivo original. O modelo de localização diferencia PDF, CFI de EPUB e blocos de texto.

## Referências técnicas

[Supabase com Prisma](https://supabase.com/docs/guides/database/prisma), [NextAuth / Auth.js](https://authjs.dev/getting-started/installation) e [PDF.js](https://mozilla.github.io/pdf.js/examples/).

## Cadastro por convite

Aplique `npx prisma migrate deploy` no banco vazio para instalar as tabelas da biblioteca e de cadastro por convite. A conta indicada por `Installation.ownerId` administra convites; essa permissão é conferida no servidor, sem confiar em dados enviados pelo navegador.

Os links usam `/register#TOKEN`, evitando registrar o segredo na URL enviada ao servidor. O banco guarda somente SHA-256 do token aleatório de 256 bits. O token completo aparece apenas ao gerar o convite; copie-o antes de sair da tela. O cadastro confirma e consome o convite dentro da transação que cria a conta. O envio de e-mail automático não faz parte deste fluxo.

A validação automatizada de convites usa banco simulado para as regras transacionais e respostas simuladas nos testes de interface; os testes de acesso não autorizado consultam apenas a instalação existente. A migração e os cenários de aceitação concorrente/rollback devem ser validados em PostgreSQL isolado antes de publicar; nenhum cadastro ou convite real foi criado durante esses testes.

## Versões e novidades

A versão do aplicativo vem de `package.json`; Configurações exibe o mesmo número e oferece **Ver novidades**, que abre o histórico em um modal. O histórico fica em `src/shared/release-notes.json`, com as versões mais recentes primeiro. `0.2.0` inicia esse registro; versões anteriores não têm notas reconstruídas.

Para preparar uma versão, use `npm version patch --no-git-tag-version` para correções, `minor` para funcionalidades compatíveis ou `major` para mudanças incompatíveis. O comando atualiza `package.json` e `package-lock.json`. Acrescente uma entrada no início do histórico com esse número, a data real do lançamento e as mudanças para quem usa o aplicativo. Preserve as entradas anteriores. `npm test` confere se a versão atual tem notas e se os números dos dois arquivos coincidem. A versão exibida muda quando o aplicativo atualizado é compilado e publicado; esse preparo não cria tags nem publica automaticamente.
