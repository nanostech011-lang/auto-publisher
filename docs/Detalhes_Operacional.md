# Detalhes Operacionais e Estrutura de Custos - AutoPublisher Pro

O custo operacional para rodar o **AutoPublisher Pro** é exatamente **zero (R$ 0,00/mês)**, estruturado para operar dentro das camadas gratuitas (*Free Tiers*) das plataformas do Google Cloud e APIs de redes sociais.

---

## 1. Decomposição de Custos por Camada

### 1.1. Comunicação e APIs do Google (YouTube, Drive, Sheets)
*   **Custo:** R$ 0,00
*   **YouTube Data API v3:** O Google concede **10.000 unidades de cota gratuitas por dia** por projeto no Google Cloud (reinicia às 04:00 BRT).
    *   Upload de vídeo (`videos.insert`): 1.600 unidades.
    *   Definição de miniatura personalizada (`thumbnails.set`): 50 unidades.
    *   Custo por postagem completa: **1.650 unidades**.
    *   **Capacidade Diária Gratuita:** Até **6 postagens completas por dia** ($6 \times 1.650 = 9.900$ unidades), ideal para manter um canal aquecido com 1 a 6 vídeos diários no algoritmo sem pagar nada.
*   **Google Sheets API:** Limite gratuito de 300 requisições por minuto por projeto. O microsserviço realiza apenas 1 leitura de lote e 1 atualização pontual por postagem.
*   **Google Drive API:** Limite gratuito de 20.000 requisições a cada 100 segundos. O consumo é feito diretamente via stream de dados.

### 1.2. Hospedagem Serverless (Google Cloud Run + Cloud Scheduler)
*   **Custo:** R$ 0,00
*   **Google Cloud Run:** A camada gratuita (*Always Free*) inclui **2 milhões de requisições por mês**, além de **360.000 GB-segundos** de memória e **180.000 vCPU-segundos** mensais.
    *   Com a configuração de `min-instances: 0` e consumo de apenas 512MB de RAM, o contêiner só é provisionado no momento do disparo e é desligado logo após terminar o lote (tempo médio de execução de 30 a 90 segundos por vídeo em stream direto de alta velocidade no backbone do Google).
*   **Google Cloud Scheduler:** O Google Cloud oferece **3 jobs de agendamento cron totalmente gratuitos** por conta de faturamento. Um único job disparando a cada 30 ou 60 minutos consome 0% da franquia paga.

### 1.3. Armazenamento de Arquivos de Vídeo e Thumbnails
*   **Custo:** R$ 0,00
*   Utiliza-se o armazenamento da sua própria conta do **Google Drive** (15 GB no plano gratuito Google, ou o espaço já contratado do Google One/Workspace).
*   **Estratégia de Gestão de Espaço:** Como o processamento é feito via stream direto, os vídeos antigos já publicados podem ser movidos automaticamente para uma pasta "Lixeira / Arquivo" ou deletados periodicamente, mantendo o uso de disco sempre abaixo de 10 GB.

### 1.4. Banco de Dados e Interface do Usuário (UI)
*   **Custo:** R$ 0,00
*   O **Google Sheets** e o **Web Dashboard embarcado** (`/dashboard`) eliminam a necessidade de pagar por bancos relacionais gerenciados (como PostgreSQL ou MySQL em instâncias RDS/Cloud SQL que custam no mínimo R$ 80 a R$ 150/mês).
*   Além de banco de dados ACID e rastreável, a planilha oferece uma interface visual completa para celular e desktop, permitindo que você agende vídeos de qualquer lugar.

### 1.5. Pipeline Upstream de Criação de Vídeos por IA (Épico 09)
*   **Custo:** R$ 0,00
*   **Locução Neural Edge-TTS:** Utiliza a biblioteca `msedge-tts` para síntese de vozes neurais ultra-realistas (`pt-BR-AntonioNeural` / `pt-BR-FranciscaNeural`) via WebSocket com custo zero, eliminando custos recorrentes de plataformas de áudio como ElevenLabs (US$ 5 a US$ 22/mês).
*   **Composição & Renderização com FFmpeg:** O motor de composição visual (`pipeline/src/video_compositor.js`) roda localmente ou em contêiner com consumo mínimo de recursos, utilizando filtros complexos para efeito Ken Burns (*zoompan*), legendas em karaokê dinâmico e mixagem estéreo sem necessidade de softwares proprietários de edição (Premiere, After Effects ou CapCut Pro).
*   **Assets Visuais Royalty-Free:** Curadoria automática de b-roll vertical e geração de cenas cinematográficas em 9:16 sob licenças abertas comerciais (Pexels API, Pixabay, assets autorais procedurais), sem custos de licenciamento de banco de vídeos.

