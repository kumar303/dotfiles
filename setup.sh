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

ensure_directory() {
  local directory="$1"

  if [ -d "$directory" ]; then
    return
  fi

  local parent
  parent="$(dirname "$directory")"
  if ! ensure_directory "$parent"; then
    return 1
  fi

  if [ -e "$directory" ] || [ -L "$directory" ]; then
    local answer
    echo "Replace $directory with a directory"
    read -r -p "Overwrite $directory? [y/N] " answer
    case "$answer" in
      y|Y) ;;
      *) return 1 ;;
    esac
    rm -rf "$directory"
  fi

  mkdir "$directory"
}

link_file() {
  local src="$1"
  local dest="$2"

  if ! ensure_directory "$(dirname "$dest")"; then
    echo "Skipped: $dest"
    return
  fi

  if [ -e "$dest" ] || [ -L "$dest" ]; then
    local answer
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

zshrc_file="$HOME/.zshrc"
zsh_source_line='source "$HOME/.config/zsh/dotfiles.zsh"'
zsh_source_pattern='^[[:space:]]*(source|\.)[[:space:]]+.*[/]\.config/zsh/dotfiles\.zsh([^[:alnum:]_.-]|$)'
if ! grep -Eq "$zsh_source_pattern" "$zshrc_file" 2>/dev/null; then
  if [ -s "$zshrc_file" ]; then
    printf '\n' >> "$zshrc_file"
  fi
  printf '%s\n' "$zsh_source_line" >> "$zshrc_file"
  echo "Included dotfiles zsh additions: $zshrc_file"
else
  echo "Dotfiles zsh additions already included: $zshrc_file"
fi

echo "Linking Herdr plugins"
for plugin_dir in "$repo_dir"/plugins/*; do
  herdr plugin link "$plugin_dir" --enabled
done

echo "Reloading Herdr configuration"
herdr server reload-config
