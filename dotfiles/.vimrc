
let g:vim_dotfiles_directory = fnamemodify(resolve(expand('<sfile>:p')), ':h')

if exists('+keyprotocol')
    set keyprotocol=xterm:kitty
endif

tnoremap <M-CR> <C-y>

set cursorline

set autoindent
set backspace=indent,eol,start
set bs=2
set encoding=utf-8
set expandtab
set fileencoding=utf-8
set foldmethod=manual
" disable folding:
set foldlevelstart=99
"set foldcolumn=2
set guifont=Monaco:h12
set hls
set incsearch " Search as string is typed
set nocompatible " Use Vim settings, rather then Vi settings
set nobackup
set nowritebackup
set noswapfile " http://robots.thoughtbot.com/post/18739402579/global-gitignore#comment-458413287
set noerrorbells visualbell t_vb=
set number
set nowrap
set ruler
set laststatus=2
set scrolloff=3
set shiftwidth=4
set showmatch
set smartindent
set smarttab
set softtabstop=4
if has('termguicolors')
    set termguicolors
endif
set tabstop=4
set textwidth=80
"set title
" increase verbosity
"set vbs=1
set wildmenu

" Open new split panes to right and bottom, which feels more natural
set splitbelow
set splitright

" Save without leaving insert mode
nnoremap <C-s> :w<CR>
inoremap <C-s> <C-o>:w<CR>

function! MoveCurrentFileWindow(direction)
    let source_window = win_getid()
    let target_window = win_getid(winnr(a:direction))
    if target_window == source_window
        return
    endif

    let source_buffer = bufnr()
    call win_gotoid(target_window)
    execute 'hide buffer ' . source_buffer
    call win_gotoid(source_window)
    close
    call win_gotoid(target_window)
endfunction

nnoremap <silent> <C-M-Left> :call MoveCurrentFileWindow('h')<CR>
nnoremap <silent> <C-M-Right> :call MoveCurrentFileWindow('l')<CR>
nnoremap <silent> <C-\> :rightbelow vsplit<CR>

" Copy yanked text to the OS clipboard without changing Vim's registers.
if has('clipboard')
    augroup os_clipboard_yank
        autocmd!
        autocmd TextYankPost * if v:event.operator ==# 'y' | call setreg('+', v:event.regcontents, v:event.regtype) | endif
    augroup END
endif

if exists('$HOMEBREW_PREFIX')
    execute 'set runtimepath+=' . fnameescape($HOMEBREW_PREFIX . '/opt/fzf')
endif
let g:fzf_file_picker_root = getcwd()
let g:fzf_picker_options = [
    \ '--layout=reverse',
    \ '--info=inline',
    \ '--no-scrollbar',
    \ '--no-separator',
    \ '--color=fg:#403f53,bg:#fbfbfb,hl:#994cc3,fg+:#403f53,bg+:#d3e8f8,hl+:#994cc3,prompt:#0c969b,pointer:#e64d49,marker:#2aa298,spinner:#4876d6,header:#5f7e97'
    \ ]
let $FZF_DEFAULT_COMMAND = 'fd --type f --hidden --exclude .git'
let g:fzf_open_options = g:fzf_picker_options + ['--expect=enter,ctrl-o']

function! FzfOpenCommand(key)
    return a:key ==# 'enter' && !empty(expand('%:p')) ? 'rightbelow vsplit' : 'edit'
endfunction

function! OpenFileResults(lines)
    if len(a:lines) < 2
        return
    endif
    let file = a:lines[1]
    if file !~# '^/'
        let file = g:fzf_file_picker_root . '/' . file
    endif
    execute FzfOpenCommand(a:lines[0]) . ' ' . fnameescape(file)
endfunction

command! Files call fzf#run(fzf#wrap('files', {'dir': g:fzf_file_picker_root, 'source': $FZF_DEFAULT_COMMAND, 'sink*': function('OpenFileResults'), 'options': g:fzf_open_options}))

