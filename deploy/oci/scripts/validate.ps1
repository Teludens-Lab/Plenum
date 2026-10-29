[CmdletBinding()]
param()

$ErrorActionPreference = "Stop"
$terraform = Get-Command terraform -ErrorAction SilentlyContinue
if (-not $terraform) {
  $localTerraform = Join-Path $PSScriptRoot "..\.tools\terraform.exe"
  if (Test-Path -LiteralPath $localTerraform) { $terraform = Get-Item -LiteralPath $localTerraform }
}
if (-not $terraform) { throw "Terraform 1.17.x is required on PATH or in deploy/oci/.tools." }
$terraformExecutable = if ($terraform.Source) { $terraform.Source } else { $terraform.FullName }
$root = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$repository = (Resolve-Path (Join-Path $root "..\..")).Path

& $terraformExecutable "-chdir=$root" fmt -check -recursive
if ($LASTEXITCODE -ne 0) { throw "terraform fmt -check failed." }
& $terraformExecutable "-chdir=$root" validate
if ($LASTEXITCODE -ne 0) { throw "terraform validate failed." }
& $terraformExecutable "-chdir=$root" test
if ($LASTEXITCODE -ne 0) { throw "terraform mock plans failed." }
Push-Location $repository
try {
  & npm run test:oci-plan
  if ($LASTEXITCODE -ne 0) { throw "OCI package tests failed." }
} finally {
  Pop-Location
}
