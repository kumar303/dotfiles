herdr-workspace-create() {
  local workspace_directory="${1:-.}"
  if [[ ! -d "$workspace_directory" ]]; then
    print -u2 "Not a directory: $workspace_directory"
    return 1
  fi
  workspace_directory="$(builtin cd -- "$workspace_directory" && pwd -P)" || return
  herdr workspace create --cwd "$workspace_directory" --focus
}
