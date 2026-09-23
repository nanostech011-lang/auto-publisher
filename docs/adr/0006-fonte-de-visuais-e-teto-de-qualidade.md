# ADR 0006: Fonte dos Visuais e o Teto de Qualidade do Vídeo Gerado

* **Status:** Proposto
* **Data:** 2026-09-15
* **Decisores:** Dono do produto (decisão de custo) + Time de Engenharia
* **Contexto Técnico:** [Plano de Refatoração](../Plano_Refatoracao_Qualidade_Pipeline.md) e [SDD v3](../SDD_Pipeline_Conteudo_IA_v3.md)

---

## 1. Contexto e Problema

O [ADR 0002](0002-gatilho-serverless-cloud-scheduler-cloud-run.md) e o [ADR 0005](0005-google-sheets-como-banco-de-dados-e-painel-operacional.md) estabeleceram **custo financeiro zero (R$ 0,00)** como premissa inegociável do produto. Essa premissa foi herdada sem revisão pelo pipeline de geração de conteúdo (Épico 09), onde passou a determinar a escolha dos provedores de imagem.

A verificação empírica do pipeline em produção (2026-09-15) mostrou que, no domínio de **geração de imagem**, essa premissa impõe um teto de qualidade que torna o produto impublicável.

### 1.1 Fatos verificados

Probes reais executados contra a `GEMINI_API_KEY` configurada e contra o endpoint do Pollinations:

| Fato | Evidência |
|---|---|
| O tier primário do código chama um modelo inexistente | `models/imagen-3.0-generate-002:predict` → **HTTP 404 NOT_FOUND** |
| A chave não tem cota alguma de imagem no free tier | `gemini-*-image:generateContent` → **HTTP 429**, `quotaId: GenerateRequestsPerDayPerProjectPerModel-FreeTier`, **`limit: 0`** |
| O texto funciona normalmente | `gemini-flash-lite-latest` → 200 OK em 699ms |
| O Pollinations oferece um único modelo | `GET image.pollinations.ai/models` → **`["sana"]`**; `model=flux` e `model=turbo` retornam bytes idênticos |
| O Pollinations tem teto rígido de pixels | 1080x1920 pedido → 576x1024 entregue; 768x1344 → 580x1015; 1024x1024 → 768x768. Todos em torno de **0,59 MP** |
| `nologo=true` é ignorado no tier anônimo | Marca d'água `pollinations.ai` queimada e visível no frame t=0,3s do MP4 publicado |
| A degradação é mensurável | Nitidez (energia de borda) do render final: **1,20**. Asset nativo do repositório, para comparação: **5,04** |

O alvo de 1080x1920 são 2,07 MP. O teto gratuito entrega **28% dos pixels do alvo**, com marca d'água de terceiro, e o pipeline compensa com upscale bicúbico de 3,75x lineares (14x em área).

### 1.2 O problema da premissa

A premissa de custo zero é **correta para infraestrutura** (Cloud Run scale-to-zero, Sheets, Drive) e continua valendo integralmente. Ela é **incorreta para geração de imagem**, onde o mercado gratuito não oferece resolução publicável. Manter a premissa nesse domínio não economiza dinheiro: produz um artefato que não pode ser publicado, o que custa o valor inteiro do trabalho.

---

## 2. Decisão

Decidimos **segmentar a premissa de custo por domínio** e adotar uma cascata de provedores ordenada por custo/qualidade, com o custo tratado como decisão explícita e medida.

### 2.1 Cascata de provedores de imagem

| Tier | Provider | Custo | Uso |
|---|---|---|---|
| **T0** | Cache local content-addressed | US$ 0 | Sempre primeiro; hit só é aceito se `grade.ok` |
| **T1** | `gemini-3.1-flash-image` (`:generateContent`, `imageSize: '2K'`) | ~US$ 0,03/img | Corpo do vídeo |
| **T2** | `gemini-3-pro-image` (`:generateContent`, `imageSize: '4K'`) | ~US$ 0,13/img | Gancho (beat 1) e thumbnail |
| **T3** | Pexels → Pixabay (B-roll 1080x1920 **real**) | US$ 0 | Cenas de ação humana concreta |
| **T4** | Pollinations + restauração e crop de marca d'água | US$ 0 | Último recurso remoto |
| **T5** | Cena procedural chiaroscuro | US$ 0 | Rede indisponível |

**Custo-alvo: abaixo de US$ 0,10 por vídeo**, obtido restringindo T2 ao gancho e à thumbnail (onde retenção e CTR pagam o preço) e usando T3 gratuito para todo conteúdo que admita vídeo real.

### 2.2 Decisões de suporte

