@echo off
echo Starting RAAG Voice Server...
echo.

REM Check if environment variables are set
if "%DEEPGRAM_API_KEY%"=="" (
    echo ERROR: DEEPGRAM_API_KEY environment variable is not set
    echo Please set your Deepgram API key in .env.local
    pause
    exit /b 1
)

if "%OPENAI_API_KEY%"=="" (
    echo ERROR: OPENAI_API_KEY environment variable is not set
    echo Please set your OpenAI API key in .env.local
    pause
    exit /b 1
)

REM Default values
set PORT=7860
set BUSINESS_ID=""

REM Parse command line arguments
:parse_args
if "%1"=="--port" (
    set PORT=%2
    shift
    shift
    goto parse_args
)
if "%1"=="--business-id" (
    set BUSINESS_ID=%2
    shift
    shift
    goto parse_args
)
if "%1"=="" goto start_server
shift
goto parse_args

:start_server
echo Starting voice server on port %PORT%
if not "%BUSINESS_ID%"=="" echo Business ID: %BUSINESS_ID%
echo.

REM Start the voice server
if "%BUSINESS_ID%"=="" (
    uv run python bot.py --port %PORT%
) else (
    uv run python bot.py --port %PORT% --business-id %BUSINESS_ID%
)

REM If we get here, the server stopped
echo.
echo Voice server stopped.
pause