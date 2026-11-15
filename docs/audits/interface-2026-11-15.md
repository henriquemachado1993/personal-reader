# Auditoria técnica da interface — 15/11/2026

## Veredito de integridade

**Aprovado com pendências.** O sistema visual continua específico do Personal Reader: estantes abertas, títulos serifados, navegação em cápsula e leitor discreto. Menus Mantine mantêm a variante de cabeçalho de 330px e cantos de 28px. Há falhas verificadas de interação, acessibilidade e comunicação de estado; nenhuma alteração de interface foi feita nesta auditoria.

## Resumo

**12/20 — Aceitável; exige correções antes de considerar a interface concluída.**

| Dimensão | Nota | Evidência principal |
|---|---:|---|
| Acessibilidade | 2/4 | Estado selecionado ausente em filtros/cores e título sem contraste no leitor escuro |
| Desempenho | 3/4 | Capas e capturas sem carregamento adiado; sem medição de produção nesta rodada |
| Responsividade | 2/4 | Navegação deixa “Mais opções” fora da área útil em 320px; controles do leitor pequenos |
| Temas | 2/4 | Tema do chrome escuro usa texto claro sobre a área clara do leitor |
| Integridade da implementação | 3/4 | Identidade coerente; desfazer e estado de sincronização não correspondem ao comportamento anunciado |
| **Total** | **12/20** | **0 P0, 4 P1, 5 P2, 0 P3** |

## Cobertura e método

- 87 capturas de estado no DOM: 20 rotas autenticadas em 1440×1000, 820×1180 e 390×844; seis rotas representativas também no tema escuro; login, recuperação e redefinição de senha nas três larguras.
- Rotas: início, biblioteca, lendo, quero ler, concluídos, recentes, coleções, duas coleções preenchidas, coleção ausente, conhecimento, notas, destaques, capturas, histórico, estatísticas, configurações, duas amostras no leitor e documento ausente.
- 27 inspeções adicionais: menu do cabeçalho, menu de livro, modais de importação/renomeação/nota, conhecimento preenchido, páginas/marcadores, aparência, notas laterais e ferramentas de anotação. Notas laterais do cabeçalho não aparecem no celular por decisão existente; o acesso alternativo permanece no painel.
- Teste adicional em 320×740: botão do menu fora da largura física e clique bloqueado por sobreposição. O teste de interação não foi forçado; os estados seguintes de menus nessa largura não puderam ser concluídos.
- Chromium com viewport emulado e capacidade de toque em tablet/celular; não houve uso de aparelho físico. Esta rodada não sintetizou desenho/arraste contínuo nem validou Safari/Firefox.
- Árvore de acessibilidade do Chromium nas ferramentas: nenhum controle sem nome acessível nos estados capturados. Isso não equivale a certificação WCAG nem substitui avaliação com leitor de tela.
- Os testes existentes de hidratação e integração Mantine passaram: menu, Escape, contenção de foco no modal, tema e persistência após recarga, em desktop/celular.
- Sessão efêmera, acervo de demonstração e interceptação de `/api/library` com 503 para impedir alterações no acervo remoto. Esses 503 são artefatos intencionais do isolamento, não falhas do produto. Fora deles não houve erros JavaScript nas três larguras concluídas.
- Detector executado uma vez. Evidências locais ignoradas pelo Git: `.impeccable/review/audit-2026-11-15/` (JSON, scripts e screenshots).

Não foram exercitados envio de e-mail real, cadastro inicial de proprietário, conflitos remotos reais, todos os formatos importados, bibliotecas grandes ou cache offline de produção nesta rodada. A aplicação foi inspecionada em desenvolvimento; não há nota Lighthouse ou comparação de bundle de produção aqui.

## Achados prioritários

### A01 — [P1] Menu principal não alcançável por toque em 320px

- **Localização:** `src/app/globals.css:2872`, `:2904`, `:3391` — navegação e ações do cabeçalho.
- **Categoria:** Responsividade / acessibilidade.
- **Evidência:** com viewport físico de 320px, a navegação vai de x=15 a x≈304; o botão “Mais opções” começa em x≈312 e termina em x≈356. O screenshot corta a ação. O clique normal do Playwright não consegue abrir o menu porque a navegação/cabeçalho intercepta o ponto após tentar trazer a ação à vista.
- **Impacto:** configurações, histórico e outras ações dependentes desse menu deixam de ser acessíveis por toque nessa largura. O título “Todos os livros” também quebra em três linhas e os controles de visualização ficam parcialmente fora da área útil.
- **Padrão:** WCAG 1.4.10, reflow a 320 CSS px.
- **Recomendação:** reservar explicitamente espaço para a ação, permitir outra disposição da navegação em larguras estreitas e testar a largura física/visual, não apenas `scrollWidth <= innerWidth`. Em emulação móvel, `innerWidth` pode crescer com o conteúdo e esconder esse erro no teste.
- **Comando:** `$impeccable adapt`.

### A02 — [P1] Título do livro perde contraste com tema escuro

