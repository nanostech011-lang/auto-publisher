@REM ----------------------------------------------------------------------------
@REM Maven Wrapper Script for Windows
@REM ----------------------------------------------------------------------------
@echo off
setlocal

set "DIR=%~dp0"
set "DIR=%DIR:~0,-1%"
set "WRAPPER_JAR=%DIR%\.mvn\wrapper\maven-wrapper.jar"

@REM Prioritize JDK 21 required by AutoPublisher Pro
for /d %%i in ("C:\Program Files\Java\jdk-21*") do (
    if exist "%%i\bin\java.exe" set "JAVA_HOME=%%i"
)

if not exist "%WRAPPER_JAR%" (
    echo [INFO] maven-wrapper.jar not found, downloading...
    if not exist "%DIR%\.mvn\wrapper" mkdir "%DIR%\.mvn\wrapper"
    powershell -NoProfile -ExecutionPolicy Bypass -Command "[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12; (New-Object Net.WebClient).DownloadFile('https://repo.maven.apache.org/maven2/org/apache/maven/wrapper/maven-wrapper/3.3.2/maven-wrapper-3.3.2.jar', '%WRAPPER_JAR%')"
)

if "%JAVA_HOME%"=="" (
    java -Dmaven.multiModuleProjectDirectory="%DIR%" -cp "%WRAPPER_JAR%" org.apache.maven.wrapper.MavenWrapperMain %*
) else (
    "%JAVA_HOME%\bin\java" -Dmaven.multiModuleProjectDirectory="%DIR%" -cp "%WRAPPER_JAR%" org.apache.maven.wrapper.MavenWrapperMain %*
)

exit /b %ERRORLEVEL%
