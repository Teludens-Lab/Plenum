[CmdletBinding()]
param(
  [Parameter(Mandatory = $true)]
  [ValidateSet("functional-free", "production-parity")]
  [string]$Profile,

  [Parameter(Mandatory = $true)]
  [string]$VarFile,

  [switch]$SkipImageManifestCheck
)

$ErrorActionPreference = "Stop"
$terraform = Get-Command terraform -ErrorAction SilentlyContinue
if (-not $terraform) {
  $localTerraform = Join-Path $PSScriptRoot "..\.tools\terraform.exe"
  if (Test-Path -LiteralPath $localTerraform) { $terraform = Get-Item -LiteralPath $localTerraform }
}
if (-not $terraform) { throw "Terraform 1.17.x is required on PATH or in deploy/oci/.tools." }
$terraformExecutable = if ($terraform.Source) { $terraform.Source } else { $terraform.FullName }
$root = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$resolvedVarFile = (Resolve-Path $VarFile).Path
$content = Get-Content -Raw -LiteralPath $resolvedVarFile
if ($content -notmatch "(?m)^\s*deployment_profile\s*=\s*`"$([regex]::Escape($Profile))`"\s*$") {
  throw "The requested profile does not match deployment_profile in the variable file."
}
$imageMatch = [regex]::Match($content, '(?m)^\s*application_image\s*=\s*"([^"]+)"\s*$')
if (-not $imageMatch.Success) { throw "application_image was not found in the variable file." }
$image = $imageMatch.Groups[1].Value
if ($image -notmatch '@sha256:[0-9a-f]{64}$') { throw "application_image is not digest-pinned." }

if (-not $SkipImageManifestCheck) {
  $docker = Get-Command docker -ErrorAction SilentlyContinue
  if (-not $docker) { throw "Docker is required to verify the multi-platform image manifest." }
  $manifestJson = & $docker.Source buildx imagetools inspect $image --raw
  if ($LASTEXITCODE -ne 0) {
    throw "The private image manifest could not be inspected. Authenticate Docker to ghcr.io with read:packages access, then retry."
  }
  $manifest = $manifestJson | ConvertFrom-Json
  $platforms = @($manifest.manifests | ForEach-Object { "$($_.platform.os)/$($_.platform.architecture)" })
  foreach ($required in @("linux/amd64", "linux/arm64")) {
    if ($required -notin $platforms) { throw "The image manifest does not contain $required." }
  }
} else {
  Write-Warning "Image manifest verification was skipped. Do not approve this plan for deployment."
}

$plans = Join-Path $root ".plans"
New-Item -ItemType Directory -Force -Path $plans | Out-Null
$planPath = Join-Path $plans "$Profile.tfplan"
& $terraformExecutable "-chdir=$root" plan -input=false -lock-timeout=60s "-var-file=$resolvedVarFile" "-out=$planPath"
if ($LASTEXITCODE -ne 0) { throw "terraform plan failed with exit code $LASTEXITCODE." }
Write-Host "Plan written to $planPath. Review with: terraform -chdir=$root show $planPath"
Write-Host "No resources were created. This repository intentionally provides no apply wrapper."
