FROM mcr.microsoft.com/dotnet/sdk:8.0 AS build
WORKDIR /src

COPY backend/RealCompilerApi/RealCompilerApi.csproj backend/RealCompilerApi/
RUN dotnet restore backend/RealCompilerApi/RealCompilerApi.csproj

COPY backend/RealCompilerApi/ backend/RealCompilerApi/
RUN dotnet publish backend/RealCompilerApi/RealCompilerApi.csproj -c Release -o /app/out --no-restore

FROM mcr.microsoft.com/dotnet/aspnet:8.0 AS final
WORKDIR /app
COPY --from=build /app/out .
ENV ASPNETCORE_URLS=http://0.0.0.0:10000
EXPOSE 10000
ENTRYPOINT ["dotnet", "RealCompilerApi.dll"]
