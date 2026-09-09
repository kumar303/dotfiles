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

legacy_vim="$HOME/.vim"
legacy_vim_target="$repo_dir/.vim"
if [ -L "$legacy_vim" ] && [ "$(readlink "$legacy_vim")" = "$legacy_vim_target" ]; then
  rm "$legacy_vim"
  echo "Removed legacy link: $legacy_vim"
fi

legacy_import_resolver="$HOME/.vim/import-resolver.js"
legacy_import_resolver_target="$dotfiles_dir/.vim/import-resolver.js"
if [ -L "$legacy_import_resolver" ] && [ "$(readlink "$legacy_import_resolver")" = "$legacy_import_resolver_target" ]; then
  rm "$legacy_import_resolver"
  echo "Removed legacy link: $legacy_import_resolver"
fi

while IFS= read -r -d '' -u 3 src; do
  relative_path="${src#"$dotfiles_dir"/}"
  link_file "$src" "$HOME/$relative_path"
done 3< <(find "$dotfiles_dir" -type f -print0)

legacy_script="$HOME/.config/herdr/scripts/split-vim-above.js"
legacy_target="$HOME/src/github.com/kumar303/herdr-config/dot-config/herdr/scripts/split-vim-above.js"
if [ -L "$legacy_script" ] && [ "$(readlink "$legacy_script")" = "$legacy_target" ]; then
  rm "$legacy_script"
  rmdir "$(dirname "$legacy_script")" 2>/dev/null || true
  echo "Removed legacy link: $legacy_script"
fi

echo "Linking Herdr plugins"
for plugin_dir in "$repo_dir"/plugins/*; do
  herdr plugin link "$plugin_dir" --enabled
done

echo "Reloading Herdr configuration"
herdr server reload-config
