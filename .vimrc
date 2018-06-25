
set cursorline

set autoindent
set background=dark
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
set tags+=$HOME/.vimtags
set t_Co=16
"set t_Co=256
set tabstop=4
set textwidth=80
"set title
" increase verbosity
"set vbs=1
set wildmenu
"set wrap

" Specify a directory for plugins
" https://github.com/junegunn/vim-plug
call plug#begin('~/.vim/plugged')

" Increase verbosity for debugging.
" let g:neoformat_verbose = 1

" https://github.com/sbdchd/neoformat
Plug 'sbdchd/neoformat'

" Initialize plugin system
call plug#end()

" ***This only applies to addons-frontend***
" Format (e.g. with prettier) every time you save.
" https://prettier.io/docs/en/vim.html
autocmd BufWritePre */addons-frontend/*.js Neoformat

" This sets the prettier executable.
autocmd FileType javascript setlocal formatprg=~/dev/addons-frontend/node_modules/.bin/prettier\ --stdin\ --parser\ flow\ --config\ ~/dev/addons-frontend/.prettierrc
" Use formatprg when available
let g:neoformat_try_formatprg = 1

nnoremap ,pp :silent %!~/dev/addons-frontend/node_modules/.bin/prettier --stdin --parser flow --config ~/dev/addons-frontend/.prettierrc<CR>

" Multi-windowing.  CTRL+[HJKL] to switch windows and maximize
map <C-J> <C-W>j<C-W>_
map <C-K> <C-W>k<C-W>_
map <C-H> <C-W>h<C-W><bar>
map <C-L> <C-W>l<C-W><bar>

" Allow window-switching commands in insert mode
:imap <C-w> <C-o><C-w>

" Open new split panes to right and bottom, which feels more natural
set splitbelow
set splitright

" Multi-file.  CTRL+[NP] for next/previous file
map <C-P> :prev<CR>
map <C-N> :next<CR>

" Save a file with ESC ESC
map <Esc><Esc> :w<CR>

" Open nerdtree in the dev directory
map <C-N> :NERDTree ~/dev/

" Strip trailing whitespace
autocmd BufWritePre * :%s/\s\+$//e

" Press Space to turn off highlighting and clear any message already displayed.
:nnoremap <silent> <Space> :nohlsearch<Bar>:echo<CR>

""" Python
map <F8> Oimport pdb; pdb.set_trace()<Esc>

" Map Ctrl+W S to opening a new terminal
map <C-W>s :ConqueTerm bash<CR>
let g:ConqueTerm_ReadUnfocused = 0
"let g:ConqueTerm_CWInsert = 0

filetype plugin indent on

augroup blah
    au!
    au BufRead,BufNewFile *.html setfiletype htmldjango
augroup END

augroup jsm
    au!
    au BufRead,BufNewFile *.jsm setfiletype javascript
augroup END

" Soft wrap lines that exceed the window.
au BufRead,BufNewFile *.* set wrap linebreak nolist textwidth=0 wrapmargin=0

autocmd FileType go setlocal noexpandtab tabstop=4 shiftwidth=4 softtabstop=4
" HTML has long lines and short indents
autocmd FileType html setlocal textwidth=0 tabstop=2 shiftwidth=2 softtabstop=2
autocmd FileType css setlocal textwidth=0 tabstop=2 shiftwidth=2 softtabstop=2
autocmd FileType scss setlocal textwidth=0 tabstop=2 shiftwidth=2 softtabstop=2
autocmd FileType htmldjango setlocal textwidth=0 tabstop=2 shiftwidth=2 softtabstop=2
autocmd FileType javascript setlocal textwidth=0 tabstop=2 shiftwidth=2 softtabstop=2
autocmd FileType php setlocal tabstop=4 shiftwidth=4 softtabstop=4
autocmd FileType python setlocal tabstop=4 shiftwidth=4 softtabstop=4
"autocmd FileType python setlocal foldmethod=indent foldminlines=15 foldnestmax=2 foldcolumn=2


" Set working directory to the current file
" http://vim.wikia.com/wiki/Set_working_directory_to_the_current_file
autocmd BufEnter * silent! lcd %:p:h

syntax on
"http://vimcolorschemetest.googlecode.com/svn/html/index-c.html
"colorscheme darkblue
"colorscheme ir_black
colorscheme autumnleaf

" Tab completion
" will insert tab at beginning of line,
" will use completion if not at beginning
set wildmode=list:longest,list:full
set complete=.,w,t
function! InsertTabWrapper()
    let col = col('.') - 1
    if !col || getline('.')[col - 1] !~ '\k'
        return "\<tab>"
    else
        return "\<c-p>"
    endif
endfunction
inoremap <Tab> <c-r>=InsertTabWrapper()<cr>


" Reminders of useful things I don't use everyday:
" ^O: return to last point before a jump
" ^I: go forward to next jump point
" ZZ: save and close a file
