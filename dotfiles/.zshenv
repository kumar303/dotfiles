if [[ ${HERDR_ENV:-} == 1 && ${TERM_PROGRAM:-} != vscode ]]; then
    export BRAIN_HERDR=1
    export PIE_GIT_EDITOR='"$(herdr plugin list --plugin kumar303.split-vim-above --json | jq -r ".result.plugins[0].plugin_root")/split-vim-above.js" --file'
else
    unset BRAIN_HERDR
    unset PIE_GIT_EDITOR
fi
