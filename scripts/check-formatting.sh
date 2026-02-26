#!/bin/bash
set -e

# Get the root directory of the repository
REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

# Loop through each directory in packages/
for pkg in "$REPO_ROOT/packages"/*; do
  if [ -d "$pkg" ] && [ -f "$pkg/package.json" ]; then
    echo "Checking formatting for $(basename "$pkg")..."
    (cd "$pkg" && npm run format:check)
  fi
done

echo "All packages are formatted correctly."
