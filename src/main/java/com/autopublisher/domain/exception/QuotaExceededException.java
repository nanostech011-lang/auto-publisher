package com.autopublisher.domain.exception;

/**
 * Excecao lancada quando a cota diaria da API do YouTube (10.000 unidades) e atingida (HTTP 403 quotaExceeded).
 */
public class QuotaExceededException extends AutoPublisherException {

    public QuotaExceededException(String message) {
        super(message);
    }

    public QuotaExceededException(String message, Throwable cause) {
        super(message, cause);
    }
}
