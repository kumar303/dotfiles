
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
set incsearch
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

" Multi-windowing.  CTRL+[HJKL] to switch windows and maximize
map <C-J> <C-W>j<C-W>_
map <C-K> <C-W>k<C-W>_
map <C-H> <C-W>h<C-W><bar>
map <C-L> <C-W>l<C-W><bar>

" Allow window-switching commands in insert mode
:imap <C-w> <C-o><C-w>

" Multi-file.  CTRL+[NP] for next/previous file
map <C-P> :prev<CR>
map <C-N> :next<CR>

" Save a file with ESC ESC
map <Esc><Esc> :w<CR>

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

" HTML has long lines and short indents
autocmd FileType html setlocal textwidth=0 tabstop=2 shiftwidth=2 softtabstop=2
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

" Press tab to autocomplete a name.
" It preserves the tab key :)
" http://vim.wikia.com/wiki/Smart_mapping_for_tab_completion
function! Smart_TabComplete()
  let line = getline('.')                         " current line

  let substr = strpart(line, -1, col('.'))        " from the start of the current
                                                  " line to one character left
                                                  " of the cursor
  let substr = matchstr(substr, "[^ \t]*$")       " word till cursor
  if (strlen(substr)==0)                          " nothing to match on empty string
    return "\<tab>"
  endif
  let has_period = match(substr, '\.') != -1      " position of period, if any
  let has_slash = match(substr, '\/') != -1       " position of slash, if any
  if (!has_period && !has_slash)
    return "\<C-X>\<C-P>"                         " existing text matching
  elseif ( has_slash )
    return "\<C-X>\<C-F>"                         " file matching
  else
    return "\<C-X>\<C-O>"                         " plugin matching
  endif
endfunction

inoremap <tab> <c-r>=Smart_TabComplete()<CR>


" Reminders of useful things I don't use everyday:
" ^O: return to last point before a jump
" ^I: go forward to next jump point
" ZZ: save and close a file
