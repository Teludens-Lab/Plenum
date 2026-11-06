[CmdletBinding()]
param(
  [string]$Profile = "plenum-staging",
  [string]$Region = "us-east-2",
  [string]$ParameterName = "/plenum/staging/operations"
)

$ErrorActionPreference = "Stop"
if ($Region -ne "us-east-2") { throw "The AWS staging project is locked to us-east-2." }
if ($ParameterName -ne "/plenum/staging/operations") { throw "This command is restricted to the staging operations parameter." }
$aws = Get-Command aws -ErrorAction SilentlyContinue
if (-not $aws) { throw "AWS CLI v2 is required on PATH." }

function Convert-SecureValue([Security.SecureString]$Value) {
  return [Net.NetworkCredential]::new("", $Value).Password
}
function New-Base64UrlSecret([int]$Bytes = 32) {
  $buffer = New-Object byte[] $Bytes
  $generator = [Security.Cryptography.RandomNumberGenerator]::Create()
  try { $generator.GetBytes($buffer) } finally { $generator.Dispose() }
  return [Convert]::ToBase64String($buffer).TrimEnd("=").Replace("+", "-").Replace("/", "_")
}
function Read-RequiredText([string]$Prompt, [string]$Pattern, [string]$InvalidMessage) {
  while ($true) {
    $value = (Read-Host -Prompt $Prompt).Trim()
    if ($value -match $Pattern) { return $value }
    Write-Warning $InvalidMessage
  }
}
function Read-SecretValue([string]$Prompt, [int]$MinimumLength = 16) {
  while ($true) {
    $value = Convert-SecureValue (Read-Host -Prompt $Prompt -AsSecureString)
    if ($value.Length -ge $MinimumLength) { return $value }
    Write-Warning "The value must contain at least $MinimumLength characters."
  }
}

& $aws.Source sts get-caller-identity --profile $Profile --query Account --output text | Out-Null
if ($LASTEXITCODE -ne 0) { throw "AWS identity verification failed for profile $Profile." }
& $aws.Source ssm get-parameter --profile $Profile --region $Region --name $ParameterName --query Parameter.Name --output text 2>$null | Out-Null
if ($LASTEXITCODE -eq 0) { throw "$ParameterName already exists. This bootstrap command will not rotate or overwrite it." }

$postmarkFrom = Read-RequiredText "Verified Postmark sender (example: Plenum <you@company.edu>)" '^.+<[^<>@\s]+@[^<>@\s]+>$' "Use the form Plenum <verified-address@example.org>."
$postmarkToken = Read-SecretValue "Postmark server token" 16
$alertRecipient = Read-RequiredText "Staging operational alert recipient" '^[^<>@\s]+@[^<>@\s]+\.[^<>@\s]+$' "Enter one valid email address."
$databasePassword = New-Base64UrlSecret 32
$value = [ordered]@{
  ALERT_RECIPIENT       = $alertRecipient
  DATABASE_PASSWORD     = $databasePassword
  POSTMARK_FROM         = $postmarkFrom
  POSTMARK_SERVER_TOKEN = $postmarkToken
} | ConvertTo-Json -Compress

$directory = Join-Path ([IO.Path]::GetTempPath()) ("plenum-operations-" + [Guid]::NewGuid().ToString("N"))
$requestPath = Join-Path $directory "request.json"
$utf8 = New-Object Text.UTF8Encoding $false
New-Item -ItemType Directory -Path $directory | Out-Null
try {
  $request = [ordered]@{ Name = $ParameterName; Description = "Plenum staging operations-agent secret";
    Value = $value; Type = "SecureString"; Tier = "Standard" }
  [IO.File]::WriteAllText($requestPath, ($request | ConvertTo-Json -Compress), $utf8)
  $requestUri = "file://" + $requestPath
  & $aws.Source ssm put-parameter --profile $Profile --region $Region --cli-input-json $requestUri --output json | Out-Null
  if ($LASTEXITCODE -ne 0) { throw "Failed to create $ParameterName." }
  Write-Host "Created $ParameterName without printing its value."
} finally {
  if (Test-Path -LiteralPath $directory) { Remove-Item -LiteralPath $directory -Recurse -Force }
  Remove-Variable postmarkToken, databasePassword, value, request -ErrorAction SilentlyContinue
}
