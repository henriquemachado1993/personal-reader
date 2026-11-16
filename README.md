# Le-Books

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

**Acervo e leitura:** originais privados no R2 e biblioteca no Supabase via Prisma. IndexedDB funciona como cache por conta. Sincroniza ao abrir, voltar à aba, recuperar rede, em até 750 ms após alterações locais e a cada 15 segundos. Ao ocultar ou sair da página, envia também uma atualização compacta da posição com `keepalive`.

A tabela LibraryReplica mantém o envelope atômico da sincronização. LibraryEntity registra versões por entidade e tombstones de exclusão; as tabelas de documentos, coleções, progresso, notas, destaques e marcações são atualizadas na mesma transação. IDs legados têm projeção UUID determinística por conta. Operações têm UUID e recibos persistentes em LibraryEntity (`sync-operation`); uma resposta perdida pode ser reconhecida mesmo após outro dispositivo escrever. Estado local e base de sincronização são confirmados juntos no IndexedDB. Alterações feitas durante requisições são conciliadas sem descartar alterações remotas. Exclusões de livros e coleções são respeitadas mesmo por dispositivos sem base local. Página, porcentagem e localização formam uma posição indivisível, com `readingPositionUpdatedAt`; a mais recente prevalece, inclusive em retornos de página. Abrir o leitor não altera esse relógio. Alterações independentes são conciliadas; conflitos incompatíveis em metadados, notas ou preferências exigem escolha em Configurações, com backup JSON. Limites atuais: 25 MB para metadados, capas e anotações; 100 MB por original.

Para projetar bibliotecas anteriores, execute `npm run db:project` (já executado neste ambiente). Exclusões entram numa fila com sete dias de retenção. `npm run storage:collect` apenas simula a coleta; `npm run storage:collect -- --apply` remove candidatos vencidos após conferir novamente as referências com o mesmo lock usado na sincronização. Agende esse comando no servidor conforme sua política de retenção; nenhuma tarefa automática foi instalada na máquina. Bibliotecas ausentes ou malformadas protegem o original contra exclusão.

**Transferência de originais na Vercel:** upload e download usam URLs assinadas do R2, válidas por cinco minutos, para evitar o limite de 4,5 MB das funções. `POST /api/library/files/:id` autoriza o upload com base na sessão e recebe apenas `{ size }`; o navegador envia os bytes diretamente ao R2. `GET` autentica a conta e redireciona para o download privado. Originais existentes são reutilizados, sem sobrescrita. O `PUT` antigo permanece para compatibilidade com clientes anteriores e continua sujeito ao limite da plataforma.

Para usar transferências pelo navegador, configure CORS nas configurações do bucket R2 com [docs/storage-cors.json](docs/storage-cors.json). Preserve regras existentes necessárias a outros serviços. Ajuste os domínios caso use outra URL ou previews; evite liberar qualquer origem. São necessários `GET`, `PUT`, `HEAD` e os cabeçalhos `Content-Type` e `If-None-Match`. Credenciais com acesso somente a objetos podem não ter permissão para consultar/alterar CORS; nesse caso, use o painel Cloudflare com acesso administrativo. Após publicar, sincronize no dispositivo com o original e abra o livro em outro navegador para confirmar upload, download e CORS reais.

Bibliotecas cujo envelope excede 4 MB enviam o snapshot diretamente ao R2 por URL assinada (`POST /api/library/snapshots/:operationId`) e submetem apenas a referência à API. O servidor confere a conta, valida o conteúdo e aplica o mesmo controle de revisão. Respostas de biblioteca usam streaming. O limite de metadados permanece 25 MB. Transferências temporárias são removidas ao concluir a requisição; uploads abandonados podem ser coletados após sete dias com `npm run storage:collect -- --apply`. A coleta usa apenas o prefixo reservado `sync-snapshots/` e preserva originais. Uma falha de upload de original deixa o arquivo pendente, sem bloquear o progresso e os metadados.

**Offline:** o service worker de produção guarda páginas visitadas e recursos. Documentos abertos ficam no IndexedDB. Visite a página online após a instalação do worker antes de depender da recarga offline. Primeiro login, download de original ausente e troca de progresso entre dispositivos exigem rede. Leitura offline permanece local e é reenviada ao reconectar; encerrar o processo à força não garante o envio imediato ao outro dispositivo. O cache de navegação é apagado ao voltar ao login online.

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
