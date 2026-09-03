# Definition of Done (DoD) - AutoPublisher Pro

A **Definition of Done (DoD)** estabelece os critérios objetivos de qualidade, conformidade arquitetural, segurança e operabilidade que toda funcionalidade, história de usuário ou correção deve satisfazer antes de ser considerada concluída e pronta para produção.

---

## 1. Princípios Gerais da DoD

Nenhuma tarefa é considerada "Pronta" (*Done*) se violar:
1. **A premissa de custo R$ 0,00:** Qualquer implementação que exija recursos pagos sem justificativa de negócio é rejeitada.
2. **A integridade de monetização:** Uploads que descumpram regras de anúncios (ex: falta de flag COPPA, ausência de tratamento de direitos autorais ou descrições quebradas) não podem ser entregues.
3. **A proteção contra vazamento de memória:** Manipulações de mídia em memória heap (`byte[]`) são expressamente proibidas.

---

## 2. Critérios de Aceitação por Dimensão

### 2.1. Arquitetura e Código
- [ ] **Aderência à Clean Architecture:** O código deve respeitar a separação estrita entre Domínio, Aplicação (Portas) e Infraestrutura (Adaptadores).
- [ ] **Desacoplamento de SDKs:** Nenhuma classe do pacote `domain` pode importar bibliotecas do Google (`com.google.api.services.*`), Meta ou TikTok.
- [ ] **Java 21 Idiomático:** Utilização de novos recursos do Java 21 quando aplicável (Records para DTOs/Value Objects, Pattern Matching, Switch Expressions e Virtual Threads para I/O bloqueante).
- [ ] **Princípio de Responsabilidade Única (SRP):** Classes e métodos concisos, com responsabilidades bem delimitadas.

### 2.2. Testes Automatizados e Qualidade
- [ ] **Testes Unitários:** Cobertura de testes unitários mínima de **80%** no pacote de domínio (`domain`) e casos de uso (`application/usecase`), utilizando **JUnit 5** e **Mockito**.
- [ ] **Mocks para Serviços Externos:** Nenhum teste unitário ou de CI/CD deve fazer chamadas reais às APIs externas (Drive, Sheets, YouTube). Todas as chamadas de rede externas devem ser simuladas via stubs/mocks.
- [ ] **Testes de Integração de Adaptadores:** Testes dedicados para os adaptadores que validem a conversão correta de DTOs para o modelo de domínio e tratamento de códigos HTTP (200, 401, 403 QuotaExceeded, 500).
- [ ] **Testes de Falhas e Resiliência:** Testes simulando desconexões, timeouts e erros de cota esgotada, garantindo que o status no Sheets seja atualizado corretamente sem travar o loop de processamento.

### 2.3. Performance e Gestão de Recursos (Streaming Zero-Copy)
- [ ] **Zero-Copy Streaming:** O fluxo de dados do Google Drive para o YouTube deve operar exclusivamente via `InputStreamContent` ou pipes encadeados, garantindo que o uso de memória heap permaneça abaixo de **256MB** durante o upload de vídeos com mais de 1GB.
- [ ] **Execução Rápida:** O contêiner deve inicializar e completar o processamento do lote respeitando o timeout configurado no Cloud Run (máximo de 15 minutos).

### 2.4. Regras de Monetização e Validação Algorítmica
- [ ] **Conformidade COPPA:** O parâmetro `selfDeclaredMadeForKids: false` deve ser explicitamente enviado em todos os envios de vídeo para o YouTube.
- [ ] **Suporte a Thumbnail Personalizada:** Se o `Drive_Thumbnail_ID` estiver preenchido, a chamada à API `thumbnails.set` deve ser executada e validada.
- [ ] **SEO e Hashtags:** Se o vídeo for classificado como `YOUTUBE_SHORTS`, a validação deve garantir a presença de `#Shorts` no título ou descrição.
- [ ] **Limite de Cota (Quota Guard):** O sistema deve abortar a execução do lote imediatamente ao receber o erro `quotaExceeded` (HTTP 403) ou atingir 6 vídeos no mesmo dia, marcando os vídeos restantes como `COTA_ESGOTADA` sem queimar requisições desnecessárias.

### 2.5. Segurança e Credenciais
- [ ] **Zero Hardcoded Secrets:** Nenhuma chave de API, segredo de cliente ou ID de planilha pode constar no código fonte ou commits do Git.
- [ ] **Injeção via Ambiente:** Todas as variáveis sensíveis devem ser injetadas via variáveis de ambiente ou Secret Manager (`.env` configurado).
- [ ] **Autenticação nos Endpoints:** O endpoint de trigger (`/api/v1/publisher/run`) deve possuir validação obrigatória de token seguro (`X-API-KEY` ou OIDC Token do Cloud Scheduler).
- [ ] **Mascaramento de Logs:** Tokens de autenticação (`access_token`, `refresh_token`, segredos) jamais devem ser impressos nos logs da aplicação.

### 2.6. Infraestrutura e Deploy
- [ ] **Dockerfile Otimizado:** Build multi-stage gerando uma imagem baseada em JRE Alpine (`eclipse-temurin:21-jre-alpine`), com tamanho total inferior a 250MB.
- [ ] **Execução Non-Root:** O processo dentro do contêiner Docker deve rodar sob um usuário não privilegiado (`appuser`).
- [ ] **Escala a Zero Validada:** O serviço deve desligar adequadamente após concluir o processamento da requisição HTTP (`min-instances = 0`).

### 2.7. Documentação e Rastreabilidade
- [ ] **ADR Atualizada:** Qualquer alteração significativa de arquitetura, protocolo de autenticação ou banco de dados deve gerar um novo registro no diretório `docs/adr/`.
- [ ] **Contrato do Sheets Respeitado:** Qualquer novo campo exigido pelo sistema deve ser adicionado ao schema documentado no PRD e no README.
- [ ] **Logs Estruturados:** Logs claros e informativos via SLF4J indicando:
    * Início da execução e quantidade de vídeos pendentes.
    * ID do post sendo processado.
    * Tempo de download e upload.
    * URL final gerada ou stack trace simplificado do erro.

---

## 3. Checklist Rápido de Pré-Merge / Pré-Deploy

```markdown
[ ] O código compila sem warnings com Java 21?
[ ] Todos os testes unitários passaram (`mvn test` ou `gradle test`)?
[ ] Nenhuma credencial foi commitada no Git?
[ ] O consumo de memória foi mantido via InputStream direto?
[ ] O campo `selfDeclaredMadeForKids: false` está garantido?
[ ] O status é devidamente registrado no Sheets tanto em caso de SUCESSO quanto de FALHA?
[ ] A documentação ou ADR correspondente foi atualizada?
```
