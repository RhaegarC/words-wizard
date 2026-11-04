param(
    [string]$ClientId = '2fc2ab8a-4a9b-40b2-a4fa-a8a95fb7b969'
)

$ErrorActionPreference = 'Stop'

$app = az ad app show --id $ClientId `
    --query '{ roles: appRoles }' -o json --only-show-errors | ConvertFrom-Json

Write-Host "Defined roles" -ForegroundColor Cyan
$app.roles | Select-Object value, id, isEnabled | Format-Table -AutoSize

$sp = az ad sp show --id $ClientId `
    --query '{ id: id, required: appRoleAssignmentRequired }' -o json --only-show-errors |
    ConvertFrom-Json

Write-Host "Assignment required: $($sp.required)" -ForegroundColor Cyan

$roleName = @{}
$app.roles | ForEach-Object { $roleName[$_.id] = $_.value }

$assignments = az rest --method GET `
    --uri "https://graph.microsoft.com/v1.0/servicePrincipals/$($sp.id)/appRoleAssignedTo" `
    --query 'value[].{principal:principalDisplayName, appRoleId:appRoleId, created:createdDateTime}' `
    -o json --only-show-errors | ConvertFrom-Json

if ($assignments.Count -eq 0) {
    Write-Host "No role assignments." -ForegroundColor Yellow
}
else {
    $assignments |
        Select-Object principal,
            @{ n = 'Role'; e = { $roleName[$_.appRoleId] } },
            created |
        Sort-Object Role, principal |
        Format-Table -AutoSize
}
