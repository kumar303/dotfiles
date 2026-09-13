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

nnoremap <silent> <C-g> :call OpenCurrentFileOnGitHub()<CR>
