_inside_herdr_pane() {
    [[ ${HERDR_ENV:-} == 1 && -n ${HERDR_PANE_ID:-} ]] || return 1

    local process_info shell_pid current_tty pane_tty
    process_info=$("${HERDR_BIN_PATH:-herdr}" pane process-info --pane "$HERDR_PANE_ID" 2>/dev/null) || return 1
    shell_pid=$(printf '%s' "$process_info" | sed -n 's/.*"shell_pid":\([0-9][0-9]*\).*/\1/p')
    [[ -n $shell_pid ]] || return 1

    current_tty=$(ps -o tty= -p $$ 2>/dev/null)
    pane_tty=$(ps -o tty= -p "$shell_pid" 2>/dev/null)
    current_tty=${current_tty//[[:space:]]/}
    pane_tty=${pane_tty//[[:space:]]/}
    [[ -n $current_tty && $current_tty != '??' && $current_tty == $pane_tty ]]
}

if _inside_herdr_pane; then
    export BRAIN_HERDR=1
else
    unset BRAIN_HERDR
fi
unfunction _inside_herdr_pane
