# AutoPublisher Pro 🚀

> Plataforma completa de automação de conteúdo e orquestração de postagens em redes sociais (**YouTube Shorts**, **Instagram Reels**, **TikTok**), combinando uma **esteira de geração de vídeos por IA (Upstream)** com um **microsserviço serverless de publicação (Downstream)** em **Java 21** e **Spring Boot 3**. Foco em **canais automatizados/dark**, **monetização máxima** e **custo operacional R$ 0,00**.

---

## 🏗️ Arquitetura do Sistema End-to-End

O AutoPublisher Pro opera em duas camadas totalmente integradas e complementares:

```
 ┌─────────────────────────────────────────────────────────────────────────────┐
 │                 UPSTREAM: PIPELINE DE GERAÇÃO POR IA (Node.js)              │
 │                                                                             │
 │  Tema / Perfil ──► Roteiro 4 Blocos ──► Edge-TTS Neural ──► Legendas ASS   │
 │                         (150 palavras)    (pt-BR-Antonio)      (Karaokê)    │
 │                                                  │                 │         │
 │  Assets 9:16 ──► Ken Burns Zoompan ──────────────┴─────────────────┼─────────┤
 │                                                                    ▼         │
 │                           FFmpeg Compositor ──► MP4 9:16 (60s TikTok Ready) │
 └──────────────────────────────────────┬──────────────────────────────────────┘
                                        │ (Upload de Mídia & Metadados)
                                        ▼
 ┌─────────────────────────────────────────────────────────────────────────────┐
 │                  GOOGLE DRIVE & GOOGLE SHEETS (ou REST API)                 │
 │     - Google Drive: Armazena o MP4 e a Thumbnail personalizada              │
 │     - Google Sheets: Registra linha na aba 'Cronograma' com status PENDENTE │
 └──────────────────────────────────────┬──────────────────────────────────────┘
                                        │
                                        ▼ (Disparo Cloud Scheduler / REST)
 ┌─────────────────────────────────────────────────────────────────────────────┐
 │            DOWNSTREAM: AUTOPUBLISHER PRO (Java 21 / Spring Boot 3)          │
 │                                                                             │
 │   - Leitura de agendamentos pendentes no Sheets                             │
 │   - Streaming Zero-Copy de vídeo e capa do Drive via InputStream            │
 │   - Upload no YouTube Data API v3 (Resumable Chunks de 5MB)                 │
 │   - Publicação no Instagram Reels (Meta Graph) e TikTok Direct Post         │
 │   - Fixação do Primeiro Comentário de Afiliados com rastreamento UTM        │
 │   - Quota Guard (10.000 unidades diárias da API do YouTube)                 │
 │   - Atualização cirúrgica de status (PUBLICADO) e URLs na Planilha          │
 └─────────────────────────────────────────────────────────────────────────────┘
```

---

## 🌟 Principais Recursos

### 1. Upstream AI Video Engine (`pipeline/`)
* **Duração TikTok Creator Rewards Ready ($\ge 60$s):** Roteiros estruturados em 4 blocos de retenção (Gancho, Foco Científico, Hack Prático e CTA) calibrados para 145 a 165 palavras a uma taxa de locução de -4%, gerando vídeos com 60 a 65 segundos de retenção máxima.
* **Locução Neural Gratuita (R$ 0,00):** Síntese com `msedge-tts` (`pt-BR-AntonioNeural`), capturando *word boundaries* em microssegundos via WebSocket.
* **Legendas Dinâmicas em Karaokê:** Renderização de arquivos `.ass` com destaque de palavra ativa em Amarelo Ouro (`#FFD700`) e Ciano (`#00E5FF`), sem bibliotecas pagas de transcrição.
* **Composição Cinematográfica FFmpeg:** Efeito de movimento de câmera Ken Burns (*zoompan*), formatação estrita 9:16 (1080x1920) e mapeamento explícito de streams de áudio e vídeo (`-map [v_out]`, `-map 1:a`).
* **Arquitetura Orientada a Perfis Multi-Nicho:** Suporte a qualquer tema adicionando um arquivo JSON declarativo em `pipeline/config/channels/{canal}.json`.

