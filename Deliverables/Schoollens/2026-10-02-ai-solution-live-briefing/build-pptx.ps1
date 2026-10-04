$ErrorActionPreference = "Stop"

function RGB([int]$r, [int]$g, [int]$b) {
  return [int]($r + ($g * 256) + ($b * 65536))
}

$navy  = RGB 0 31 68
$ink   = RGB 27 53 90
$teal  = RGB 0 106 99
$mint  = RGB 56 163 154
$paper = RGB 247 244 238
$white = RGB 255 255 255
$muted = RGB 92 107 128
$card  = RGB 255 255 255
$mintBg = RGB 232 248 245

$root  = "D:\SMT\Personal\myPKA-main\myPKA-main\Deliverables\Schoollens"
$out   = Join-Path $root "2026-10-02-ai-solution-live-briefing"
$video = Join-Path $root "demo-video\output\SchoolLens-parent-enquiry-silent.mp4"
$fb    = Join-Path $out "parent-yais-kings.png"
$logo  = Join-Path $root "web\public\logo-mark.png"
$poster = Join-Path $out "demo-poster.jpg"
$pptx  = Join-Path $out "SchoolLens-8min-AI-briefing.pptx"

if (-not (Test-Path $video)) { throw "Missing demo video: $video" }
if (-not (Test-Path $fb)) { throw "Missing Facebook screenshot" }

$ErrorActionPreference = "Continue"
ffmpeg -y -ss 55 -i $video -frames:v 1 -q:v 3 $poster | Out-Null
$ErrorActionPreference = "Stop"

function Add-Box($slide, $l, $t, $w, $h, $fill, $line) {
  $s = $slide.Shapes.AddShape(1, $l, $t, $w, $h) # msoShapeRectangle
  $s.Fill.Solid()
  $s.Fill.ForeColor.RGB = $fill
  if ($null -eq $line) {
    $s.Line.Visible = 0
  } else {
    $s.Line.ForeColor.RGB = $line
  }
  return $s
}

function Add-Round($slide, $l, $t, $w, $h, $fill) {
  $s = $slide.Shapes.AddShape(5, $l, $t, $w, $h) # rounded rect
  $s.Fill.Solid()
  $s.Fill.ForeColor.RGB = $fill
  $s.Line.Visible = 0
  $s.Adjustments.Item(1) = 0.08
  return $s
}

function Add-Text($slide, $l, $t, $w, $h, $text, $size, $bold, $color, $font, $align) {
  $tb = $slide.Shapes.AddTextbox(1, $l, $t, $w, $h)
  $tr = $tb.TextFrame.TextRange
  $tb.TextFrame.WordWrap = -1
  $tb.TextFrame.MarginLeft = 4
  $tb.TextFrame.MarginRight = 4
  $tb.TextFrame.MarginTop = 2
  $tb.TextFrame.MarginBottom = 2
  $tr.Text = $text
  $tr.Font.Name = $font
  $tr.Font.Size = $size
  $tr.Font.Bold = $(if ($bold) { -1 } else { 0 })
  $tr.Font.Color.RGB = $color
  if ($align) { $tr.ParagraphFormat.Alignment = $align }
  return $tb
}

function Set-Notes($slide, $text) {
  try {
    $slide.NotesPage.Shapes.Placeholders.Item(2).TextFrame.TextRange.Text = $text
  } catch {
    foreach ($sh in $slide.NotesPage.Shapes) {
      try {
        if ($sh.HasTextFrame -eq -1 -and $sh.TextFrame.HasText -ne $null) {
          if ($sh.Name -match "Notes") { $sh.TextFrame.TextRange.Text = $text }
        }
      } catch {}
    }
  }
}

$pptPath = "C:\Program Files\Microsoft Office\root\Office16\POWERPNT.EXE"
$app = New-Object -ComObject PowerPoint.Application
$app.Visible = 1
$pres = $app.Presentations.Add()
$pres.PageSetup.SlideWidth = 960
$pres.PageSetup.SlideHeight = 540

$blank = $null
for ($i = 1; $i -le $pres.SlideMaster.CustomLayouts.Count; $i++) {
  if ($pres.SlideMaster.CustomLayouts.Item($i).Name -match "Blank") {
    $blank = $pres.SlideMaster.CustomLayouts.Item($i)
    break
  }
}
if (-not $blank) { $blank = $pres.SlideMaster.CustomLayouts.Item($pres.SlideMaster.CustomLayouts.Count) }

function New-Slide($pres, $layout) {
  return $pres.Slides.AddSlide($pres.Slides.Count + 1, $layout)
}

