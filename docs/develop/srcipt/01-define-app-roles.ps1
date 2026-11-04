param(
    [string]$ClientId = '2fc2ab8a-4a9b-40b2-a4fa-a8a95fb7b969',
    [switch]$Force
)

$ErrorActionPreference = 'Stop'

function Write-JsonBody([string]$Json) {
    $path = Join-Path $env:TEMP ("words-" + [guid]::NewGuid().ToString() + ".json")
    [System.IO.File]::WriteAllText($path, $Json, [System.Text.UTF8Encoding]::new($false))
    return $path
}

$appObjectId = (az ad app show --id $ClientId --query id -o tsv --only-show-errors).Trim()
if ($LASTEXITCODE -ne 0 -or [string]::IsNullOrWhiteSpace($appObjectId)) {
    throw "Could not resolve the application object id for $ClientId."
}

$existing = az ad app show --id $ClientId --query appRoles -o json --only-show-errors | ConvertFrom-Json
if ($existing.Count -gt 0 -and -not $Force) {
    Write-Host "The application already defines these roles:"
    $existing | Select-Object value, id, isEnabled | Format-Table -AutoSize
    throw "Refusing to replace appRoles. Re-run with -Force if this is intentional."
}

# Stable GUIDs. Assignments reference these ids; do not regenerate them.
$roles = @(
    [ordered]@{
        id                 = '63630126-e0a6-4262-a9f3-869cefebf1b0'
        displayName        = 'User'
        description        = 'Default role for a signed-in child or parent.'
        value              = 'user'
        allowedMemberTypes = @('User')
        isEnabled          = $true
    }
    [ordered]@{
        id                 = '46a4091e-5147-4415-b8df-fd625a1e91f8'
        displayName        = 'Teacher'
        description        = 'Can manage content for their classes.'
        value              = 'teacher'
        allowedMemberTypes = @('User')
        isEnabled          = $true
    }
    [ordered]@{
        id                 = 'b8fc2b12-6ae4-4d1f-89f4-b0a371a5e0f9'
        displayName        = 'Admin'
        description        = 'Full administrative access.'
        value              = 'admin'
        allowedMemberTypes = @('User')
        isEnabled          = $true
    }
)

$bodyPath = Write-JsonBody (@{ appRoles = $roles } | ConvertTo-Json -Depth 10)
try {
    az rest --method PATCH `
        --uri "https://graph.microsoft.com/v1.0/applications/$appObjectId" `
        --body "@$bodyPath" --only-show-errors | Out-Null

    if ($LASTEXITCODE -ne 0) { throw "The appRoles PATCH failed." }
}
finally {
    Remove-Item $bodyPath -ErrorAction SilentlyContinue
}

az ad app show --id $ClientId `
    --query 'appRoles[].[value,id,isEnabled,allowedMemberTypes[0]]' -o table