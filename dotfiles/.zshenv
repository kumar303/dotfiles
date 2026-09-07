if [[ ${HERDR_ENV:-} == 1 && ${TERM_PROGRAM:-} != vscode ]]; then
    export BRAIN_HERDR=1
else
    unset BRAIN_HERDR
fi
