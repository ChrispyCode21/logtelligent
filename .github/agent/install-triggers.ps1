# Installs the agent pipeline's local triggers (PIPELINE.md, "Triggers") on the owner's machine.
#
#   install-triggers.ps1            the pre-push hook, in the owner's checkout and its worktrees
#   install-triggers.ps1 -Watch     also a watcher: every 30 minutes, Tier 0 for both agents
#   install-triggers.ps1 -Uninstall removes both
#
# The watcher costs no tokens unless the gate finds work; during peak hours it defers instead.
param([switch]$Watch, [switch]$Uninstall)
$ErrorActionPreference = 'Stop'

$Owner = 'D:\Projects\Logtelligent'
$Trigger = 'D:\Projects\Logtelligent-reviewer\.github\agent\trigger.ps1'
$WatchTask = 'Logtelligent agent watch'

if ($Uninstall) {
  git -c safe.directory='*' -C $Owner config --unset core.hooksPath
  Unregister-ScheduledTask -TaskName $WatchTask -Confirm:$false -ErrorAction SilentlyContinue
  'Removed the pre-push hook and the watcher.'
  exit 0
}

# Relative, so each worktree uses the hooks on its own branch (none on branches older than this).
git -c safe.directory='*' -C $Owner config core.hooksPath .github/agent/hooks
'Pre-push hook installed: pushes to agent/issue-* and dependabot/* branches start the reviewer.'

if ($Watch) {
  if (-not (Test-Path $Trigger)) { throw "$Trigger isn't there yet: merge the triggers PR and refresh the reviewer's checkout first." }
  $run = "& '$Trigger' -Agent review; & '$Trigger' -Agent build"
  $action = New-ScheduledTaskAction -Execute 'powershell.exe' -Argument "-NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -Command `"$run`""
  $trigger = New-ScheduledTaskTrigger -Once -At (Get-Date).Date.AddMinutes(15) -RepetitionInterval (New-TimeSpan -Minutes 30)
  # A run still going when the next is due makes the next one skip.
  $settings = New-ScheduledTaskSettingsSet -MultipleInstances IgnoreNew -StartWhenAvailable
  Register-ScheduledTask -TaskName $WatchTask -Action $action -Trigger $trigger -Settings $settings -Force | Out-Null
  "Watcher installed: '$WatchTask' in Task Scheduler, every 30 minutes."
}
