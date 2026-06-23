#!/usr/bin/env bash
set -euo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
package_dir="$repo_root/artifacts/package-node"
zip_path="$repo_root/artifacts/kajabi-customer-nodejs.zip"

if ! command -v zip >/dev/null 2>&1; then
  echo "zip is required to create $zip_path" >&2
  exit 1
fi

rm -f "$zip_path"
(
  cd "$package_dir"
  zip -qr "$zip_path" . \
    -x 'node_modules/*' \
    -x '.next/*' \
    -x '.env*' \
    -x '*.DS_Store'
)

echo "Created $zip_path"
