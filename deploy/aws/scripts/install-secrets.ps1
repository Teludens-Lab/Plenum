[CmdletBinding()]
param(
  [string]$Profile = "plenum-staging",
  [string]$Region = "us-east-2",
  [string]$ParameterPrefix = "/plenum/staging"
)

$ErrorActionPreference = "Stop"

if ($Region -ne "us-east-2") { throw "The AWS Free-plan project is locked to us-east-2." }
if ($ParameterPrefix -ne "/plenum/staging") { throw "This installer is restricted to /plenum/staging." }

$aws = Get-Command aws -ErrorAction SilentlyContinue
if (-not $aws) { throw "AWS CLI v2 is required on PATH." }

function Convert-SecureValue {
  param([Parameter(Mandatory = $true)][Security.SecureString]$Value)
  return [Net.NetworkCredential]::new("", $Value).Password
}

function Read-RequiredText {
  param(
    [Parameter(Mandatory = $true)][string]$Prompt,
    [string]$Pattern = ".+",
    [string]$InvalidMessage = "A value is required."
  )
  while ($true) {
    $value = (Read-Host -Prompt $Prompt).Trim()
    if ($value -match $Pattern) { return $value }
    Write-Warning $InvalidMessage
  }
}

function Read-SecretValue {
  param(
    [Parameter(Mandatory = $true)][string]$Prompt,
    [int]$MinimumLength = 16,
    [switch]$Confirm
  )
  while ($true) {
    $first = Convert-SecureValue (Read-Host -Prompt $Prompt -AsSecureString)
    if ($first.Length -lt $MinimumLength) {
      Write-Warning "The value must contain at least $MinimumLength characters."
      continue
    }
    if ($Confirm) {
      $second = Convert-SecureValue (Read-Host -Prompt "Confirm $Prompt" -AsSecureString)
      if ($first -cne $second) {
        Write-Warning "The values did not match. Try again."
        continue
      }
    }
    return $first
  }
}

function New-RandomBytes {
  param([Parameter(Mandatory = $true)][int]$Count)
  $bytes = New-Object byte[] $Count
  $generator = [Security.Cryptography.RandomNumberGenerator]::Create()
  try { $generator.GetBytes($bytes) } finally { $generator.Dispose() }
  return $bytes
}

function New-Base64UrlSecret {
  param([int]$Bytes = 32)
  return [Convert]::ToBase64String((New-RandomBytes $Bytes)).TrimEnd("=").Replace("+", "-").Replace("/", "_")
}

function New-HexSecret {
  param([int]$Bytes = 8)
  return ((New-RandomBytes $Bytes) | ForEach-Object { $_.ToString("x2") }) -join ""
}

Write-Host "Checking AWS identity and existing staging parameters..."
& $aws.Source sts get-caller-identity --profile $Profile --query Account --output text | Out-Null
if ($LASTEXITCODE -ne 0) { throw "AWS identity verification failed for profile $Profile." }

$existing = & $aws.Source ssm describe-parameters `
  --profile $Profile `
  --region $Region `
  --parameter-filters "Key=Name,Option=BeginsWith,Values=$ParameterPrefix/" `
  --query "Parameters[].Name" `
  --output text
if ($LASTEXITCODE -ne 0) { throw "Could not inspect staging parameter metadata." }
if (-not [string]::IsNullOrWhiteSpace(($existing | Out-String))) {
  throw "One or more $ParameterPrefix parameters already exist. This first-install script will not rotate or overwrite live credentials."
}

Write-Host "Enter the stored external credentials. Secret prompts do not echo or enter shell history."
$postmarkFrom = Read-RequiredText `
  -Prompt "Verified Postmark sender (example: Plenum <you@company.edu>)" `
  -Pattern '^.+<[^<>@\s]+@[^<>@\s]+>$' `
  -InvalidMessage "Use the form Plenum <verified-address@example.org>."
$postmarkToken = Read-SecretValue -Prompt "Postmark server token" -MinimumLength 16
$postmarkWebhookPassword = Read-SecretValue -Prompt "Postmark webhook password" -MinimumLength 32
$alertRecipient = Read-RequiredText `
  -Prompt "Staging operational alert recipient" `
  -Pattern '^[^<>@\s]+@[^<>@\s]+\.[^<>@\s]+$' `
  -InvalidMessage "Enter one valid email address."
$githubUser = Read-RequiredText `
  -Prompt "GitHub username with package access" `
  -Pattern '^[A-Za-z0-9](?:[A-Za-z0-9-]{0,38})$' `
  -InvalidMessage "Enter a valid GitHub username."