# ----- SLIDE 1 Cover -----
$s1 = New-Slide $pres $blank
Add-Box $s1 0 0 960 540 $navy $null | Out-Null
Add-Box $s1 0 0 8 540 $mint $null | Out-Null
if (Test-Path $logo) {
  $s1.Shapes.AddPicture($logo, 0, -1, 40, 28, 42, 42) | Out-Null
}
Add-Text $s1 92 36 500 28 "SCHOOLLENS  ·  8-MINUTE AI BRIEFING" 12 $true $mint "Calibri" 1 | Out-Null
Add-Text $s1 40 150 880 160 "Yangon American or KINGS?" 36 $true $white "Georgia" 1 | Out-Null
Add-Text $s1 40 310 820 90 "Facebook scored them. We open the sources." 28 $false $mint "Georgia" 1 | Out-Null
Add-Text $s1 40 480 700 28 "A real parent enquiry. Silent recording of the running app. No invented ranking." 13 $false (RGB 183 201 196) "Calibri" 1 | Out-Null
Set-Notes $s1 @"
0:00-0:20
Good afternoon. I will not repeat the deck you already have. This briefing is a real parent, then the product running.

A parent asked: Yangon American or KINGS, and what are the fees? Facebook answered with 84 percent recommended versus not yet rated.
"@

# ----- SLIDE 2 Scenario -----
$s2 = New-Slide $pres $blank
Add-Box $s2 0 0 960 540 $paper $null | Out-Null
Add-Box $s2 0 0 960 8 $teal $null | Out-Null
Add-Text $s2 40 22 500 22 "REAL PARENT  ·  INTERNATIONAL SCHOOL REVIEW MYANMAR" 11 $true $teal "Calibri" 1 | Out-Null
Add-Text $s2 40 52 480 140 "This parent asked a fee question. Facebook answered with a score." 24 $true $ink "Georgia" 1 | Out-Null
Add-Text $s2 40 200 470 110 "Yangon American or KINGS Pun Hlaing. They compared deposits and yearly fees in Burmese. The group UI answered 84 percent recommended versus not yet rated." 15 $false $muted "Calibri" 1 | Out-Null

$names = "Yangon American","KINGS Pun Hlaing","84% recommended","Not yet rated"
$x = 40
$widths = 150,150,150,140
$i = 0
foreach ($n in $names) {
  $w = $widths[$i]
  $chip = Add-Round $s2 $x 330 $w 28 $mintBg
  $chip.Adjustments.Item(1) = 0.5
  Add-Text $s2 $x 332 $w 24 $n 10 $true $teal "Calibri" 2 | Out-Null
  $x += ($w + 8)
  $i++
}

$s2.Shapes.AddPicture($fb, 0, -1, 540, 48, 380, 450) | Out-Null
try {
  $pic = $s2.Shapes.Item($s2.Shapes.Count)
  $pic.PictureFormat.CropBottom = 90
} catch {}

Set-Notes $s2 @"
0:20-1:20
I want to start where every Yangon parent already is. Not a slide about AI. A Facebook group.

Hours ago, in International School Review Myanmar, a parent asked: Yangon American or KINGS. They compared fees in the comments. Facebook put 84 percent recommended next to not yet rated.

That score is not a fee table. It is not a source. It cannot tell you whether Nursery is 19.25 million kyat.

This parent asked for help. The group will send opinions. None of that comes with a poster you can open tonight.
"@

# ----- SLIDE 3 Gap -----
$s3 = New-Slide $pres $blank
Add-Box $s3 0 0 960 540 $paper $null | Out-Null
Add-Box $s3 0 0 960 8 $teal $null | Out-Null
Add-Text $s3 40 22 800 22 "THE GAP SCHOOLLENS FILLS" 11 $true $teal "Calibri" 1 | Out-Null
Add-Text $s3 40 50 880 70 "They need facts they can inspect. The group will send opinions." 24 $true $ink "Georgia" 1 | Out-Null

$cards = @(
  @{ t = "Facebook tonight"; h = "84% recommended"; b = "A page score and a not-yet-rated badge. No excerpt. No date. No fee poster you can open." },
  @{ t = "This parent needs"; h = "Fees they can inspect"; b = "Deposit, early-bird, Nursery, Year 10. Gossip numbers stay gossip until a source is on file." },
  @{ t = "SchoolLens"; h = "Collect · reconcile · Ask"; b = "Show the poster. Label it likely until a second source agrees. If a name has no record, say unknown - do not invent 84%." }
)
$cx = 40
foreach ($c in $cards) {
  $box = Add-Round $s3 $cx 150 280 300 $card
  Add-Box $s3 $cx 150 280 6 $mint $null | Out-Null
  Add-Text $s3 ($cx + 18) 172 244 22 $c.t.ToUpper() 11 $true $teal "Calibri" 1 | Out-Null
  Add-Text $s3 ($cx + 18) 204 244 70 $c.h 18 $true $ink "Georgia" 1 | Out-Null
  Add-Text $s3 ($cx + 18) 280 244 140 $c.b 14 $false $muted "Calibri" 1 | Out-Null
  $cx += 300
}
Set-Notes $s3 @"
1:20-2:10
What does this parent actually need? Not 84 percent. They need the fee poster. Deposit. Early-bird. Nursery. Year 10.

Facebook cannot do that. A chatbot will invent a fluent fee and sound sure.

SchoolLens does three jobs. Collect the poster. Extract and label it likely - one source. Ask only from retrieved evidence. If Yangon American is not on file, we say so. We do not invent a recommendation score.

