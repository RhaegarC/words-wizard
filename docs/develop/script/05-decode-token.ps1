param(
    [Parameter(Mandatory)]
    [string]$Token
)

$part = $Token.Split('.')[1].Replace('-', '+').Replace('_', '/')
switch ($part.Length % 4) {
    2 { $part += '==' }
    3 { $part += '=' }
}

$json = [System.Text.Encoding]::UTF8.GetString([Convert]::FromBase64String($part))
$claims = $json | ConvertFrom-Json

$claims | Select-Object scp, roles, oid, tid, aud, iss | Format-List
