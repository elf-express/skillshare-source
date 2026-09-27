# docker/api.Dockerfile — the ONLY API Dockerfile template (elf-dotnet links here).
# Build context is the repo root: docker compose -f docker/docker-compose.yml build
# Placeholder: <AppName> (e.g. MyApp → server/src/MyApp.Api/MyApp.Api.csproj)
# Layout (elf-dotnet / elf-cicd-backend): global.json at the repo root,
# server/Directory.Build.props, server/Directory.Packages.props, server/src/<Project>/.
FROM mcr.microsoft.com/dotnet/sdk:10.0 AS build
WORKDIR /src

# Restore needs the SDK pin, the shared MSBuild props (TargetFramework, Central
# Package Management versions) and every referenced project's manifest.
# Copying only these keeps the restore layer cached until a dependency changes.
# Add one COPY line per ProjectReference (keep the same relative layout).
COPY global.json ./
COPY server/Directory.Build.props server/Directory.Packages.props server/
COPY server/src/<AppName>.Api/<AppName>.Api.csproj server/src/<AppName>.Api/
# COPY server/src/<LibProject>/<LibProject>.csproj server/src/<LibProject>/
RUN dotnet restore server/src/<AppName>.Api/<AppName>.Api.csproj

COPY server/ server/
RUN dotnet publish server/src/<AppName>.Api/<AppName>.Api.csproj -c Release -o /app --no-restore

FROM mcr.microsoft.com/dotnet/aspnet:10.0 AS runtime
WORKDIR /app

# The aspnet image ships neither curl nor wget, so a container healthcheck that
# calls one of them is unhealthy forever. Install curl explicitly (as root,
# before dropping privileges); --no-install-recommends keeps the layer small.
USER root
RUN apt-get update \
 && apt-get install -y --no-install-recommends curl \
 && rm -rf /var/lib/apt/lists/*

COPY --from=build /app ./

# The aspnet image provides the non-root $APP_UID user; run as it.
USER $APP_UID

# No connection string here: PostgreSQL credentials arrive at runtime through
# the ConnectionStrings__Default environment variable (docker-compose.yml /
# deployment secrets). Baking one in would ship the password inside the image.
# TZ=UTC: the process clock is UTC; convert to local time only in the UI.
ENV ASPNETCORE_HTTP_PORTS=8080 \
    TZ=UTC
EXPOSE 8080
HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
  CMD curl -fsS http://localhost:8080/api/health >/dev/null || exit 1
ENTRYPOINT ["dotnet", "<AppName>.Api.dll"]
