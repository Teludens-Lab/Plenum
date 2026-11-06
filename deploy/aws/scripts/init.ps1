$ErrorActionPreference = "Stop"
$terraform = Get-Command terraform -ErrorAction SilentlyContinue
if (-not $terraform) { throw "Terraform 1.17.x is required on PATH." }
$root = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
& $terraform.Source "-chdir=$root" init -backend=false
if ($LASTEXITCODE -ne 0) { throw "terraform init failed with exit code $LASTEXITCODE." }
