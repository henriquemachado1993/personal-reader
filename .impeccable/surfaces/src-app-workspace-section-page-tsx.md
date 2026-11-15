---
version: 1
slug: "src-app-workspace-section-page-tsx"
primary_target: "src/app/(workspace)/[[...section]]/page.tsx"
related_targets: ["src/modules/reader/reader.tsx","src/modules/knowledge/knowledge.tsx"]
---

# Biblioteca, leitor e conhecimento

Modo: Operate na biblioteca e conhecimento; Read no documento. Usuário individual em desktop, tablet e telefone. PRODUCT.md permanece a autoridade de produto, confirmado em 15/11/2026. Construção direta em código escolhida pelo usuário.

## Direction contract

THESIS: uma estante pessoal na qual retomar um livro exige um clique; o conteúdo ocupa a maior parte da tela.

OWN-WORLD: Apple Books, explicitamente fixado no brief e nas dez referências. Em 15/11 o usuário rejeitou a primeira interpretação com sidebar e bege. A direção corrigida usa branco neutro, preto, cinza claro, Georgia em negrito nos títulos e navegação flutuante superior em cápsula.

STORY: localizar um documento, retomar a leitura, guardar uma ideia e reencontrá-la com sua origem.

FIRST VIEWPORT: navegação em cápsula central com Início, Biblioteca e Conhecimento; menus circulares à direita, título serifado grande, Continuar em blocos horizontais com capa e metadados; Quero Ler em estante aberta. Biblioteca separada com lista ampla, busca e alternância de visualização. No telefone, navegação compacta, duas capas por linha e Continuar com rolagem horizontal. Signature: os controles flutuam e o conteúdo permanece aberto, como nas imagens; ao abrir, o livro ocupa uma página branca central entre controles arredondados.

FORM: direção Apple Books fixada pelo usuário prevalece sobre o seed 6fa01c76. O serviço de sorteio não estava acessível; sem challengers ou boards. Sem alterar decisões visuais já fornecidas. Movimento funcional de 180ms, com reduced-motion respeitado.

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance

## Refinamento do leitor — 15/11/2026

As referências IMG_0111.PNG e IMG_0112.PNG fixam os estados: um toque esconde menus e outro restaura sem mover a página; a paleta abre apenas pelo pincel; rótulos extras gerados pelo aplicativo não aparecem sobre o conteúdo; uma faixa de miniaturas navega pelas páginas, com contador legível no alto. Preservar seleção de texto, desenho, marcadores, exportação e conteúdo original do PDF. EPUB mantém CFI e percentual real em vez de miniaturas inventadas.
