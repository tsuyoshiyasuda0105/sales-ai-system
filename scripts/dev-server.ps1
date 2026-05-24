Set-Location "C:\Users\tsuyo\Documents\Codex\2026-05-23\ai-sns-1-10"

$env:NODE_ENV = "development"
$node = "C:\Program Files\nodejs\node.exe"
$nextCli = "C:\Users\tsuyo\Documents\Codex\2026-05-23\ai-sns-1-10\node_modules\next\dist\bin\next"

& $node $nextCli dev --hostname 127.0.0.1 --port 3000 *> ".next-dev.log"
