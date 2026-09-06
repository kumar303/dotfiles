
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
set t_Co=16
set tabstop=4
set textwidth=80
"set title
" increase verbosity
"set vbs=1
set wildmenu

" Open new split panes to right and bottom, which feels more natural
set splitbelow
set splitright

" Save a file with ESC ESC
map <Esc><Esc> :w<CR>

if exists('$HOMEBREW_PREFIX')
    execute 'set runtimepath+=' . fnameescape($HOMEBREW_PREFIX . '/opt/fzf')
endif
let g:fzf_file_picker_root = getcwd()
let g:fzf_picker_options = [
    \ '--layout=reverse',
    \ '--info=inline',
    \ '--color=fg:#000000,bg:#fffdfa,hl:#aa7733,fg+:#000000,bg+:#ddeedd,hl+:#aa7733,prompt:#003399,pointer:#cc0000,marker:#228877,spinner:#003399,header:#555555'
    \ ]
let $FZF_DEFAULT_COMMAND = 'fd --type f --hidden --exclude .git'
command! Files call fzf#run(fzf#wrap('files', {'dir': g:fzf_file_picker_root, 'source': $FZF_DEFAULT_COMMAND, 'sink': 'edit', 'options': g:fzf_picker_options}))

function! OpenRipgrepResult(line)
    let match = matchlist(a:line, '^\(.\{-}\):\(\d\+\):\(\d\+\):')
    if empty(match)
        return
    endif
    execute 'edit ' . fnameescape(match[1])
    call cursor(str2nr(match[2]), str2nr(match[3]))
endfunction

function! Ripgrep(args)
    let command = 'rg --column --line-number --no-heading --color=never --smart-case ' . a:args
    let options = g:fzf_picker_options + ['--delimiter=:', '--nth=1,4..', '--prompt=Search> ']
    call fzf#run(fzf#wrap('rg', {'dir': g:fzf_file_picker_root, 'source': command, 'sink': function('OpenRipgrepResult'), 'options': options}))
endfunction
command! -nargs=+ -complete=file Rg call Ripgrep(<q-args>)

nnoremap <silent> <C-p> :Files<CR>
nnoremap <C-r> :Rg<Space>
autocmd FileType netrw nnoremap <buffer> <C-r> :Rg<Space>

" Strip trailing whitespace
autocmd BufWritePre * :%s/\s\+$//e

" Press Space to turn off highlighting and clear any message already displayed.
:nnoremap <silent> <Space> :nohlsearch<Bar>:echo<CR>

" Soft wrap lines that exceed the window.
au BufRead,BufNewFile *.* set wrap linebreak nolist textwidth=0 wrapmargin=0

autocmd FileType go setlocal noexpandtab tabstop=4 shiftwidth=4 softtabstop=4
" HTML has long lines and short indents
autocmd FileType html setlocal textwidth=0 tabstop=2 shiftwidth=2 softtabstop=2
autocmd FileType css setlocal textwidth=0 tabstop=2 shiftwidth=2 softtabstop=2
autocmd FileType javascript setlocal textwidth=0 tabstop=2 shiftwidth=2 softtabstop=2
autocmd FileType python setlocal tabstop=4 shiftwidth=4 softtabstop=4


" Set working directory to the current file
" http://vim.wikia.com/wiki/Set_working_directory_to_the_current_file
autocmd BufEnter * silent! lcd %:p:h

syntax on
colorscheme autumnleaf
