" Reload external changes only outside Insert mode, without replacing unsaved edits.
function! HandleExternalFileChange() abort
    let buffer = str2nr(expand('<abuf>'))
    if get(g:, 'dotfiles_insert_mode', 0)
        if v:fcs_reason ==# 'changed'
            call setbufvar(buffer, 'dotfiles_pending_reload', 1)
        endif
    elseif v:fcs_reason ==# 'changed' && !getbufvar(buffer, '&modified')
        let v:fcs_choice = 'reload'
    else
        let v:fcs_choice = 'ask'
    endif
endfunction

function! CheckExternalFileChanges() abort
    if get(g:, 'dotfiles_insert_mode', 0)
        return
    endif
    if get(b:, 'dotfiles_pending_reload', 0) && !&modified && filereadable(expand('%:p'))
        unlet b:dotfiles_pending_reload
        edit
    endif
    checktime
endfunction

augroup dotfiles_external_file_reload
    autocmd!
    autocmd FileChangedShell * call HandleExternalFileChange()
    autocmd FocusGained,BufEnter,CursorHold * if mode() ==# 'n' | call CheckExternalFileChanges() | endif
    autocmd InsertEnter * let g:dotfiles_insert_mode = 1
    autocmd InsertLeave * let g:dotfiles_insert_mode = 0 | call CheckExternalFileChanges()
    autocmd BufReadPost,BufWritePost * unlet! b:dotfiles_pending_reload
augroup END
