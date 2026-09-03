# ADR 0005: Google Sheets como Banco de Dados Operacional e Interface do Usuário (UI)

* **Status:** Aceito
* **Data:** 2026-09-03
* **Decisores:** Time de Arquitetura e Engenharia AutoPublisher
* **Contexto Técnico:** [Detalhes_Operacional.md](../Detalhes_Operacional.md) e [PRD_AutoPublisher_Completo.md](../PRD_AutoPublisher_Completo.md) - Seção 6

---

## 1. Contexto e Problema

Todo microsserviço de agendamento e automação precisa de:
1. Um repositório persistente para registrar o cronograma de postagens, metadados (título, descrição, links de afiliados) e histórico de execução (status, IDs publicados, logs de erro).
2. Uma interface de usuário para que o criador de conteúdo possa cadastrar novos vídeos, editar descrições e acompanhar as postagens pelo celular ou computador.

Soluções convencionais exigiriam:
* Hospedagem de um banco de dados relacional (ex: PostgreSQL / MySQL no AWS RDS ou Google Cloud SQL), com custo mínimo mensal de R$ 80 a R$ 180 mesmo nos menores planos.
* Desenvolvimento e hospedagem de um frontend web (React, Vue, Next.js) com tela de autenticação, formulários e tabela de controle.

Como a premissa inegociável do produto é **custo operacional financeiro zero (R$ 0,00)** e simplicidade máxima para o criador, era necessário encontrar uma alternativa pronta, gratuita e acessível.

---

## 2. Decisão

Decidimos utilizar o **Google Sheets** como banco de dados transacional/operacional e interface gráfica unificada do AutoPublisher:

1. **Camada de Apresentação (UI):**
   * O criador utiliza a própria interface web ou aplicativo móvel do Google Sheets para colar os IDs dos vídeos do Drive, preencher os títulos, descrições com links de afiliados e definir os horários.
   * Não há necessidade de construir, manter ou hospedar qualquer aplicação frontend.

2. **Camada de Persistência (Banco de Dados):**
   * A aba `Cronograma` funciona como a tabela principal com esquema rígido de 16 colunas (definido na Seção 6 do PRD).
   * O `GoogleSheetsAdapter` realiza a leitura de dados via Google Sheets API v4 (`spreadsheets.values.get`).
   * A escrita de status, data de publicação e logs de erro é feita de forma cirúrgica na linha correspondente via `spreadsheets.values.update` (ex: range `Cronograma!L2:P2`), evitando sobrescrever a planilha inteira.

3. **Concorrência e Cotas:**
   * A Google Sheets API oferece cota gratuita de **300 requisições por minuto por projeto** (suficiente para um fluxo de 5 a 20 postagens diárias).
   * Apenas o AutoPublisher e o usuário interagem com a planilha, eliminando riscos de concorrência massiva de múltiplos clientes.

---

## 3. Consequências

### Pontos Positivos
* **Custo Zero Real:** Economia de 100% nos custos de hospedagem de banco de dados e servidores web de frontend.
* **Acessibilidade Móvel Imediata:** O criador de conteúdo pode agendar ou alterar postagens diretamente pelo app oficial do Google Planilhas no smartphone de qualquer lugar.
* **Histórico e Auditoria Nativos:** O Google Sheets mantém versionamento e histórico de alterações nativos de cada célula.
* **Fácil Integração com Outras Automações:** Permite que ferramentas No-Code (Make, Zapier, n8n) ou scripts em Python/Google Apps Script alimentem a planilha automaticamente com novos conteúdos gerados por IA.

### Pontos de Atenção / Trade-offs
* **Ausência de Chaves Estrangeiras e Tipagem Rígida de BD:** Planilhas não impedem que um usuário acidentalmente digite texto em uma coluna numérica. **Mitigação:** O `GoogleSheetsAdapter` e a camada de aplicação executam validação rígida de tipos e regras de negócio antes de processar qualquer linha. Linhas com formatação inválida são marcadas imediatamente com status `ERRO_FATAL` na coluna de logs.
* **Desempenho com Volumes Extremos:** Planilhas não são adequadas para milhões de registros. Como o volume operacional de um canal dark varia entre 30 e 180 postagens por mês, a tabela permanecerá extremamente leve por anos.