---

## 2. Viabilidade e Potencial de Monetização

Com o custo de infraestrutura travado em **R$ 0,00**, todo e qualquer faturamento gerado pelo canal se torna **lucro líquido direto (100% margem)**.

| Canal de Monetização | Mecânica de Conversão | Papel do AutoPublisher & Pipeline |
| :--- | :--- | :--- |
| **TikTok Creator Rewards Program** | Monetização direta de visualizações qualificadas para vídeos verticais com **duração $\ge 60$ segundos** (RPM varia de US$ 0,50 a US$ 1,20 / ~R$ 2,50 a R$ 6,00 por mil views) | O pipeline calibra a taxa de locução (-4%) e contagem de palavras (145-165 palavras) para garantir que cada vídeo atinja rigorosamente $\ge 60$s, desbloqueando essa receita inacessível a Shorts comuns. |
| **YouTube Shorts Fund / YPP** | Visualizações no Feed de Shorts (RPM varia de R$ 0,20 a R$ 1,00 por mil views) | Garante postagem diária consistente e sinalização obrigatória de `madeForKids: false`. |
| **Marketing de Afiliados** | Venda de infoprodutos, assinaturas ou ferramentas via links na descrição e comentários fixados | Injeção padronizada de links de afiliados rastreados com UTM na descrição de cada vídeo e publicação do primeiro comentário fixado. |
| **Vídeos Longos (AdSense)** | RPM maior (R$ 5,00 a R$ 35,00 por mil views dependendo do nicho) | Upload programado com miniatura personalizada (`thumbnails.set`) para maximizar o CTR. |
| **Parcerias / Publis** | Fechamento de patrocínios mensais pelo alcance orgânico alcançado | Escala automática sem necessidade de contratar assistentes virtuais para upload manual. |

---

## 3. Gestão de Riscos e Melhores Práticas Operacionais

1. **Evitar o "Spam Flag":** Não agende mais de 6 vídeos simultaneamente no mesmo minuto. Distribua os horários (ex: 08:00, 12:00, 15:00, 18:00, 20:30) para maximizar a retenção do algoritmo.
2. **Processamento Prévio (Content ID):** Ao usar `UNLISTED` com conversão para público ou `publishAt`, o YouTube analisa previamente reivindicações de direitos autorais de trilhas sonoras antes do tráfego orgânico entrar, prevenindo perdas de monetização.
3. **Renovação Segura do Refresh Token:** Para evitar que o token de atualização expire a cada 7 dias em modo de teste, a tela de consentimento do Google Cloud Console deve ser colocada no status **"Em Produção"** (com tipo de usuário Externo, sem necessidade de verificação completa do Google caso apenas o proprietário utilize a aplicação).

---

## 4. Estratégia de Distribuição e Acesso Multi-Usuário

Ao disponibilizar o projeto para outras pessoas (clientes, parceiros, alunos ou criadores), a estratégia adotada segue as seguintes diretrizes:

### 4.1. Modelo Self-Hosted / Instância Própria (Recomendado)
* **Como funciona:** Você entrega o projeto pronto para a pessoa subir a automação na conta dela do Google Cloud.
* **Segurança e Chaves:** **Sim! Cada um terá a sua própria chave (`AUTO_PUBLISHER_API_KEY`) no seu próprio servidor.** A chave de um usuário não acessa o servidor nem a planilha do outro.
* **Cotas 100% Individuais:** Cada usuário conta com suas próprias **10.000 unidades diárias da YouTube Data API v3** (até 6 vídeos/dia) sem concorrência ou divisão de cota.
* **Custo R$ 0,00 Mantido:** Cada usuário consome a camada gratuita (*Always Free*) da sua própria conta do Google Cloud, sem custos de servidor para o mantenedor do projeto.

### 4.2. Modelo SaaS Centralizado (Multi-Tenant)
* **Como funciona:** Todas as pessoas utilizam a sua mesma URL central do Cloud Run.
* **Requisitos de Evolução:** Podemos implementar o suporte **Multi-Tenant com banco de dados** (ex: PostgreSQL / Supabase / Firebase) para que você possa cadastrar clientes e gerar chaves individuais (`user_api_key`) por usuário, vinculando cada chave à respectiva planilha e canal social.
* **Atenção à Cota:** Nesse formato compartilhado, a cota de 10.000 unidades do YouTube precisará ser gerida via OAuth individual por cliente ou solicitação de ampliação de cota junto ao Google.