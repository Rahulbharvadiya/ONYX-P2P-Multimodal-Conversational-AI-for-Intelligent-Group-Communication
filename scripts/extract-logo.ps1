Add-Type -AssemblyName System.Drawing

$srcPath = "C:\Users\WIN 11\.gemini\antigravity-ide\brain\d8d93d47-096e-4924-8490-7277c332adc1\.user_uploaded\media_1789285686222.jpg"
$img = [System.Drawing.Image]::FromFile($srcPath)

Write-Host "Image size: $($img.Width) x $($img.Height)"

# The App Icon is in the left region:
# Left rounded card spans roughly x: 67 to 550, y: 247 to 730 (in normalized coords)
# Let's compute based on dimensions:
$w = $img.Width
$h = $img.Height

# Left app icon (rounded icon container)
# Left icon center is around x = 0.31 * w, y = 0.49 * h, size ~ 0.50 * w
$appX = [int]($w * 0.065)
$appY = [int]($h * 0.245)
$appW = [int]($w * 0.485)
$appH = [int]($h * 0.485)

$appRect = New-Object System.Drawing.Rectangle($appX, $appY, $appW, $appH)
$appBmp = New-Object System.Drawing.Bitmap($appW, $appH)
$g = [System.Drawing.Graphics]::FromImage($appBmp)
$g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
$g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
$g.DrawImage($img, (New-Object System.Drawing.Rectangle(0, 0, $appW, $appH)), $appRect, [System.Drawing.GraphicsUnit]::Pixel)
$g.Dispose()

$outApp = "c:\Users\WIN 11\Desktop\Group-Chatbot-main\public\onyx-logo.png"
$appBmp.Save($outApp, [System.Drawing.Imaging.ImageFormat]::Png)
$appBmp.Dispose()
Write-Host "Saved $outApp"

# Also save to public/icon.png and src/app/icon.png (for Next.js metadata icons)
Copy-Item $outApp "c:\Users\WIN 11\Desktop\Group-Chatbot-main\public\icon.png"
Copy-Item $outApp "c:\Users\WIN 11\Desktop\Group-Chatbot-main\src\app\icon.png" -Force

# Right side clean gemstone icon (inside the favicon square box, inset by 3px)
$favX = [int]($w * 0.672)
$favY = [int]($h * 0.364)
$favW = [int]($w * 0.252)
$favH = [int]($h * 0.252)

$favRect = New-Object System.Drawing.Rectangle($favX, $favY, $favW, $favH)
$favBmp = New-Object System.Drawing.Bitmap($favW, $favH)
$g2 = [System.Drawing.Graphics]::FromImage($favBmp)
$g2.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
$g2.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
$g2.DrawImage($img, (New-Object System.Drawing.Rectangle(0, 0, $favW, $favH)), $favRect, [System.Drawing.GraphicsUnit]::Pixel)
$g2.Dispose()

$outFav = "c:\Users\WIN 11\Desktop\Group-Chatbot-main\public\onyx-gem.png"
$favBmp.Save($outFav, [System.Drawing.Imaging.ImageFormat]::Png)
$favBmp.Dispose()
Write-Host "Saved $outFav"

$img.Dispose()
