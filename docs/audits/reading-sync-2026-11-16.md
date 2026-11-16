# Retomada de leitura entre dispositivos

A investigação reproduziu um leitor mostrando a página 1 depois de já ter recebido e persistido a página 3. A restauração só ocorria na montagem; EPUB também guardava a localização inicial em uma referência sem acompanhar a sincronização. Sair da aba não solicitava envio e uma falha no original interrompia os metadados.

## Comportamento corrigido

- Página, porcentagem e localização são conciliadas como uma posição indivisível. `readingPositionUpdatedAt` registra movimentos da leitura; a posição mais recente vence, inclusive ao voltar páginas. Empates têm desempate determinístico. `lastReadAt` continua registrando a abertura, sem substituir uma posição mais recente.
- Leitores já abertos aplicam posições recebidas. EPUB restaura o CFI sem registrar o reposicionamento automático como nova navegação; percentuais não usam o valor sentinela negativo da indexação.
- Alterações disparam sincronização em até 750 ms. Foco, conexão, visibilidade e o intervalo de 15 segundos também solicitam atualização. Ocultar/sair envia uma posição compacta com `keepalive`, limitada a 60 KB, sem depender de concluir um upload do original.
- Mudanças feitas enquanto rede ou IndexedDB estão ocupados são conciliadas antes de atualizar o leitor. Estado local e base de sincronização são gravados na mesma transação. Operações usam uma execução por navegador e Web Locks quando disponíveis; disputas de revisão têm três tentativas imediatas antes da próxima sincronização.
- Recibos `sync-operation` em LibraryEntity reconhecem uma escrita aceita mesmo depois de outra escrita remota. O registro pendente inclui o snapshot de entrada, para recuperar respostas perdidas sem contar tempo novamente. Registros antigos sem esse snapshot preservam entradas remotas e evitam somar outra vez seus totais já aceitos.
- Exclusões de livros têm tombstones, como as de coleções. Dispositivos sem base e clientes antigos não podem restaurar esses IDs; notas e marcadores do livro excluído também são removidos.
- Metadados são confirmados antes dos originais. Falhas de arquivo ficam pendentes e não bloqueiam a posição. Envelopes acima de 4 MB usam uma transferência privada temporária no R2 e uma referência autenticada na API; respostas de biblioteca usam streaming. Permanecem os limites de 25 MB de metadados e 100 MB por original.
- Transferências temporárias são apagadas ao concluir a requisição. Uploads interrompidos antes de submissão podem ser coletados no prefixo reservado `sync-snapshots/` após sete dias pelo comando de coleta existente. A simulação continua sendo o padrão.

Não há migração de schema ou nova credencial. Os campos novos pertencem aos snapshots JSON existentes. Conflitos incompatíveis em metadados, notas e preferências continuam exigindo escolha explícita com backup.

A resolução manual participa da mesma fila da sincronização automática. As escolhas “Manter deste dispositivo” e “Usar versão da conta” aguardam a operação em andamento, confirmam estado/base juntos e iniciam a sincronização com a escolha aplicada. Uma resposta automática anterior não pode substituir essa decisão.

## Validação

Resultado: 80 testes unitários e 19 cenários distintos de navegador/API aprovados em execuções de regressão e verificações dirigidas. Build de produção, TypeScript e conferência do diff aprovados. Os dois caminhos de resolução manual foram testados com uma sincronização automática pausada em andamento.

A suíte unitária cobre posições nos quatro formatos, retorno de páginas, empates, preservação de metadados, tombstones, falha de upload, revisão concorrente, respostas perdidas, compatibilidade com pendências antigas, limites em bytes e streaming.

Os testes de navegador/API usam contas temporárias e banco real. Cobrem dois contextos isolados em TXT, DOCX, PDF e EPUB, capítulo visível e recarga EPUB, offline/reconexão, saída imediata, edição durante requisição, revisão concorrente, resposta perdida após escrita real, isolamento por conta, exclusões, reenvio e transferência de metadados acima de 4 MB no R2. As regressões existentes de coleções, projeção normalizada, persistência local, controles de leitura e upload de originais também são executadas.

Comandos: `node --import tsx --test tests/*.test.ts`, `npm run typecheck`, `npm run build` e `npx playwright test tests/e2e/reading-sync.spec.ts tests/e2e/sync-protocol.spec.ts tests/e2e/synchronization.spec.ts tests/e2e/collection-sync.spec.ts tests/e2e/entity-persistence.spec.ts tests/e2e/storage-performance.spec.ts tests/e2e/reader-audit-fixes.spec.ts`, com o servidor de produção local ativo.

## Limites operacionais

A troca entre dispositivos exige rede. A leitura offline permanece no IndexedDB e é reenviada ao reconectar. Encerrar o processo à força pode impedir eventos de saída e envio imediato; o outro dispositivo só recebe o que chegou ao servidor. Posições de documentos legados sem relógio de leitura mantêm a conciliação conservadora se ambos os lados forem incompatíveis. Nenhum dado da conta real foi alterado pela validação. Não houve commit ou deploy; a execução desta versão na Vercel ainda depende da publicação.
