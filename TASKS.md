# Trabalho restante

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
- [ ] Auditoria: atingir 44×44 px em todos os controles móveis e alinhar todos os tokens documentados.
- [x] Testes de merge, validação, API, isolamento, R2, restauração e editor; build de produção.

## Evoluções e limites explícitos

- [x] Recuperação por e-mail via Mailtrap: tokens de uso único, expiração de 30 minutos, limite de solicitações e revogação de sessões antigas.
- [ ] Ativar entrega real: configurar MAILTRAP_API_TOKEN e MAILTRAP_FROM_EMAIL no ambiente (MAILTRAP_SANDBOX_ID é opcional para testes sem entrega).
- [ ] Coleta de originais órfãos no R2: hoje são retidos para recuperação.
- [ ] Projeção da réplica nas tabelas normalizadas e versionamento por entidade; hoje a revisão é por agregado da conta.
- [ ] Busca em todo o EPUB, filtro por data no conhecimento e estatísticas diárias.
- [ ] Preservar Unicode completo em notas exportadas ao PDF (fonte padrão atual tem repertório limitado).
- [ ] Cobertura de integração para upload de imagens, exportação avançada e resolução manual de conflitos.

Não marcar estas evoluções como concluídas sem implementação e evidência. README descreve os limites operacionais.
