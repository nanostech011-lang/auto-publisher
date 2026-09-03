# Épico 04: Orquestração, Monetização e Quota Guard

* **Identificador:** `EP-04`
* **Status:** Pronto para Iniciar
* **Prioridade:** Must Have
* **Objetivo:** Implementar o caso de uso central da aplicação (`PublishScheduledPostsService`), que coordena as portas, aplica as regras algorítmicas de monetização e gerencia a segurança do orçamento de cotas diárias da API do YouTube.

---

## Histórias de Usuário

### US-04.1: Orquestrador de Agendamento (PublishScheduledPostsService)
* **ID:** `US-04.1`
* **Descrição:**  
  Como operador do AutoPublisher,  
  Quero que o serviço de orquestração consulte as postagens pendentes e despache cada vídeo para seu publicador correspondente,  
  Para garantir que os conteúdos programados sejam publicados pontualmente.

* **Critérios de Aceitação:**
  - [ ] Implementação de `PublishScheduledPostsService` implementando `PublishScheduledPostsUseCase`.
  - [ ] Consulta de postagens na planilha via `ScheduleRepositoryPort.findPendingPostsDue(LocalDateTime.now())`.
  - [ ] Loop de processamento de cada postagem pendente:
    1. Atualiza status temporário para `PROCESSANDO`.
    2. Obtém os streams de vídeo e thumbnail via `MediaStoragePort`.
    3. Seleciona o publicador correto via `publisher.supports(post.getPlatform())`.
    4. Invoca `publisher.publish(...)`.
    5. Atualiza a planilha com `PUBLICADO`, a URL do vídeo e timestamp de conclusão.
  - [ ] Cobertura de testes unitários superior a 80% usando JUnit 5 e Mockito.

---

### US-04.2: Quota Guard e Interrupção Graciosa (YouTube 403)
* **ID:** `US-04.2`
* **Descrição:**  
  Como gestor de infraestrutura,  
  Quero que o sistema detecte erros de cota excedida (`quotaExceeded` HTTP 403) e interrompa imediatamente o processamento do lote,  
  Para não desperdiçar requisições, não gerar falhas em cascata e não arriscar penalidades de limite da API.

* **Critérios de Aceitação:**
  - [ ] Limite preventivo: O orquestrador não processa mais de 6 vídeos no mesmo dia calendário.
  - [ ] Ao capturar um erro `403 quotaExceeded` ou `QuotaExceededException`:
    * A linha atual é atualizada para `COTA_ESGOTADA`.
    * O lote de execução é abortado imediatamente (o loop para).
    * As demais postagens pendentes permanecem como `PENDENTE` para o dia seguinte.
    * Um log de alerta nível `WARN/ERROR` é emitido avisando que a cota foi atingida.
  - [ ] Teste unitário simulando erro de cota e verificando que postagens subsequentes não são chamadas.

---

### US-04.3: Conformidade de Monetização (COPPA, SEO #Shorts e UTMs)
* **ID:** `US-04.3`
* **Descrição:**  
  Como criador focado em monetização,  
  Quero validações automáticas de SEO, classificação de Shorts e parâmetros de monetização antes do upload,  
  Para garantir que todo vídeo enviado esteja 100% elegível para anúncios e conversões de afiliados.

* **Critérios de Aceitação:**
  - [ ] Validação de COPPA: se o post possuir `madeForKids: true`, emitir log de alerta (canais monetizados devem operar com `madeForKids: false`).
  - [ ] Validação de Shorts: se a plataforma for `YOUTUBE_SHORTS`, o sistema valida se a hashtag `#Shorts` está no título ou descrição; caso não esteja, adiciona automaticamente ao final do título.
  - [ ] Validação de Limites:
    * Título: lança `ScheduleValidationException` se exceder 100 caracteres.
    * Descrição: preserva links completos com parâmetros UTM sem quebras de linha que invalidem a URL.
  - [ ] Testes unitários cobrindo as regras de injeção de `#Shorts` e verificação de COPPA.

---

### US-04.4: Resiliência com Retentativas e Backoff Exponencial
* **ID:** `US-04.4`
* **Descrição:**  
  Como operador de sistema,  
  Quero que falhas transitórias de conexão com o Drive ou YouTube sejam retentadas automaticamente até 3 vezes,  
  Para evitar que instabilidades momentâneas de rede impeçam a publicação do dia.

* **Critérios de Aceitação:**
  - [ ] Configuração de retry com Spring Retry ou Resilience4j para exceções de rede (`SocketTimeoutException`, `IOException`).
  - [ ] Backoff exponencial: 3 tentativas com intervalo inicial de 2 segundos e multiplicador 2.0 (2s, 4s, 8s).
  - [ ] Se todas as tentativas falharem:
    * Atualizar status da linha na planilha para `ERRO_TEMPORARIO`.
    * Gravar a mensagem da exceção na coluna `Log_Erro`.
    * Incrementar a coluna `Tentativas`.
  - [ ] Exceções fatais de validação (ex: ID do vídeo inexistente no Drive) não devem ser retentadas (falha rápida).