### 2. Downstream Serverless Publisher (`com.autopublisher`)
* **Streaming Zero-Copy:** Tráfego direto do Google Drive para o YouTube via `InputStreamContent`, operando estavelmente com menos de **256MB de RAM** mesmo com arquivos de mídia grandes.
* **Autenticação Headless Permanente:** Renovação de `access_token` em memória via OAuth 2.0 com `refresh_token` offline permanente (resolvendo a limitação de Service Accounts no YouTube).
* **Conformidade COPPA & Monetização:** Flag `selfDeclaredMadeForKids: false` mandatória, injeção de `#Shorts` e primeiro comentário com links de afiliados fixado automaticamente.
* **Interface Híbrida & Studio IA:** Opere pelo **Google Sheets** ou pelo **Web Dashboard** interativo em `http://localhost:8080/`. O novo **Studio IA Integrado** permite planejar temas, pré-visualizar roteiros de 4 blocos, gerar vídeos verticais de alta retenção com FFmpeg e acompanhar o console em tempo real diretamente pelo navegador.
* **Gestão e Reprocessamento de Posts:** Modal de detalhes completos, cópia em 1 clique de primeiro comentário de afiliados, links diretos para vídeos publicados e reprocessamento sob demanda de postagens com falha.
* **Custo Zero Real (R$ 0,00):** Escala a zero no Google Cloud Run (`min-instances: 0`), acionado pontualmente pelo Google Cloud Scheduler.

---

## 📂 Estrutura do Repositório

```
auto-publisher/
├── pipeline/                         # Upstream: Motor de Criação de Vídeos por IA
│   ├── config/channels/              # Perfis de canais (psicosegredo.json, channel_template.json)
│   ├── assets/scenes/                # Assets visuais 9:16 por canal
│   ├── src/                          # Código-fonte da esteira Node.js
│   │   ├── run_pipeline.js           # CLI Master Runner
│   │   ├── script_generator.js       # Roteirização em 4 blocos e metadados SEO
│   │   ├── voice_synthesizer.js      # Locução neural Edge-TTS + word boundaries
│   │   ├── subtitle_generator.js     # Compilação de legendas dinâmicas (.ass / .srt)
│   │   ├── visuals_harvester.js      # Seleção de b-roll e gerador de thumbnails
│   │   ├── video_compositor.js       # Composição de vídeo e áudio com FFmpeg
│   │   └── publisher_ingestor.js     # Ingestão na API REST do AutoPublisher
│   └── package.json                  # Dependências do pipeline (gerenciado via pnpm)
│
├── src/main/java/com/autopublisher/  # Downstream: Microsserviço Java 21 Spring Boot
│   ├── domain/                       # Entidades e regras puras (Zero dependências externas)
│   ├── application/                  # Portas (in/out) e Casos de Uso
│   └── infrastructure/               # Adaptadores (Sheets, Drive, YouTube, Reels, TikTok)
│
├── src/main/resources/static/        # Dashboard Web e Central de Credenciais
├── docs/                             # Documentação técnica e operacional completa
├── Dockerfile                        # Multi-stage build otimizado (JRE Alpine ~150MB)
└── pom.xml                           # Build Maven do backend Java
```

---

## 🚀 Como Executar

### 1. Pré-requisitos
* **Java 21 LTS** e **Maven**
* **Node.js 20+** e **pnpm** (`npm install -g pnpm`)
* **FFmpeg** instalado no PATH (ou via pacotes `@ffmpeg-installer/ffmpeg`)
* Arquivo `.env` configurado na raiz (utilize o modelo do dashboard ou `.env.example`)

---

### 2. Geração de Vídeos por IA (Upstream)

Instale as dependências da esteira de vídeo com `pnpm`:
```bash
# Na raiz do projeto ou dentro de pipeline/
pnpm install
```

Execute o pipeline para criar um vídeo completo (áudio, legendas, cortes 9:16 e thumbnail):
```bash
# Executa o roteiro 1 do canal piloto (@psicosegredo)
pnpm pipeline --channel psicosegredo --script 0

# Ou criar vídeo a partir de um tema dinâmico
pnpm pipeline --channel psicosegredo --topic "Como desarmar uma discussão em 5 segundos"
```

O vídeo final será gerado em `pipeline/output/run_{timestamp}/video_final_9x16.mp4` e o manifesto de publicação em `POST-AUTO-*_manifest.json`.

---

### 3. Backend e Agendador Serverless (Downstream)

#### Executar Testes Automatizados com JaCoCo:
```bash
./mvnw clean test
# Relatório de cobertura: target/site/jacoco/index.html (Cobertura > 92%)
```

