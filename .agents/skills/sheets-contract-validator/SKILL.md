---
name: sheets-contract-validator
description: >-
  Use this skill when designing, inspecting, or validating the Google Sheets schedule table,
  formatting columns, auditing status transition lifecycles, handling quota limits, or integrating
  content generation pipelines (AI faceless video generators) into the spreadsheet.
---

# Google Sheets Contract & Lifecycle Validator

Este guia define o contrato de dados estrito da planilha Google Sheets que atua como o banco de dados e a interface visual do **AutoPublisher Pro**.

---

## 1. Estrutura Canônica da Tabela (`Cronograma`)

A aba principal deve se chamar rigorosamente **`Cronograma`**. A linha 1 contém os cabeçalhos. Os dados iniciam na linha 2.

| Coluna | Índice | Campo | Tipo | Validação / Regra de Negócio |
| :---: | :---: | :--- | :--- | :--- |
| **A** | 0 | `ID` | String | Obrigatório. Identificador único do post (ex: `POST-001`). |
| **B** | 1 | `Data_Agendamento` | Timestamp | Obrigatório. Formato `YYYY-MM-DD HH:mm:ss`. Apenas itens onde `Data <= Agora` são processados. |
| **C** | 2 | `Plataforma` | Enum | Valores permitidos: `YOUTUBE_SHORTS`, `YOUTUBE_VIDEO`, `INSTAGRAM_REELS`, `TIKTOK`. |
| **D** | 3 | `Drive_Video_ID` | String | Obrigatório. ID alfanumérico do arquivo de vídeo no Google Drive. |
| **E** | 4 | `Drive_Thumbnail_ID` | String | Opcional. ID da imagem no Drive para capa/thumbnail personalizada. |
| **F** | 5 | `Titulo` | String | Obrigatório. Máximo de 100 caracteres. Para Shorts, deve conter `#Shorts`. |
| **G** | 6 | `Descricao` | String | Opcional. Máximo de 5.000 caracteres. Contém copy de conversão e links de afiliados UTM. |
| **H** | 7 | `Tags` | String | Opcional. Tags separadas por vírgula (máximo de 500 caracteres somados). |
| **I** | 8 | `Categoria_ID` | Inteiro | Obrigatório. Categoria padrão: `24` (Entretenimento) ou `28` (Ciência e Tecnologia). |
| **J** | 9 | `Made_For_Kids` | Booleano | Sempre `FALSE` para garantir monetização com anúncios e comentários. |
| **K** | 10 | `Privacidade` | Enum | `PUBLIC`, `PRIVATE`, `UNLISTED`. Recomendado `UNLISTED` para checagem de Content ID prévia. |
| **L** | 11 | `Status` | Enum | Controlado pelo sistema: `PENDENTE`, `PROCESSANDO`, `PUBLICADO`, `ERRO_TEMPORARIO`, `COTA_ESGOTADA`. |
| **M** | 12 | `URL_Publicada` | String | Preenchido pelo sistema: Link direto do vídeo após o upload concluído. |
| **N** | 13 | `Data_Publicacao` | Timestamp | Preenchido pelo sistema: Momento exato da conclusão do envio. |
| **O** | 14 | `Log_Erro` | String | Mensagem de sucesso ou descrição da exceção em caso de falha. |
| **P** | 15 | `Tentativas` | Inteiro | Número de retentativas executadas (0 a 3). |

---

## 2. Ciclo de Vida dos Status (State Machine)

```
        ┌──────────────┐
        │   PENDENTE   │ ◄─── (Criado pelo criador / pipeline de IA)
        └──────┬───────┘
               │ (Horário atingido e trigger disparado)
               ▼
        ┌──────────────┐
        │ PROCESSANDO  │ ◄─── (Evita processamento duplicado)
        └──────┬───────┘
               │
       ┌───────┴────────────────────────┐
       ▼                                ▼
┌──────────────┐               ┌──────────────────┐
│  PUBLICADO   │               │ ERRO_TEMPORARIO  │ (Falha de rede/streaming)
└──────────────┘               └────────┬─────────┘
                                        │ (Se tentativas < 3, retenta no próximo ciclo)
                                        │ (Se cota diária esgotada 403)
                                        ▼
                               ┌──────────────────┐
                               │  COTA_ESGOTADA   │ (Pausa até às 04:00 BRT)
                               └──────────────────┘
```

---

## 3. Escrita Cirúrgica de Atualização (Google Sheets API v4)

Para manter a performance e evitar sobrescrever dados do usuário, o `GoogleSheetsAdapter` atualiza estritamente as colunas **L até P** da linha que foi processada:

```java
// Exemplo de atualização cirúrgica da Linha 5 (colunas L até P)
String range = String.format("Cronograma!L%d:P%d", rowIndex, rowIndex);
List<Object> rowUpdate = List.of(
    status.name(),                  // Coluna L: Status
    publishedUrl,                   // Coluna M: URL_Publicada
    LocalDateTime.now().toString(), // Coluna N: Data_Publicacao
    logMessage,                     // Coluna O: Log_Erro
    attempts                        // Coluna P: Tentativas
);
ValueRange body = new ValueRange().setValues(List.of(rowUpdate));
sheetsService.spreadsheets().values()
    .update(spreadsheetId, range, body)
    .setValueInputOption("USER_ENTERED")
    .execute();
```
