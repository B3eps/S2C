param(
  [Parameter(Mandatory)] [string] $From,
  [Parameter(Mandatory)] [string] $To,
  [string[]] $Exclude = @()
)
$ErrorActionPreference = 'Stop'
$cache = Join-Path $PSScriptRoot '../../.cache/dukascopy'
New-Item -ItemType Directory -Force -Path $cache | Out-Null
$agent = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/155.0.0.0 Safari/537.36'
$failed = [Collections.Generic.List[string]]::new()
for ($d = [datetime]::ParseExact($From, 'yyyy-MM-dd', $null); $d -lt [datetime]::ParseExact($To, 'yyyy-MM-dd', $null); $d = $d.AddDays(1)) {
  $date = $d.ToString('yyyy-MM-dd')
  if ($d.DayOfWeek -in @('Saturday','Sunday') -or $date -in $Exclude) { continue }
  $route = "candles/minute/XAU-USD/BID/$($d.Year)/$($d.Month)/$($d.Day)"
  $target = Join-Path $cache ([uri]::EscapeDataString($route) + '.json')
  if (Test-Path -LiteralPath $target) { continue }
  $temporary = "$target.download"
  $http = & curl.exe -sS -L --max-time 20 --retry 1 --retry-delay 2 -o $temporary -w '%{http_code}' -A $agent -H 'Referer: https://widgets.dukascopy.com/en/historical-data-export' "https://jetta.dukascopy.com/v1/$route"
  try {
    if ($LASTEXITCODE -ne 0 -or $http -ne '200') { throw "HTTP $http" }
    $raw = Get-Content -Raw -LiteralPath $temporary | ConvertFrom-Json
    if ($null -eq $raw.times -or $null -eq $raw.shift -or $raw.shift -ne 60000 -or $null -eq $raw.open) { throw 'Unexpected payload' }
    Move-Item -LiteralPath $temporary -Destination $target
    Write-Output "$date OK"
  } catch {
    if (Test-Path -LiteralPath $temporary) { Remove-Item -LiteralPath $temporary }
    $failed.Add("$date ($($_.Exception.Message))")
  }
}
if ($failed.Count) { throw "Unavailable: $($failed -join ', ')" }