function! OpenFileSwitcherState()
    let previous_window = win_getid(winnr('#'))
    let current_window = win_getid()
    let entries = []
    let previous_position = 0
    let current_position = 1
    for window in getwininfo()
        if window.tabnr != tabpagenr()
            continue
        endif
        let file = fnamemodify(bufname(window.bufnr), ':p')
        if empty(file) || !filereadable(file)
            continue
        endif
        call add(entries, printf("%d\t%s", window.winid, fnamemodify(file, ':~:.')))
        if window.winid == previous_window
            let previous_position = len(entries)
        elseif window.winid == current_window
            let current_position = len(entries)
        endif
    endfor
    return {'entries': entries, 'position': previous_position > 0 ? previous_position : current_position}
endfunction

function! OpenFileSwitcherResults(lines)
    if len(a:lines) < 2
        return
    endif
    let window_id = str2nr(matchstr(a:lines[1], '^\d\+'))
    if window_id == 0 || win_id2win(window_id) == 0
        return
    endif
    if a:lines[0] ==# 'enter'
        call win_gotoid(window_id)
    elseif a:lines[0] ==# 'x'
        let buffer = winbufnr(window_id)
        if winnr('$') > 1
            call win_execute(window_id, 'close')
        else
            call win_execute(window_id, 'enew')
            execute 'bdelete ' . buffer
        endif
    endif
endfunction

function! OpenFileSwitcher()
    let state = OpenFileSwitcherState()
    if empty(state.entries)
        echo 'No open files'
        return
    endif
    let options = g:fzf_picker_options + [
        \ '--bind=load:pos(' . state.position . ')',
        \ '--delimiter=\t',
        \ '--expect=enter,x',
        \ '--footer=↑/↓ select  •  enter focus  •  x close  •  esc close',
        \ '--footer-border=none',
        \ '--prompt=File> ',
        \ '--with-nth=2..',
        \ ]
    call fzf#run(fzf#wrap('open-files', {
        \ 'options': options,
        \ 'sink*': function('OpenFileSwitcherResults'),
        \ 'source': state.entries,
        \ 'window': {'width': 0.8, 'height': min([9, len(state.entries) + 4])},
        \ }))
endfunction
command! OpenFiles call OpenFileSwitcher()

function! OpenRipgrepResult(line, command)
    let match = matchlist(a:line, '^\(.\{-}\):\(\d\+\):\(\d\+\):')
    if empty(match)
        return
    endif
    let file = match[1]
    if file !~# '^/'
        let file = g:fzf_file_picker_root . '/' . file
    endif
    execute a:command . ' ' . fnameescape(file)
    call cursor(str2nr(match[2]), str2nr(match[3]))
endfunction

function! OpenRipgrepResults(lines)
    if len(a:lines) < 2
        return
    endif
    call OpenRipgrepResult(a:lines[1], FzfOpenCommand(a:lines[0]))
endfunction

function! RunRipgrep(name, command)
    let preview_script = g:vim_dotfiles_directory . '/.vim/bin/ripgrep-preview'
    let preview_command = shellescape(preview_script) . ' {1} {2} "$FZF_PREVIEW_LINES" "$FZF_PREVIEW_COLUMNS"'
    let options = g:fzf_open_options + [
        \ '--delimiter=:',
        \ '--nth=1,4..',
        \ '--preview=' . preview_command,
        \ '--preview-window=down,50%,nowrap,border-top',
        \ '--prompt=Search> ',
        \ ]
    let window = {'width': 0.9, 'height': 0.9}
    call fzf#run(fzf#wrap(a:name, {'dir': g:fzf_file_picker_root, 'source': a:command, 'sink*': function('OpenRipgrepResults'), 'options': options, 'window': window}))
endfunction

function! Ripgrep(args)
    let command = 'rg --column --line-number --with-filename --no-heading --color=never --smart-case ' . a:args
    call RunRipgrep('rg', command)
endfunction
command! -nargs=+ -complete=file Rg call Ripgrep(<q-args>)

function! VisualRipgrepMapping()
    let term = join(getregion(getpos('v'), getpos('.')), ' ')
    return ":\<C-u>Rg -g'!**/*test*' " . term
