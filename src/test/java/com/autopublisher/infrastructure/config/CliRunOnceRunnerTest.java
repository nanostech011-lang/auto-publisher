package com.autopublisher.infrastructure.config;

import com.autopublisher.application.port.in.PublishScheduledPostsUseCase;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.context.ApplicationContext;

import static org.mockito.Mockito.verifyNoInteractions;

@ExtendWith(MockitoExtension.class)
class CliRunOnceRunnerTest {

    @Mock
    private PublishScheduledPostsUseCase publishUseCase;

    @Mock
    private ApplicationContext applicationContext;

    @Test
    @DisplayName("Nao deve executar nada quando runOnce for false")
    void shouldDoNothingWhenRunOnceIsFalse() {
        CliRunOnceRunner runner = new CliRunOnceRunner(publishUseCase, applicationContext, false);

        runner.run();

        verifyNoInteractions(publishUseCase);
        verifyNoInteractions(applicationContext);
    }
}
