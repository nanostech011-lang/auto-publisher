# AutoPublisher Pro — Frontend Web Decoupled 🌐

> Interface visual completa e desacoplada do **AutoPublisher Pro** (Studio IA, Gestão de Vídeos, Agendamento em Redes Sociais e Monitoramento), pronta para publicação **100% gratuita no GitHub Pages** (custo R$ 0,00).

---

## 🚀 Como Publicar no GitHub Pages (Custo R$ 0,00)

### Passo 1: Habilitar o GitHub Pages no Repositório
1. Acesse o seu repositório no GitHub: `https://github.com/SEU_USUARIO/auto-publisher`
2. Vá em **Settings** (Configurações) ➔ **Pages** (no menu lateral esquerdo).
3. Na seção **Build and deployment**:
   * Em **Source**, selecione **GitHub Actions**.

### Passo 2: Disparar a Publicação
* Qualquer `git push` na branch `main` que altere a pasta `frontend/` dispara automaticamente o workflow [`.github/workflows/deploy-pages.yml`](../.github/workflows/deploy-pages.yml).
* Ou acesse a aba **Actions** no GitHub, clique em **Publicar Dashboard no GitHub Pages** e clique em **Run workflow**.
* Em menos de 1 minuto, seu frontend estará online no endereço:
  ```
  https://SEU_USUARIO.github.io/auto-publisher/
  ```

---

## 🔌 Conectando ao Backend Serverless

Como o frontend está hospedado no GitHub Pages e o backend roda no Google Cloud Run (ou localmente), a aplicação utiliza comunicação segura via **CORS** e autenticação com `X-API-KEY`.

1. Ao abrir o frontend no GitHub Pages, clique no botão **Conectar API** no topo direito (ou abra o menu pelo atalho `Ctrl + K`).
2. Digite a URL Base do seu backend:
   * **Produção (Cloud Run):** `https://autopublisher-xxxxxxxx.a.run.app`
   * **Desenvolvimento Local:** `http://localhost:8085` (ou seu túnel Ngrok/Cloudflare Tunnel)
3. Digite sua **X-API-KEY** configurada no backend.
4. Clique em **Testar Conexão** para validar a comunicação e depois em **Salvar & Conectar**.

> 🔒 **Segurança:** A URL da API e a chave ficam salvas exclusivamente no `localStorage` do seu navegador e nunca são expostas no repositório.

---

## 🛠️ Como Executar o Frontend Localmente

Você pode abrir o `index.html` diretamente no navegador ou servir com qualquer servidor HTTP estático local:

```bash
# Opção 1: Usando npx serve
npx serve frontend

# Opção 2: Usando Python
python -m http.server 3000 --directory frontend

# Opção 3: Abrir diretamente no navegador
# Dê dois cliques em frontend/index.html
```

---

## 📦 Como Separar em um Repositório Git Exclusivo (Opcional)

Se você preferir manter o frontend em um repositório Git totalmente separado (ex: `auto-publisher-web`):

1. Crie um novo repositório vazio no GitHub (`auto-publisher-web`).
2. Copie o conteúdo da pasta `frontend/` para a raiz do novo repositório.
3. No novo repositório, ative o GitHub Pages em **Settings ➔ Pages ➔ GitHub Actions** ou selecione a branch `main / root`.
