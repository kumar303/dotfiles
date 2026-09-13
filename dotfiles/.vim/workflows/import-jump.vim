function! ImportAtCursor()
    let cursor_line = line('.')
    let start_line = cursor_line
    while start_line >= 1 && getline(start_line) !~# '^\s*import\>'
        let start_line -= 1
    endwhile
    if start_line < 1
        return {}
    endif

    let end_line = start_line
    while end_line < line('$') && getline(end_line) !~# ';\s*$'
        let end_line += 1
    endwhile
    if cursor_line > end_line
        return {}
    endif

    let statement = join(getline(start_line, end_line), ' ')
    let specifier = matchstr(statement, '\<from\s*[''"]\zs[^''"]\+\ze[''"]')
    if empty(specifier)
        let specifier = matchstr(statement, '^\s*import\s*[''"]\zs[^''"]\+\ze[''"]')
    endif

    let symbol = expand('<cword>')
    let alias = matchlist(statement, '\<\(\k\+\)\s\+as\s\+' . symbol . '\>')
    if !empty(alias)
        let symbol = alias[1]
    endif
    return {'specifier': specifier, 'symbol': symbol}
endfunction

function! ImportedSymbolLine(file, symbol)
    if empty(a:symbol)
        return 1
    endif
    let output = systemlist('ctags --output-format=json --fields=+nK --extras=-F --excmd=number --sort=no -f - ' . shellescape(a:file))
    if v:shell_error
        return 1
    endif
    for item in output
        try
            let tag = json_decode(item)
        catch
            continue
        endtry
        if get(tag, '_type', '') ==# 'tag' && get(tag, 'name', '') ==# a:symbol && has_key(tag, 'line')
            return tag.line
        endif
    endfor
    return 1
endfunction

function! JumpToImport()
    let import = ImportAtCursor()
    if empty(import) || empty(import.specifier)
        echo 'No import found'
        return
    endif

    let source_file = expand('%:p')
    let specifier = import.specifier
    let symbol = import.symbol
    let resolver = g:vim_dotfiles_directory . '/.vim/bin/import-resolver.js'
    let output = systemlist('node ' . shellescape(resolver) . ' ' . shellescape(source_file) . ' ' . shellescape(specifier))
    if v:shell_error || empty(output)
        echoerr empty(output) ? 'Could not resolve import' : join(output, ' ')
        return
    endif

    let target_file = output[0]
    execute 'rightbelow vsplit ' . fnameescape(target_file)
    call cursor(ImportedSymbolLine(target_file, symbol), 1)
    normal! zz
endfunction

augroup import_jump
    autocmd!
    autocmd FileType javascript,javascriptreact,typescript,typescriptreact nnoremap <buffer> <silent> <C-j> :call JumpToImport()<CR>
augroup END
