@REM ----------------------------------------------------------------------------
@REM Maven Wrapper Script for Windows
@REM ----------------------------------------------------------------------------
@echo off
setlocal

set "DIR=%~dp0"
set "DIR=%DIR:~0,-1%"
set "WRAPPER_JAR=%DIR%\.mvn\wrapper\maven-wrapper.jar"

if exist "C:\Program Files\Java\jdk-21.0.10" (
    set "JAVA_HOME=C:\Program Files\Java\jdk-21.0.10"
)

if not exist "%WRAPPER_JAR%" (
    echo [ERROR] maven-wrapper.jar not found at %WRAPPER_JAR%
    exit /b 1
)

if "%JAVA_HOME%"=="" (
    java -Dmaven.multiModuleProjectDirectory="%DIR%" -cp "%WRAPPER_JAR%" org.apache.maven.wrapper.MavenWrapperMain %*
) else (
    "%JAVA_HOME%\bin\java" -Dmaven.multiModuleProjectDirectory="%DIR%" -cp "%WRAPPER_JAR%" org.apache.maven.wrapper.MavenWrapperMain %*
)

exit /b %ERRORLEVEL%
