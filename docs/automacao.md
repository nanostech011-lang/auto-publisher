# Projeto: Canal Dark TikTok - Psicosegredo

Documento de contexto e especificações para produção de conteúdo e automação de pipeline de vídeo.

---

## 1. Identidade e Posicionamento

* **Nome do Canal / Perfil:** `@psicosegredo`
* **Nicho Principal:** Neurociência prática, inteligência emocional, psicologia comportamental e motivação analítica.
* **Proposta de Valor:** Transformar conceitos científicos densos e neurobiologia em gatilhos e hacks mentais práticos para o dia a dia.
* **Público-Alvo:** Jovens e adultos interessados em desenvolvimento pessoal, autodomínio, foco e comportamento humano.
* **Formato de Vídeo:** Vertical (9:16), duração acima de 60 segundos (elegível ao Programa de Recompensas do Criador), cortes dinâmicos a cada 2–4 segundos.
* **Identidade Visual:** Estética *Dark* minimalista, iluminação dramática (*chiaroscuro*), tons escuros com destaques em azul ciano, roxo néon e dourado. Elementos-chave: circuitos cerebrais, silhuetas, olhos em close e símbolos conceituais (como a chave e o cérebro).

### Bios para o Perfil (Limite: 80 caracteres)
* Opção 1: `🧠 Domine sua mente, mude sua vida. ⚡ Inteligência emocional & motivação.` (74 chars)
* Opção 2: `🧠 O poder da mente a seu favor. ♟️ Motivação e inteligência emocional.` (71 chars)
* Opção 3: `🧠 Mentalidade • Motivação • Autodomínio 🔥 Evolua 1% todos os dias. Siga.` (73 chars)

---

## 2. Referências de Conteúdo Validado

Temas com alto volume de busca e retenção extraídos de vídeos virais:

| Tema | Foco Científico / Comportamental | Gancho Principal |
| :--- | :--- | :--- |
| **Linguagem Corporal & Silêncio** | Resposta da amígdala cerebral ao vácuo comunicativo. | "Se alguém mentir para você, NÃO faça perguntas." |
| **Dopamina & Procrastinação** | Diferença entre dopamina fásica e tônica; dessensibilização de receptores. | "Você não é preguiçoso. Seu cérebro foi hackeado." |
| **Ignorância Emocional** | Vieses cognitivos, paralisia de decisão e repetição de padrões mentais. | "Por que o seu cérebro prefere o erro conhecido do que a mudança." |

---

## 3. Roteiros Prontos para Produção

### Roteiro 1: "O Truque do Silêncio e a Dopamina da Dúvida"
* **Duração estimada:** ~65–70 segundos.
* **Texto para Narração (TTS):**
> "Se você desconfia que alguém está mentindo ou escondendo algo de você, nunca confronte a pessoa na hora. Existe um truque da neurociência muito mais poderoso. Quando a pessoa terminar de falar, não diga absolutamente nada. Apenas faça uma pausa e continue mantendo contato visual direto nos olhos dela. O que acontece no cérebro humano nesse momento é fascinante: o cérebro detesta o vácuo de informação. O silêncio prolongado ativa a amígdala cerebral, gerando um pico imediato de ansiedade e insegurança. A pessoa subconscientemente assume que o seu silêncio significa que você já sabe da verdade. Para tentar preencher o vazio e aliviar o desconforto mental, ela começa a falar mais do que deveria e entrega detalhes que pretendia esconder. O silêncio sob controle sempre entrega mais poder do que qualquer argumento verbal. Siga o Psicosegredo para dominar sua mente antes que usem isso contra você."

* **Prompts Visuais (9:16 - Text-to-Video / Image-to-Video):**
  * **Cena 1 (00:00 - 00:05):** `Cinematic close-up of intense human eyes looking directly into the camera, extreme dark background, dramatic chiaroscuro lighting, subtle cyan and gold edge light, 8k resolution, vertical 9:16`
  * **Cena 2 (00:05 - 00:20):** `Dark aesthetic silhouette of two people sitting across a table, tense standoff, shadowy ambient lighting, minimalist modern room, cinematic atmospheric smoke, vertical 9:16`
  * **Cena 3 (00:20 - 00:38):** `Glowing 3D human brain on a pure black background, neural pathways firing with rapid electric blue and gold synapses, focal point on deep brain amygdala glowing red, hyper-realistic, vertical 9:16`
  * **Cena 4 (00:38 - 00:52):** `Close-up shot of a person's mouth and hands fidgeting with nervousness in dim lighting, subtle sweat, shadow covering the face, cinematic tension, vertical 9:16`
  * **Cena 5 (00:52 - 01:05):** `A glowing gold key hovering inside a minimalist dark silhouette of a mind, volumetric light rays, sleek neon blue rim lighting, elegant dark psychology vibe, vertical 9:16`

