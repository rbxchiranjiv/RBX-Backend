curl -s ^
-H "Authorization: token %GITHUB_TOKEN%" ^
-X POST https://api.github.com/repos/rbxchiranjiv/RBX-Backend/pulls ^
-d "{ "title": "chore: finalize cleanup verification ^& test-fixtures", "head": "verify/cleanup-final-20251206_194840", "base": "main", "body": "Final cleanup verification for RBX backend.\n\nIncludes verification reports, deleted+modified file lists, test-only helper fixes, and build/test logs.\n\nDo NOT merge automatically. Human review required." }"
