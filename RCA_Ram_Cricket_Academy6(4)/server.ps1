# RCA (Ram Cricket Academy) - Lightweight Local HTTP Server
# Runs natively on any Windows computer using built-in PowerShell .NET HttpListener (zero dependencies required)

$port = 8080
$prefix = "http://localhost:$port/"
$baseDir = $PSScriptRoot

$listener = New-Object System.Net.HttpListener
$listener.Prefixes.Add($prefix)

try {
    $listener.Start()
} catch {
    Write-Host "Failed to bind to $prefix. Trying port 8081..." -ForegroundColor Yellow
    $port = 8081
    $prefix = "http://localhost:$port/"
    $listener = New-Object System.Net.HttpListener
    $listener.Prefixes.Add($prefix)
    $listener.Start()
}

Write-Host "==========================================================" -ForegroundColor Yellow
Write-Host " RCA (RAM CRICKET ACADEMY) - LOCAL DEMO SERVER RUNNING" -ForegroundColor Green
Write-Host " Server URL: $prefix" -ForegroundColor Cyan
Write-Host " Admin URL:  $prefix/admin.html" -ForegroundColor Cyan
Write-Host " Admin User: admin  |  Admin Pass: rca@vrindavan" -ForegroundColor White
Write-Host " Press Ctrl+C in this console to stop the server." -ForegroundColor Gray
Write-Host "==========================================================" -ForegroundColor Yellow

# Auto-open browser
Start-Process $prefix

$mimeMap = @{
    ".html" = "text/html; charset=utf-8"
    ".htm"  = "text/html; charset=utf-8"
    ".css"  = "text/css; charset=utf-8"
    ".js"   = "application/javascript; charset=utf-8"
    ".json" = "application/json; charset=utf-8"
    ".png"  = "image/png"
    ".jpg"  = "image/jpeg"
    ".jpeg" = "image/jpeg"
    ".gif"  = "image/gif"
    ".svg"  = "image/svg+xml"
    ".ico"  = "image/x-icon"
}

while ($listener.IsListening) {
    try {
        $context = $listener.GetContext()
        $request = $context.Request
        $response = $context.Response

        $rawUrl = $request.RawUrl.Split('?')[0]
        if ($rawUrl -eq '/' -or $rawUrl -eq '') {
            $rawUrl = '/index.html'
        }

        $localPath = Join-Path $baseDir ($rawUrl.TrimStart('/'))
        $localPath = [System.IO.Path]::GetFullPath($localPath)

        # Basic path traversal guard
        if (-not $localPath.StartsWith($baseDir, [System.StringComparison]::OrdinalIgnoreCase)) {
            $response.StatusCode = 403
            $response.Close()
            continue
        }

        if (Test-Path $localPath -PathType Leaf) {
            $ext = [System.IO.Path]::GetExtension($localPath).ToLower()
            $mime = "application/octet-stream"
            if ($mimeMap.ContainsKey($ext)) {
                $mime = $mimeMap[$ext]
            }

            $response.ContentType = $mime
            $response.Headers.Add("Access-Control-Allow-Origin", "*")
            $response.StatusCode = 200

            $bytes = [System.IO.File]::ReadAllBytes($localPath)
            $response.ContentLength64 = $bytes.Length
            $response.OutputStream.Write($bytes, 0, $bytes.Length)
        } else {
            $response.StatusCode = 404
            $notFoundText = [System.Text.Encoding]::UTF8.GetBytes("<h1>404 Not Found: $rawUrl</h1>")
            $response.ContentType = "text/html"
            $response.OutputStream.Write($notFoundText, 0, $notFoundText.Length)
        }

        $response.Close()
    } catch {
        # ignore context interruptions on shutdown
    }
}
