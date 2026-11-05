param(
    [Parameter(Mandatory)]
    [ValidateSet('user', 'teacher', 'admin')]
    [string]$Role,

    [string]$UserUpn,
    [string]$GroupId,

    [string]$ClientId = '2fc2ab8a-4a9b-40b2-a4fa-a8a95fb7b969'
)

$ErrorActionPreference = 'Stop'

$roleIds = @{
    user    = '63630126-e0a6-4262-a9f3-869cefebf1b0'
    teacher = '46a4091e-5147-4415-b8df-fd625a1e91f8'
    admin   = 'b8fc2b12-6ae4-4d1f-89f4-b0a371a5e0f9'
}

if ($UserUpn -and $GroupId) { throw "Pass either -UserUpn or -GroupId, not both." }
if (-not $UserUpn -and -not $GroupId) { throw "Pass -UserUpn or -GroupId." }

$spId = (az ad sp show --id $ClientId --query id -o tsv --only-show-errors).Trim()
if ($LASTEXITCODE -ne 0 -or [string]::IsNullOrWhiteSpace($spId)) {
    throw "No service principal exists for $ClientId. Create it with: az ad sp create --id $ClientId"
}

$principalId = if ($UserUpn) {
    $id = (az ad user show --id $UserUpn --query id -o tsv --only-show-errors).Trim()
    if ($LASTEXITCODE -ne 0 -or [string]::IsNullOrWhiteSpace($id)) {
        throw "Could not resolve user $UserUpn."
    }
    $id
}
else {
    $id = (az ad group show --group $GroupId --query id -o tsv --only-show-errors).Trim()
    if ($LASTEXITCODE -ne 0 -or [string]::IsNullOrWhiteSpace($id)) {
        throw "Could not resolve group $GroupId."
    }
    $id
}

$roleId = $roleIds[$Role]

$query = "value[?principalId=='$principalId' && appRoleId=='$roleId']"
$existing = az rest --method GET `
    --uri "https://graph.microsoft.com/v1.0/servicePrincipals/$spId/appRoleAssignedTo" `
    --query $query -o json --only-show-errors | ConvertFrom-Json

if ($existing.Count -gt 0) {
    Write-Host "$principalId already has role '$Role'. Nothing to do."
    return
}

$body = @{
    principalId = $principalId
    resourceId  = $spId
    appRoleId   = $roleId
} | ConvertTo-Json

$bodyPath = Join-Path $env:TEMP ("words-" + [guid]::NewGuid().ToString() + ".json")
[System.IO.File]::WriteAllText($bodyPath, $body, [System.Text.UTF8Encoding]::new($false))
try {
    az rest --method POST `
        --uri "https://graph.microsoft.com/v1.0/servicePrincipals/$spId/appRoleAssignedTo" `
        --body "@$bodyPath" --only-show-errors | Out-Null

    if ($LASTEXITCODE -ne 0) { throw "The app role assignment failed." }
}
finally {
    Remove-Item $bodyPath -ErrorAction SilentlyContinue
}

Write-Host "Assigned '$Role' to $principalId."