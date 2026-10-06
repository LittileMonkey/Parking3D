FROM mcr.microsoft.com/dotnet/sdk:9.0 AS build
ARG PROJECT
WORKDIR /repo
COPY src/ src/
RUN dotnet publish "$PROJECT" -c Release -o /app/publish

FROM mcr.microsoft.com/dotnet/aspnet:9.0 AS runtime
USER root
RUN apt-get update && apt-get install -y --no-install-recommends curl ca-certificates && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY --from=build /app/publish .
ARG APP_DLL
ENV APP_DLL=${APP_DLL}
EXPOSE 8080 8081
USER $APP_UID
HEALTHCHECK --interval=15s --timeout=3s --start-period=30s CMD curl -fsS http://localhost:8080/health/ready || exit 1
ENTRYPOINT ["sh", "-c", "exec dotnet \"$APP_DLL\""]
