# ==============================================================================
# AutoPublisher Pro - High-Performance Multi-Stage Dockerfile
# Java 21 LTS (Project Loom Virtual Threads) + FFmpeg Headless + Alpine Linux
# Custo Zero, Baixo Consumo de Memória (< 256MB) e Inicialização Instantânea
# ==============================================================================

# ------------------------------------------------------------------------------
# Stage 1: Build & Extração de Camadas (Spring Boot 3.3 Tools)
# ------------------------------------------------------------------------------
FROM eclipse-temurin:21-jdk-alpine AS builder
WORKDIR /build

# Copia configurações do Maven e wrapper
COPY .mvn/ .mvn/
COPY mvnw pom.xml ./
RUN sed -i 's/\r$//' mvnw && chmod +x mvnw && ./mvnw dependency:go-offline -B --no-transfer-progress

# Copia código-fonte e compila JAR de produção
COPY src/ src/
RUN ./mvnw clean package -DskipTests --no-transfer-progress

# Extração cirúrgica de camadas para acelerar re-builds e otimizar cache de imagens Docker
RUN java -Djarmode=tools -jar target/*.jar extract --layers --launcher --destination /build/extracted

# ------------------------------------------------------------------------------
# Stage 2: Runtime Ultraleve, Seguro e Otimizado
# ------------------------------------------------------------------------------
FROM eclipse-temurin:21-jre-alpine AS runtime

LABEL maintainer="AutoPublisher Pro Team"
LABEL description="AutoPublisher Pro - Autonomous Social Media Publisher & AI Studio"

WORKDIR /app

# Utilitários headless: FFmpeg, Node.js e fontes TrueType completas para legendas ASS sem glifos corrompidos
RUN apk add --no-cache \
    ffmpeg \
    nodejs \
    npm \
    fontconfig \
    font-liberation \
    ttf-dejavu \
    ca-certificates \
    tzdata \
    curl \
    gcompat && \
    fc-cache -f -v && \
    npm install -g pnpm@10.32.1 && \
    rm -rf /var/cache/apk/* /root/.npm

ENV pnpm_config_pmOnFail=ignore
ENV pnpm_config_pm_on_fail=ignore

# Criação de usuário não-root seguro (UID 10001) para Cloud Run e Kubernetes
RUN addgroup -S appgroup -g 10001 && \
    adduser -S appuser -u 10001 -G appgroup -h /app -s /bin/sh

# Diretórios de trabalho do pipeline com permissões estritas
RUN mkdir -p /app/pipeline/scratch /app/pipeline/output /app/pipeline/state /app/logs && \
    chown -R appuser:appgroup /app

# Copia camadas Spring Boot do builder (isolamento de cache por frequência de alteração)
COPY --from=builder --chown=appuser:appgroup /build/extracted/dependencies/ /app/
COPY --from=builder --chown=appuser:appgroup /build/extracted/spring-boot-loader/ /app/
COPY --from=builder --chown=appuser:appgroup /build/extracted/snapshot-dependencies/ /app/
COPY --from=builder --chown=appuser:appgroup /build/extracted/application/ /app/

# Copia scripts do pipeline e pacotes Node.js
COPY --chown=appuser:appgroup package.json .npmrc* pnpm-lock.yaml* pnpm-workspace.yaml* /app/
COPY --chown=appuser:appgroup pipeline/ /app/pipeline/

# Instala dependências de produção do pipeline Node.js
RUN pnpm install --prod --ignore-scripts --config.pmOnFail=ignore && \
    chown -R appuser:appgroup /app/node_modules

# Alterna para o usuário não-privilegiado
USER appuser

# Parâmetros JVM afinados para Cloud Run e Docker local (512MB RAM total, < 256MB Heap, SerialGC)
ENV JAVA_OPTS="-XX:+UseContainerSupport -XX:MaxRAMPercentage=50.0 -XX:InitialRAMPercentage=25.0 -XX:+UseSerialGC -XX:MaxMetaspaceSize=96m -XX:ReservedCodeCacheSize=48m -Xss256k -XX:+ExitOnOutOfMemoryError -Djava.security.egd=file:/dev/./urandom -Dspring.threads.virtual.enabled=true"

ENV FFMPEG_PATH=/usr/bin/ffmpeg
ENV FFPROBE_PATH=/usr/bin/ffprobe
ENV PORT=8080
ENV SPRING_PROFILES_ACTIVE=prod
ENV TZ=America/Sao_Paulo

EXPOSE 8080

# Healthcheck interno direto no endpoint /api/v1/health
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
    CMD curl -f http://localhost:${PORT:-8080}/api/v1/health || exit 1

ENTRYPOINT ["sh", "-c", "exec java $JAVA_OPTS org.springframework.boot.loader.launch.JarLauncher --server.port=${PORT:-8080}"]
