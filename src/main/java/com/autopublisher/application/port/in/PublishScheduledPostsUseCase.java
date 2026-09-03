package com.autopublisher.application.port.in;

/**
 * Porta de Entrada (Inbound Port) que orquestra a publicacao de posts pendentes.
 */
public interface PublishScheduledPostsUseCase {

    /**
     * Executa a verificacao do cronograma, baixa midias e despacha publicacoes nas redes.
     *
     * @return Relatorio consolidado da execucao em lote.
     */
    PublishBatchReport execute();
}
