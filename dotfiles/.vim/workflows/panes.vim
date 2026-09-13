function! MoveCurrentFileWindow(direction)
    let source_window = win_getid()
    let target_window = win_getid(winnr(a:direction))
    if target_window == source_window
        return
    endif

    let source_buffer = bufnr()
    let source_view = winsaveview()
    call win_gotoid(target_window)
    execute 'hide buffer ' . source_buffer
    call win_gotoid(source_window)
    close
    call win_gotoid(target_window)
    call winrestview(source_view)
endfunction

nnoremap <silent> <C-M-Left> :call MoveCurrentFileWindow('h')<CR>
nnoremap <silent> <C-M-Right> :call MoveCurrentFileWindow('l')<CR>
nnoremap <silent> <C-\> :rightbelow vsplit<CR>
