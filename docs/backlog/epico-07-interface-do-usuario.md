# Épico 07: Interface Web do Usuário e Central de Credenciais

* **Status:** Concluído
* **Prioridade:** Must Have
* **Complexidade:** Média
* **Data de Conclusão:** 2026-09-03
* **Arquivos Relacionados:**
  * `src/main/resources/static/index.html`
  * `src/main/java/com/autopublisher/infrastructure/controller/DashboardApiController.java`
  * `src/main/java/com/autopublisher/application/usecase/DashboardService.java`
  * `tests/dashboard.spec.js`

---

## 1. Visão Geral

Implementação de uma interface gráfica web moderna (tema escuro com Tailwind CSS e Vanilla/Alpine.js) servida diretamente pelo microsserviço Spring Boot na raiz (`http://localhost:8080/`), sem custos adicionais de hospedagem (R$ 0,00), permitindo que o usuário gerencie seus agendamentos, visualize o consumo de cota e configure todas as credenciais de APIs de forma amigável.

---

## 2. Histórias de Usuário e Critérios de Aceite

### US-07.1: Painel de Indicadores (KPIs) e Quota Guard YouTube
* **Descrição:** O usuário deve visualizar em tempo real os contadores de postagens (Total, Pendentes, Publicados) e o medidor de cota diária da YouTube Data API v3 (0 a 6 vídeos e 0 a 10.000 unidades).
* **Critérios de Aceite:**
  - [x] Cards com estatísticas agregadas sincronizadas com a aba `Cronograma`.
  - [x] Barra de progresso visual colorida para a cota (Verde <50%, Âmbar <80%, Vermelho >80%).
  - [x] Alerta visual caso o status seja `COTA_ESGOTADA`.

### US-07.2: Monitor de Status, Busca e Filtros
* **Descrição:** Visualizar tabela interativa com todas as postagens agendadas, permitindo buscar por título/ID e filtrar por plataforma ou status.
* **Critérios de Aceite:**
  - [x] Tabela responsiva com badges coloridos de plataforma (Shorts, Vídeo, Reels, TikTok) e status.
  - [x] Filtro dinâmico por rede social e por status de publicação.
  - [x] Campo de pesquisa instantânea em tempo real.
  - [x] Exibição do Primeiro Comentário Fixado (Coluna Q).

### US-07.3: Modal de Agendamento com Auto-Detecção de Drive ID
* **Descrição:** Formulário intuitivo para cadastrar novas postagens diretamente na planilha do Google Sheets.
* **Critérios de Aceite:**
  - [x] Extração automática de IDs de arquivos a partir de URLs completas do Google Drive (`/d/{id}`).
  - [x] Validação de limite de 100 caracteres para o título com contador dinâmico.
  - [x] Campo dedicado para o Primeiro Comentário de Afiliados.
  - [x] Persistência via Sheets API (`values.append`) sem sobrescrever dados existentes.

### US-07.4: Central de Chaves & Credenciais All-in-One com Gerador .env
* **Descrição:** Interface amigável para inserir e visualizar todas as chaves e APIs do sistema (Segurança, Sheets, YouTube, Meta, TikTok) com alternador de visibilidade e exportador de `.env`.
* **Critérios de Aceite:**
  - [x] Modal com abas temáticas e chips de status de conexão (`🟢 Conectado` / `⚪ Não configurado`).
  - [x] Botões para alternar visibilidade (olhinho 👁️) para cada token secreto.
  - [x] Botão para consultar status do servidor (`GET /api/v1/dashboard/credentials`).
  - [x] Gerador de arquivo `.env` com botões "Copiar Conteúdo" e "Baixar Arquivo .env".
  - [x] Persistência segura no `localStorage` do navegador para autorizar chamadas `X-API-KEY`.