---

### Roteiro 2: "A Mentira da Falta de Motivação"
* **Duração estimada:** ~65–70 segundos.
* **Texto para Narração (TTS):**
> "Você não é preguiçoso, e a sua falta de ânimo para mudar de vida tem uma explicação biológica exata. A neurociência explica que a dopamina não é o neurotransmissor do prazer, mas sim da antecipação e da motivação para agir. Quando você passa o dia rolando vídeos curtos, seu cérebro recebe descargas rápidas de dopamina sem nenhum esforço real. Quando você tenta sentar para estudar, treinar ou construir um projeto difícil, sua mente interpreta aquilo como sofrimento extremo, simplesmente porque a recompensa demora a chegar. O nome disso não é incapacidade; é dessensibilização dos seus receptores dopaminérgicos. A regra prática para reiniciar esse circuito: a ação precisa vir antes da vontade. A dopamina só é liberada de forma sustentável depois que os primeiros 5 minutos de uma tarefa começam. Pare de esperar a motivação cair do céu. Force o primeiro movimento. Siga o Psicosegredo e aprenda a controlar sua química mental."

---

## 4. Arquitetura para Pipeline de Automação (MCP / Agentes)

O pipeline de automação para o canal `@psicosegredo` e canais correlatos é formalizado detalhadamente no documento **[PRD: Pipeline de Automação de Produção de Conteúdo e Vídeos Dark por IA](PRD_Pipeline_Automacao_Conteudo.md)**.

### Estrutura de Execução por Etapas:

1. **Etapa 1: Roteirização Estruturada & SEO (Script Engine):**
   * Entrada: Tema ou gatilho validado da neurociência (Tabela de Referências).
   * Processamento: LLM estruturado gerando texto de narração de 150–165 palavras (~65–70s), divisão em 15–20 cenas visuais de 2–4s e metadados SEO (Título com `#Shorts`, Descrição com links UTM de afiliados, Tags e Primeiro Comentário Fixado).

2. **Etapa 2: Síntese Vocal & Timestamps (Voice & Subtitles Engine):**
   * Ferramenta: Microsoft Edge-TTS (`pt-BR-AntonioNeural`, +5% de velocidade) para custo R$ 0,00.
   * Extração: Word boundary timestamps em tempo real via WebSocket.
   * Compilação: Geração de arquivo `.ass` com efeito karaokê dinâmico (palavras destacadas em Amarelo Ouro `#FFD700` e Ciano `#00E5FF` sobre fundo escuro).

3. **Etapa 3: Aquisição de Ativos Visuais 9:16 (Visual Assets Engine):**
   * Ferramenta: Pexels API (vídeos verticais em *dark aesthetic*, silhuetas e iluminação *chiaroscuro*) e/ou motores de IA gerativa (Luma, Kling, Stable Diffusion).
   * Miniatura: Geração de thumbnail com contraste extremo e texto de gancho.

4. **Etapa 4: Composição Audiovisual e Renderização (Video Compositor):**
   * Ferramenta: FFmpeg headless em contêiner efêmero.
   * Ações: Concatenação dos takes visuais com transições rápidas (2–4s), mixagem da voz com trilha dark ambient royalty-free (-22dB) e queima de legendas animadas centralizadas no terço inferior.
   * Saída: Arquivo MP4 H.264 (1080x1920, 9:16, 30fps, áudio -14 LUFS, duração $\ge 61$s).

5. **Etapa 5: Ingestão Direta no AutoPublisher Pro:**
   * Envio automático do MP4 e da Thumbnail para as pastas do canal no **Google Drive**.
   * Inserção do novo agendamento na aba `Cronograma` do **Google Sheets** via API REST (`POST /api/v1/dashboard/posts`), com status `PENDENTE`.
   * Publicação pontual orquestrada pelo **Cloud Scheduler** e **AutoPublisher Pro** no YouTube Shorts, Instagram Reels e TikTok, garantindo 100% de conformidade COPPA e monetização.