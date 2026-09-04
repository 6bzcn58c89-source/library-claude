Add-Type -AssemblyName System.Drawing

function New-Icon($size, $path) {
  $bmp = New-Object System.Drawing.Bitmap $size, $size
  $g = [System.Drawing.Graphics]::FromImage($bmp)
  $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
  $g.Clear([System.Drawing.Color]::Transparent)

  $bg = [System.Drawing.ColorTranslator]::FromHtml('#7a4b3a')
  $brush = New-Object System.Drawing.SolidBrush $bg
  $radius = $size * 0.19
  $rect = New-Object System.Drawing.RectangleF 0, 0, $size, $size
  $path2 = New-Object System.Drawing.Drawing2D.GraphicsPath
  $d = $radius * 2
  $path2.AddArc(0, 0, $d, $d, 180, 90)
  $path2.AddArc($size - $d, 0, $d, $d, 270, 90)
  $path2.AddArc($size - $d, $size - $d, $d, $d, 0, 90)
  $path2.AddArc(0, $size - $d, $d, $d, 90, 90)
  $path2.CloseFigure()
  $g.FillPath($brush, $path2)

  $fg = [System.Drawing.ColorTranslator]::FromHtml('#faf6f0')
  $fgBrush = New-Object System.Drawing.SolidBrush $fg
  $bw = $size * 0.27
  $bh = $size * 0.43
  $cx = $size / 2
  $topY = $size * 0.275

  $left = New-Object System.Drawing.Drawing2D.GraphicsPath
  $leftPts = @(
    New-Object System.Drawing.PointF ($cx - 0.01*$size), $topY
    New-Object System.Drawing.PointF ($cx - $bw), ($topY + $size*0.02)
    New-Object System.Drawing.PointF ($cx - $bw), ($topY + $bh)
    New-Object System.Drawing.PointF ($cx - 0.01*$size), ($topY + $bh - $size*0.05)
  )
  $left.AddPolygon($leftPts)
  $g.FillPath($fgBrush, $left)

  $right = New-Object System.Drawing.Drawing2D.GraphicsPath
  $rightPts = @(
    New-Object System.Drawing.PointF ($cx + 0.01*$size), $topY
    New-Object System.Drawing.PointF ($cx + $bw), ($topY + $size*0.02)
    New-Object System.Drawing.PointF ($cx + $bw), ($topY + $bh)
    New-Object System.Drawing.PointF ($cx + 0.01*$size), ($topY + $bh - $size*0.05)
  )
  $right.AddPolygon($rightPts)
  $g.FillPath($fgBrush, $right)

  $bmp.Save($path, [System.Drawing.Imaging.ImageFormat]::Png)
  $g.Dispose()
  $bmp.Dispose()
}

New-Icon 180 "$PSScriptRoot\icon-180.png"
New-Icon 192 "$PSScriptRoot\icon-192.png"
New-Icon 512 "$PSScriptRoot\icon-512.png"
Write-Output "done"
