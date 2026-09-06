" Light Owl color scheme for Vim
" Adapted from Sarah Drasner's Night Owl Light VS Code theme:
" https://github.com/sdras/night-owl-vscode-theme
"
" MIT License
"
" Copyright (c) 2018 Sarah Drasner
"
" Permission is hereby granted, free of charge, to any person obtaining a copy
" of this software and associated documentation files (the "Software"), to deal
" in the Software without restriction, including without limitation the rights
" to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
" copies of the Software, and to permit persons to whom the Software is
" furnished to do so, subject to the following conditions:
"
" The above copyright notice and this permission notice shall be included in all
" copies or substantial portions of the Software.
"
" THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
" IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
" FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
" AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
" LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
" OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
" SOFTWARE.

set background=light
highlight clear
if exists('syntax_on')
    syntax reset
endif
let g:colors_name = 'light-owl'

" Editor UI
highlight Normal guifg=#403f53 guibg=#fbfbfb ctermfg=8 ctermbg=15
highlight NormalNC guifg=#403f53 guibg=#fbfbfb ctermfg=8 ctermbg=15
highlight Cursor guifg=#fbfbfb guibg=#403f53 ctermfg=15 ctermbg=8
highlight CursorLine guibg=#f0f0f0 ctermbg=7
highlight CursorColumn guibg=#f0f0f0 ctermbg=7
highlight ColorColumn guibg=#f0f0f0 ctermbg=7
highlight LineNr guifg=#90a7b2 guibg=#fbfbfb ctermfg=7 ctermbg=15
highlight CursorLineNr guifg=#403f53 guibg=#f0f0f0 gui=bold ctermfg=8 ctermbg=7 cterm=bold
highlight SignColumn guifg=#90a7b2 guibg=#fbfbfb ctermfg=7 ctermbg=15
highlight FoldColumn guifg=#90a7b2 guibg=#f0f0f0 ctermfg=7 ctermbg=15
highlight Folded guifg=#5f7e97 guibg=#f0f0f0 ctermfg=8 ctermbg=7
highlight NonText guifg=#d9d9d9 guibg=#fbfbfb ctermfg=7 ctermbg=15
highlight EndOfBuffer guifg=#d9d9d9 guibg=#fbfbfb ctermfg=7 ctermbg=15
highlight SpecialKey guifg=#90a7b2 guibg=#fbfbfb ctermfg=7 ctermbg=15
highlight Whitespace guifg=#d9d9d9 guibg=#fbfbfb ctermfg=7 ctermbg=15
highlight VertSplit guifg=#d9d9d9 guibg=#f0f0f0 ctermfg=7 ctermbg=7
highlight StatusLine guifg=#403f53 guibg=#f0f0f0 gui=bold ctermfg=8 ctermbg=7 cterm=bold
highlight StatusLineNC guifg=#90a7b2 guibg=#f6f6f6 ctermfg=7 ctermbg=15
highlight TabLine guifg=#5f7e97 guibg=#f0f0f0 ctermfg=8 ctermbg=7
highlight TabLineFill guifg=#d9d9d9 guibg=#f0f0f0 ctermfg=7 ctermbg=7
highlight TabLineSel guifg=#403f53 guibg=#fbfbfb gui=bold ctermfg=8 ctermbg=15 cterm=bold
highlight Visual guifg=#403f53 guibg=#e0e0e0 ctermfg=8 ctermbg=7
highlight Search guifg=#403f53 guibg=#cdd2d2 ctermfg=8 ctermbg=7
highlight IncSearch guifg=#fbfbfb guibg=#2aa298 gui=bold ctermfg=15 ctermbg=6 cterm=bold
highlight MatchParen guifg=#994cc3 guibg=#d3e8f8 gui=bold ctermfg=5 ctermbg=7 cterm=bold
highlight Directory guifg=#0c969b guibg=#fbfbfb ctermfg=6 ctermbg=15
highlight Title guifg=#111111 guibg=#fbfbfb gui=bold ctermfg=0 ctermbg=15 cterm=bold
highlight ModeMsg guifg=#0c969b guibg=#fbfbfb gui=bold ctermfg=6 ctermbg=15 cterm=bold
highlight MoreMsg guifg=#0c969b guibg=#fbfbfb ctermfg=6 ctermbg=15
highlight Question guifg=#0c969b guibg=#fbfbfb ctermfg=6 ctermbg=15
highlight WarningMsg guifg=#daaa01 guibg=#fbfbfb ctermfg=3 ctermbg=15
highlight ErrorMsg guifg=#e64d49 guibg=#fbfbfb gui=bold ctermfg=1 ctermbg=15 cterm=bold
highlight WildMenu guifg=#403f53 guibg=#d3e8f8 ctermfg=8 ctermbg=7
highlight Pmenu guifg=#403f53 guibg=#f0f0f0 ctermfg=8 ctermbg=7
highlight PmenuSel guifg=#403f53 guibg=#d3e8f8 gui=bold ctermfg=8 ctermbg=7 cterm=bold
highlight PmenuSbar guibg=#d9d9d9 ctermbg=7
highlight PmenuThumb guibg=#90a7b2 ctermbg=8
highlight QuickFixLine guifg=#403f53 guibg=#d3e8f8 gui=bold ctermfg=8 ctermbg=7 cterm=bold

