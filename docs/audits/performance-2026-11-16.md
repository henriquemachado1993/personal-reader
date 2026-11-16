# Auditoria de performance — 16/11/2026

## Escopo e limites

Inspeção do código atual, dos artefatos locais de produção e reprodução isolada de foco de inputs no Chrome via Playwright. Nenhum código de execução foi alterado. O objetivo é reduzir custo preservando interface, resultados, persistência, funcionamento offline e sincronização. Bugs ficam separados para decisão posterior.

Não foram medidos LCP, INP, FPS ou heap da aplicação autenticada em produção. Os achados de complexidade são verificáveis no código; sua contribuição para a latência real ainda precisa de perfilamento. Tamanhos abaixo pertencem ao build local existente, não a um novo build nem a bytes efetivamente transferidos por uma rota.

## Prioridades

| Prioridade | Ponto                                        | Evidência                                                                                             | Otimização compatível com o comportamento atual                                                                                                                                   |
| ---------- | -------------------------------------------- | ----------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Alta       | Persistência integral a cada alteração       | `src/modules/library/store.ts`, função `persist`; `src/infrastructure/storage/local.ts`, `writeState` | Reutilizar conexão IndexedDB por usuário e eliminar a clonagem explícita redundante após verificar isolamento e testes. Medir a fila antes de considerar coalescência.            |
| Alta       | Projeção no banco com consultas por entidade | `src/modules/library/entity-persistence.ts`, `persistLibraryEntities`                                 | Buscar entidades existentes em lote, indexar por ID e escrever apenas diferenças, preservando transação, versões, tombstones e idempotência.                                      |
| Alta       | Memória acumulada em PDFs longos             | `src/modules/reader/pdf-page.tsx`, efeito de renderização; `reader.tsx`, lista de páginas             | Descartar canvas/text layer distantes com janela limitada e reconstituição fiel; preservar altura, seleção, anotações, busca, exportação e posição. Exige testes antes de adotar. |
| Alta       | Renderização ampla por alterações globais    | `reader.tsx:106`, `workspace.tsx:37` e demais consumidores de `useLibrary()`                          | Seletores por fatia, índices memoizados e isolamento da camada de desenho. Preservar atualizações necessárias, evitando seletores que recriem objetos sem igualdade estável.      |
| Média      | Busca PDF relê texto por consulta            | `src/modules/reader/pdf-page.tsx`, atribuição de `searchRef.current`                                  | Cache limitado de texto normalizado por documento/página; manter busca circular e o resultado atual.                                                                              |
| Média      | Telas secundárias importadas pelo workspace  | `src/components/layout/workspace.tsx`, imports de Settings, Knowledge e ImportDialog                  | Avaliar divisão de código de telas e diálogo, preservando foco, estado e feedback de carregamento. Confirmar grafo e waterfall antes de estimar ganho.                            |
| Média      | Repetição de filtros e ordenações            | `src/modules/library/library.tsx`, `visible` e `reading`; `reader.tsx`, filtros por página            | Memorizar cálculos pelas dependências reais e agrupar anotações por documento/página. Não introduzir debounce que atrase a busca.                                                 |

## Detalhamento

### 1. IndexedDB e snapshots

Cada atualização do documento, anotação, preferência ou tempo de leitura enfileira um snapshot completo. A mudança de página chama `updateDocument`; o cronômetro persiste a cada 10 segundos de leitura. O snapshot inclui capas, conteúdo textual e imagens de anotações. `writeState` executa `structuredClone` antes de `IDBObjectStore.put`, que já precisa serializar o valor. Além disso, `db()` chama `openDB` em cada operação, sem reutilização ou fechamento explícito da conexão.

O custo cresce com a biblioteca inteira, mesmo quando só muda a página de um livro. A fila preserva todas as gravações intermediárias. Não se recomenda simplesmente adicionar debounce: isso alteraria a garantia atual de salvamento. Primeiro medir tempo de clonagem, duração das transações e profundidade da fila com bibliotecas representativas. Reutilizar conexão deve respeitar troca de usuário, falha de abertura e `versionchange`.

### 2. Banco e sincronização

A projeção consulta `libraryEntity.findUnique` sequencialmente para cada documento, coleção, anotação e marcador, mesmo quando quase tudo permanece igual. Para E entidades há ao menos E consultas de existência antes das demais escritas/projeções. Comparações de documentos usam `find` e filtros sobre todas as anotações e marcadores; remoções usam `some` por item. Há oportunidades de substituir buscas repetidas por Maps/Sets sem mudar resultados.

`LibraryIdentity` sincroniza ao montar, a cada 15 segundos e em foco/reconexão. Cada rodada lê o snapshot remoto integral; há várias serializações JSON no cliente. Preservar inicialmente esses gatilhos e o protocolo; otimizar comparações e projeções internas antes de propor deltas, ETags ou mudança de frequência.

### 3. PDF: renderização adiada, retenção sem limite por distância

