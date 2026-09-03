# ==============================================================================
# AutoPublisher Pro - Multi-stage Dockerfile
# Base: Eclipse Temurin Java 21 Alpine (Ultra-leve < 200MB, seguro e non-root)
# ==============================================================================

# Estagio 1: Compilacao e Empacotamento
FROM eclipse-temurin:21-jdk-alpine AS builder
WORKDIR /app

# Copia arquivos do wrapper e dependencias primeiro para cache do Docker
COPY .mvn/ .mvn/
COPY mvnw pom.xml ./
RUN chmod +x mvnw && ./mvnw dependency:go-offline -B

# Copia o codigo fonte e compila o JAR final
COPY src/ ./src/
RUN ./mvnw clean package -DskipTests

# Estagio 2: Imagem Final de Execucao (Runtime)
FROM eclipse-temurin:21-jre-alpine
WORKDIR /app

# Seguranca: execucao como usuario nao-privilegiado
RUN addgroup -S appgroup && adduser -S appuser -G appgroup
USER appuser

# Copia o JAR empacotado do estagio anterior
COPY --from=builder --chown=appuser:appgroup /app/target/*.jar app.jar

# Variaveis de ambiente padrao e otimizacao de memoria para contêiner de 512MB
ENV SERVER_PORT=8080
ENV JAVA_OPTS="-XX:+UseContainerSupport -XX:MaxRAMPercentage=75.0 -XX:+ExitOnOutOfMemoryError"

EXPOSE 8080

ENTRYPOINT ["sh", "-c", "java $JAVA_OPTS -jar app.jar"]
