Add-Type -AssemblyName PresentationFramework, PresentationCore, WindowsBase, System.Drawing
Add-Type @"
using System;
using System.Runtime.InteropServices;
public class Win32 {
  [DllImport("user32.dll")] public static extern bool GetCursorPos(out POINT lpPoint);
  [DllImport("user32.dll")] public static extern short GetAsyncKeyState(int vKey);
  public struct POINT { public int X; public int Y; }
}
"@

$Xaml = @"
<Window xmlns="http://schemas.microsoft.com/winfx/2006/xaml/presentation"
        xmlns:x="http://schemas.microsoft.com/winfx/2006/xaml"
        WindowStyle="None" AllowsTransparency="True" Background="Transparent"
        Topmost="True" ShowInTaskbar="False" IsHitTestVisible="False"
        ResizeMode="NoResize" WindowStartupLocation="Manual">
  <Grid>
    <!-- Glowing corners -->
    <Border x:Name="CornerTL" Width="140" Height="140" HorizontalAlignment="Left" VerticalAlignment="Top" Margin="0" BorderThickness="3,3,0,0" CornerRadius="14,0,0,0" Opacity="0.95">
      <Border.BorderBrush><LinearGradientBrush StartPoint="0,0" EndPoint="1,1"><GradientStop Color="#7C3AED" Offset="0"/><GradientStop Color="#06B6D4" Offset="1"/></LinearGradientBrush></Border.BorderBrush>
      <Border.Effect><DropShadowEffect Color="#7C3AED" BlurRadius="18" ShadowDepth="0" Opacity="0.55"/></Border.Effect>
    </Border>
    <Border x:Name="CornerTR" Width="140" Height="140" HorizontalAlignment="Right" VerticalAlignment="Top" BorderThickness="0,3,3,0" CornerRadius="0,14,0,0" Opacity="0.95">
      <Border.BorderBrush><LinearGradientBrush StartPoint="1,0" EndPoint="0,1"><GradientStop Color="#06B6D4" Offset="0"/><GradientStop Color="#10B981" Offset="1"/></LinearGradientBrush></Border.BorderBrush>
      <Border.Effect><DropShadowEffect Color="#06B6D4" BlurRadius="18" ShadowDepth="0" Opacity="0.55"/></Border.Effect>
    </Border>
    <Border x:Name="CornerBL" Width="140" Height="140" HorizontalAlignment="Left" VerticalAlignment="Bottom" BorderThickness="3,0,0,3" CornerRadius="0,0,0,14" Opacity="0.95">
      <Border.BorderBrush><LinearGradientBrush StartPoint="0,1" EndPoint="1,0"><GradientStop Color="#10B981" Offset="0"/><GradientStop Color="#7C3AED" Offset="1"/></LinearGradientBrush></Border.BorderBrush>
      <Border.Effect><DropShadowEffect Color="#10B981" BlurRadius="18" ShadowDepth="0" Opacity="0.55"/></Border.Effect>
    </Border>
    <Border x:Name="CornerBR" Width="140" Height="140" HorizontalAlignment="Right" VerticalAlignment="Bottom" BorderThickness="0,0,3,3" CornerRadius="0,0,14,0" Opacity="0.95">
      <Border.BorderBrush><LinearGradientBrush StartPoint="1,1" EndPoint="0,0"><GradientStop Color="#7C3AED" Offset="0"/><GradientStop Color="#06B6D4" Offset="1"/></LinearGradientBrush></Border.BorderBrush>
      <Border.Effect><DropShadowEffect Color="#7C3AED" BlurRadius="18" ShadowDepth="0" Opacity="0.55"/></Border.Effect>
    </Border>

    <!-- Top pill -->
    <Border x:Name="Pill" HorizontalAlignment="Center" VerticalAlignment="Top" Margin="0,14,0,0"
            Background="#171719" CornerRadius="24" Padding="14,7" BorderThickness="1" BorderBrush="#2A2A2E">
      <Border.Effect><DropShadowEffect Color="Black" BlurRadius="22" ShadowDepth="0" Opacity="0.45"/></Border.Effect>
      <StackPanel Orientation="Horizontal">
        <Ellipse x:Name="Dot" Width="10" Height="10" Fill="#10B981" Margin="0,0,9,0">
          <Ellipse.Effect><DropShadowEffect Color="#10B981" BlurRadius="8" ShadowDepth="0" Opacity="0.7"/></Ellipse.Effect>
        </Ellipse>
        <TextBlock Text="WinAgent is using your PC" Foreground="#F1F1F3" FontWeight="SemiBold" FontSize="12.5" FontFamily="Segoe UI" VerticalAlignment="Center"/>
        <TextBlock Text=" • live" Foreground="#8A8A92" FontSize="11.5" Margin="4,0,0,0" VerticalAlignment="Center"/>
        <Border Width="1" Height="16" Background="#2E2E33" Margin="10,0,10,0"/>
        <TextBlock Text="ESC to hide • Ctrl+Shift+Q to quit" Foreground="#6E6E78" FontSize="10.5" VerticalAlignment="Center"/>
      </StackPanel>
    </Border>

    <!-- Mouse indicator canvas -->
    <Canvas x:Name="MouseCanvas" IsHitTestVisible="False">
      <Ellipse x:Name="MouseDot" Width="26" Height="26" Stroke="#10B981" StrokeThickness="2.2" Fill="#101211" Opacity="0.92" Visibility="Collapsed">
        <Ellipse.Effect><DropShadowEffect Color="#10B981" BlurRadius="10" ShadowDepth="0" Opacity="0.6"/></Ellipse.Effect>
      </Ellipse>
      <Ellipse x:Name="MouseInner" Width="8" Height="8" Fill="#10B981" Opacity="0.95" Visibility="Collapsed"/>
      <Ellipse x:Name="ClickRipple" Width="44" Height="44" Stroke="#06B6D4" StrokeThickness="2" Opacity="0" Visibility="Collapsed"/>
      <TextBlock x:Name="ActionLabel" Foreground="White" Background="#0F172A" Padding="6,3" FontSize="11" FontFamily="Segoe UI" Visibility="Collapsed" Canvas.Left="0" Canvas.Top="0">
        <TextBlock.Effect><DropShadowEffect Color="Black" BlurRadius="6" ShadowDepth="0" Opacity="0.5"/></TextBlock.Effect>
      </TextBlock>
    </Canvas>
  </Grid>
