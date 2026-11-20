param([string]$Manifest)

$ErrorActionPreference = 'Stop'
$agent = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/155.0.0.0 Safari/537.36'
$cache = Join-Path $PSScriptRoot '../../.cache/dukascopy'
$entries = @('2026-01-05T08:01Z','2026-01-05T10:35Z','2026-05-04T09:57Z','2026-05-04T11:27Z','2026-09-07T08:15Z','2026-09-07T08:33Z')
$hours = if ($Manifest) {
  (Get-Content -Raw -LiteralPath $Manifest | ConvertFrom-Json).hours | ForEach-Object {
    ([datetimeoffset]$_).UtcDateTime
  }
} else {
  foreach ($entry in $entries) {
    $start = [datetimeoffset]::Parse($entry).UtcDateTime
    $hour = [datetime]::new($start.Year,$start.Month,$start.Day,$start.Hour,0,0)
    foreach ($n in 0..2) { $hour.AddHours($n) }
  }
}
foreach ($h in ($hours | Sort-Object -Unique)) {
  $route = "ticks/XAU-USD/$($h.Year)/$($h.Month)/$($h.Day)/$($h.Hour)"
  $target = Join-Path $cache ([uri]::EscapeDataString($route) + '.json')
  if (Test-Path -LiteralPath $target) { continue }
  $tempPath = "$target.download"
  $http = curl.exe -sS -L --max-time 20 --retry 1 -A $agent -H 'Referer: https://widgets.dukascopy.com/en/historical-data-export' -o $tempPath -w '%{http_code}' "https://jetta.dukascopy.com/v1/$route"
  if ($LASTEXITCODE -ne 0 -or $http -ne '200') { throw "$route HTTP $http" }
  $payload = Get-Content -Raw -LiteralPath $tempPath | ConvertFrom-Json
  if ($payload.times.Count -eq 0 -or $payload.asks.Count -ne $payload.times.Count -or $payload.bids.Count -ne $payload.times.Count) { throw "Malformed $route" }
  Move-Item -LiteralPath $tempPath -Destination $target
  Write-Output $route
}

