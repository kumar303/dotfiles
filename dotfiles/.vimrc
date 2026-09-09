
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
        if get(tag, '_type', '') ==# 'tag' && has_key(tag, 'line') && index(['constant', 'property', 'variable'], kind) == -1
            call add(symbols, printf('%6d  %-12s %s', tag.line, kind, tag.name))
        endif
    endfor
    return symbols
endfunction

function! OpenSymbol(line)
    let line_number = matchstr(a:line, '^\s*\zs\d\+')
    if !empty(line_number)
        execute line_number
        normal! zz
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

function! Symbols()
    let cursor_line = line('.')
    let symbols = CurrentFileSymbols()
    if empty(symbols)
        echo 'No symbols found'
        return
    endif
    let position = SymbolPosition(symbols, cursor_line)
    let options = g:fzf_picker_options + ['--prompt=Symbol> ', '--bind=load:pos(' . position . ')']
    call fzf#run(fzf#wrap('symbols', {'source': symbols, 'sink': function('OpenSymbol'), 'options': options}))
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