</Window>
"@

$reader = [System.Xml.XmlReader]::Create([System.IO.StringReader]::new($Xaml))
$win = [System.Windows.Markup.XamlReader]::Load($reader)

# Fullscreen to primary screen
try {
  Add-Type -AssemblyName System.Windows.Forms -ErrorAction SilentlyContinue
  $bounds = [System.Windows.Forms.Screen]::PrimaryScreen.Bounds
  $win.Left = $bounds.X
  $win.Top = $bounds.Y
  $win.Width = $bounds.Width
  $win.Height = $bounds.Height
} catch {
  $win.WindowState = 'Maximized'
}

$MouseDot = $win.FindName("MouseDot")
$MouseInner = $win.FindName("MouseInner")
$ClickRipple = $win.FindName("ClickRipple")
$ActionLabel = $win.FindName("ActionLabel")
$Pill = $win.FindName("Pill")
$Dot = $win.FindName("Dot")
$CornerTL = $win.FindName("CornerTL")
$CornerTR = $win.FindName("CornerTR")
$CornerBL = $win.FindName("CornerBL")
$CornerBR = $win.FindName("CornerBR")

# Pill hover not possible as IsHitTestVisible false, but keep Topmost
$win.Show()
# Make click-through: WS_EX_TRANSPARENT | WS_EX_LAYERED | WS_EX_TOOLWINDOW
Add-Type @"
using System;
using System.Runtime.InteropServices;
public class WinUtil {
  [DllImport("user32.dll")] public static extern int GetWindowLong(IntPtr hWnd, int nIndex);
  [DllImport("user32.dll")] public static extern int SetWindowLong(IntPtr hWnd, int nIndex, int dwNewLong);
  [DllImport("user32.dll")] public static extern bool SetWindowPos(IntPtr hWnd, IntPtr hWndInsertAfter, int X,int Y,int cx,int cy,int uFlags);
}
"@
try {
  $hwnd = (New-Object System.Windows.Interop.WindowInteropHelper($win)).Handle
  $GWL_EXSTYLE = -20
  $WS_EX_TRANSPARENT = 0x20
  $WS_EX_LAYERED = 0x80000
  $WS_EX_TOOLWINDOW = 0x80
  $style = [WinUtil]::GetWindowLong($hwnd, $GWL_EXSTYLE)
  [WinUtil]::SetWindowLong($hwnd, $GWL_EXSTYLE, ($style -bor $WS_EX_TRANSPARENT -bor $WS_EX_LAYERED -bor $WS_EX_TOOLWINDOW)) | Out-Null
  # keep topmost
  [WinUtil]::SetWindowPos($hwnd, [IntPtr]::new(-1), 0,0,0,0, 0x0001 -bor 0x0002) | Out-Null
} catch {}

# State file for WinAgent to drive overlay (click/drag/type)
$stateFile = "C:\Users\HP\windows-system-agent\overlay-state.json"
$lastAction = ""

# ESC to hide pill, Ctrl+Shift+Q to quit
$win.Add_KeyDown({
  param($s,$e)
  if ($e.Key -eq 'Escape') { $Pill.Visibility = if ($Pill.Visibility -eq 'Visible') {'Collapsed'} else {'Visible'} }
  if ($e.Key -eq 'Q' -and [System.Windows.Input.Keyboard]::IsKeyDown('LeftCtrl') -and [System.Windows.Input.Keyboard]::IsKeyDown('LeftShift')) { $win.Close() }
})