Click the next slide. Silent recording of the live app. No music.
"@

# ----- SLIDE 4 Demo video -----
$s4 = New-Slide $pres $blank
Add-Box $s4 0 0 960 540 $navy $null | Out-Null
Add-Box $s4 0 0 960 8 $mint $null | Out-Null
Add-Text $s4 40 16 700 20 "CLICK ONCE TO PLAY  ·  SCREEN RECORDING OF THE LIVE APP" 11 $true $mint "Calibri" 1 | Out-Null
Add-Text $s4 40 36 880 28 "Same path as the product: the Facebook post, Yangon American empty, KINGS fees labelled likely." 14 $false (RGB 183 201 196) "Calibri" 1 | Out-Null

$vidLeft = 80
$vidTop = 72
$vidW = 800
$vidH = [int](800 * 900 / 1440) # 500 - too tall
$vidW = 736
$vidH = 460
$vidLeft = [int]((960 - $vidW) / 2)
$vidTop = 68

$media = $s4.Shapes.AddMediaObject2($video, 0, -1, $vidLeft, $vidTop, $vidW, $vidH)
if (Test-Path $poster) {
  try { $media.MediaFormat.SetDisplayPicture($poster) } catch {
    try { $media.MediaFormat.SetDisplayPictureFromFile($poster) } catch {}
  }
}

# Play when the video is clicked
try {
  $seq = $s4.TimeLine.InteractiveSequences.Add()
  $null = $seq.AddEffect($media, 83, 0, 4) # MediaPlay, trigger OnShapeClick
} catch {
  try {
    $media.AnimationSettings.PlaySettings.PlayOnEntry = 0
    $media.AnimationSettings.Animate = -1
  } catch {}
}

Add-Text $s4 40 508 880 22 "1 min 31 sec  ·  silent  ·  pause if you need to talk  ·  actual SchoolLens UI, not a mock" 12 $false (RGB 183 201 196) "Calibri" 2 | Out-Null

Set-Notes $s4 @"
2:10-7:20  TALK OVER THE VIDEO. Click the picture once to play. Spacebar pauses in presenter view.

OPEN: Real Facebook post. Yangon American or KINGS. 84 percent versus not yet rated.

HOME: The AI does not pick a school.

YANGON AMERICAN: Zero rows. Honest empty. We do not invent an 84 percent score.

KINGS: Facebook said not yet rated. We do not rate. Zero claim groups is unknown, not a badge.

FEES: Public poster, extracted. Nursery 19.25 million, Year 10 30.8 million. Label is likely - one source.

ASK: The parent question is fees, not which school is better. If Ask is silent, the poster is still the answer.

Do not name a winner.
"@

# ----- SLIDE 5 Close -----
$s5 = New-Slide $pres $blank
Add-Box $s5 0 0 960 540 $paper $null | Out-Null
Add-Box $s5 0 0 960 8 $teal $null | Out-Null
Add-Text $s5 40 22 800 22 "BACK TO THAT PARENT" 11 $true $teal "Calibri" 1 | Out-Null
Add-Text $s5 40 52 880 70 "They asked for a score. We can hand them a source." 24 $true $ink "Georgia" 1 | Out-Null

$rows = @(
  @{ k = "Not this"; v = "84 percent recommended versus not yet rated. A comment thread about 15 million and 20 million kyat." },
  @{ k = "This"; v = "Yangon American stays unknown if we have no record. KINGS fees stay likely until a second source agrees." },
  @{ k = "The rule"; v = "The AI still does not pick Yangon American or KINGS. It shows the poster - or says we do not have one." }
)
$ry = 150
foreach ($r in $rows) {
  Add-Round $s5 40 $ry 880 90 $card | Out-Null
  Add-Text $s5 58 ($ry + 16) 140 58 $r.k 16 $true $teal "Georgia" 1 | Out-Null
  Add-Text $s5 210 ($ry + 18) 680 58 $r.v 15 $false $ink "Calibri" 1 | Out-Null
  $ry += 102
}
Add-Text $s5 40 500 880 24 "Directories invent a number one. Facebook invents a percent. SchoolLens labels evidence." 13 $false $muted "Calibri" 1 | Out-Null
Set-Notes $s5 @"
7:20-8:00
Let me put us back in that Facebook thread.

They asked Yangon American or KINGS, and what the fees are. Facebook gave 84 percent and not yet rated.

What we can hand them is not a winner. If a name is missing, unknown. If a poster is on file, likely. The parent still chooses.

Directories invent a number one. Facebook invents a percent. Chatbots invent fluency.

SchoolLens tells that family what sources say - and how sure we are.

I will stop there. Questions.
"@

if (Test-Path $pptx) { Remove-Item $pptx -Force }
$pres.SaveAs($pptx)
$pres.Close()
$app.Quit()

[System.Runtime.Interopservices.Marshal]::ReleaseComObject($pres) | Out-Null
[System.Runtime.Interopservices.Marshal]::ReleaseComObject($app) | Out-Null
[GC]::Collect()
[GC]::WaitForPendingFinalizers()

Get-Item $pptx | Select-Object FullName, Length
