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

**Acervo e leitura:** nesta entrega, arquivos, progresso, coleções, marcadores e anotações são salvos em IndexedDB no navegador, separados pelo ID da conta. Limpar os dados do site remove esse acervo local. Configurações permite exportar metadados e anotações; esse JSON não inclui os arquivos originais.

**Ainda pendente:** integração da biblioteca e da fila de sincronização com as tabelas remotas, upload/download do acervo pelo R2, cache do shell para abrir o app sem rede, recuperação de senha e ferramentas avançadas do editor (texto livre, imagens, espessura e opacidade). O cliente R2 e as variáveis estão preparados; definir credenciais não ativa sincronização automaticamente.

PDFs são renderizados sob demanda, uma página de cada vez. A exportação preserva o original, mas atualmente incorpora notas como texto e não inclui clippings como novas imagens no PDF. DOCX é convertido para texto legível; não reproduz layout Word. A busca EPUB usa a página exibida. O tempo mostrado é acumulado neste navegador, sem afirmar estatísticas diárias que ainda não são registradas.

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