endfunction

function! RipgrepFile(args)
    let file = expand('%:p')
    if !filereadable(file)
        echoerr 'Current buffer is not a readable file'
        return
    endif
    let command = 'rg --column --line-number --with-filename --no-heading --color=never --smart-case ' . a:args . ' -- ' . shellescape(file)
    call RunRipgrep('rg-file', command)
endfunction
command! -nargs=+ RgFile call RipgrepFile(<q-args>)

function! EncodeGitHubPath(path)
    return substitute(a:path, '[ %#?]', '\=printf("%%%02X", char2nr(submatch(0)))', 'g')
endfunction

function! OpenCurrentFileOnGitHub()
    let file = expand('%:p')
    if !filereadable(file)
        echoerr 'Current buffer is not a readable file'
        return
    endif

    let directory = fnamemodify(file, ':h')
    let root_output = systemlist('git -C ' . shellescape(directory) . ' rev-parse --show-toplevel')
    if v:shell_error || empty(root_output)
        echoerr 'Current file is not in a Git repository'
        return
    endif
    let root = root_output[0]

    let remote_output = systemlist('git -C ' . shellescape(root) . ' remote get-url origin')
    if v:shell_error || empty(remote_output)
        echoerr 'Git repository has no origin remote'
        return
    endif
    let remote = remote_output[0]

    if remote =~# '^git@github\.com:'
        let repository = substitute(remote, '^git@github\.com:', '', '')
    elseif remote =~# '^https\?://github\.com/'
        let repository = substitute(remote, '^https\?://github\.com/', '', '')
    elseif remote =~# '^ssh://git@github\.com/'
        let repository = substitute(remote, '^ssh://git@github\.com/', '', '')
    elseif remote =~# '^https\?://\%([^/]\+\.\)\?gitstream\.shopify\.io/'
        let repository = substitute(remote, '^https\?://\%([^/]\+\.\)\?gitstream\.shopify\.io/', '', '')
    else
        echoerr 'Origin is not a GitHub repository'
        return
    endif
    let repository = substitute(repository, '\.git$', '', '')

    let relative_file = file[strlen(root) + 1:]
    let url = 'https://github.com/' . repository . '/blob/main/' . EncodeGitHubPath(relative_file) . '#L' . line('.')
    let opener = has('macunix') ? 'open' : 'xdg-open'
    call system(shellescape(opener) . ' ' . shellescape(url))
    if v:shell_error
        echoerr 'Could not open GitHub URL'
    endif
endfunction

function! ImportAtCursor()
    let cursor_line = line('.')
    let start_line = cursor_line
    while start_line >= 1 && getline(start_line) !~# '^\s*import\>'
        let start_line -= 1
    endwhile
    if start_line < 1
        return {}
    endif

    let end_line = start_line
    while end_line < line('$') && getline(end_line) !~# ';\s*$'
        let end_line += 1
    endwhile
    if cursor_line > end_line
        return {}
    endif

    let statement = join(getline(start_line, end_line), ' ')
    let specifier = matchstr(statement, '\<from\s*[''"]\zs[^''"]\+\ze[''"]')
    if empty(specifier)
        let specifier = matchstr(statement, '^\s*import\s*[''"]\zs[^''"]\+\ze[''"]')
    endif

    let symbol = expand('<cword>')
    let alias = matchlist(statement, '\<\(\k\+\)\s\+as\s\+' . symbol . '\>')
    if !empty(alias)
        let symbol = alias[1]
    endif
    return {'specifier': specifier, 'symbol': symbol}
endfunction

function! ImportedSymbolLine(file, symbol)
    if empty(a:symbol)
        return 1
    endif
    let output = systemlist('ctags --output-format=json --fields=+nK --extras=-F --excmd=number --sort=no -f - ' . shellescape(a:file))
    if v:shell_error
        return 1
    endif
    for item in output
        try
            let tag = json_decode(item)
        catch
            continue
        endtry
        if get(tag, '_type', '') ==# 'tag' && get(tag, 'name', '') ==# a:symbol && has_key(tag, 'line')
            return tag.line
        endif
    endfor
    return 1
