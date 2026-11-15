# Trabalho restante

- [x] Mantine integrado aos controles, checkboxes, menus e modais, com tema central, foco acessível, claro/escuro unificado e verificação visual em desktop e celular.

- [x] Persistência remota autenticada e isolada por conta (réplica JSONB versionada via Prisma).
- [x] Upload e recuperação de originais privados no R2, comprovados por integração real.
- [x] Fila offline durável, UUID, idempotência, revisão atômica e conciliação de alterações independentes.
- [x] Migração automática do acervo existente no navegador.
- [x] Estado de sincronização e resolução explícita de conflitos com backup.
- [x] Cache offline de páginas visitadas, recursos e documentos abertos; recarga offline testada.
- [x] Recuperação administrativa da conta pessoal por comando seguro.
- [x] Editor: texto, imagens PNG/JPEG, cores, espessura e opacidade.
- [x] Exportação das novas marcações, imagens e capturas.
- [x] Auditoria: títulos, diálogos, contraste, contador da home e coleção inexistente.
- [x] Auditoria: alvos de toque de 44px em controles móveis, inventário CSS documentado e preservação dos papéis visuais existentes.
- [x] Testes de merge, validação, API, isolamento, R2, restauração e editor; build de produção.

## Evoluções e limites explícitos

- [x] Recuperação por e-mail via Mailtrap: tokens de uso único, expiração de 30 minutos, limite de solicitações e revogação de sessões antigas.
- [x] Mailtrap: credenciais locais configuradas e um envio real autorizado aceito pela API. Recebimento na caixa de entrada depende da confirmação do destinatário.
- [x] Coletor de originais órfãos com sete dias de retenção, proteção de referências e simulação por padrão. Exclusão real exige --apply.
- [x] Projeção relacional transacional e versões por entidade com tombstones. Bibliotecas existentes projetadas.
- [x] Busca em todo o EPUB, filtro por data no conhecimento e estatísticas diárias.
- [x] Unicode nas notas exportadas: imagem com fallback do navegador e conteúdo integral em anexo TXT UTF-8.
- [x] Integração para upload de imagens, PDF com imagens/notas Unicode, movimentação de objetos e resolução manual de conflitos com backup.
- [x] Ferramentas de mover página, lápis, sublinhado e atualização de propriedades de objetos.

## Operação após deploy

- Configurar AUTH_URL com o endereço público da implantação.
- Agendar a coleta real apenas após definir a política de retenção. A simulação deste ambiente encontrou zero candidatos vencidos; nenhum original foi apagado.
- Confirmar o recebimento do e-mail na caixa de entrada. Não reenviar automaticamente o teste autorizado.

Não marcar estas evoluções como concluídas sem implementação e evidência. README descreve os limites operacionais.
