param(
    [string]$ClientId = '2fc2ab8a-4a9b-40b2-a4fa-a8a95fb7b969',
    [switch]$Enable
)

$ErrorActionPreference = 'Stop'

$spId = (az ad sp show --id $ClientId --query id -o tsv --only-show-errors).Trim()

$body = @{ appRoleAssignmentRequired = [bool]$Enable } | ConvertTo-Json
$bodyPath = Join-Path $env:TEMP ("words-" + [guid]::NewGuid().ToString() + ".json")
[System.IO.File]::WriteAllText($bodyPath, $body, [System.Text.UTF8Encoding]::new($false))
try {
    az rest --method PATCH `
        --uri "https://graph.microsoft.com/v1.0/servicePrincipals/$spId" `
        --body "@$bodyPath" --only-show-errors | Out-Null

    if ($LASTEXITCODE -ne 0) { throw "The service principal PATCH failed." }
}
finally {
    Remove-Item $bodyPath -ErrorAction SilentlyContinue
}

az rest --method GET --uri "https://graph.microsoft.com/v1.0/servicePrincipals/$spId" `
    --query '{ appRoleAssignmentRequired: appRoleAssignmentRequired }' -o json