- **Localização:** `src/app/globals.css:3172`; `src/modules/reader/reader-controls.css:24`.
- **Categoria:** Temas / acessibilidade.
- **Evidência:** o título central usa aproximadamente `#f5f5f5` sobre o fundo `#f6f6f6` quando o tema da biblioteca é escuro e a página continua clara. Contraste ≈1,01:1; fonte 18px no desktop/tablet. Verificado pelo estilo computado e screenshot.
- **Impacto:** o nome do livro fica praticamente invisível no chrome central do leitor.
- **Padrão:** WCAG 1.4.3, mínimo 4,5:1 para esse texto.
- **Recomendação:** definir uma superfície atrás do título ou vincular sua cor ao fundo efetivo do leitor. Verificar a matriz tema da biblioteca × tema da página.
- **Comando:** `$impeccable harden`.

### A03 — [P1] “Desfazer” remove a anotação após uma edição

- **Localização:** `src/modules/reader/reader.tsx:241`, `:247`, `:849`, `:850`, `:1032`.
- **Categoria:** Integridade da implementação.
- **Evidência de código:** o comando remove a última anotação do documento e a coloca em redo. Movimento e aplicação de propriedades substituem a anotação diretamente via `addAnnotation`, sem guardar o estado anterior. A borracha chama `removeAnnotation` diretamente; quando apaga a última anotação, o botão de desfazer fica desabilitado.
- **Impacto:** depois de mover/editar um objeto, o usuário espera restaurar sua posição/propriedade, mas pode apagar a anotação. A exclusão pela borracha não pode ser recuperada por esse histórico.
- **Padrão:** correspondência entre o comando de edição apresentado e a ação executada; reversibilidade de operações no editor.
- **Recomendação:** histórico de comandos com estado anterior/posterior para criar, editar, mover e apagar; undo/redo deve operar sobre esse histórico. Regressões específicas para os quatro tipos de ação.
- **Comando:** `$impeccable harden`.

### A04 — [P1] Filtros e cores selecionados não expõem estado acessível

- **Localização:** `src/modules/knowledge/knowledge.tsx:117`, `:138`; `src/modules/reader/reader.tsx:1063`.
- **Categoria:** Acessibilidade.
- **Evidência:** os filtros Tudo/Destaques/Anotações/Capturas e os swatches usam classe `active`, sem `aria-pressed`, `aria-checked` ou seleção equivalente. As cores têm nomes em hexadecimal, sem indicação de qual está ativa. A presença de nomes acessíveis não comunica o estado selecionado.
- **Impacto:** quem navega por leitor de tela não recebe a mesma informação visual sobre filtro/cor ativos.
- **Padrão:** WCAG 4.1.2, estados programaticamente determináveis.
- **Recomendação:** usar botões com `aria-pressed` ou grupo de seleção com semântica consistente, nomes humanos para as cores e indicação da cor atual.
- **Comando:** `$impeccable harden`.

### A05 — [P2] Alvos de toque continuam pequenos fora do workspace

- **Localização:** `src/modules/reader/editor-controls.css`; `src/components/ui/controls.css:46`; `src/modules/reader/reader.tsx:1073`.
- **Categoria:** Responsividade.
- **Evidência:** sliders Espessura e Opacidade medem 70×18px no tablet e celular; o botão Fechar do modal de importação encolhe para cerca de 39,3×44px no celular. A regra global de 44px do workspace não cobre os elementos portados para fora dele nem todos os controles do leitor.
- **Impacto:** manipulação menos confortável e mais sujeita a erro em toque, principalmente em overlays.
- **Padrão:** meta de 44×44px adotada pelo projeto / WCAG 2.5.5 AAA. Tamanho abaixo de 44px, isoladamente, não prova violação de 2.5.8 AA; espaçamento e exceções também precisam ser avaliados.
- **Recomendação:** ampliar a área interativa dos sliders sem inflar necessariamente o trilho e impedir flex-shrink no botão Fechar; verificar portais e leitor separadamente.
- **Comando:** `$impeccable adapt`.

### A06 — [P2] Configuração do banco é apresentada como sincronização concluída

- **Localização:** `src/modules/settings/settings.tsx:190`; `src/app/api/status/route.ts`.
- **Categoria:** Integridade da implementação / clareza.
- **Evidência de código:** `config.database` indica presença de variáveis de ambiente, mas escolhe a frase “Biblioteca sincronizada com sua conta.”. Não consulta o resultado da última sincronização. O texto pode coexistir com o status de erro exibido acima.
- **Impacto:** a tela pode transmitir que o conteúdo está remoto quando só foi configurada uma conexão e o envio falhou.
- **Recomendação:** separar “serviço configurado” de “última sincronização concluída”, com estado e horário reais quando disponíveis.
- **Comando:** `$impeccable clarify`.

### A07 — [P2] Redefinição sem token não explica como recuperar o fluxo

