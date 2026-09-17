# System-wide agent overlay - ONLY shows when agent is active (file/system access)
# Polls C:\Users\HP\windows-system-agent\overlay-agent.json
# { active: true/false, x, y, action, target }
# Shows: 4 glowing corners + agent mouse dot + action label
# Human mouse is NOT shown. Hides completely when inactive.

Add-Type -AssemblyName PresentationFramework, PresentationCore, WindowsBase, System.Windows.Forms

$stateFile = "C:\Users\HP\windows-system-agent\overlay-agent.json"
# ensure file exists
if (!(Test-Path $stateFile)) { '{"active":false}' | Set-Content $stateFile -Encoding utf8 }

$Xaml = @"
<Window xmlns="http://schemas.microsoft.com/winfx/2006/xaml/presentation"
        xmlns:x="http://schemas.microsoft.com/winfx/2006/xaml"
        WindowStyle="None" AllowsTransparency="True" Background="Transparent"
        Topmost="True" ShowInTaskbar="False" ResizeMode="NoResize" WindowStartupLocation="Manual">
  <Grid x:Name="Root" Opacity="0">
    <Border x:Name="CornerTL" Width="96" Height="96" HorizontalAlignment="Left" VerticalAlignment="Top" Margin="10" BorderThickness="3,3,0,0" CornerRadius="14,0,0,0" BorderBrush="#7C3AED">
      <Border.Effect><DropShadowEffect Color="#7C3AED" BlurRadius="16" ShadowDepth="0" Opacity="0.5"/></Border.Effect>
    </Border>
    <Border x:Name="CornerTR" Width="96" Height="96" HorizontalAlignment="Right" VerticalAlignment="Top" Margin="10" BorderThickness="0,3,3,0" CornerRadius="0,14,0,0" BorderBrush="#06B6D4">
      <Border.Effect><DropShadowEffect Color="#06B6D4" BlurRadius="16" ShadowDepth="0" Opacity="0.5"/></Border.Effect>
    </Border>
    <Border x:Name="CornerBL" Width="96" Height="96" HorizontalAlignment="Left" VerticalAlignment="Bottom" Margin="10" BorderThickness="3,0,0,3" CornerRadius="0,0,0,14" BorderBrush="#10B981">
      <Border.Effect><DropShadowEffect Color="#10B981" BlurRadius="16" ShadowDepth="0" Opacity="0.5"/></Border.Effect>
    </Border>
    <Border x:Name="CornerBR" Width="96" Height="96" HorizontalAlignment="Right" VerticalAlignment="Bottom" Margin="10" BorderThickness="0,0,3,3" CornerRadius="0,0,14,0" BorderBrush="#7C3AED">
      <Border.Effect><DropShadowEffect Color="#7C3AED" BlurRadius="16" ShadowDepth="0" Opacity="0.5"/></Border.Effect>
    </Border>
    <Border x:Name="Pill" HorizontalAlignment="Center" VerticalAlignment="Top" Margin="0,14,0,0" Background="#111113" CornerRadius="22" Padding="12,6" BorderBrush="#26262A" BorderThickness="1">
      <Border.Effect><DropShadowEffect Color="Black" BlurRadius="18" ShadowDepth="0" Opacity="0.4"/></Border.Effect>
      <StackPanel Orientation="Horizontal">
        <Ellipse Width="9" Height="9" Fill="#10B981" Margin="0,0,8,0">
          <Ellipse.Effect><DropShadowEffect Color="#10B981" BlurRadius="8" ShadowDepth="0" Opacity="0.6"/></Ellipse.Effect>
        </Ellipse>
        <TextBlock x:Name="PillText" Text="WinAgent is working" Foreground="#F1F1F3" FontWeight="SemiBold" FontSize="12.5" FontFamily="Segoe UI" VerticalAlignment="Center"/>
        <TextBlock x:Name="PillSub" Text=" • file access" Foreground="#8A8A92" FontSize="11" Margin="5,0,0,0" VerticalAlignment="Center"/>
      </StackPanel>
    </Border>
    <Canvas x:Name="MouseCanvas">
      <Ellipse x:Name="AgentDot" Width="28" Height="28" Stroke="#10B981" StrokeThickness="2.3" Fill="#0F1412" Visibility="Collapsed">
        <Ellipse.Effect><DropShadowEffect Color="#10B981" BlurRadius="12" ShadowDepth="0" Opacity="0.55"/></Ellipse.Effect>
      </Ellipse>
      <Ellipse x:Name="AgentInner" Width="8" Height="8" Fill="#10B981" Visibility="Collapsed"/>
      <Ellipse x:Name="AgentRipple" Width="40" Height="40" Stroke="#06B6D4" StrokeThickness="2" Opacity="0" Visibility="Collapsed"/>
      <Border x:Name="AgentLabel" Background="#0F172A" CornerRadius="7" BorderBrush="#1E293B" BorderThickness="1" Padding="6,3" Visibility="Collapsed">
        <TextBlock x:Name="AgentLabelText" Text="click" Foreground="#E2E8F0" FontSize="11" FontWeight="SemiBold" FontFamily="Segoe UI"/>
      </Border>
    </Canvas>
  </Grid>
</Window>
"@

$reader = [System.Xml.XmlReader]::Create([System.IO.StringReader]::new($Xaml))
$win = [System.Windows.Markup.XamlReader]::Load($reader)

# fullscreen to primary screen
try {
  $bounds = [System.Windows.Forms.Screen]::PrimaryScreen.Bounds
  $win.Left = $bounds.X; $win.Top = $bounds.Y; $win.Width = $bounds.Width; $win.Height = $bounds.Height
} catch { $win.WindowState = 'Maximized' }

