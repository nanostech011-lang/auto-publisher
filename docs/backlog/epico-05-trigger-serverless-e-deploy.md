# Épico 05: Gatilho Serverless e Deploy em Produção

* **Identificador:** `EP-05`
* **Status:** Concluído
* **Prioridade:** Must Have
* **Objetivo:** Expor o endpoint REST de disparo protegido por chave de API, configurar o contêiner no Google Cloud Run com escala a zero e orquestrar o acionamento pontual via Google Cloud Scheduler, garantindo o custo operacional de R$ 0,00/mês.

---

## Histórias de Usuário

### US-05.1: Endpoint Inbound Seguro (JobTriggerController)
* **ID:** `US-05.1`
* **Status:** Concluído
* **Descrição:**  
  Como operador de nuvem,  
  Quero expor um endpoint HTTP seguro `POST /api/v1/publisher/run` com autenticação obrigatória via cabeçalho `X-API-KEY`,  
  Para que somente gatilhos autorizados (como o Google Cloud Scheduler) possam disparar o fluxo de publicação.

* **Critérios de Aceitação:**
  - [x] Implementação de `JobTriggerController` no pacote `infrastructure.controller`.
  - [x] Endpoint `POST /api/v1/publisher/run`.
  - [x] Interceptor ou filtro de segurança validando o cabeçalho `X-API-KEY` contra a variável de ambiente `AUTO_PUBLISHER_API_KEY`:
    * Se ausente ou inválido: retornar imediatamente `HTTP 401 Unauthorized`.
    * Se válido: invocar `PublishScheduledPostsUseCase.execute()`.
  - [x] Retorno de DTO com o resumo do processamento: total processado, sucessos, falhas e tempo de execução em milissegundos.
  - [x] Teste de integração do controller (`MockMvc`) validando cenários 401 e 200.

---

### US-05.2: Deploy no Google Cloud Run (min-instances=0)
* **ID:** `US-05.2`
* **Status:** Concluído
* **Descrição:**  
  Como engenheiro DevOps,  
  Quero fazer o deploy da imagem Docker no Google Cloud Run com escala para zero instâncias,  
  Para que a aplicação só consuma recursos computacionais durante o processamento do lote diário.

* **Critérios de Aceitação:**
  - [x] Configuração do serviço no Cloud Run via scripts automatizados (`scripts/deploy-cloudrun.ps1` e `scripts/deploy-cloudrun.sh`):
    * Mínimo de instâncias: `0` (`--min-instances 0`).
    * Máximo de instâncias: `1` (`--max-instances 1` para evitar concorrência no upload da planilha).
    * Memória RAM: `512MiB` (`--memory 512Mi`).
    * CPU: `1 vCPU` (`--cpu 1`).
    * Timeout de requisição: `900s` (15 minutos para tolerar uploads de vídeos grandes).
  - [x] Injeção de variáveis de ambiente do `.env` ou Secret Manager.
  - [x] Verificação de que o contêiner hiberna (escala para 0) após a conclusão do processamento.

---

### US-05.3: Automação com Google Cloud Scheduler (Cron Externo)
* **ID:** `US-05.3`
* **Status:** Concluído
* **Descrição:**  
  Como criador de conteúdo,  
  Quero configurar um job no Google Cloud Scheduler para disparar o endpoint do Cloud Run a cada 30 minutos,  
  Para que minhas postagens sejam publicadas pontualmente no horário agendado de forma 100% autônoma.

* **Critérios de Aceitação:**
  - [x] Criação de job no Google Cloud Scheduler via scripts (`scripts/setup-scheduler.ps1` e `scripts/setup-scheduler.sh`):
    * Frequência: `*/30 * * * *` (a cada 30 minutos) ou conforme conveniência do criador.
    * Alvo: HTTP POST para a URL do serviço Cloud Run (`https://<cloud-run-url>/api/v1/publisher/run`).
    * Cabeçalho HTTP: `X-API-KEY: <sua-chave-secreta>`.
  - [x] Verificação de consumo: 1 único job configurado no Cloud Scheduler (dentro da cota gratuita de 3 jobs/mês por conta Google).
  - [x] Suporte a teste de disparo manual imediato via `gcloud scheduler jobs run`.
