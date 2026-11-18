# Exclusão de coleções entre dispositivos

> Registro histórico anterior à sincronização incremental. Para o funcionamento atual, consulte a [arquitetura do Le-Books](../ARQUITETURA.md).

Relato: “Filosofia & ideias”, coleção da versão inicial com ID `filosofia`, foi excluída em um dispositivo e continuou visível em outro. Não foi confirmado se ambos haviam concluído a sincronização; a conta real não foi consultada ou alterada.

Foi reproduzida uma falha compatível: sem uma base local de sincronização, uma coleção antiga ausente do snapshot remoto era interpretada como inclusão local. A projeção já registrava exclusões em `LibraryEntity`, mas esses registros não eram usados pelo protocolo de sincronização. Um cliente antigo também podia reenviar o mesmo ID e reativá-lo.

A API agora retorna os IDs de coleções com exclusão registrada para o próprio usuário. O merge remove esses IDs e seus vínculos com documentos da base e dos dois snapshots antes de conciliar alterações. A API também impede a restauração desses IDs por uploads de clientes antigos, sob a transação e controle de revisão existentes. A regra é por ID; coleções novas, inclusive com nomes repetidos, permanecem permitidas. Livros, progresso e anotações não são excluídos. Nenhuma migração de banco é necessária.

Limite: se a exclusão nunca chegou ao servidor, não há registro para distingui-la de uma coleção local nova. Se uma versão anterior já recriou a coleção e apagou a marca de exclusão, ela precisa ser excluída novamente após a atualização. Não há remoção automática por nome ou por ser coleção inicial.

Validação: testes de merge cobrem ausência de base, nova coleção independente, limpeza dos vínculos e preservação do progresso. Teste com banco real e navegador separado reproduz o dispositivo legado, confirma aplicação na tela de coleções e impede reenvio por cliente antigo. A regressão existente de projeção, versões e tombstones também passou. A suíte unitária completa tem 48 testes aprovados; build de produção e TypeScript aprovados.
