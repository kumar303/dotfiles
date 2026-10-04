function! PreviewMarkdown() abort
    let file = expand('%:p')
    if empty(file) || !filereadable(file)
        echoerr 'Current buffer is not a readable file'
        return
    endif
    let node = exepath('node')
    if empty(node)
        echoerr 'Node.js is not available'
        return
    endif
    let command = [node, g:vim_dotfiles_directory . '/.vim/bin/markdown-preview/server.js', 'start', file]
    let output = system(join(map(command, 'shellescape(v:val)'), ' '))
    if v:shell_error
        echoerr empty(output) ? 'Cannot start Markdown preview' : trim(output)
    endif
endfunction

nnoremap <silent> <C-m> :call PreviewMarkdown()<CR>