# Timer for mouse + pulse + state file
$timer = New-Object System.Windows.Threading.DispatcherTimer
$timer.Interval = [TimeSpan]::FromMilliseconds(16)
$tick = 0
$prevDown = $false
$timer.Add_Tick({
  $tick++
  # pulse corners
  $pulse = 0.72 + 0.28 * [Math]::Sin($tick * 0.07)
  $CornerTL.Opacity = $pulse
  $CornerTR.Opacity = $pulse
  $CornerBL.Opacity = $pulse
  $CornerBR.Opacity = $pulse
  $Dot.Opacity = 0.85 + 0.15 * [Math]::Sin($tick * 0.14)

  # follow real mouse
  $pt = New-Object Win32+POINT
  if ([Win32]::GetCursorPos([ref]$pt)) {
    $x = $pt.X - $win.Left
    $y = $pt.Y - $win.Top
    [System.Windows.Controls.Canvas]::SetLeft($MouseDot, $x - 13)
    [System.Windows.Controls.Canvas]::SetTop($MouseDot, $y - 13)
    [System.Windows.Controls.Canvas]::SetLeft($MouseInner, $x - 4)
    [System.Windows.Controls.Canvas]::SetTop($MouseInner, $y - 4)
    [System.Windows.Controls.Canvas]::SetLeft($ClickRipple, $x - 22)
    [System.Windows.Controls.Canvas]::SetTop($ClickRipple, $y - 22)
    $MouseDot.Visibility = 'Visible'
    $MouseInner.Visibility = 'Visible'
    # click detection
    $down = ([Win32]::GetAsyncKeyState(0x01) -band 0x8000) -ne 0
    if ($down -and -not $prevDown) {
      # click ripple
      $ClickRipple.Visibility = 'Visible'
      $ClickRipple.Opacity = 0.95
      $ClickRipple.Width = 18; $ClickRipple.Height = 18
      $anim = New-Object System.Windows.Media.Animation.DoubleAnimation(44, [TimeSpan]::FromMilliseconds(420))
      $anim.EasingFunction = (New-Object System.Windows.Media.Animation.CubicEase -Property @{EasingMode='EaseOut'})
      $ClickRipple.BeginAnimation([System.Windows.Controls.Control]::WidthProperty, $anim) | Out-Null
      $ClickRipple.BeginAnimation([System.Windows.Controls.Control]::HeightProperty, $anim) | Out-Null
      $fade = New-Object System.Windows.Media.Animation.DoubleAnimation(0, [TimeSpan]::FromMilliseconds(420))
      $ClickRipple.BeginAnimation([System.Windows.UIElement]::OpacityProperty, $fade) | Out-Null
      $ActionLabel.Text = "click"
      $ActionLabel.Visibility = 'Visible'
      [System.Windows.Controls.Canvas]::SetLeft($ActionLabel, $x + 16)
      [System.Windows.Controls.Canvas]::SetTop($ActionLabel, $y - 18)
    }
    if (-not $down -and $prevDown) {
      # hide label after 600ms
      $tmp = $ActionLabel
      $d = New-Object System.Windows.Threading.DispatcherTimer
      $d.Interval = [TimeSpan]::FromMilliseconds(650)
      $d.Add_Tick({ $tmp.Visibility='Collapsed'; $d.Stop() })
      $d.Start()
    }
    $prevDown = $down
  }

  # read state file driven by WinAgent (optional)
  if (Test-Path $stateFile) {
    try {
      $j = Get-Content $stateFile -Raw -ErrorAction SilentlyContinue | ConvertFrom-Json -ErrorAction SilentlyContinue
      if ($j -and $j.action -ne $lastAction) {
        $lastAction = $j.action
        $ActionLabel.Text = "$($j.action) $($j.target)"
        $ActionLabel.Visibility = 'Visible'
        [System.Windows.Controls.Canvas]::SetLeft($ActionLabel, ($j.x + 16))
        [System.Windows.Controls.Canvas]::SetTop($ActionLabel, ($j.y - 20))
        # flash dot color
        if ($j.action -eq "drag") { $MouseDot.Stroke = "#06B6D4" } elseif ($j.action -eq "type") { $MouseDot.Stroke = "#7C3AED" } else { $MouseDot.Stroke = "#10B981" }
        # auto-hide label
        $tmp2 = $ActionLabel
        $d2 = New-Object System.Windows.Threading.DispatcherTimer
        $d2.Interval = [TimeSpan]::FromMilliseconds(1200)
        $d2.Add_Tick({ $tmp2.Visibility='Collapsed'; $d2.Stop() })
        $d2.Start()
      }
    } catch {}
  }
})
$timer.Start()

# Close on session logoff handled by ShowDialog
[void]$win.ShowDialog()
