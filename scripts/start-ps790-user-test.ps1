$ErrorActionPreference = "Stop"

$containerName = "plenum-ps790-user-test-db"
$databaseName = "plenum_ps790_user_test"

$existing = docker ps --all --filter "name=^/$containerName$" --format "{{.Names}}"
if ($existing -eq $containerName) {
  docker rm --force $containerName | Out-Null
}
docker run --detach --name $containerName --publish "127.0.0.1::5432" `
  --env POSTGRES_PASSWORD=plenum_test --env "POSTGRES_DB=$databaseName" postgres:18.6-alpine | Out-Null

$portBinding = docker port $containerName 5432/tcp
if ($portBinding -notmatch ':(\d+)$') { throw "The PS-790 PostgreSQL port binding is unavailable." }
$databasePort = [int]$Matches[1]

$ready = $false
for ($attempt = 0; $attempt -lt 30; $attempt += 1) {
  docker exec $containerName pg_isready --username postgres --dbname $databaseName | Out-Null
  if ($LASTEXITCODE -eq 0) { $ready = $true; break }
  Start-Sleep -Milliseconds 500
}
if (-not $ready) { throw "The PS-790 PostgreSQL container did not become ready." }

$env:DATABASE_URL = "postgresql://postgres:plenum_test@127.0.0.1:$databasePort/$databaseName"
npm run user-test:ps790