A implementação já compartilha o documento PDF e usa IntersectionObserver com margem de 1000 px. Porém, monta um `PdfPage` por página: cada um tem efeitos, estado e observers. Ao sair da região visível, o trabalho ativo é cancelado, mas os pixels do canvas e os nós da camada de texto já criados permanecem até desmontar a página. Percorrer o livro pode acumular páginas rasterizadas.

Estimativa teórica: um canvas de 760 px de largura CSS, razão de altura √2 e DPR 2 ocupa aproximadamente 12,5 MiB só de pixels RGBA. Cem canvases nesse tamanho equivalem a aproximadamente 1,22 GiB antes de text layers e recursos internos. Não é uma medição de heap; o tamanho real depende do documento, viewport e navegador.

A janela de descarte deve ser avaliada antes da virtualização integral, que tem mais risco para a seleção e a navegação contínua. O rastreamento da página atual já usa requestAnimationFrame e busca binária: não há motivo para substituí-lo sem perfilamento.

### 4. Store e desenho

Consumidores sem seletor recebem também mudanças de mensagens de sync, cronômetro e outras entidades. O Reader percorre todas as páginas; a camada de desenho chama `onDraft` por movimento. Embora `PdfPage` tenha `memo`, o pai e outras camadas ainda podem trabalhar. Antes de adicionar memo indiscriminadamente, medir commits durante desenho, mudança de página, busca e sincronização. Priorizar índices e fronteiras estáveis de componentes.

### 5. Carga inicial

Inventário do build local: 2.948.574 bytes de JS em todos os chunks somados. Os três maiores arquivos têm 421.827, 411.376 e 245.256 bytes; gzip calculado localmente: 174.969, 120.563 e 72.589 bytes. Isso não significa que todos sejam carregados na entrada. O worker PDF tem aproximadamente 2,1 MiB em disco. O importador já usa imports dinâmicos de PDF.js, JSZip e Mammoth; a exportação PDF já carrega pdf-lib sob demanda. Preservar essas separações.

Todos os estilos gerais e Mantine Dates entram no layout raiz. Mapear CSS por rota antes de dividi-lo, evitando flashes e mudanças de precedência. As capas já têm `loading="lazy"` e `decoding="async"`; otimizar acima da dobra apenas com medição de LCP.

## Bugs e riscos funcionais identificados

1. **Busca PDF sem tratamento de falha ou concorrência** — `reader.tsx`, botão Buscar: o `await pdfSearch.current?.(...)` não tem `try/catch`, bloqueio de duplicação ou controle de requisição vigente. Uma rejeição de `getPage/getTextContent` pode virar rejeição não tratada; duas buscas podem concluir fora de ordem e navegar para resultado antigo. Confirmado pelo fluxo do código; falha ainda não reproduzida com PDF defeituoso. Correção funcional separada da otimização do cache.
2. **Caches offline sem expiração ou limpeza de versões** — `public/sw.js`: cache de assets acumula URLs de chunks com hash entre deploys; `activate` só chama `clients.claim`. Potencial de consumo crescente de armazenamento e pressão sobre o armazenamento local. Não deletar automaticamente o cache atual sem validar abas antigas e offline. A correção exige política de versões testada.
3. **Input: hipótese descartada** — investigada possível referência circular entre variáveis de borda do Mantine. Reprodução isolada com CSS instalado e controles atuais manteve borda de 1 px e variáveis válidas antes/depois do foco. Não foi classificado como bug.

## Sequência recomendada, sem alterar comportamento

1. Registrar baseline de produção com fixtures de 100/1.000 documentos, PDFs de 50/500 páginas e bibliotecas com/sem imagens de anotação.
2. Otimizar projeção no banco e índices em memória. Comparar número de queries e equivalência dos snapshots/projeções.
3. Reutilizar IndexedDB e verificar remoção da cópia redundante. Validar reload imediato, troca de conta, falhas e gravações concorrentes.
4. Aplicar seletores e isolamento de renderização. Comparar commits e latência ao desenhar, buscar e trocar de página.
5. Medir memória após abrir, percorrer e fechar PDF; só então introduzir descarte distante com regressões de rolagem/seleção/zoom/rotação/exportação.
6. Avaliar divisão de código usando waterfall por rota e cargas frias/quentes.

Para cada mudança, comparar o mesmo fixture antes/depois, desktop e viewport móvel, com CPU/rede limitadas. Exigir a mesma saída e comportamento, sem perdas em persistência/offline. Usar traces/long tasks como diagnóstico; métricas de laboratório não equivalem a INP de usuários reais. Não há percentuais de ganho estimados sem baseline.

## Implementação — otimizações internas