endfunction

function! JumpToImport()
    let import = ImportAtCursor()
    if empty(import) || empty(import.specifier)
        echo 'No import found'
        return
    endif

    let source_file = expand('%:p')
    let specifier = import.specifier
    let symbol = import.symbol
    let resolver = g:vim_dotfiles_directory . '/.vim/bin/import-resolver.js'
    let output = systemlist('node ' . shellescape(resolver) . ' ' . shellescape(source_file) . ' ' . shellescape(specifier))
    if v:shell_error || empty(output)
        echoerr empty(output) ? 'Could not resolve import' : join(output, ' ')
        return
    endif

    let target_file = output[0]
    execute 'rightbelow vsplit ' . fnameescape(target_file)
    call cursor(ImportedSymbolLine(target_file, symbol), 1)
    normal! zz
endfunction

augroup import_jump
    autocmd!
    autocmd FileType javascript,javascriptreact,typescript,typescriptreact nnoremap <buffer> <silent> <C-j> :call JumpToImport()<CR>
augroup END

function! CurrentFileSymbols()
    let file = expand('%:p')
    if !filereadable(file)
        echoerr 'Current buffer is not a readable file'
        return []
    endif
    let command = 'ctags --output-format=json --fields=+nK --extras=-F --excmd=number --sort=no -f -'
    if file =~# '\.jsx\?$'
        let test_regex = '--regex-JavaScript=/^[ \t]*(describe|it|test)(\.(only|skip|todo))?[ \t]*\([ \t]*["'']([^"'']+)/\4/t,test/'
        let command .= ' ' . shellescape(test_regex)
    elseif file =~# '\.tsx\?$'
        let test_regex = '--regex-TypeScript=/^[ \t]*(describe|it|test)(\.(only|skip|todo))?[ \t]*\([ \t]*["'']([^"'']+)/\4/t,test/'
        let method_regex = '--regex-TypeScript=/^  (async[ \t]+)?(#?[A-Za-z_$][A-Za-z0-9_$#]*)[ \t]*\([^)]*\)[ \t]*:[^{]+\{/\2/m,method/'
        let command .= ' ' . shellescape(test_regex) . ' ' . shellescape(method_regex)
    endif
    let output = systemlist(command . ' ' . shellescape(file))
    if v:shell_error
        echoerr join(output, ' ')
        return []
    endif

    let symbols = []
    let seen = {}
    for line in output
        try
            let tag = json_decode(line)
        catch
            continue
        endtry
        let kind = get(tag, 'kind', '')
        let key = printf('%d:%s:%s', get(tag, 'line', 0), kind, get(tag, 'name', ''))
        if get(tag, '_type', '') ==# 'tag' && has_key(tag, 'line') && index(['alias', 'constant', 'property', 'variable'], kind) == -1 && !has_key(seen, key)
            let seen[key] = 1
            call add(symbols, printf('%6d  %-12s %s', tag.line, kind, tag.name))
        endif
    endfor
    return symbols
endfunction

function! PositionSymbolWindow(window_id, line_number)
    let top_line = max([1, a:line_number - 4])
    call win_execute(a:window_id, 'call cursor(' . top_line . ', 1)')
    call win_execute(a:window_id, 'normal! zt')
    call win_execute(a:window_id, 'call cursor(' . a:line_number . ', 1)')

    if exists('g:symbol_picker_state') && get(g:symbol_picker_state, 'source_window', 0) == a:window_id
        let triangle_id = get(g:symbol_picker_state, 'triangle_id', 0)
        if triangle_id && !empty(popup_getpos(triangle_id))
            let position = screenpos(a:window_id, a:line_number, 1)
            if position.row > 0
                call popup_move(triangle_id, {'line': position.row, 'col': g:symbol_picker_state.triangle_col})
            endif
        endif
    endif
endfunction

function! OpenSymbol(line)
    let line_number = str2nr(matchstr(a:line, '^\s*\zs\d\+'))
    if line_number > 0
        let source_window = exists('g:symbol_picker_state') ? g:symbol_picker_state.source_window : win_getid()
        call PositionSymbolWindow(source_window, line_number)
    endif
