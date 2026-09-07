# Épico 08: SaaS Multi-Tenant e Gestão de Usuários

* **Status:** Concluído
* **Prioridade:** Should Have
* **Complexidade:** Alta
* **Data de Conclusão:** 2026-09-07
* **Contexto Técnico:** [Detalhes_Operacional.md](../Detalhes_Operacional.md#42-modelo-saas-centralizado-multi-tenant)

---

## 1. Visão Geral

Evolução arquitetural implementada no AutoPublisher Pro para transformar o sistema em uma plataforma **SaaS (Software as a Service) multi-tenant**, onde múltiplos clientes/usuários acessam a mesma URL pública gerenciada pelo proprietário do sistema, com autenticação individual, isolamento de dados por Tenant e provisionamento de chaves próprias por cliente.

---

## 2. Histórias de Usuário e Critérios de Aceite

### US-08.1: Persistência e Repositório de Tenants com Suporte Multi-Tenant
* **Descrição:** Como administrador do sistema, quero armazenar contas de usuários e mapear suas chaves de API individuais em repositório seguro, para que cada cliente possua seu próprio cadastro e credenciais.
* **Critérios de Aceite:**
  - [x] Modelagem de entidades: `TenantConfig` e contexto de execução `TenantContext`.
  - [x] Implementação de `TenantRepositoryPort` e adaptador thread-safe `InMemoryTenantRepositoryAdapter`.
  - [x] Geração e revogação de chaves criptograficamente seguras com prefixo `sec_live_...`.

### US-08.2: Isolamento de Planilhas e Recursos por Tenant
* **Descrição:** Como cliente da plataforma SaaS, quero que minha chave acesse estritamente a minha planilha do Google Sheets e as minhas postagens, sem risco de visualização ou interferência de outros usuários.
* **Critérios de Aceite:**
  - [x] Contexto de Tenant propagado via `TenantContextHolder` com descarte rigoroso em Virtual Threads do Java 21.
  - [x] Associação obrigatória: cada requisição autenticada resolve o `spreadsheet_id` e a aba exclusiva do usuário logado via `DynamicGoogleClientProvider`.
  - [x] Testes de isolamento unitários garantindo que o Tenant A não interfere no Tenant B.

### US-08.3: Gestão Descentralizada de Credenciais por Cliente
* **Descrição:** Como criador utilizando a plataforma central, quero conectar meu próprio canal do YouTube e credenciais de redes sociais sem consumir a cota global do servidor.
* **Critérios de Aceite:**
  - [x] Resolução dinâmica de instâncias de clientes Google (`Sheets`, `Drive`, `YouTube`) por tenant via `DynamicGoogleClientProvider` com cache local.
  - [x] Armazenamento de credenciais por usuário (`youtubeClientId`, `youtubeRefreshToken`, etc.).
  - [x] Retrocompatibilidade total garantida para modo single-tenant self-hosted (`default` tenant).

### US-08.4: API de Gestão Administrativa de Clientes
* **Descrição:** Como proprietário do SaaS, quero endpoints administrativos para cadastrar clientes, ativar/desativar acessos e rotacionar chaves da plataforma.
* **Critérios de Aceite:**
  - [x] Endpoint REST seguro `/api/v1/tenants` (`POST`, `GET`, `DELETE`, `PATCH /status`, `POST /rotate-key`).
  - [x] Proteção estrita via Master Admin Key no `ApiKeyAuthFilter`.
  - [x] Suíte de testes unitários com 100% de aprovação no ecossistema JUnit 5 / Mockito.
