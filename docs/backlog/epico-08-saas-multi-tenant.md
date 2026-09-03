# Épico 08: SaaS Multi-Tenant e Gestão de Usuários (Fase Futura)

* **Status:** Planejado (Roadmap Futuro)
* **Prioridade:** Could Have
* **Complexidade:** Alta
* **Data de Planejamento:** 2026-09-03
* **Contexto Técnico:** [Detalhes_Operacional.md](../Detalhes_Operacional.md#42-modelo-saas-centralizado-multi-tenant)

---

## 1. Visão Geral

Evolução arquitetural para transformar o AutoPublisher Pro em uma plataforma **SaaS (Software as a Service) centralizada**, onde múltiplos clientes/usuários acessam a mesma URL pública gerenciada pelo proprietário do sistema, com autenticação individual, isolamento de dados por Tenant e provisionamento de chaves próprias por cliente.

---

## 2. Histórias de Usuário e Critérios de Aceite

### US-08.1: Persistência com Banco de Dados Relacional Multi-Tenant
* **Descrição:** Como administrador do sistema, quero armazenar contas de usuários e mapear suas chaves de API individuais em um banco de dados relacional (ex: PostgreSQL, Supabase ou Firebase), para que cada cliente possua seu próprio cadastro seguro.
* **Critérios de Aceite:**
  - [ ] Modelagem de tabelas: `Tenant / User` (id, nome, email, api_key_hash, ativo, data_criacao).
  - [ ] Migrações automatizadas de banco de dados com Flyway ou Liquibase.
  - [ ] Geração e revogação de `user_api_key` criptografada (Argon2 ou BCrypt).

### US-08.2: Isolamento de Planilhas e Recursos por Tenant
* **Descrição:** Como cliente da plataforma SaaS, quero que minha chave acesse estritamente a minha planilha do Google Sheets e as minhas postagens, sem risco de visualização ou interferência de outros usuários.
* **Critérios de Aceite:**
  - [ ] Contexto de Tenant propagado via `ThreadLocal` ou `ScopedValue` nas Virtual Threads.
  - [ ] Associação obrigatória: cada requisição autenticada resolve o `spreadsheet_id` e a aba exclusiva do usuário logado.
  - [ ] Testes de isolamento garantindo que o Tenant A não consegue ler nem escrever no Tenant B.

### US-08.3: Gestão Descentralizada de Cotas OAuth 2.0 por Cliente
* **Descrição:** Como criador utilizando a plataforma central, quero conectar meu próprio canal do YouTube via fluxo OAuth 2.0 sem consumir a cota global do servidor.
* **Critérios de Aceite:**
  - [ ] Fluxo de OAuth 2.0 Connect no Dashboard para que cada usuário autorize seu respectivo canal do YouTube.
  - [ ] Armazenamento criptografado dos Refresh Tokens por usuário no banco de dados.
  - [ ] Medidor de cota diária individualizado por canal (10.000 unidades do canal do cliente).

### US-08.4: Painel Administrativo de Gestão de Clientes
* **Descrição:** Como proprietário do SaaS, quero uma tela administrativa para cadastrar clientes, ativar/desativar acessos e monitorar uso geral da plataforma.
* **Critérios de Aceite:**
  - [ ] Endpoint seguro para criação de novas chaves de clientes.
  - [ ] Métrica de total de requisições e taxa de sucesso por cliente.
  - [ ] Limite de taxa (Rate Limiting) por usuário para evitar sobrecarga do Cloud Run.
