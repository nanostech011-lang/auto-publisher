---
name: youtube-oauth-setup
description: >-
  Use this skill when configuring Google Cloud Console credentials, setting up OAuth 2.0 Client IDs,
  generating permanent offline refresh tokens for YouTube Data API v3, configuring environment
  variables, or troubleshooting 401 Unauthorized and 403 quotaExceeded errors.
---

# YouTube Data API v3 - Guia de Configuração e OAuth 2.0 Headless

Este guia contém o procedimento exato para configurar as credenciais do Google Cloud e gerar o `refresh_token` offline permanente necessário para que o **AutoPublisher Pro** publique vídeos no YouTube de forma 100% autônoma.

---

## 1. Por que OAuth 2.0 com Refresh Token?

A **YouTube Data API v3 NÃO aceita upload de vídeos via Service Account** em canais pessoais ou de marca (retorna erro `401 Unauthorized` ou `channel not found`). 

A solução arquitetural definitiva ([ADR 0001](../../docs/adr/0001-autenticacao-oauth2-refresh-token-youtube.md)) consiste em autenticar o canal do usuário uma única vez, salvar o `refresh_token` como variável de ambiente e permitir que a aplicação Spring Boot renove o `access_token` em memória indefinidamente.

---

## 2. Passo a Passo no Google Cloud Console

### Etapa 1: Criar o Projeto e Ativar as APIs
1. Acesse o [Google Cloud Console](https://console.cloud.google.com/).
2. Crie um novo projeto (ex: `AutoPublisher-Production`).
3. No menu lateral, acesse **APIs e Serviços > Biblioteca**.
4. Pesquise e ative as três APIs:
   * **YouTube Data API v3**
   * **Google Drive API**
   * **Google Sheets API**

### Etapa 2: Configurar a Tela de Consentimento OAuth
1. Acesse **APIs e Serviços > Tela de permissão OAuth** (*OAuth consent screen*).
2. Selecione **Tipo de Usuário: Externo** (*External*) e clique em **Criar**.
3. Preencha o nome do app (ex: `AutoPublisher`) e seu e-mail de suporte.
4. Na aba **Escopos** (*Scopes*), adicione:
   * `https://www.googleapis.com/auth/youtube.upload` (upload de vídeos)
   * `https://www.googleapis.com/auth/youtube` (gestão e thumbnails)
   * `https://www.googleapis.com/auth/drive.readonly` (leitura dos vídeos no Drive)
   * `https://www.googleapis.com/auth/spreadsheets` (leitura e atualização de status)
5. **CRÍTICO - Evitar expiração de 7 dias:**
   * Enquanto o app estiver em status "Em Teste" (*Testing*), o Google revoga o `refresh_token` a cada 7 dias.
   * Vá em **Tela de permissão OAuth** e clique no botão **Publicar Aplicativo** (*Publish App*) para colocá-lo em status **"Em Produção"** (*In Production*).
   * *Nota:* Não é necessário passar por verificação formal do Google se apenas você (o criador) for o usuário do aplicativo. Apenas clique em continuar caso surja um aviso de aplicativo não verificado durante o login inicial.

### Etapa 3: Criar as Credenciais OAuth 2.0
1. Acesse **APIs e Serviços > Credenciais > Criar Credenciais > ID do cliente OAuth**.
2. Selecione **Tipo de aplicativo:** Aplicativo da Web (*Web Application*) ou Aplicativo para computador (*Desktop App*).
3. Se escolher Aplicativo da Web, adicione em **URIs de redirecionamento autorizados**:
   * `https://developers.google.com/oauthplayground` (para obter o token facilmente pelo Playground)
   * `http://localhost:8080/oauth2/callback`
4. Clique em **Criar** e copie o **ID do Cliente** (*Client ID*) e o **Segredo do Cliente** (*Client Secret*).

---

## 3. Como Obter o `REFRESH_TOKEN` Offline Permanente

### Método Rápido: Google OAuth 2.0 Playground
1. Abra o [Google OAuth 2.0 Playground](https://developers.google.com/oauthplayground).
2. Clique no ícone de engrenagem no canto superior direito (**OAuth 2.0 configuration**):
   * Marque a opção: **"Use your own OAuth credentials"**.
   * Cole seu **OAuth Client ID** e **OAuth Client Secret**.
3. No painel esquerdo (**Step 1: Select & authorize APIs**):
   * Digite no campo "Input your own scopes":
     `https://www.googleapis.com/auth/youtube.upload https://www.googleapis.com/auth/youtube https://www.googleapis.com/auth/drive.readonly https://www.googleapis.com/auth/spreadsheets`
   * Clique em **Authorize APIs**.
4. Faça login com a conta Google dona do seu canal do YouTube. Se aparecer a tela de aviso de app não verificado, clique em "Avançado" e depois em "Acessar AutoPublisher (não seguro)".
5. Você será redirecionado para o **Step 2**:
   * Clique no botão azul **"Exchange authorization code for tokens"**.
6. Copie o valor do campo **`Refresh token`** exibido na tela.

---

## 4. Configuração das Variáveis de Ambiente

No seu arquivo `.env` (desenvolvimento local) ou no Google Cloud Run Secret Manager (produção), configure:

```properties
# Google OAuth 2.0
YOUTUBE_CLIENT_ID=seu-client-id.apps.googleusercontent.com
YOUTUBE_CLIENT_SECRET=seu-client-secret
YOUTUBE_REFRESH_TOKEN=1//seu-refresh-token-permanente

# Google Sheets & Drive
GOOGLE_SHEETS_SPREADSHEET_ID=1AbCdEfGhIjKlMnOpQrStUvWxYz123456789

# Segurança do Endpoint de Trigger
AUTO_PUBLISHER_API_KEY=sua-chave-secreta-uuid-forte

# Configurações do Spring
SERVER_PORT=8080
SPRING_THREADS_VIRTUAL_ENABLED=true
```

---

## 5. Renovação Automática no Código Java (Spring Boot)

No adaptador `YouTubePublisherAdapter`, utilize o builder oficial que renova os tokens sob demanda:

```java
GoogleCredentials credentials = UserCredentials.newBuilder()
    .setClientId(clientId)
    .setClientSecret(clientSecret)
    .setRefreshToken(refreshToken)
    .build();

HttpRequestInitializer requestInitializer = new HttpCredentialsAdapter(credentials);

YouTube youtube = new YouTube.Builder(
    GoogleNetHttpTransport.newTrustedTransport(),
    GsonFactory.getDefaultInstance(),
    requestInitializer
).setApplicationName("AutoPublisher").build();
```
