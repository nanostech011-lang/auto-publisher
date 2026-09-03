# ADR 0002: Disparo Serverless com Cloud Scheduler e Cloud Run (Scale-to-Zero)

* **Status:** Aceito
* **Data:** 2026-09-03
* **Decisores:** Time de Arquitetura e Engenharia AutoPublisher
* **Contexto Técnico:** [Detalhes_Operacional.md](../Detalhes_Operacional.md) e [PRD_AutoPublisher_Completo.md](../PRD_AutoPublisher_Completo.md) - [RF-02], [RNF-04]

---

## 1. Contexto e Problema

O objetivo financeiro do projeto AutoPublisher é operar com **custo zero (R$ 0,00/mês)**, alavancando os níveis gratuitos (*Free Tiers*) do Google Cloud.

A proposta inicial sugeria o uso de `@Scheduled` (cron interno do Spring Boot) rodando em um contêiner no Google Cloud Run. Entretanto:
1. No modelo padrão do Cloud Run, o serviço **escala para zero instâncias** (`min-instances = 0`) quando não recebe requisições HTTP.
2. Com a CPU desabilitada em instâncias ociosas, o scheduler interno do Spring Boot **não executa**, já que não há processo ativo de CPU rodando para avaliar a expressão cron.
3. Manter uma instância ativa continuamente (`min-instances = 1` com CPU sempre alocada) consumiria aproximadamente 720 horas de vCPU e memória por mês, ultrapassando os limites da camada gratuita do Cloud Run (que concede 180.000 vCPU-segundos e 360.000 GB-segundos mensais) e gerando faturas recorrentes de nuvem.

Era necessário um mecanismo que mantivesse o contêiner 100% desligado durante o dia, acordando-o apenas nos horários de publicação.

---

## 2. Decisão

Decidimos desacoplar o agendador temporal do microsserviço de publicação, adotando a seguinte arquitetura de disparo:

1. **Google Cloud Scheduler:**
   * Configuração de um job no Google Cloud Scheduler (o Google concede **3 jobs gratuitos por mês** por conta de faturamento).
   * O job é configurado com uma expressão cron (ex: a cada 30 ou 60 minutos, ou em horários fixos como `0 12,18,21 * * *`).
   * O Cloud Scheduler emite uma requisição `POST /api/v1/publisher/run` para a URL do serviço Cloud Run.

2. **Segurança do Endpoint:**
   * A requisição HTTP é autenticada via cabeçalho `X-API-KEY` (ou token OIDC gerenciado pelo IAM do Google Cloud Run Invoker).
   * Requisições não autenticadas recebem resposta imediata `401 Unauthorized`.

3. **Ciclo de Vida do Cloud Run:**
   * Ao receber a chamada, o Cloud Run sobe uma instância em cold start (~2 a 4 segundos com Java 21).
   * O Spring Boot executa o caso de uso `PublishScheduledPostsUseCase`, processa todas as linhas pendentes da planilha cujo horário já foi atingido, grava o status no Google Sheets e retorna HTTP 200 com o resumo do processamento.
   * O Cloud Run encerra a requisição e desarma a instância, voltando imediatamente a **zero instâncias ativas**.

---

## 3. Consequências

### Pontos Positivos
* **Custo R$ 0,00 Real:** O tempo total de faturamento no Cloud Run fica restrito a poucos minutos por dia (cerca de 60 a 90 segundos por execução), consumindo menos de 5% da franquia gratuita mensal de CPU e memória.
* **Resiliência a Reinicializações:** Como o estado do agendamento reside no Google Sheets e o gatilho é externo, falhas no contêiner ou atualizações de código não perdem o cronograma.
* **Flexibilidade Operacional:** É possível disparar execuções manuais ou sob demanda a qualquer momento enviando um `curl` autenticado para o endpoint.

### Pontos de Atenção / Trade-offs
* **Cold Start:** A primeira requisição do contêiner possui uma latência de inicialização de 2 a 5 segundos (completamente desprezível para um fluxo assíncrono em lote de publicação em redes sociais).
* **Timeout de Requisição:** O Google Cloud Run possui um timeout padrão de 300 segundos (5 minutos) por requisição. Como o upload de 1 a 3 vídeos via rede Google leva menos de 2 minutos, o tempo é suficiente. Caso o volume aumente, o timeout pode ser ajustado para até 15 minutos nas configurações do serviço.
