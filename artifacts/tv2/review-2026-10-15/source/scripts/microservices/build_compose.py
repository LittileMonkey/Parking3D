from pathlib import Path
ROOT=Path(__file__).resolve().parents[2]
lines=['# Local isolated Development; internal gRPC is not exposed to the host.','services:']
for s in ['identity','parking','payment','ai']:
    upper=s.upper()
    lines += [f'  {s}-db:','    image: postgres:17',f'    environment:',f'      POSTGRES_DB: parking_{s}',f'      POSTGRES_USER: {s}',f'      POSTGRES_PASSWORD: ${{{upper}_DB_PASSWORD:?Run New-DevelopmentEnv.ps1}}',
        '    volumes:',f'      - {s}-data:/var/lib/postgresql/data',f'      - ./database/services/{s}/001_schema.sql:/docker-entrypoint-initdb.d/001_schema.sql:ro',
        '    healthcheck:',f'      test: ["CMD-SHELL", "pg_isready -U {s} -d parking_{s}"]','      interval: 5s','      timeout: 3s','      retries: 20','    restart: unless-stopped']
for s in ['identity','parking','payment','ai']:
    title='AI' if s=='ai' else s.title()
    lines += [f'  {s}:','    build:','      context: .','      dockerfile: deploy/docker/Dockerfile','      args:',
        f'        PROJECT: src/Services/{title}/Parking.{title}.Api/Parking.{title}.Api.csproj',f'        APP_DLL: Parking.{title}.Api.dll',
        '    environment:','      ASPNETCORE_ENVIRONMENT: Development','      Ports__Bind: 0.0.0.0',
        '      Jwt__Key: ${JWT_KEY:?Run New-DevelopmentEnv.ps1}','      Grpc__ServiceKey: ${GRPC_SERVICE_KEY:?Run New-DevelopmentEnv.ps1}',
        f'      ConnectionStrings__Service: "Host={s}-db;Database=parking_{s};Username={s};Password=${{{s.upper()}_DB_PASSWORD}}"',
        '      Services__IdentityGrpc: http://identity:8081','      Services__ParkingGrpc: http://parking:8081','      Services__AIGrpc: http://ai:8081']
    if s=='identity':lines+=['      Bootstrap__Email: ${BOOTSTRAP_EMAIL:?Set administrator email}','      Bootstrap__Password: ${BOOTSTRAP_PASSWORD:?Run New-DevelopmentEnv.ps1}']
    if s=='ai':lines+=['      AI__OcrEndpoint: ${OCR_ENDPOINT:-}','      AI__OcrApiKey: ${OCR_API_KEY:-}']
    lines+=['    depends_on:',f'      {s}-db:','        condition: service_healthy','    restart: unless-stopped']
lines+=['  gateway:','    build:','      context: .','      dockerfile: deploy/docker/Dockerfile','      args:',
        '        PROJECT: src/Gateway/Parking.Gateway/Parking.Gateway.csproj','        APP_DLL: Parking.Gateway.dll',
        '    environment:','      ASPNETCORE_ENVIRONMENT: Development','      ASPNETCORE_HTTP_PORTS: 8080',
        '    ports:','      - "127.0.0.1:8080:8080"','    depends_on:']
for s in ['identity','parking','payment','ai']:lines+=[f'      {s}:','        condition: service_healthy']
lines+=['    restart: unless-stopped','volumes:','  identity-data:','  parking-data:','  payment-data:','  ai-data:']
(ROOT/'compose.microservices.yml').write_text('\n'.join(lines)+'\n',encoding='utf-8')
print('Wrote compose.microservices.yml; 4 isolated PG17 containers, 4 services, 1 gateway.')