endfunction

function! SymbolPosition(symbols, cursor_line)
    let position = 1
    for index in range(len(a:symbols))
        let symbol_line = str2nr(matchstr(a:symbols[index], '^\s*\zs\d\+'))
        if symbol_line > a:cursor_line
            break
        endif
        let position = index + 1
    endfor
    return position
endfunction

function! SymbolPopupLayout()
    let pane_position = win_screenpos(0)
    let pane_width = winnr('$') == 1 ? max([1, float2nr((winwidth(0) - 1) / 2)]) : winwidth(0)
    let pane_height = winheight(0)
    let width = min([&columns, max([8, float2nr(pane_width * 0.95)])])
    let height = max([4, float2nr(pane_height * 0.8)])
    let leftmost = pane_position[1] == 1
    let side = leftmost ? 'right' : 'left'
    let col = leftmost ? pane_position[1] + pane_width + 1 : pane_position[1] - width - 1
    let col = min([max([1, col]), max([1, &columns - width + 1])])
    let row = min([pane_position[0], max([1, &lines - height + 1])])
    let x_range = max([1, &columns - width])
    let y_range = max([1, &lines - height])
    let triangle_col = side ==# 'right' ? col : col + width - 1
    return {
        \ 'border': 'sharp',
        \ 'col': col,
        \ 'height': height,
        \ 'pane_col': pane_position[1],
        \ 'pane_height': pane_height,
        \ 'pane_width': pane_width,
        \ 'row': row,
        \ 'side': side,
        \ 'triangle': side ==# 'right' ? '◀' : '▶',
        \ 'triangle_col': triangle_col,
        \ 'width': width,
        \ 'xoffset': (col - 1) * 1.0 / x_range,
        \ 'yoffset': (row - 1) * 1.0 / y_range,
        \ }
endfunction

function! SymbolPreviewTick(timer)
    if !exists('g:symbol_picker_state') || !filereadable(g:symbol_picker_state.preview_file)
        return
    endif
    let lines = readfile(g:symbol_picker_state.preview_file, '', 1)
    let line_number = empty(lines) ? 0 : str2nr(lines[0])
    if line_number > 0 && line_number != g:symbol_picker_state.last_line
        let g:symbol_picker_state.last_line = line_number
        call PositionSymbolWindow(g:symbol_picker_state.source_window, line_number)
        redraw
    endif
endfunction

function! SymbolPickerExit(code)
    if !exists('g:symbol_picker_state')
        return
    endif
    call timer_stop(g:symbol_picker_state.timer)
    if get(g:symbol_picker_state, 'triangle_id', 0)
        call popup_close(g:symbol_picker_state.triangle_id)
    endif
    call delete(g:symbol_picker_state.preview_file)
    unlet g:symbol_picker_state
endfunction

function! Symbols()
    let cursor_line = line('.')
    let symbols = CurrentFileSymbols()
    if empty(symbols)
        echo 'No symbols found'
        return
    endif

    let position = SymbolPosition(symbols, cursor_line)
    let layout = SymbolPopupLayout()
    let preview_file = tempname()
    let source_window = win_getid()
    call writefile([matchstr(symbols[position - 1], '^\s*\zs\d\+')], preview_file)
    let triangle_id = popup_create(layout.triangle, {
        \ 'col': layout.triangle_col,
        \ 'highlight': 'PmenuSel',
        \ 'line': layout.row + min([4, layout.height - 1]),
        \ 'maxheight': 1,
        \ 'maxwidth': 1,
        \ 'minheight': 1,
        \ 'minwidth': 1,
        \ 'padding': [0, 0, 0, 0],
        \ 'zindex': 1001,
        \ })
    let g:symbol_picker_state = {
        \ 'last_line': -1,
        \ 'preview_file': preview_file,
        \ 'source_window': source_window,
        \ 'triangle_col': layout.triangle_col,
        \ 'triangle_id': triangle_id,
        \ }
    let g:symbol_picker_state.timer = timer_start(30, function('SymbolPreviewTick'), {'repeat': -1})
    call SymbolPreviewTick(g:symbol_picker_state.timer)

    let focus_command = 'printf %s {1} > ' . shellescape(preview_file)
    let options = g:fzf_picker_options + [
        \ '--prompt=Symbol> ',
        \ '--bind=load:pos(' . position . ')',
        \ '--bind=focus:execute-silent(' . focus_command . ')',
        \ ]
    let popup_window = {
        \ 'border': layout.border,
        \ 'height': layout.height,
        \ 'width': layout.width,
        \ 'xoffset': layout.xoffset,
        \ 'yoffset': layout.yoffset,
        \ }
    call fzf#run(fzf#wrap('symbols', {
        \ 'exit': function('SymbolPickerExit'),
        \ 'options': options,
        \ 'sink': function('OpenSymbol'),
        \ 'source': symbols,
        \ 'window': popup_window,
        \ }))
