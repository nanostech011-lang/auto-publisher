package com.autopublisher.domain.exception;

/**
 * Excecao lancada em caso de falha de download, leitura ou streaming de arquivos de midia.
 */
public class MediaStreamingException extends AutoPublisherException {

    public MediaStreamingException(String message) {
        super(message);
    }

    public MediaStreamingException(String message, Throwable cause) {
        super(message, cause);
    }
}
