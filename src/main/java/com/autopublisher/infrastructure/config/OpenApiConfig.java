package com.autopublisher.infrastructure.config;

import io.swagger.v3.oas.models.Components;
import io.swagger.v3.oas.models.OpenAPI;
import io.swagger.v3.oas.models.info.Contact;
import io.swagger.v3.oas.models.info.Info;
import io.swagger.v3.oas.models.info.License;
import io.swagger.v3.oas.models.security.SecurityRequirement;
import io.swagger.v3.oas.models.security.SecurityScheme;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

/**
 * Configuracao OpenAPI 3.0 / Swagger UI para o AutoPublisher Pro.
 */
@Configuration
public class OpenApiConfig {

    @Bean
    public OpenAPI autoPublisherOpenAPI() {
        final String securitySchemeName = "ApiKeyAuth";
        return new OpenAPI()
                .info(new Info()
                        .title("AutoPublisher Pro API")
                        .description("API REST Serverless de Automação de Publicação de Vídeos (YouTube Shorts, Instagram Reels, TikTok) e AI Studio")
                        .version("2.0.0-pro")
                        .contact(new Contact().name("AutoPublisher Pro Team"))
                        .license(new License().name("Apache 2.0")))
                .addSecurityItem(new SecurityRequirement().addList(securitySchemeName))
                .components(new Components()
                        .addSecuritySchemes(securitySchemeName,
                                new SecurityScheme()
                                        .name("X-API-KEY")
                                        .type(SecurityScheme.Type.APIKEY)
                                        .in(SecurityScheme.In.HEADER)
                                        .description("Chave de API do Workspace / Tenant ou Master Admin Key")));
    }
}
