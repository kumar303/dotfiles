
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
command! Files call fzf#run(fzf#wrap('files', {'dir': g:fzf_file_picker_root, 'source': $FZF_DEFAULT_COMMAND, 'sink': 'edit', 'options': g:fzf_picker_options}))

function! OpenRipgrepResult(line)
    let match = matchlist(a:line, '^\(.\{-}\):\(\d\+\):\(\d\+\):')
    if empty(match)
        return
    endif
    let file = match[1]
    if file !~# '^/'
        let file = g:fzf_file_picker_root . '/' . file
    endif
    execute 'edit ' . fnameescape(file)
    call cursor(str2nr(match[2]), str2nr(match[3]))
endfunction

function! RunRipgrep(name, command)
    let options = g:fzf_picker_options + ['--delimiter=:', '--nth=1,4..', '--prompt=Search> ']
    call fzf#run(fzf#wrap(a:name, {'dir': g:fzf_file_picker_root, 'source': a:command, 'sink': function('OpenRipgrepResult'), 'options': options}))
endfunction

function! Ripgrep(args)
    let command = 'rg --column --line-number --with-filename --no-heading --color=never --smart-case ' . a:args
    call RunRipgrep('rg', command)
endfunction
command! -nargs=+ -complete=file Rg call Ripgrep(<q-args>)

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

nnoremap <silent> <C-l> :Symbols<CR>
nnoremap <silent> <C-p> :Files<CR>
nnoremap <C-f> :RgFile<Space>
nnoremap <C-r> :Rg -g'!**/*test*'<Space>
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
