#!/usr/bin/env bash
set -euo pipefail

repo_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
dotfiles_dir="$repo_dir/dotfiles"

if [ ! -d "$dotfiles_dir" ]; then
  echo "Source directory not found: $dotfiles_dir" >&2
  exit 1
fi

echo "Installing Node dependencies"
npm install --prefix "$repo_dir"

link_file() {
  local src="$1"
  local dest="$2"

  mkdir -p "$(dirname "$dest")"

  if [ -e "$dest" ] || [ -L "$dest" ]; then
    if [ -L "$dest" ] && [ "$(readlink "$dest")" = "$src" ]; then
      echo "Already linked: $dest"
      return
    fi
    echo "Replace $dest with a symlink to $src"
    read -r -p "Overwrite $dest? [y/N] " answer
    case "$answer" in
      y|Y) ;;
      *) echo "Skipped: $dest"; return ;;
    esac
    rm -rf "$dest"
  fi

  ln -s "$src" "$dest"
  echo "Linked: $dest -> $src"
}

while IFS= read -r -d '' -u 3 src; do
  relative_path="${src#"$dotfiles_dir"/}"
  link_file "$src" "$HOME/$relative_path"
done 3< <(find "$dotfiles_dir" -type f -print0)

echo "Linking Herdr plugins"
for plugin_dir in "$repo_dir"/plugins/*; do
  herdr plugin link "$plugin_dir" --enabled
done

echo "Reloading Herdr configuration"
herdr server reload-config
