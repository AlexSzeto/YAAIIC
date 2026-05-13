param(
  [string]$Source = (Join-Path (Get-Location) ".claude\skills"),
  [string]$Target = (Join-Path $env:USERPROFILE ".codex\skills")
)

$ErrorActionPreference = "Stop"

function Convert-ToAsciiMarkdown {
  param([string]$Text)

  return $Text.Replace([string][char]0x2018, "'").
    Replace([string][char]0x2019, "'").
    Replace([string][char]0x201C, '"').
    Replace([string][char]0x201D, '"').
    Replace([string][char]0x2013, "-").
    Replace([string][char]0x2014, "-").
    Replace([string][char]0x2026, "...")
}

function Convert-ToYamlDoubleQuoted {
  param([string]$Text)

  $escaped = $Text.Replace("\", "\\").Replace('"', '\"')
  return '"' + $escaped + '"'
}

function Get-FrontmatterValue {
  param(
    [string[]]$Lines,
    [string]$Key
  )

  $pattern = "^\s*$([regex]::Escape($Key))\s*:\s*(.+?)\s*$"
  foreach ($line in $Lines) {
    if ($line -match $pattern) {
      return $Matches[1]
    }
  }

  throw "Missing required frontmatter key '$Key'."
}

if (-not (Test-Path -LiteralPath $Source)) {
  throw "Source skills directory not found: $Source"
}

New-Item -ItemType Directory -Force -Path $Target | Out-Null

$converted = @()

Get-ChildItem -Directory -LiteralPath $Source | Sort-Object Name | ForEach-Object {
  $skillDir = $_
  $sourceSkill = Join-Path $skillDir.FullName "SKILL.md"
  if (-not (Test-Path -LiteralPath $sourceSkill)) {
    return
  }

  $raw = Get-Content -LiteralPath $sourceSkill -Raw
  if ($raw -notmatch "(?s)^---\r?\n(.*?)\r?\n---\r?\n(.*)$") {
    throw "SKILL.md has no YAML frontmatter: $sourceSkill"
  }

  $frontmatterLines = $Matches[1] -split "\r?\n"
  $body = $Matches[2]

  $name = (Get-FrontmatterValue -Lines $frontmatterLines -Key "name").Trim()
  $description = (Get-FrontmatterValue -Lines $frontmatterLines -Key "description").Trim()

  $body = $body -replace "\.github/rules", ".agents/rules"
  $body = Convert-ToAsciiMarkdown -Text $body
  $name = Convert-ToAsciiMarkdown -Text $name
  $description = Convert-ToAsciiMarkdown -Text $description

  $targetSkillDir = Join-Path $Target $skillDir.Name
  New-Item -ItemType Directory -Force -Path $targetSkillDir | Out-Null

  $targetSkill = Join-Path $targetSkillDir "SKILL.md"
  $content = @(
    "---"
    "name: $name"
    "description: $(Convert-ToYamlDoubleQuoted -Text $description)"
    "---"
    ""
    $body.TrimEnd()
    ""
  ) -join "`n"

  [System.IO.File]::WriteAllText(
    $targetSkill,
    $content,
    [System.Text.UTF8Encoding]::new($false)
  )
  $converted += $skillDir.Name
}

if ($converted.Count -eq 0) {
  throw "No skills were converted from: $Source"
}

Write-Output "Converted $($converted.Count) skill(s) to $Target"
$converted | ForEach-Object { Write-Output "- $_" }