endfunction
command! Symbols call Symbols()

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
    return g:fzf_picker_options + [
        \ '--delimiter=\t',
        \ '--expect=ctrl-y',
        \ '--footer=↑/↓ agent  •  enter steer  •  opt+enter follow-up  •  esc close',
        \ '--footer-border=none',
        \ '--header=' . a:state.context,
        \ '--header-border=bottom',
        \ '--no-sort',
        \ '--phony',
        \ '--print-query',
        \ '--prompt=Prompt> ',
        \ '--with-nth=2..',
        \ ]
endfunction

function! AgentPromptMarkerPath()
    if !empty($HERDR_SPLIT_VIM_PROMPT_MARKER)
        return $HERDR_SPLIT_VIM_PROMPT_MARKER
    endif
    let state_directory = empty($HERDR_SPLIT_VIM_STATE_DIR)
        \ ? (empty($XDG_STATE_HOME) ? expand('~/.local/state') : $XDG_STATE_HOME) . '/herdr/plugins/kumar303.split-vim-above'
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
    let layout = SymbolPopupLayout()
    let content_height = len(split(a:state.context, "\n", 1)) + len(a:state.entries) + 5
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

nnoremap <silent> <C-g> :call OpenCurrentFileOnGitHub()<CR>
nnoremap <silent> <C-l> :Symbols<CR>
nnoremap <silent> <C-p> :Files<CR>
nnoremap <silent> <C-Tab> :OpenFiles<CR>
nnoremap <C-f> :RgFile<Space>
nnoremap <C-r> :Rg -g'!**/*test*'<Space>
xnoremap <expr> <C-r> VisualRipgrepMapping()
" Leave netrw before opening fzf to avoid conflicts when fzf returns.
autocmd FileType netrw nnoremap <buffer> <silent> <C-p> :enew<CR>:Files<CR>
autocmd FileType netrw nnoremap <buffer> <C-r> :enew<CR>:Rg -g'!**/*test*'<Space>

" Strip trailing whitespace
autocmd BufWritePre * :%s/\s\+$//e

" Press Space to turn off highlighting and clear any message already displayed.
:nnoremap <silent> <Space> :nohlsearch<Bar>:echo<CR>

" Soft wrap lines that exceed the window.
au BufRead,BufNewFile *.* set wrap linebreak nolist textwidth=0 wrapmargin=0

syntax on

autocmd FileType go setlocal noexpandtab tabstop=4 shiftwidth=4 softtabstop=4
" HTML has long lines and short indents
autocmd FileType html setlocal textwidth=0 tabstop=2 shiftwidth=2 softtabstop=2
autocmd FileType css setlocal textwidth=0 tabstop=2 shiftwidth=2 softtabstop=2
autocmd FileType javascript,typescript,typescriptreact setlocal textwidth=0 tabstop=2 shiftwidth=2 softtabstop=2
" Vim's TypeScript syntax can block redraws on generic function calls.
autocmd FileType typescript,typescriptreact setlocal syntax=javascript
autocmd FileType python setlocal tabstop=4 shiftwidth=4 softtabstop=4


colorscheme light-owl
