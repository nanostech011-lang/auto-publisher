package com.autopublisher.domain.exception;

/**
 * Excecao lancada quando os dados da linha da planilha contem inconsistencias ou violam contratos.
 */
public class ScheduleValidationException extends AutoPublisherException {

    public ScheduleValidationException(String message) {
        super(message);
    }

    public ScheduleValidationException(String message, Throwable cause) {
        super(message, cause);
    }
}
