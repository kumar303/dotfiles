function! OpenFileSwitcherWorkspace()
    let workspace = resolve(fnamemodify(g:fzf_file_picker_root, ':p'))
    return workspace ==# '/' ? workspace : substitute(workspace, '/$', '', '')
endfunction

function! OpenFileSwitcherStateDirectory()
    return empty($VIM_OPEN_FILE_SWITCHER_STATE_DIR)
        \ ? expand('~/.cache/vim-open-file-switcher')
        \ : $VIM_OPEN_FILE_SWITCHER_STATE_DIR
endfunction

function! OpenFileSwitcherStatePath()
    return OpenFileSwitcherStateDirectory() . '/' . sha256(OpenFileSwitcherWorkspace()) . '.json'
endfunction

function! OpenFileSwitcherRecentFiles()
    let state_path = OpenFileSwitcherStatePath()
    if !filereadable(state_path)
        return []
    endif
    try
        let state = json_decode(join(readfile(state_path), "\n"))
    catch
        return []
    endtry
    if type(state) != v:t_dict
        \ || get(state, 'workspace', '') !=# OpenFileSwitcherWorkspace()
        \ || type(get(state, 'files', 0)) != v:t_list
        return []
    endif

    let files = []
    for stored_file in state.files
        if type(stored_file) != v:t_string
            continue
        endif
        let file = resolve(fnamemodify(stored_file, ':p'))
        if filereadable(file) && index(files, file) < 0
            call add(files, file)
        endif
        if len(files) == 10
            break
        endif
    endfor
    return files
endfunction

function! SaveOpenFileSwitcherRecentFiles(files)
    let state_directory = OpenFileSwitcherStateDirectory()
    call mkdir(state_directory, 'p', 0700)
    let state_path = OpenFileSwitcherStatePath()
    let temporary_path = state_path . '.tmp.' . getpid()
    let state = {'workspace': OpenFileSwitcherWorkspace(), 'files': a:files[:9]}
    try
        call writefile([json_encode(state)], temporary_path)
        if rename(temporary_path, state_path) != 0
            throw 'Cannot save Vim open-file history'
        endif
    finally
        call delete(temporary_path)
    endtry
endfunction

function! RecordOpenFileSwitcherFile()
    if &buftype !=# ''
        return
    endif
    let file = resolve(fnamemodify(expand('%:p'), ':p'))
    if empty(file) || !filereadable(file)
        return
    endif
    let files = [file]
    for recent_file in OpenFileSwitcherRecentFiles()
        if recent_file !=# file
            call add(files, recent_file)
        endif
        if len(files) == 10
            break
        endif
    endfor
    call SaveOpenFileSwitcherRecentFiles(files)
endfunction

function! OpenFileSwitcherDisplayPath(file)
    let workspace = OpenFileSwitcherWorkspace()
    let prefix = workspace ==# '/' ? workspace : workspace . '/'
    return stridx(a:file, prefix) == 0
        \ ? strpart(a:file, strlen(prefix))
        \ : fnamemodify(a:file, ':~')
endfunction

function! OpenFileSwitcherState()
    let previous_window = win_getid(winnr('#'))
    let current_window = win_getid()
    let entries = []
    let open_files = {}
    let previous_position = 0
    let current_position = 1
    for window in getwininfo()
        if window.tabnr != tabpagenr()
            continue
        endif
        let file = resolve(fnamemodify(bufname(window.bufnr), ':p'))
        if empty(file) || !filereadable(file)
            continue
        endif
        let open_files[file] = 1
        call add(entries, printf("%d\t%s\t%s", window.winid, file, OpenFileSwitcherDisplayPath(file)))
        if window.winid == previous_window
            let previous_position = len(entries)
        elseif window.winid == current_window
            let current_position = len(entries)
        endif
    endfor
    for file in OpenFileSwitcherRecentFiles()
        if !has_key(open_files, file)
            call add(entries, printf("0\t%s\t%s", file, OpenFileSwitcherDisplayPath(file)))
        endif
    endfor
    return {'entries': entries, 'position': previous_position > 0 ? previous_position : current_position}
endfunction

function! OpenFileSwitcherResults(lines)
    if len(a:lines) < 2
        return
    endif
    let fields = split(a:lines[1], "\t", 1)
    if len(fields) < 2
        return
    endif
    let window_id = str2nr(fields[0])
    let file = fields[1]
    if a:lines[0] ==# 'enter'
        if window_id > 0 && win_id2win(window_id) > 0
            call win_gotoid(window_id)
        elseif filereadable(file)
            execute dotfiles#fzf#open_command('enter') . ' ' . fnameescape(file)
        endif
    elseif a:lines[0] ==# 'x' && window_id > 0 && win_id2win(window_id) > 0
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
        echo 'No open or recent files'
        return
    endif
    let options = g:fzf_picker_options + [
        \ '--bind=load:pos(' . state.position . ')',
        \ '--delimiter=\t',
        \ '--expect=enter,x',
        \ '--footer=↑/↓ select  •  enter open  •  x close  •  esc close',
        \ '--footer-border=none',
        \ '--prompt=File> ',
        \ '--with-nth=3..',
        \ ]
    call fzf#run(fzf#wrap('open-files', {
        \ 'options': options,
        \ 'sink*': function('OpenFileSwitcherResults'),
        \ 'source': state.entries,
        \ 'window': {'width': 0.8, 'height': min([14, len(state.entries) + 4])},
        \ }))
endfunction
command! OpenFiles call OpenFileSwitcher()

augroup open_file_switcher_history
    autocmd!
    autocmd BufEnter,BufWritePost * call RecordOpenFileSwitcherFile()
augroup END

nnoremap <silent> <C-Tab> :OpenFiles<CR>