- IndexedDB: uma conexão reutilizada por escopo, com invalidação em falha, término inesperado ou atualização de versão. A cópia explícita dos snapshots e a sequência de gravações foram mantidas para preservar isolamento e salvamento.
- Prisma: reutilização do cliente também em produção, evitando criar pools por chamada.
- Projeção: uma consulta em lote das entidades existentes, mapas por ID e agrupamento de anotações/marcadores por documento. Transação, versões, exclusões e projeção normalizada preservadas. O índice é atualizado depois de uma escrita para manter o comportamento também quando há IDs repetidos na entrada.
- Leitor/workspace: seletores com comparação rasa evitam renderizações por campos não consumidos; biblioteca observa documentos e coleções separadamente. Anotações e marcadores do livro são calculados apenas quando as dependências mudam.
- Busca PDF: cache de extração compartilhado por documento, limitado a 128 páginas; consultas concorrentes reaproveitam extrações em andamento. Falhas são removidas do cache para permitir nova tentativa. Ordem circular e normalização permanecem iguais.

Evidências de custo: teste com 1.000 documentos inalterados usa uma consulta de leitura de entidades e nenhuma escrita. Antes havia uma consulta de existência por entidade. No fixture de busca, três consultas que exigiam oito extrações passam a usar três extrações. Esses números não representam ganho percentual de latência de usuários.

O teste de integração existente foi adaptado à porta configurada e passou a declarar explicitamente seus oito documentos, mantendo as verificações originais de contagem, versões e tombstones; a fixture compartilhada atual contém três documentos.

Descarte de canvases, virtualização, divisão de telas e mudança do protocolo/cache offline não foram aplicados nesta etapa: ainda precisam de baseline e validação específica de seleção, foco, navegação e offline para respeitar a exigência de não alterar o comportamento. Os bugs funcionais continuam registrados, sem mudança nesta implementação.

Validação final: 31 testes unitários e 26 cenários E2E distintos aprovados (24 de leitura/estatísticas, 1 de IndexedDB e 1 de projeção com banco real). Build de produção e TypeScript aprovados. A suíte de leitura inclui iPhone/iPad, rotação, desenho, seleção e navegação em PDF de 503 páginas.

## Correção dos bugs funcionais

A busca PDF agora captura rejeições e publica somente o resultado da solicitação vigente. Nova busca, edição da consulta, fechamento e desmontagem invalidam respostas anteriores, incluindo mensagens de erro. Se o PDF ainda não está pronto, o leitor informa que o usuário pode tentar novamente. As extrações compartilhadas continuam disponíveis no cache; resultados antigos não provocam navegação.

O registro do service worker recebe uma versão pública criada no build. A atualização aguarda o encerramento das abas anteriores (sem `skipWaiting`). Ao ativar, remove caches do leitor anteriores à geração de fallback, preserva caches de outros aplicativos e mantém a geração imediatamente anterior para acesso offline. Chunks imutáveis reutilizados são copiados para o cache atual, evitando perdê-los na atualização seguinte. Assets estáveis ausentes do cache atual tentam a rede antes do fallback. O redirecionamento para login limpa os caches HTML de todas as gerações. IndexedDB e originais dos documentos não são removidos.

Validação desta correção: 39 testes unitários aprovados, incluindo oito regressões novas de concorrência/erros e ciclo dos caches. Cinco cenários de navegador aprovados: atualização real de três versões com abas abertas e fallback offline (inclusive chunks compartilhados), e quatro fluxos PDF de iPhone/iPad, rotação, controles e navegação distante em 503 páginas. TypeScript e build de produção aprovados. O teste de ciclo dos workers usa um servidor local isolado para controlar versões e estado de rede.

## Limpeza manual e tamanho do cache

Configurações → Dados da biblioteca inclui tamanho aproximado e ação “Limpar cache”. A medição soma corpos das respostas apenas em caches `reader-shell-*` e `reader-assets-*`, uma resposta por vez; não usa Content-Length comprimido e não inclui overhead interno do navegador. A medição é cancelável e não substitui uma medição mais recente. O valor é atualizado após a limpeza; falhas mostram tamanho indisponível em vez de um zero incorreto.

A ação preserva IndexedDB, originais, preferências e dados sincronizados, não desregistra o worker e não recarrega a página. Mostra progresso, sucesso ou erro recuperável e esclarece a necessidade de reabrir algumas páginas online. O uso total do dispositivo é atualizado separadamente. CacheStorage de outros aplicativos permanece intacto. Novas requisições do aplicativo podem repovoar o cache naturalmente.

Durante o trabalho foi relatado reload contínuo no desenvolvimento; o usuário informou que reiniciar o servidor resolveu. A versão aleatória da configuração foi limitada a produção, mantendo “development” estável em reavaliações do Next. A causa exata do episódio não foi comprovada. Teste de navegador confirmou estabilidade em repouso durante oito segundos, e testes de configuração protegem a versão estável.

Validação: 46 testes unitários, três E2E de limpeza/tamanho/preservação/recuperação em desktop e celular e um E2E de estabilidade aprovados. Build e TypeScript aprovados. Capturas em `.impeccable/review/settings/cache-*.png`.
