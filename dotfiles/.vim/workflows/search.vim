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
    call OpenRipgrepResult(a:lines[1], dotfiles#fzf#open_command(a:lines[0]))
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
    return ":\<C-u>Rg --hidden -g'!**/*test*' " . term
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

nnoremap <C-f> :RgFile<Space>
nnoremap <C-r> :Rg --hidden -g'!**/*test*'<Space>
xnoremap <expr> <C-r> VisualRipgrepMapping()

" Leave netrw before opening fzf to avoid conflicts when fzf returns.
autocmd FileType netrw nnoremap <buffer> <C-r> :enew<CR>:Rg --hidden -g'!**/*test*'<Space>