$Root = $win.FindName("Root")
$AgentDot = $win.FindName("AgentDot")
$AgentInner = $win.FindName("AgentInner")
$AgentRipple = $win.FindName("AgentRipple")
$AgentLabel = $win.FindName("AgentLabel")
$AgentLabelText = $win.FindName("AgentLabelText")
$PillText = $win.FindName("PillText")
$PillSub = $win.FindName("PillSub")

# Make click-through and toolwindow (not in alt-tab)
Add-Type @"
using System; using System.Runtime.InteropServices;
public class WinUtil2 {
  [DllImport("user32.dll")] public static extern int GetWindowLong(IntPtr hWnd, int nIndex);
  [DllImport("user32.dll")] public static extern int SetWindowLong(IntPtr hWnd, int nIndex, int dwNewLong);
}
"@
try {
  $hwnd = (New-Object System.Windows.Interop.WindowInteropHelper($win)).Handle
  $style = [WinUtil2]::GetWindowLong($hwnd, -20)
  [WinUtil2]::SetWindowLong($hwnd, -20, ($style -bor 0x20 -bor 0x80000 -bor 0x80)) | Out-Null
} catch {}

# Poll state file
$timer = New-Object System.Windows.Threading.DispatcherTimer
$timer.Interval = [TimeSpan]::FromMilliseconds(120)
$tick = 0
$lastActive = $false
$timer.Add_Tick({
  $tick++
  # pulse corners slightly when active
  $p = 0.82 + 0.18 * [Math]::Sin($tick * 0.09)
  if ($Root.Opacity -gt 0) {
    $win.FindName("CornerTL").Opacity = $p
    $win.FindName("CornerTR").Opacity = $p
    $win.FindName("CornerBL").Opacity = $p
    $win.FindName("CornerBR").Opacity = $p
  }
  try {
    if (!(Test-Path $stateFile)) { return }
    $raw = Get-Content $stateFile -Raw -ErrorAction SilentlyContinue
    if (!$raw) { return }
    $j = $raw | ConvertFrom-Json -ErrorAction SilentlyContinue
    if ($null -eq $j) { return }
    $active = [bool]$j.active
    if ($active -and -not $lastActive) {
      # fade in
      $Root.Opacity = 1
      $AgentDot.Visibility = 'Visible'
      $AgentInner.Visibility = 'Visible'
    } elseif (-not $active -and $lastActive) {
      $Root.Opacity = 0
      $AgentDot.Visibility = 'Collapsed'
      $AgentInner.Visibility = 'Collapsed'
      $AgentRipple.Visibility = 'Collapsed'
      $AgentLabel.Visibility = 'Collapsed'
    }
    $lastActive = $active
    if ($active) {
      $x = [double]$j.x; $y = [double]$j.y
      if ($x -ne 0 -or $y -ne 0) {
        $lx = $x - $win.Left; $ly = $y - $win.Top
        [System.Windows.Controls.Canvas]::SetLeft($AgentDot, $lx - 14)
        [System.Windows.Controls.Canvas]::SetTop($AgentDot, $ly - 14)
        [System.Windows.Controls.Canvas]::SetLeft($AgentInner, $lx - 4)
        [System.Windows.Controls.Canvas]::SetTop($AgentInner, $ly - 4)
        [System.Windows.Controls.Canvas]::SetLeft($AgentRipple, $lx - 20)
        [System.Windows.Controls.Canvas]::SetTop($AgentRipple, $ly - 20)
        [System.Windows.Controls.Canvas]::SetLeft($AgentLabel, $lx + 18)
        [System.Windows.Controls.Canvas]::SetTop($AgentLabel, $ly - 22)
      }
      $action = [string]$j.action
      $target = [string]$j.target
      if ($action) {
        $AgentLabelText.Text = if ($target) { "$action $target" } else { $action }
        $AgentLabel.Visibility = 'Visible'
        # color by action
        if ($action -eq "drag") { $AgentDot.Stroke = "#7C3AED"; $AgentInner.Fill = "#7C3AED" }
        elseif ($action -eq "type") { $AgentDot.Stroke = "#F59E0B"; $AgentInner.Fill = "#F59E0B" }
        elseif ($action -eq "file") { $AgentDot.Stroke = "#06B6D4"; $AgentInner.Fill = "#06B6D4" }
        else { $AgentDot.Stroke = "#10B981"; $AgentInner.Fill = "#10B981" }
        # ripple on click
        if ($action -eq "click" -and $j.ripple -eq $true) {
          $AgentRipple.Visibility = 'Visible'; $AgentRipple.Opacity = 0.9
          $AgentRipple.Width = 16; $AgentRipple.Height = 16
          $animW = New-Object System.Windows.Media.Animation.DoubleAnimation(48, [TimeSpan]::FromMilliseconds(420))
          $animO = New-Object System.Windows.Media.Animation.DoubleAnimation(0, [TimeSpan]::FromMilliseconds(420))
          $AgentRipple.BeginAnimation([System.Windows.FrameworkElement]::WidthProperty, $animW) | Out-Null
          $AgentRipple.BeginAnimation([System.Windows.FrameworkElement]::HeightProperty, $animW) | Out-Null
          $AgentRipple.BeginAnimation([System.Windows.UIElement]::OpacityProperty, $animO) | Out-Null
        }
      }
      if ($j.text) { $PillText.Text = $j.text }
      if ($j.sub) { $PillSub.Text = $j.sub }
    }
  } catch {}
})
$timer.Start()

# Close cleanly on file delete
$win.Add_Closed({ $timer.Stop() })
[void]$win.ShowDialog()