$githubToken = Read-SecretValue -Prompt "GitHub classic PAT restricted to read:packages" -MinimumLength 20
$keycloakAdminPassword = Read-SecretValue -Prompt "Keycloak staging administrator password" -MinimumLength 16 -Confirm
$testUserPassword = Read-SecretValue -Prompt "Plenum staging test-user password" -MinimumLength 12 -Confirm

$postgresPassword = New-Base64UrlSecret 32
$operationsDatabasePassword = New-Base64UrlSecret 32
$floorTokenSecret = New-Base64UrlSecret 32
$invitationBearerToken = New-Base64UrlSecret 32
$invitationWebhookToken = New-Base64UrlSecret 32
$mediaApiKey = "plenum-$(New-HexSecret 8)"
$mediaApiSecret = New-Base64UrlSecret 32

$application = [ordered]@{
  DATABASE_URL                      = "postgres://plenum:${postgresPassword}@database:5432/plenum"
  FLOOR_TOKEN_SECRET                = $floorTokenSecret
  INVITATION_DELIVERY_BEARER_TOKEN  = $invitationBearerToken
  INVITATION_DELIVERY_WEBHOOK_TOKEN = $invitationWebhookToken
  MEDIA_API_KEY                     = $mediaApiKey
  MEDIA_API_SECRET                  = $mediaApiSecret
  POSTMARK_FROM                     = $postmarkFrom
  POSTMARK_SERVER_TOKEN             = $postmarkToken
  POSTMARK_WEBHOOK_PASSWORD         = $postmarkWebhookPassword
}

$parameters = [ordered]@{
  "$ParameterPrefix/postgres-password"       = $postgresPassword
  "$ParameterPrefix/keycloak-admin-password" = $keycloakAdminPassword
  "$ParameterPrefix/test-user-password"      = $testUserPassword
  "$ParameterPrefix/livekit-keys"            = "${mediaApiKey}: ${mediaApiSecret}`n"
  "$ParameterPrefix/registry"                = (@{ username = $githubUser; password = $githubToken } | ConvertTo-Json -Compress)
  "$ParameterPrefix/application"             = ($application | ConvertTo-Json -Compress)
  "$ParameterPrefix/operations"              = ([ordered]@{
    ALERT_RECIPIENT       = $alertRecipient
    DATABASE_PASSWORD     = $operationsDatabasePassword
    POSTMARK_FROM         = $postmarkFrom
    POSTMARK_SERVER_TOKEN = $postmarkToken
  } | ConvertTo-Json -Compress)
}

$temporaryDirectory = Join-Path ([IO.Path]::GetTempPath()) ("plenum-ssm-" + [Guid]::NewGuid().ToString("N"))
$utf8 = New-Object Text.UTF8Encoding $false
New-Item -ItemType Directory -Path $temporaryDirectory | Out-Null

try {
  foreach ($entry in $parameters.GetEnumerator()) {
    $request = [ordered]@{
      Name        = $entry.Key
      Description = "Plenum staging runtime secret installed outside Terraform"
      Value       = $entry.Value
      Type        = "SecureString"
      Tier        = "Standard"
    }
    $requestPath = Join-Path $temporaryDirectory ((New-HexSecret 8) + ".json")
    [IO.File]::WriteAllText($requestPath, ($request | ConvertTo-Json -Compress), $utf8)
    $requestUri = "file://" + $requestPath
    & $aws.Source ssm put-parameter `
      --profile $Profile `
      --region $Region `
      --cli-input-json $requestUri `
      --output json | Out-Null
    if ($LASTEXITCODE -ne 0) { throw "Failed to create encrypted parameter $($entry.Key)." }
    Write-Host "Created encrypted parameter $($entry.Key)"
    Remove-Item -LiteralPath $requestPath -Force
  }
} finally {
  if (Test-Path -LiteralPath $temporaryDirectory) {
    Remove-Item -LiteralPath $temporaryDirectory -Recurse -Force
  }
  Remove-Variable -Name postmarkToken, postmarkWebhookPassword, githubToken, `
    keycloakAdminPassword, testUserPassword, postgresPassword, operationsDatabasePassword, alertRecipient, `
    floorTokenSecret, invitationBearerToken, `
    invitationWebhookToken, mediaApiSecret, application, parameters -ErrorAction SilentlyContinue
}

Write-Host "All seven encrypted staging parameters were created. No secret values were printed or added to Terraform state."
