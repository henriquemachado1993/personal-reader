# Personal Reader

Biblioteca pessoal em Next.js, com direção visual baseada nas referências do Apple Books fornecidas em `docs/design/images-reference/`. A especificação está em [docs/PRODUCT.md](docs/PRODUCT.md).

## Executar

Requer Node.js 20.9 ou superior e um PostgreSQL do Supabase acessível.

```sh
npm ci
```

Copie `.env.example` para `.env` e configure as URLs do Supabase e `AUTH_SECRET`. As senhas na URL precisam de percent-encoding se contiverem caracteres reservados. Use a URL do transaction pooler para `DATABASE_URL` e a do session pooler para `DIRECT_URL`. Copie o host exato mostrado em Connect no seu projeto Supabase.

```sh
npm run db:generate
npx prisma migrate deploy
npm run dev
```

Abra http://localhost:3000. O primeiro acesso permite criar a conta proprietária. Novos cadastros ficam bloqueados após essa criação. NextAuth usa e-mail/senha, JWT em cookie HttpOnly e hashes bcrypt com custo 12. As tabelas ficam no schema `reader`, separado de `public`. Não exponha o schema `reader` pela Data API do Supabase.

O `.env` é ignorado pelo controle de versão. Nunca use variáveis `NEXT_PUBLIC_*` para as credenciais do banco, R2 ou `AUTH_SECRET`.

## O que funciona nesta entrega

- Início, biblioteca em lista/grade, busca, filtros, ordenação e coleções.
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

**Acervo e leitura:** originais privados no R2 e biblioteca no Supabase via Prisma. IndexedDB funciona como cache por conta. Sincroniza ao abrir, voltar à aba, recuperar rede e a cada 15 segundos.

A tabela LibraryReplica guarda uma réplica JSONB com revisão atômica por conta. As tabelas normalizadas permanecem para evolução. Limites: 25 MB para metadados, capas e anotações; 100 MB por original. Operações têm UUID, reenvio idempotente e comparação de versão. Conflitos exigem escolha em Configurações, com backup JSON antes da escolha. Exclusões saem da réplica; originais imutáveis ficam retidos no bucket para recuperação.

**Offline:** o service worker de produção guarda páginas visitadas e recursos. Documentos abertos ficam no IndexedDB. Visite a página online após a instalação do worker antes de depender da recarga offline. Primeiro login e download exigem rede. O cache de navegação é apagado ao voltar ao login online.

**Editor:** texto, imagens PNG/JPEG, cor, espessura e opacidade; exportação de imagens e capturas com marcações. DOCX é convertido para texto. A busca EPUB atua no capítulo exibido; estatísticas mostram tempo acumulado.

**Recuperação por e-mail:** configure `MAILTRAP_API_TOKEN`, `MAILTRAP_FROM_EMAIL` (remetente verificado) e `AUTH_URL` (endereço público confiável do app). Opcionalmente, use `MAILTRAP_SANDBOX_ID` para capturar mensagens no sandbox sem enviá-las aos destinatários. O link “Esqueci minha senha” solicita um token com validade de 30 minutos e uso único. A nova senha revoga sessões anteriores. O link usa fragmento e não é registrado nos logs de acesso.

**Recuperação administrativa:** no servidor confiável, execute `node scripts/reset-password.mjs EMAIL ARQUIVO_PRIVADO_COM_NOVA_SENHA`. Apague o arquivo privado após usar. Esse comando também revoga sessões anteriores.

Veja TASKS.md para evoluções e limites ainda abertos.

## Verificação

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

`src/modules/` agrupa biblioteca, documentos, leitor, conhecimento, autenticação e preferências. `src/infrastructure/` contém IndexedDB, Prisma e R2. A camada de anotação usa coordenadas normalizadas e permanece separada do arquivo original. O modelo de localização diferencia PDF, CFI de EPUB e blocos de texto.

## Referências técnicas

[Supabase com Prisma](https://supabase.com/docs/guides/database/prisma), [NextAuth / Auth.js](https://authjs.dev/getting-started/installation) e [PDF.js](https://mozilla.github.io/pdf.js/examples/).