1. **Pexels e Pixabay tornam-se dependência de primeira classe.** As chaves são gratuitas (Pexels: 20.000 req/mês) e entregam 1080x1920 nativo real. O tier existe no código desde a v2 mas nunca executou: as chaves não estão no `.env` **e** o harvester não as repassa.
2. **Todo asset é validado por decodificação real.** Resolução mínima 864x1536, desvio de aspecto no máximo 0,06, luminância em [38, 215], heurística de marca d'água. Asset reprovado cai para o próximo tier — nunca é aceito com aviso.
3. **A disponibilidade de modelo é resolvida em runtime.** `models.list` no preflight derruba qualquer model id ausente antes de produzir. Nenhum model id fica hardcoded como premissa.
4. **O custo é medido e tem teto por run**, registrado em `report.json`.

---

## 3. Alternativas Consideradas

### 3.1 Manter custo zero estrito (só Pollinations)

**Rejeitada.** O teto de 0,59 MP é estrutural, não contornável por parâmetro. A melhor cadeia de restauração testada (crop da marca d'água + lanczos 2x + `hqdn3d` + `unsharp`) elevou a nitidez de 1,20 para 1,37 — **+14%**, contra os 5,04 de um asset nativo. Não há detalhe a recuperar em um arquivo que nunca o teve.

Permanece disponível como T4 e como modo de operação explícito para quem aceitar o trade-off.

### 3.2 Somente B-roll de stock (Pexels/Pixabay)

**Rejeitada como solução única, adotada como T3.** Entrega 1080x1920 real e custo zero, mas cobre mal conceitos abstratos (dopamina, amígdala, efeito composto) e não atende estilos autorais (Ghibli, anime, estoico em mármore) que são a identidade visual dos canais.

### 3.3 Geração local com GPU (Stable Diffusion / ComfyUI)

**Rejeitada.** Exige GPU dedicada e um runtime Python pesado, incompatível com o alvo de deploy (Cloud Run scale-to-zero, contêiner Alpine de 512MB). Violaria o ADR 0002 e o ADR 0003 sem ganho proporcional sobre T1/T2.

### 3.4 Outros provedores pagos (Replicate, Fal, Together, Stability)

**Não adotada agora.** Tecnicamente viáveis e de custo comparável, mas exigiriam uma segunda integração e um segundo conjunto de credenciais. A chave Google já está no projeto e os modelos já estão listados para ela — basta habilitar billing. O `asset_provider_registry.js` é desenhado para aceitar novos providers sem mudança estrutural, mantendo essa porta aberta.

---

## 4. Consequências

### 4.1 Positivas

* Remove o teto de 0,59 MP: fim do upscale de 3,75x, da marca d'água de terceiro e da anatomia deformada.
* Elimina a degradação silenciosa: todo tier indisponível é declarado no preflight, e todo asset reprovado cai para o próximo tier.
* O `asset_provider_registry.js` desacopla a decisão de provider da lógica de pipeline — trocar de provedor deixa de ser refatoração.
* O cache content-addressed torna re-execuções e `--resume` gratuitos, limitando o custo real bem abaixo do nominal.

### 4.2 Negativas e trade-offs

* **Rompe a premissa de R$ 0,00 no domínio de imagem.** A premissa segue íntegra para infraestrutura; mas o pipeline de conteúdo passa a ter custo variável e exige billing habilitado no projeto Google.
* Exige gestão de orçamento: teto por run, alertas e acompanhamento de `totalCostUsd`.
* Duas credenciais gratuitas adicionais a obter e rotacionar (`PEXELS_API_KEY`, `PIXABAY_API_KEY`).
* O roteamento entre T1/T2/T3 depende da classificação `suggestedType` do beat — uma classificação ruim desperdiça tier pago em cena que o stock cobriria.

### 4.3 Mitigações

* Teto de gasto por run, com falha dura ao ser excedido.
* T2 (4K) restrito a exatamente dois assets por vídeo: gancho e thumbnail.
* Cache com negative-cache: geração reprovada não é repetida.
* Modo `--free-only` mantido, restringindo a cascata a T0/T3/T4/T5 para quem optar pelo custo zero estrito com o teto de qualidade que ele implica.

---

## 5. Revisão do Invariante

O [GEMINI.md](../../GEMINI.md), Regra 3, declara custo zero como invariante global. Esta ADR propõe a seguinte redação substitutiva para o domínio do Épico 09:

> **Infraestrutura permanece em custo zero** (Cloud Run scale-to-zero, Scheduler, Drive, Sheets, Edge-TTS).
> **A geração de conteúdo tem custo variável, medido e com teto por execução.** Nenhuma execução pode exceder o teto configurado, e todo custo é registrado em `report.json`.

A aprovação desta ADR implica atualizar o GEMINI.md e o [PRD do Pipeline](../PRD_Pipeline_Automacao_Conteudo.md) de acordo.