" Syntax
highlight Comment guifg=#989fb1 guibg=#fbfbfb gui=italic ctermfg=7 ctermbg=15 cterm=italic
highlight Constant guifg=#4876d6 guibg=#fbfbfb ctermfg=4 ctermbg=15
highlight String guifg=#c96765 guibg=#fbfbfb ctermfg=1 ctermbg=15
highlight Character guifg=#c96765 guibg=#fbfbfb ctermfg=1 ctermbg=15
highlight Number guifg=#aa0982 guibg=#fbfbfb ctermfg=5 ctermbg=15
highlight Boolean guifg=#4876d6 guibg=#fbfbfb ctermfg=4 ctermbg=15
highlight Float guifg=#aa0982 guibg=#fbfbfb ctermfg=5 ctermbg=15
highlight Identifier guifg=#4876d6 guibg=#fbfbfb ctermfg=4 ctermbg=15
highlight Function guifg=#0c969b guibg=#fbfbfb ctermfg=6 ctermbg=15
highlight Statement guifg=#994cc3 guibg=#fbfbfb gui=italic ctermfg=5 ctermbg=15 cterm=italic
highlight Conditional guifg=#994cc3 guibg=#fbfbfb gui=italic ctermfg=5 ctermbg=15 cterm=italic
highlight Repeat guifg=#994cc3 guibg=#fbfbfb gui=italic ctermfg=5 ctermbg=15 cterm=italic
highlight Label guifg=#994cc3 guibg=#fbfbfb ctermfg=5 ctermbg=15
highlight Operator guifg=#994cc3 guibg=#fbfbfb ctermfg=5 ctermbg=15
highlight Keyword guifg=#994cc3 guibg=#fbfbfb gui=italic ctermfg=5 ctermbg=15 cterm=italic
highlight Exception guifg=#994cc3 guibg=#fbfbfb gui=italic ctermfg=5 ctermbg=15 cterm=italic
highlight PreProc guifg=#994cc3 guibg=#fbfbfb ctermfg=5 ctermbg=15
highlight Include guifg=#994cc3 guibg=#fbfbfb gui=italic ctermfg=5 ctermbg=15 cterm=italic
highlight Define guifg=#994cc3 guibg=#fbfbfb ctermfg=5 ctermbg=15
highlight Macro guifg=#aa0982 guibg=#fbfbfb ctermfg=5 ctermbg=15
highlight PreCondit guifg=#994cc3 guibg=#fbfbfb ctermfg=5 ctermbg=15
highlight Type guifg=#111111 guibg=#fbfbfb ctermfg=0 ctermbg=15
highlight StorageClass guifg=#994cc3 guibg=#fbfbfb gui=italic ctermfg=5 ctermbg=15 cterm=italic
highlight Structure guifg=#111111 guibg=#fbfbfb ctermfg=0 ctermbg=15
highlight Typedef guifg=#111111 guibg=#fbfbfb ctermfg=0 ctermbg=15
highlight Special guifg=#aa0982 guibg=#fbfbfb ctermfg=5 ctermbg=15
highlight SpecialChar guifg=#aa0982 guibg=#fbfbfb ctermfg=5 ctermbg=15
highlight Tag guifg=#994cc3 guibg=#fbfbfb ctermfg=5 ctermbg=15
highlight Delimiter guifg=#5f7e97 guibg=#fbfbfb ctermfg=8 ctermbg=15
highlight SpecialComment guifg=#989fb1 guibg=#fbfbfb gui=italic ctermfg=7 ctermbg=15 cterm=italic
highlight Debug guifg=#e64d49 guibg=#fbfbfb ctermfg=1 ctermbg=15
highlight Underlined guifg=#4876d6 guibg=#fbfbfb gui=underline ctermfg=4 ctermbg=15 cterm=underline
highlight Ignore guifg=#d9d9d9 guibg=#fbfbfb ctermfg=7 ctermbg=15
highlight Error guifg=#e64d49 guibg=#fbfbfb gui=underline ctermfg=1 ctermbg=15 cterm=underline
highlight Todo guifg=#994cc3 guibg=#d3e8f8 gui=bold ctermfg=5 ctermbg=7 cterm=bold

" Diffs and diagnostics
highlight DiffAdd guifg=#0c696e guibg=#d7f3ef ctermfg=6 ctermbg=15
highlight DiffChange guifg=#4876d6 guibg=#e3eff8 ctermfg=4 ctermbg=15
highlight DiffDelete guifg=#bc5454 guibg=#f9dfdf ctermfg=1 ctermbg=15
highlight DiffText guifg=#403f53 guibg=#cdebf7 gui=bold ctermfg=8 ctermbg=7 cterm=bold
highlight SpellBad guisp=#e64d49 gui=undercurl cterm=underline
highlight SpellCap guisp=#4876d6 gui=undercurl cterm=underline
highlight SpellLocal guisp=#0c969b gui=undercurl cterm=underline
highlight SpellRare guisp=#994cc3 gui=undercurl cterm=underline

let g:terminal_ansi_colors = [
    \ '#403f53', '#e64d49', '#0c969b', '#daaa01',
    \ '#4876d6', '#994cc3', '#2aa298', '#f0f0f0',
    \ '#90a7b2', '#f76e6e', '#49d0c5', '#e0af02',
    \ '#6fbef6', '#aa0982', '#cdebf7', '#fbfbfb'
    \ ]
