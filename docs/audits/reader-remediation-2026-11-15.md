# Correções e polish do leitor — 15/11/2026

Implementação dos cinco problemas da [auditoria do leitor](reader-2026-11-15.md), após o checkpoint `0fbf711`. O relatório original permanece como registro da situação anterior. Esta entrega inclui a investigação da pausa ao trocar de página e o polish solicitado, preservando as referências visuais.

## Problemas resolvidos

| Item | Correção | Evidência |
|---|---|---|
| R01 — fonte móvel fixa | Removida a regra de 17px que anulava a preferência | Texto calculado passa de 19px para 20px nos quatro tamanhos |
| R02 — progresso EPUB em zero | Índice de posições gerado em segundo plano; progresso calculado pelo CFI | Avanço dentro do capítulo, busca em outro capítulo e retomada após recarga testados; EPUB de inspeção avançou de 0% para 13% |
| R03 — contraste das notas | Rótulo usa a cor semântica de texto; a cor escolhida fica em um marcador | Contraste de 18,23:1 no claro e 14,24:1 no escuro, calculado a partir das cores renderizadas |
| R04 — paleta cortada | Grupo permite quebra e separa entrada de cor e amostras no celular | `scrollWidth` igual a `clientWidth`: 364px em 390px e 294px em 320px; cinco cores dentro da barra |
| R05 — capítulo atrás dos controles | Navegação e retomada preservam o espaço superior do leitor | Título começa em y=188 no desktop, y=148 no tablet e y=180 no celular; teste compara título e cabeçalho |

## Troca de página e editor

O efeito que rasterizava o PDF dependia do callback do canvas ativo. Trocar de página alterava esse callback e reiniciava desenhos já concluídos. A seleção do canvas foi separada da rasterização; páginas prontas são reaproveitadas enquanto documento, página e largura permanecem iguais. O observador usa o contêiner de rolagem do leitor para preparar páginas próximas.

O teste de regressão monitora alterações nos atributos `width` e `height` dos canvases de duas páginas já renderizadas: **8 reinicializações antes, 0 depois**. Isso comprova a remoção desse trabalho redundante, sem estabelecer um ganho percentual de latência. O teste também verifica que a área de anotações acompanha a altura real de um PDF 600×800, sem impor proporção A4.

A atualização do contador por rolagem foi limitada a uma execução por frame e usa busca binária nas páginas. O teste unitário identifica a página final de uma lista de 2.048 itens com no máximo 12 medições.

Uma regressão adicional do editor foi reproduzida: arrastar texto SVG também selecionava suas letras e abria as ações de seleção sobre as ferramentas. O gesto agora impede essa seleção nativa. O teste cobre mover, apagar, desfazer e ausência do menu indevido.

## Polish e verificação

- Barra de ferramentas limitada a 760px no desktop, respeitando áreas seguras.
- Entrada de cor em uma linha e cinco amostras alinhadas na linha seguinte no celular.
- Sliders com área de interação de 44px e nome acessível no polegar.
- Texto das notas com 14px e rótulos com 12px, mantendo as famílias existentes.
- Zoom interno respeitado também em telas menores, com rolagem horizontal quando necessário.
- Títulos das abas definidos pelos metadados da rota; elimina a disputa com o título escrito no cliente, observada no build de produção.

Inspeção visual em Chromium: 1440×1000, 820×1100, 390×844 e 320×740; aparência, notas, paleta, temas papel/noturno e interface escura. Rolagem por toque sintetizado confirmou movimento nos três tamanhos móveis. Nenhum erro JavaScript foi capturado nessa rodada. Evidências locais ignoradas pelo Git: `.impeccable/review/reader-polish/`.

Detector Impeccable sobre `src/modules/reader`: nenhum achado principal e um aviso de tipografia. O tamanho de 2,8px em `reader-controls.css` pertence à reprodução reduzida da página nas miniaturas; foi preservado por representar uma prévia visual, não o texto de leitura.

Validação automatizada:

- 21 testes unitários aprovados.
- 26 cenários E2E distintos aprovados em produção: 25 na rodada principal; o cenário de título da página inicial passou após sua correção e novo build. Cobertura inclui TXT, DOCX, PDF, EPUB, exportação, anotações, toque, teclado, controles Mantine, modais e recarga offline.
- `npx next build` aprovado com verificação TypeScript. Prisma Client já gerado neste ambiente; o comando de deploy continua sendo `npm run build`.

## Limites

Esta confirmação cobre as correções e o polish, sem atribuir uma nova nota de auditoria geral. Não houve teste em aparelhos físicos, Safari/WebKit ou leitor de tela. O PDF de 60 páginas ainda mantém os elementos de todas as páginas montados; virtualização e medição de memória com documentos muito grandes continuam sendo oportunidades de investigação. Desempenho com acervo grande não foi medido. Os dados usados ficaram isolados no navegador e a sincronização foi interceptada nos testes.
