
# This part of .zshrc was added by kumar303/dotfiles

# This persists history in a single workspace.
# TODO: persist across workspaces.
export HISTFILE=/home/spin/.zsh_history
export HISTSIZE=5000
export HISTCONTROL=erasedups
setopt HIST_FIND_NO_DUPS
setopt INC_APPEND_HISTORY
setopt HIST_IGNORE_ALL_DUPS