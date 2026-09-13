function! OpenFileSwitcherState()
    let previous_window = win_getid(winnr('#'))
    let current_window = win_getid()
    let entries = []
    let previous_position = 0
    let current_position = 1
    for window in getwininfo()
        if window.tabnr != tabpagenr()
            continue
        endif
        let file = fnamemodify(bufname(window.bufnr), ':p')
        if empty(file) || !filereadable(file)
            continue
        endif
        call add(entries, printf("%d\t%s", window.winid, fnamemodify(file, ':~:.')))
        if window.winid == previous_window
            let previous_position = len(entries)
        elseif window.winid == current_window
            let current_position = len(entries)
        endif
    endfor
    return {'entries': entries, 'position': previous_position > 0 ? previous_position : current_position}
endfunction

function! OpenFileSwitcherResults(lines)
    if len(a:lines) < 2
        return
    endif
    let window_id = str2nr(matchstr(a:lines[1], '^\d\+'))
    if window_id == 0 || win_id2win(window_id) == 0
        return
    endif
    if a:lines[0] ==# 'enter'
        call win_gotoid(window_id)
    elseif a:lines[0] ==# 'x'
        let buffer = winbufnr(window_id)
        if winnr('$') > 1
            call win_execute(window_id, 'close')
        else
            call win_execute(window_id, 'enew')
            execute 'bdelete ' . buffer
        endif
    endif
endfunction

function! OpenFileSwitcher()
    let state = OpenFileSwitcherState()
    if empty(state.entries)
        echo 'No open files'
        return
    endif
    let options = g:fzf_picker_options + [
        \ '--bind=load:pos(' . state.position . ')',
        \ '--delimiter=\t',
        \ '--expect=enter,x',
        \ '--footer=↑/↓ select  •  enter focus  •  x close  •  esc close',
        \ '--footer-border=none',
        \ '--prompt=File> ',
        \ '--with-nth=2..',
        \ ]
    call fzf#run(fzf#wrap('open-files', {
        \ 'options': options,
        \ 'sink*': function('OpenFileSwitcherResults'),
        \ 'source': state.entries,
        \ 'window': {'width': 0.8, 'height': min([9, len(state.entries) + 4])},
        \ }))
endfunction
command! OpenFiles call OpenFileSwitcher()

nnoremap <silent> <C-Tab> :OpenFiles<CR>
