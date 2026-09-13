function! CurrentFileSymbols()
    let file = expand('%:p')
    if !filereadable(file)
        echoerr 'Current buffer is not a readable file'
        return []
    endif
    let command = 'ctags --output-format=json --fields=+nK --extras=-F --excmd=number --sort=no -f -'
    if file =~# '\.jsx\?$'
        let test_regex = '--regex-JavaScript=/^[ \t]*(describe|it|test)(\.(only|skip|todo))?[ \t]*\([ \t]*["'']([^"'']+)/\4/t,test/'
        let command .= ' ' . shellescape(test_regex)
    elseif file =~# '\.tsx\?$'
        let test_regex = '--regex-TypeScript=/^[ \t]*(describe|it|test)(\.(only|skip|todo))?[ \t]*\([ \t]*["'']([^"'']+)/\4/t,test/'
        let method_regex = '--regex-TypeScript=/^  (async[ \t]+)?(#?[A-Za-z_$][A-Za-z0-9_$#]*)[ \t]*\([^)]*\)[ \t]*:[^{]+\{/\2/m,method/'
        let command .= ' ' . shellescape(test_regex) . ' ' . shellescape(method_regex)
    endif
    let output = systemlist(command . ' ' . shellescape(file))
    if v:shell_error
        echoerr join(output, ' ')
        return []
    endif

    let symbols = []
    let seen = {}
    for line in output
        try
            let tag = json_decode(line)
        catch
            continue
        endtry
        let kind = get(tag, 'kind', '')
        let key = printf('%d:%s:%s', get(tag, 'line', 0), kind, get(tag, 'name', ''))
        if get(tag, '_type', '') ==# 'tag' && has_key(tag, 'line') && index(['alias', 'constant', 'property', 'variable'], kind) == -1 && !has_key(seen, key)
            let seen[key] = 1
            call add(symbols, printf('%6d  %-12s %s', tag.line, kind, tag.name))
        endif
    endfor
    return symbols
endfunction

function! PositionSymbolWindow(window_id, line_number)
    let top_line = max([1, a:line_number - 4])
    call win_execute(a:window_id, 'call cursor(' . top_line . ', 1)')
    call win_execute(a:window_id, 'normal! zt')
    call win_execute(a:window_id, 'call cursor(' . a:line_number . ', 1)')

    if exists('g:symbol_picker_state') && get(g:symbol_picker_state, 'source_window', 0) == a:window_id
        let triangle_id = get(g:symbol_picker_state, 'triangle_id', 0)
        if triangle_id && !empty(popup_getpos(triangle_id))
            let position = screenpos(a:window_id, a:line_number, 1)
            if position.row > 0
                call popup_move(triangle_id, {'line': position.row, 'col': g:symbol_picker_state.triangle_col})
            endif
        endif
    endif
endfunction

function! OpenSymbol(line)
    let line_number = str2nr(matchstr(a:line, '^\s*\zs\d\+'))
    if line_number > 0
        let source_window = exists('g:symbol_picker_state') ? g:symbol_picker_state.source_window : win_getid()
        call PositionSymbolWindow(source_window, line_number)
    endif
endfunction

function! SymbolPosition(symbols, cursor_line)
    let position = 1
    for index in range(len(a:symbols))
        let symbol_line = str2nr(matchstr(a:symbols[index], '^\s*\zs\d\+'))
        if symbol_line > a:cursor_line
            break
        endif
        let position = index + 1
    endfor
    return position
endfunction

function! SymbolPreviewTick(timer)
    if !exists('g:symbol_picker_state') || !filereadable(g:symbol_picker_state.preview_file)
        return
    endif
    let lines = readfile(g:symbol_picker_state.preview_file, '', 1)
    let line_number = empty(lines) ? 0 : str2nr(lines[0])
    if line_number > 0 && line_number != g:symbol_picker_state.last_line
        let g:symbol_picker_state.last_line = line_number
        call PositionSymbolWindow(g:symbol_picker_state.source_window, line_number)
        redraw
    endif
endfunction

function! SymbolPickerExit(code)
    if !exists('g:symbol_picker_state')
        return
    endif
    call timer_stop(g:symbol_picker_state.timer)
    if get(g:symbol_picker_state, 'triangle_id', 0)
        call popup_close(g:symbol_picker_state.triangle_id)
    endif
    call delete(g:symbol_picker_state.preview_file)
    unlet g:symbol_picker_state
endfunction

function! Symbols()
    let cursor_line = line('.')
    let symbols = CurrentFileSymbols()
    if empty(symbols)
        echo 'No symbols found'
        return
    endif

    let position = SymbolPosition(symbols, cursor_line)
    let layout = dotfiles#fzf#file_tool_layout()
    let preview_file = tempname()
    let source_window = win_getid()
    call writefile([matchstr(symbols[position - 1], '^\s*\zs\d\+')], preview_file)
    let triangle_id = popup_create(layout.triangle, {
        \ 'col': layout.triangle_col,
        \ 'highlight': 'PmenuSel',
        \ 'line': layout.row + min([4, layout.height - 1]),
        \ 'maxheight': 1,
        \ 'maxwidth': 1,
        \ 'minheight': 1,
        \ 'minwidth': 1,
        \ 'padding': [0, 0, 0, 0],
        \ 'zindex': 1001,
        \ })
    let g:symbol_picker_state = {
        \ 'last_line': -1,
        \ 'preview_file': preview_file,
        \ 'source_window': source_window,
        \ 'triangle_col': layout.triangle_col,
        \ 'triangle_id': triangle_id,
        \ }
    let g:symbol_picker_state.timer = timer_start(30, function('SymbolPreviewTick'), {'repeat': -1})
    call SymbolPreviewTick(g:symbol_picker_state.timer)

    let focus_command = 'printf %s {1} > ' . shellescape(preview_file)
    let options = g:fzf_picker_options + [
        \ '--prompt=Symbol> ',
        \ '--bind=load:pos(' . position . ')',
        \ '--bind=focus:execute-silent(' . focus_command . ')',
        \ ]
    let popup_window = {
        \ 'border': layout.border,
        \ 'height': layout.height,
        \ 'width': layout.width,
        \ 'xoffset': layout.xoffset,
        \ 'yoffset': layout.yoffset,
        \ }
    call fzf#run(fzf#wrap('symbols', {
        \ 'exit': function('SymbolPickerExit'),
        \ 'options': options,
        \ 'sink': function('OpenSymbol'),
        \ 'source': symbols,
        \ 'window': popup_window,
        \ }))
endfunction
command! Symbols call Symbols()

nnoremap <silent> <C-l> :Symbols<CR>