- **Localização:** `src/modules/auth/recovery-form.tsx:98`.
- **Categoria:** Clareza / recuperação de erro.
- **Evidência:** ao visitar `/reset-password` sem fragmento, o formulário apresenta Nova senha e Salvar desabilitado. Não aparece mensagem de link ausente/inválido nem um atalho direto para pedir outro link; a mensagem de erro só é preenchida ao enviar uma requisição.
- **Impacto:** quem abre um link incompleto fica sem saber por que não pode continuar.
- **Recomendação:** exibir estado de link inválido e ação “Solicitar outro link”; token expirado deve levar ao mesmo caminho de recuperação após validação.
- **Comando:** `$impeccable clarify`.

### A08 — [P2] Contador do leitor virou uma coluna após a migração de input

- **Localização:** `src/components/ui/controls.css:143`; `src/modules/reader/reader-controls.css:38`.
- **Categoria:** Responsividade / layout.
- **Evidência visual:** o contador mostra “2” acima de “de 3”, formando uma cápsula vertical. O campo agora tem wrapper do Mantine; o layout anterior esperava um input em linha.
- **Impacto:** aumenta a área coberta sobre a página e diverge do contador compacto anterior.
- **Recomendação:** compor input e total numa linha com dimensões explícitas, mantendo o nome acessível e a área de toque.
- **Comando:** `$impeccable layout`.

### A09 — [P2] Capas e capturas carregam sem adiamento ou limite de renderização

- **Localização:** `src/components/ui.tsx:37`; `src/modules/knowledge/knowledge.tsx:224`; lista em `src/modules/library/library.tsx`.
- **Categoria:** Desempenho.
- **Evidência de código:** imagens sem `loading="lazy"`/decodificação adiada; a estante e a central montam todos os resultados de uma vez. O efeito em um acervo grande não foi medido nesta rodada.
- **Impacto:** potencial custo de decodificação/memória e montagem de DOM proporcional ao acervo, inclusive fora da área visível.
- **Recomendação:** carregar imagens abaixo da dobra sob demanda e medir uma biblioteca representativa antes de escolher paginação ou virtualização. Preservar dimensões das capas para evitar deslocamento.
- **Comando:** `$impeccable optimize`.

## Detector e falsos positivos

209 alertas consultivos: 47 cores, 134 tamanhos de fonte e 28 raios. Não houve finding determinístico de severidade superior a advisory. Eles não representam 209 defeitos confirmados.

- Cores das capas, tintas de anotação e papel têm finalidade própria; não devem virar uma única cor neutra por causa do detector.
- Miniaturas usam texto em escala minúscula como arte `aria-hidden`, com nome acessível no botão; não são texto de leitura da interface.
- O inventário `implementationInventory` registra CSS legado, mas não equivale a mapear esses valores aos papéis do frontmatter de DESIGN.md. Por isso avisos antigos continuam aparecendo.
- A varredura de contraste também sugeriu falha no total “de 3”; **rejeitada** após inspeção, pois o algoritmo simplificado não resolveu corretamente `color-mix` do fundo da cápsula. Não foi contada como defeito. O título central foi confirmado separadamente.
- O teste de “overflow” baseado apenas em `innerWidth` gerou falso negativo em 320px, devido à expansão do layout viewport em emulação móvel. A evidência física e o clique não forçado confirmam A01.

## Padrões sistêmicos

- Ajustes aplicados somente a `.books-app` deixam gaps nos portais e no leitor.
- A biblioteca e o leitor têm temas independentes; suas combinações precisam de cobertura própria.
- Interações foram ampliadas (mover/editar), mas o histórico continua baseado apenas em adições.
- Estado visual por classe CSS ainda não é acompanhado de estado programático em alguns controles.

## Pontos positivos

- Migração Mantine preservou os menus amplos do cabeçalho e a identidade editorial.
- Modal possui nome, contenção de foco e fechamento por Escape verificados.
- Menus usam portal e ações com nomes acessíveis; o teste de navegação para Configurações passa.
- Esquemas Mantine e da biblioteca permanecem sincronizados após trocar tema e recarregar.
- Teste de hidratação passa, incluindo emissão determinística das variáveis CSS.
- Nas três larguras concluídas, nenhuma entrada visível sem rótulo foi encontrada nos estados inspecionados.
- A página de leitura mantém texto legível no tema de papel, com chrome que pode ser ocultado sem deslocar o conteúdo.

## Ações recomendadas

1. **[P1] `$impeccable adapt`** — recuperar o menu e a composição da biblioteca em 320px; cobrir a área física de toque e overlays.
2. **[P1] `$impeccable harden`** — contraste do título do leitor, estados ARIA e histórico completo de edição.
3. **[P2] `$impeccable clarify`** — sincronização real versus configuração, e recuperação de link inválido.
4. **[P2] `$impeccable layout`** — contador em linha com wrapper Mantine.
5. **[P2] `$impeccable optimize`** — imagens e lista sob carga representativa.
6. **`$impeccable polish`** — confirmação final após as correções.

Os comandos podem ser executados individualmente ou em conjunto. Rodar `$impeccable audit` após corrigir os achados permite comparar os resultados com esta rodada.
