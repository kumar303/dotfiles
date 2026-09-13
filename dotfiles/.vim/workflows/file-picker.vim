function! OpenFileResults(lines)
    if len(a:lines) < 2
        return
    endif
    let file = a:lines[1]
    if file !~# '^/'
        let file = g:fzf_file_picker_root . '/' . file
    endif
    execute dotfiles#fzf#open_command(a:lines[0]) . ' ' . fnameescape(file)
endfunction

command! Files call fzf#run(fzf#wrap('files', {'dir': g:fzf_file_picker_root, 'source': $FZF_DEFAULT_COMMAND, 'sink*': function('OpenFileResults'), 'options': g:fzf_open_options}))

nnoremap <silent> <C-p> :Files<CR>
" Leave netrw before opening fzf to avoid conflicts when fzf returns.
autocmd FileType netrw nnoremap <buffer> <silent> <C-p> :enew<CR>:Files<CR>
