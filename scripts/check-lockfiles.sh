#!/bin/bash
set -e

# Get the root directory of the repository
REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

# Loop through each directory in packages/
for pkg in "$REPO_ROOT/packages"/*; do
  if [ -d "$pkg" ] && [ -f "$pkg/package-lock.json" ]; then
    name="$(basename "$pkg")"
    echo "Checking lockfile for $name..."
    (cd "$pkg" && npm install --package-lock-only --ignore-scripts)
    if ! git diff --exit-code "$pkg/package-lock.json" > /dev/null 2>&1; then
      echo "Error: packages/$name/package-lock.json is not up to date."
      echo "Please run 'npm install' in packages/$name and commit the changes."
      exit 1
    fi
  fi
done

echo "All lockfiles are up to date."
