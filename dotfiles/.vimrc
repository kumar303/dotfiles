
let g:vim_dotfiles_directory = fnamemodify(resolve(expand('<sfile>:p')), ':h')

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
    let options = g:fzf_open_options + ['--delimiter=:', '--nth=1,4..', '--prompt=Search> ']
    call fzf#run(fzf#wrap(a:name, {'dir': g:fzf_file_picker_root, 'source': a:command, 'sink*': function('OpenRipgrepResults'), 'options': options}))
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
    if file =~# '\.js$'
        let test_regex = '--regex-JavaScript=/^[ \t]*(describe|it|test)(\.(only|skip|todo))?[ \t]*\([ \t]*["'']([^"'']+)/\4/t,test/'
        let command .= ' ' . shellescape(test_regex)
    endif
    let output = systemlist(command . ' ' . shellescape(file))
    if v:shell_error
        echoerr join(output, ' ')
        return []
    endif

    let symbols = []
    for line in output
        try
            let tag = json_decode(line)
        catch
            continue
        endtry
        let kind = get(tag, 'kind', '')
        if get(tag, '_type', '') ==# 'tag' && has_key(tag, 'line') && index(['alias', 'constant', 'property', 'variable'], kind) == -1
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
    let pane_width = winwidth(0)
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
        \ '--no-scrollbar',
        \ '--no-separator',
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

nnoremap <silent> <C-g> :call OpenCurrentFileOnGitHub()<CR>
nnoremap <silent> <C-l> :Symbols<CR>
nnoremap <silent> <C-p> :Files<CR>
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
