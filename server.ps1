# Minimal static file server — no Python or Node required
# Usage: powershell -File server.ps1 [-Port 8080]
param([int]$Port = 8080)
$root = $PSScriptRoot
$prefix = "http://localhost:$Port/"

$mimeTypes = @{
  '.html' = 'text/html'
  '.js'   = 'application/javascript'
  '.css'  = 'text/css'
  '.jpg'  = 'image/jpeg'
  '.jpeg' = 'image/jpeg'
  '.png'  = 'image/png'
  '.gif'  = 'image/gif'
  '.gltf' = 'model/gltf+json'
  '.glb'  = 'model/gltf-binary'
  '.mp3'  = 'audio/mpeg'
  '.wav'  = 'audio/wav'
  '.mp4'  = 'video/mp4'
  '.webm' = 'video/webm'
  '.json' = 'application/json'
}

$listener = New-Object System.Net.HttpListener
$listener.Prefixes.Add($prefix)
$listener.Start()
Write-Host "Serving at $prefix  (Ctrl+C to stop)"

try {
  while ($listener.IsListening) {
    $ctx  = $listener.GetContext()
    $req  = $ctx.Request
    $res  = $ctx.Response

    $rel  = $req.Url.LocalPath.TrimStart('/').Replace('/', '\')
    if ($rel -eq '') { $rel = 'index.html' }
    $path = Join-Path $root $rel

    if (Test-Path $path -PathType Leaf) {
      $ext   = [System.IO.Path]::GetExtension($path).ToLower()
      $mime  = if ($mimeTypes[$ext]) { $mimeTypes[$ext] } else { 'application/octet-stream' }
      $bytes = [System.IO.File]::ReadAllBytes($path)
      $res.ContentType   = $mime
      $res.Headers.Add("Cache-Control", "no-store, no-cache")
      $res.ContentLength64 = $bytes.Length
      # HEAD requests (used for page discovery) must send headers only, no body.
      if ($req.HttpMethod -ne 'HEAD') {
        $res.OutputStream.Write($bytes, 0, $bytes.Length)
      }
      Write-Host "$($req.HttpMethod) 200 $($req.Url.LocalPath)"
    } else {
      $res.StatusCode = 404
      Write-Host "$($req.HttpMethod) 404 $($req.Url.LocalPath)"
    }
    $res.Close()
  }
} finally {
  $listener.Stop()
}
