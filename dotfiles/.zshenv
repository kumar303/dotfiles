if [[ ${HERDR_ENV:-} == 1 && ${TERM_PROGRAM:-} != vscode ]]; then
    export BRAIN_HERDR=1
    export PIE_GIT_EDITOR="$HOME/.local/bin/pie-git-editor"
else
    unset BRAIN_HERDR
    unset PIE_GIT_EDITOR
fi
