tnoremap <M-CR> <C-y>
tnoremap <M-b> <C-q>
tnoremap <M-f> <C-x>

function! CaptureAgentPromptContext(include_selection)
    let file = expand('%:p')
    if !filereadable(file)
        return {}
    endif

    let start = getpos('.')
    let finish = start
    let selection = ''
    if a:include_selection
        let start = getpos("'<")
        let finish = getpos("'>")
        let selection = join(getregion(start, finish, {'type': visualmode()}), "\n")
    endif

    let root = resolve(get(g:, 'fzf_file_picker_root', getcwd()))
    let resolved_file = resolve(file)
    let relative_file = stridx(resolved_file, root . '/') == 0
        \ ? strpart(resolved_file, strlen(root) + 1)
        \ : fnamemodify(file, ':.')
    return {
        \ 'file': relative_file,
        \ 'line': min([start[1], finish[1]]),
        \ 'selection': selection,
        \ }
endfunction

function! AgentPromptContext(context)
    let context = a:context.file . ':' . a:context.line
    if empty(a:context.selection)
        return context
    endif
    let quote = map(split(a:context.selection, "\n", 1), '" > " . v:val')
    return context . "\n" . join(quote, "\n")
endfunction

function! AgentPromptCommand(arguments)
    let node = exepath('node')
    let herdr = empty($HERDR_BIN_PATH) ? exepath('herdr') : $HERDR_BIN_PATH
    if empty(node) || empty(herdr)
        return ''
    endif
    let command = [node, g:vim_dotfiles_directory . '/.vim/bin/agent-prompt.js'] + a:arguments
    let environment = 'HERDR_BIN_PATH=' . shellescape(herdr) . ' '
    return system(environment . join(map(command, 'shellescape(v:val)'), ' '))
endfunction

function! AgentPromptState(include_selection)
    let context = CaptureAgentPromptContext(a:include_selection)
    if empty(context)
        return {'context': '', 'entries': []}
    endif
    let output = AgentPromptCommand(['list', $HERDR_WORKSPACE_ID])
    if v:shell_error || empty(output)
        echoerr empty(output) ? 'Cannot list Herdr agents' : trim(output)
        return {'context': '', 'entries': []}
    endif
    let agents = json_decode(output)
    let entries = map(agents, 'printf("%s\t%s  %s  tab:%s", v:val.paneId, v:val.label, v:val.status, v:val.tabLabel)')
    return {'context': AgentPromptContext(context), 'entries': entries}
endfunction

function! AgentPromptOptions(state)
    let preview_command = shellescape(g:vim_dotfiles_directory . '/.vim/bin/agent-prompt-preview')
    return g:fzf_picker_options + [
        \ '--bind=ctrl-q:backward-word,ctrl-x:forward-word,change:refresh-preview',
        \ '--delimiter=\t',
        \ '--expect=ctrl-y',
        \ '--header=' . a:state.context,
        \ '--header-border=bottom',
        \ '--info=hidden',
        \ '--no-sort',
        \ '--phony',
        \ '--preview=' . preview_command,
        \ '--preview-window=down,6,border-none,wrap,noinfo',
        \ '--print-query',
        \ '--prompt=Prompt> ',
        \ '--with-nth=2..',
        \ '--layout=reverse-list',
        \ ]
endfunction

function! AgentPromptMarkerPath()
    if !empty($HERDR_SPLIT_VIM_PROMPT_MARKER)
        return $HERDR_SPLIT_VIM_PROMPT_MARKER
    endif
    let state_directory = empty($HERDR_SPLIT_VIM_STATE_DIR)
        \ ? expand('~/.cache/split-vim-above')
        \ : $HERDR_SPLIT_VIM_STATE_DIR
    let workspace = substitute($HERDR_WORKSPACE_ID, '[^A-Za-z0-9_.-]', '_', 'g')
    let tab = substitute($HERDR_TAB_ID, '[^A-Za-z0-9_.-]', '_', 'g')
    return state_directory . '/agent-prompts/' . workspace . '__' . tab
endfunction

function! ActivateAgentPrompt()
    let g:agent_prompt_marker = AgentPromptMarkerPath()
    call mkdir(fnamemodify(g:agent_prompt_marker, ':h'), 'p', 0700)
    call writefile(['active'], g:agent_prompt_marker)
endfunction

function! RemoveAgentPromptMarker(timer)
    if exists('g:agent_prompt_marker')
        call delete(g:agent_prompt_marker)
        unlet g:agent_prompt_marker
    endif
endfunction

function! AgentPromptExit(code)
    call timer_start(0, function('RemoveAgentPromptMarker'))
endfunction

function! AgentPromptResults(lines)
    if len(a:lines) < 3
        return
    endif
    let mode = a:lines[1] ==# 'ctrl-y' ? 'follow-up' : 'steer'
    let target = matchstr(a:lines[2], '^[^\t]\+')
    let query = a:lines[0]
    let prompt = g:agent_prompt_context . (empty(query) ? '' : "\n\n" . query)
    let prompt_path = tempname()
    call writefile(split(prompt, "\n", 1), prompt_path)
    call setfperm(prompt_path, 'rw-------')
    let output = AgentPromptCommand(['send', target, prompt_path, mode])
    if v:shell_error
        echoerr empty(output) ? 'Cannot prompt the Herdr agent' : trim(output)
    endif
    unlet! g:agent_prompt_context
endfunction

function! AgentPromptPopupWindow(state)
    let layout = dotfiles#fzf#file_tool_layout()
    let content_height = len(split(a:state.context, "\n", 1)) + len(a:state.entries) + 11
    return {
        \ 'border': layout.border,
        \ 'height': min([layout.height, content_height]),
        \ 'width': layout.width,
        \ 'xoffset': layout.xoffset,
        \ 'yoffset': layout.yoffset,
        \ }
endfunction

function! OpenAgentPrompt(include_selection)
    let state = AgentPromptState(a:include_selection)
    if empty(state.entries)
        echo 'No agents in this workspace'
        return
    endif
    let g:agent_prompt_context = state.context
    call ActivateAgentPrompt()
    call fzf#run(fzf#wrap('agent-prompt', {
        \ 'exit': function('AgentPromptExit'),
        \ 'options': AgentPromptOptions(state),
        \ 'sink*': function('AgentPromptResults'),
        \ 'source': state.entries,
        \ 'window': AgentPromptPopupWindow(state),
        \ }))
endfunction

nnoremap <silent> <C-a> :call OpenAgentPrompt(0)<CR>
xnoremap <silent> <C-a> :<C-u>call OpenAgentPrompt(1)<CR>
