# migrate-bg-colors.ps1
# Run ONCE from your project root (where src/ lives).
# Converts every hardcoded #1a1f35 / #2d3651 in every .css file under src/
# into var(--page-bg-a) / var(--page-bg-b) — the tokens already declared on
# :root in src/app/globals.css. Because they're on :root, every element in
# the app already inherits them, regardless of what wrapper class a given
# component uses — no per-file dependency beyond this substitution.
#
# Safe by construction: it only touches these two exact hex strings.
# AdS.module.css and anything else using a DIFFERENT color (e.g. #1a1a2e)
# is untouched — verified against the files you sent, zero matches there.
#
# After running: `git diff` to review, then commit. From then on, changing
# --page-bg-a / --page-bg-b in globals.css is genuinely the only file that
# needs to change.

$root = "src"
$files = Get-ChildItem -Path $root -Recurse -Include *.css

$changedCount = 0
foreach ($f in $files) {
    $content = Get-Content -Raw -Path $f.FullName
    $original = $content

    $content = $content -replace '(?i)#1a1f35', 'var(--page-bg-a)'
    $content = $content -replace '(?i)#2d3651', 'var(--page-bg-b)'

    if ($content -ne $original) {
        Set-Content -Path $f.FullName -Value $content -NoNewline
        Write-Host "Updated: $($f.FullName)"
        $changedCount++
    }
}

Write-Host ""
Write-Host "Done. $changedCount file(s) changed. Run 'git diff' to review before committing."
