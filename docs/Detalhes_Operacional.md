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
*   O **Google Sheets** elimina a necessidade de pagar por bancos relacionais gerenciados (como PostgreSQL ou MySQL em instâncias RDS/Cloud SQL que custam no mínimo R$ 80 a R$ 150/mês).
*   Além de banco de dados ACID e rastreável, a planilha oferece uma interface visual completa para celular e desktop, permitindo que você agende vídeos de qualquer lugar.

---

## 2. Viabilidade e Potencial de Monetização

Com o custo de infraestrutura travado em **R$ 0,00**, todo e qualquer faturamento gerado pelo canal se torna **lucro líquido direto (100% margem)**.

| Canal de Monetização | Mecânica de Conversão | Papel do AutoPublisher |
| :--- | :--- | :--- |
| **YouTube Shorts Fund / YPP** | Visualizações no Feed de Shorts (RPM varia de R$ 0,20 a R$ 1,00 por mil views) | Garante postagem diária consistente e sinalização obrigatória de `madeForKids: false`. |
| **Marketing de Afiliados** | Venda de infoprodutos, assinaturas ou ferramentas via links na descrição | Injeção padronizada de links de afiliados rastreados com UTM na descrição de cada vídeo. |
| **Vídeos Longos (AdSense)** | RPM maior (R$ 5,00 a R$ 35,00 por mil views dependendo do nicho) | Upload programado com miniatura personalizada (`thumbnails.set`) para maximizar o CTR. |
| **Parcerias / Publis** | Fechamento de patrocínios mensais pelo alcance orgânico alcançado | Escala automática sem necessidade de contratar assistentes virtuais para upload manual. |

---

## 3. Gestão de Riscos e Melhores Práticas Operacionais

1. **Evitar o "Spam Flag":** Não agende mais de 6 vídeos simultaneamente no mesmo minuto. Distribua os horários (ex: 08:00, 12:00, 15:00, 18:00, 20:30) para maximizar a retenção do algoritmo.
2. **Processamento Prévio (Content ID):** Ao usar `UNLISTED` com conversão para público ou `publishAt`, o YouTube analisa previamente reivindicações de direitos autorais de trilhas sonoras antes do tráfego orgânico entrar, prevenindo perdas de monetização.
3. **Renovação Segura do Refresh Token:** Para evitar que o token de atualização expire a cada 7 dias em modo de teste, a tela de consentimento do Google Cloud Console deve ser colocada no status **"Em Produção"** (com tipo de usuário Externo, sem necessidade de verificação completa do Google caso apenas o proprietário utilize a aplicação).