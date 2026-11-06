$ErrorActionPreference = "Stop"
$terraform = Get-Command terraform -ErrorAction SilentlyContinue
if (-not $terraform) { throw "Terraform 1.17.x is required on PATH." }
$root = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path

& $terraform.Source "-chdir=$root" fmt -check -recursive
if ($LASTEXITCODE -ne 0) { throw "terraform fmt check failed with exit code $LASTEXITCODE." }
& $terraform.Source "-chdir=$root" validate
if ($LASTEXITCODE -ne 0) { throw "terraform validate failed with exit code $LASTEXITCODE." }
& $terraform.Source "-chdir=$root" test
if ($LASTEXITCODE -ne 0) { throw "terraform test failed with exit code $LASTEXITCODE." }