#### Iniciar a Aplicação Localmente:
```bash
./mvnw spring-boot:run
```
* **Dashboard Web:** Abra `http://localhost:8080/dashboard` para visualizar métricas, tabela de agendamento e central de chaves.
* **Disparo Manual da Fila:**
```bash
curl -X POST http://localhost:8080/api/v1/publisher/run \
  -H "X-API-KEY: sua-chave-configurada"
```

#### Execução Local com Docker e Docker Compose:
1. Copie o arquivo de exemplo de variáveis de ambiente:
```bash
cp .env.example .env
```
*(No Windows PowerShell: `Copy-Item .env.example .env`)*

2. Inicie o contêiner em segundo plano:
```bash
docker compose up -d --build
```

3. Acesse a aplicação e monitore o status:
* **Dashboard Web & Studio IA:** [http://localhost:8080/](http://localhost:8080/)
* **Health Check:** [http://localhost:8080/api/v1/health](http://localhost:8080/api/v1/health)
* **Logs em tempo real:** `docker compose logs -f`
* **Parar o contêiner:** `docker compose down`


---

## 📚 Central de Documentação

* 🌐 [**Manual Interativo do Usuário (HTML)**](docs/manual/index.html): Guia visual completo com passo a passo ilustrado, configuração de credenciais e FAQ.
* 📋 [**Product Requirements Document (PRD v2.0 Pro)**](docs/PRD_AutoPublisher_Completo.md): Visão completa do produto, regras de negócio e requisitos funcionais.
* 🎬 [**PRD do Pipeline de Geração de Vídeos por IA**](docs/PRD_Pipeline_Automacao_Conteudo.md): Especificação arquitetural do motor upstream desacoplado.
* 💰 [**Detalhes Operacionais & Custo Zero**](docs/Detalhes_Operacional.md): Análise minuciosa de custo R$ 0,00 e cálculo de rentabilidade (TikTok Creator Rewards e YouTube Shorts).
* ✅ [**Definition of Done (DoD)**](docs/DoD.md): Critérios de qualidade, testes unitários (mín. 80%), boas práticas e conformidade de monetização.
* 🏛️ [**Architectural Decision Records (ADRs)**](docs/adr/README.md): Histórico de decisões técnicas fundamentadas.
* 📊 [**Product Backlog (Épicos 01 a 09)**](docs/backlog/README.md): Todas as histórias de usuário implementadas com rastreabilidade total.

---

## 📊 Métricas de Qualidade e Conformidade

| Dimensão / Regra | Critério | Atingido | Status |
| :--- | :---: | :---: | :---: |
| **Cobertura de Casos de Uso (Service)** | $\ge 80\%$ | **92.8%** | ✅ Superado |
| **Cobertura de Domínio e Entidades** | $\ge 80\%$ | **94.7%** | ✅ Superado |
| **Uso de Memória Heap no Upload** | Zero-Copy | **0 bytes alocados (InputStream)** | ✅ Aprovado |
| **Duração do Vídeo IA (TikTok Rewards)** | $\ge 60$s | **60.0 segundos** | ✅ Aprovado |
| **Conformidade COPPA** | `madeForKids: false` | **Garantido em código** | ✅ Aprovado |
| **Quota Guard YouTube** | Max 6 posts/dia (10k units) | **QuotaExceededException** | ✅ Aprovado |
| **Custo Mensal de Infraestrutura** | R$ 0,00 | **100% Free Tier (Cloud Run + Sheets + Edge-TTS)** | ✅ Aprovado |



---

## 🐳 Execução via Docker Performático

O projeto conta com um `Dockerfile` multi-stage altamente otimizado com **Java 21 LTS**, **Alpine Linux**, **FFmpeg** e **Virtual Threads**:

```bash
# Build e inicialização do contêiner local
docker compose up --build -d

# Verificação de logs e status
docker compose logs -f
```

A aplicação responde em `http://localhost:8080` com consumo típico inferior a 256MB de RAM.


---

## 🐳 Execução de Alta Performance com Docker

O AutoPublisher Pro conta com um Dockerfile multi-stage otimizado com Java 21, FFmpeg headless nativo e fontes TrueType para renderização de legendas:

```bash
# Build e inicialização em segundo plano
docker compose up -d --build

# Verificação de liveness e status
curl http://localhost:8080/api/v1/health

# Visualização de logs
docker compose logs -f
```
