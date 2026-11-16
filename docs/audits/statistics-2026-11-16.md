# Estatísticas e centralização — 16/11/2026

Auditoria estática e visual em 1440 px e 393 px, seguida de layout, typeset e polish dentro da identidade existente. Evidências iniciais: `.impeccable/review/statistics/before-*.png`.

## Diagnóstico inicial

Integridade: reprovada no acabamento da superfície. Cores e famílias tipográficas seguem o projeto, mas o histórico diário não recebe apresentação própria e os blocos de largura limitada não compartilham um eixo central.

| Dimensão | Nota / 4 | Evidência |
| --- | --- | --- |
| Acessibilidade | 2 | Indicador de meta é uma `div`; períodos pouco distintos e legendas pequenas. |
| Performance | 3 | Agregação simples e sete linhas; avaliação estática, sem perfil de execução. |
| Responsividade | 2 | Conteúdo fica deslocado em desktop; histórico e números comprimidos no telefone. |
| Temas | 3 | Tokens presentes; contraste e estados precisam de verificação após o ajuste. |
| Integridade | 2 | Cabeçalho, estatísticas e histórico usam larguras e níveis de acabamento distintos. |
| Total | 12 / 20 | Melhorias de estrutura e legibilidade necessárias. |

## Achados

- **P2 — Centralização:** `settings-refined` e `reading-stats` limitam a largura sem centralizar o conjunto. Centralizar título e conteúdo na mesma coluna. Comando: layout.
- **P2 — Períodos misturados:** minutos acumulados aparecem junto da meta de hoje. Separar claramente hoje, total e últimos sete dias. Comandos: clarify e layout.
- **P2 — Histórico sem apresentação:** datas e minutos aparecem colados, sem espaçamento ou comparação visual. Usar tabela semântica com barras proporcionais e valores explícitos. Comandos: layout e typeset.
- **P2 — Indicador de meta:** a barra não expõe o valor como progresso nativo. Usar `progress` com nome e valores acessíveis. Comando: harden.
- **P2 — Histórico vazio:** sete zeros não explicam como começar. Oferecer estado vazio e acesso à biblioteca. Comando: polish.
- **P3 — Tipografia:** legendas de 10–11 px dificultam a leitura em telas pequenas. Aplicar a escala existente de corpo, rótulos e títulos. Comando: typeset.

Não foram identificados P0 ou P1 nesta superfície. O detector também apontou valores preexistentes de raio/tamanho fora da escala em Configurações; não são a causa principal dos problemas auditados.

## Resultado após layout, typeset e polish

- Estatísticas e Configurações compartilham título e conteúdo em uma coluna central de até 1000 px.
- Hoje, total acumulado e últimos sete dias têm períodos explícitos. O histórico usa tabela com cabeçalhos, datas e valores, acompanhada por barras proporcionais decorativas.
- A meta usa progresso nativo; a indicação de conclusão não arredonda 19min59s para uma meta de 20 minutos. O ajuste de meta leva a Configurações e atualiza os valores ao voltar.
- O estado sem atividade descreve o período e oferece acesso à biblioteca. Durações menores que um minuto não aparecem como ausência de leitura.
- A tipografia e os números foram alinhados no telefone; estilos antigos sem uso foram removidos.

Verificação: **14 testes E2E e 2 testes de cálculo aprovados**, além do build de produção e TypeScript. A matriz inclui 1440, 820, 393 e 320 px nos temas claro e escuro, medição da centralização e ausência de rolagem horizontal. Os testes também verificam preferências persistidas, backup, mudança da meta e exclusão de amostras do total de concluídos. Capturas finais: `.impeccable/review/statistics/`.

Pontuação de revisão após os ajustes: **18/20** (acessibilidade 3, performance 3, responsividade 4, temas 4 e integridade 4). A performance foi revisada estaticamente; esta avaliação de superfície não substitui certificação completa de acessibilidade ou testes em aparelhos físicos. Os cenários usam bibliotecas locais de teste e isolam a sincronização remota.

## Ampliação da utilidade

Foram adicionados períodos de 7/30 dias, comparação com uma janela anterior equivalente, frequência de leitura, média diária, dias que alcançam a meta atual, sequência atual e recorde. O cálculo da média inclui os dias sem atividade. As metas históricas não são registradas pelo produto; o contador usa explicitamente a meta atual. A sequência considera hoje ou ontem, evitando encerrar o hábito antes de o dia terminar; o recorde ignora datas futuras ou inválidas. “Como calculamos” explica as regras.

O resumo da biblioteca passou a ficar abaixo do histórico. A ação “Retomar” abre a leitura real em andamento mais recentemente acessada. O período de 30 dias usa uma área rolável com cabeçalho fixo.

Validação desta ampliação: 14 cenários E2E aprovados e 4 testes de cálculo aprovados, incluindo média, limites entre períodos, sequência, recorde, filtros, retomada e integração com Configurações. Build e TypeScript aprovados. Capturas adicionais: `.impeccable/review/statistics/utility-30-*.png`.
