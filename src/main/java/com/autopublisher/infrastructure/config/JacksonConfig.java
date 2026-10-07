package com.autopublisher.infrastructure.config;

import com.autopublisher.domain.model.AudioMode;
import com.fasterxml.jackson.core.JsonParser;
import com.fasterxml.jackson.databind.DeserializationContext;
import com.fasterxml.jackson.databind.JsonDeserializer;
import com.fasterxml.jackson.databind.MapperFeature;
import com.fasterxml.jackson.databind.module.SimpleModule;
import org.springframework.boot.autoconfigure.jackson.Jackson2ObjectMapperBuilderCustomizer;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

import java.io.IOException;

/**
 * Configuração de serialização e desserialização Jackson.
 * Permite que modelos do domínio e requisições REST aceitem strings em minúsculas
 * ou maiúsculas (ex: "tts", "source_audio", "none") com fallback seguro.
 */
@Configuration
public class JacksonConfig {

    @Bean
    public Jackson2ObjectMapperBuilderCustomizer jacksonCustomizer() {
        return builder -> {
            builder.featuresToEnable(MapperFeature.ACCEPT_CASE_INSENSITIVE_ENUMS);

            SimpleModule domainModule = new SimpleModule("DomainEnumModule");
            domainModule.addDeserializer(AudioMode.class, new JsonDeserializer<>() {
                @Override
                public AudioMode deserialize(JsonParser p, DeserializationContext ctxt) throws IOException {
                    String value = p.getValueAsString();
                    return AudioMode.fromString(value);
                }
            });
            builder.modules(domainModule);
        };
    }
}
