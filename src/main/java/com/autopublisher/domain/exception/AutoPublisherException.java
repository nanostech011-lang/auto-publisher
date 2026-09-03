package com.autopublisher.domain.exception;

/**
 * Excecao base de dominio do AutoPublisher Pro.
 */
public class AutoPublisherException extends RuntimeException {

    public AutoPublisherException(String message) {
        super(message);
    }

    public AutoPublisherException(String message, Throwable cause) {
        super(message, cause);
    }
}
