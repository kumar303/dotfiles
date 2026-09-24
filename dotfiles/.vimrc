
let g:vim_dotfiles_directory = fnamemodify(resolve(expand('<sfile>:p')), ':h')
execute 'set runtimepath^=' . fnameescape(g:vim_dotfiles_directory . '/.vim')
execute 'set runtimepath+=' . fnameescape(g:vim_dotfiles_directory . '/.vim/after')

if exists('+keyprotocol')
    set keyprotocol=xterm:kitty
endif

cnoremap <M-b> <S-Left>
cnoremap <M-f> <S-Right>
cnoremap <M-BS> <C-W>

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

" Keep undo and redo next to each other after remapping Ctrl-R.
nnoremap U <C-r>

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

execute 'source' fnameescape(g:vim_dotfiles_directory . '/.vim/workflows/panes.vim')
execute 'source' fnameescape(g:vim_dotfiles_directory . '/.vim/workflows/file-picker.vim')
execute 'source' fnameescape(g:vim_dotfiles_directory . '/.vim/workflows/open-file-switcher.vim')
execute 'source' fnameescape(g:vim_dotfiles_directory . '/.vim/workflows/search.vim')
execute 'source' fnameescape(g:vim_dotfiles_directory . '/.vim/workflows/github.vim')
execute 'source' fnameescape(g:vim_dotfiles_directory . '/.vim/workflows/import-jump.vim')
execute 'source' fnameescape(g:vim_dotfiles_directory . '/.vim/workflows/list-symbols.vim')
execute 'source' fnameescape(g:vim_dotfiles_directory . '/.vim/workflows/agent-prompt.vim')
execute 'source' fnameescape(g:vim_dotfiles_directory . '/.vim/workflows/diff-view.vim')

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
