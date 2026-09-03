# ADR 0001: Autenticação com OAuth 2.0 (Refresh Token) vs Service Account para YouTube Data API v3

* **Status:** Aceito
* **Data:** 2026-09-03
* **Decisores:** Time de Arquitetura e Engenharia AutoPublisher
* **Contexto Técnico:** [PRD_AutoPublisher_Completo.md](../PRD_AutoPublisher_Completo.md) - [RF-01]

---

## 1. Contexto e Problema

O projeto AutoPublisher requer a automação do envio de vídeos para o YouTube sem intervenção humana manual a cada upload.

A especificação inicial previa o uso de uma **Google Cloud Service Account** para todas as operações do sistema (Google Sheets, Google Drive e YouTube Data API v3). No entanto, testes e a documentação oficial da Google Cloud e do YouTube confirmam que:
1. Contas de Serviço (*Service Accounts*) não possuem canais regulares do YouTube associados a elas.
2. Ao tentar realizar um upload (`videos.insert`) em um canal padrão de usuário utilizando um token de Service Account, a YouTube Data API v3 rejeita a requisição com erro **`401 Unauthorized`** ou **`channel not found`**.
3. O suporte a Service Accounts na API do YouTube é restrito exclusivamente a clientes corporativos com **YouTube Content Manager (CMS / Content Owners)** utilizando o parâmetro `onBehalfOfContentOwner`, o que não se aplica a criadores de conteúdo e canais individuais/dark.

Era necessário definir um mecanismo de autenticação headless, seguro e perpétuo que opere sem telas de login durante a execução agendada.

---

## 2. Decisão

Decidimos adotar uma arquitetura de autenticação híbrida:

1. **YouTube Data API v3:**
   * Utilizar credenciais **OAuth 2.0 (Client ID + Client Secret)** com tipo de aplicativo Desktop/Web.
   * Executar um fluxo de autorização manual **uma única vez** no início da configuração do projeto para obter o **`refresh_token` offline permanente** com os escopos `https://www.googleapis.com/auth/youtube.upload` e `https://www.googleapis.com/auth/youtube`.
   * Armazenar o `refresh_token`, `client_id` e `client_secret` em variáveis de ambiente seguras (`YOUTUBE_CLIENT_ID`, `YOUTUBE_CLIENT_SECRET`, `YOUTUBE_REFRESH_TOKEN`).
   * No backend Java (Spring Boot), utilizar a biblioteca `GoogleCredential` / `UserCredentials` do SDK oficial da Google para obter novos `access_token` de forma 100% automática e headless na inicialização de cada requisição.

2. **Google Drive e Google Sheets:**
   * Podem utilizar a **Service Account** tradicional (compartilhando a planilha e a pasta do Drive com o e-mail da service account), ou reaproveitar o mesmo token de usuário do OAuth 2.0 caso possua os escopos correspondentes.

---

## 3. Consequências

### Pontos Positivos
* **Efetividade Técnica:** O upload no YouTube funciona sem erros de permissão em canais regulares e canais de marca.
* **Operação 100% Autônoma:** Uma vez gerado o `refresh_token`, o microsserviço roda indefinidamente sem intervenção humana.
* **Segurança Reforçada:** O `refresh_token` é injetado como variável de ambiente (ou Secret Manager) e nunca é commitado no repositório.
* **Compatibilidade Serverless:** Não há necessidade de armazenar arquivos de sessão em disco local ou banco de dados persistente.

### Pontos de Atenção / Trade-offs
* **Setup Inicial Requer Ação Manual Única:** É necessário gerar o `refresh_token` na primeira instalação (via Google OAuth Playground ou um script CLI auxiliar fornecido no projeto).
* **Validade do Token no Modo de Teste:** No Google Cloud Console, enquanto o app estiver no modo de teste ("Testing"), o `refresh_token` expira a cada 7 dias. **Mitigação:** É mandatório publicar o app no Google Cloud Console com status "Em Produção" (*In Production*), o que garante validade indefinida do token para a conta do criador.
