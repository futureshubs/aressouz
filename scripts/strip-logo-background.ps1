# Qora (yoki juda to‘q) fonni shaffof qiladi — PNG logolar uchun.
param(
  [string[]]$Paths = @(
    'public/branding/*.png',
    'public/icons/icon-*.png'
  ),
  [int]$Threshold = 28
)

$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Drawing

function Remove-DarkBackground([string]$path) {
  $full = Resolve-Path $path
  $src = [System.Drawing.Bitmap]::FromFile($full)
  $dst = New-Object System.Drawing.Bitmap($src.Width, $src.Height, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
  $g = [System.Drawing.Graphics]::FromImage($dst)
  $g.Clear([System.Drawing.Color]::FromArgb(0, 0, 0, 0))
  $g.Dispose()
  for ($y = 0; $y -lt $src.Height; $y++) {
    for ($x = 0; $x -lt $src.Width; $x++) {
      $c = $src.GetPixel($x, $y)
      if ($c.R -le $Threshold -and $c.G -le $Threshold -and $c.B -le $Threshold) { continue }
      $dst.SetPixel($x, $y, [System.Drawing.Color]::FromArgb(255, $c.R, $c.G, $c.B))
    }
  }
  $src.Dispose()
  $tmp = "$full.tmp"
  $dst.Save($tmp, [System.Drawing.Imaging.ImageFormat]::Png)
  $dst.Dispose()
  Move-Item -Force $tmp $full
  Write-Host "OK $full"
}

$root = Split-Path (Split-Path $PSScriptRoot -Parent) -Parent
if (-not $root) { $root = (Get-Location).Path }
Set-Location (Join-Path $PSScriptRoot '..')

foreach ($pattern in $Paths) {
  Get-ChildItem -Path $pattern -ErrorAction SilentlyContinue | ForEach-Object {
    Remove-DarkBackground $_.FullName
  }
}
