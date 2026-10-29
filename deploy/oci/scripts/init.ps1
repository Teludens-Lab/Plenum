[CmdletBinding()]
param()

$ErrorActionPreference = "Stop"
$terraform = Get-Command terraform -ErrorAction SilentlyContinue
if (-not $terraform) {
  $localTerraform = Join-Path $PSScriptRoot "..\.tools\terraform.exe"
  if (Test-Path -LiteralPath $localTerraform) { $terraform = Get-Item -LiteralPath $localTerraform }
}
if (-not $terraform) {
  throw "Terraform 1.17.x is required on PATH or in deploy/oci/.tools."
}
$terraformExecutable = if ($terraform.Source) { $terraform.Source } else { $terraform.FullName }
$root = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
& $terraformExecutable "-chdir=$root" init -input=false -upgrade=false
if ($LASTEXITCODE -ne 0) { throw "terraform init failed with exit code $LASTEXITCODE." }
