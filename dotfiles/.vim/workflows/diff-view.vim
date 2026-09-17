sign define ViewDiffAdd text=+ texthl=DiffAdd
sign define ViewDiffChange text=~ texthl=DiffChange

function! ViewDiffCommand(arguments)
    let node = exepath('node')
    if empty(node)
        return ''
    endif
    let command = [node, g:vim_dotfiles_directory . '/.vim/bin/view-diff-in-vim.js'] + a:arguments
    return system(join(map(command, "shellescape('' . v:val)"), ' '))
endfunction

function! DiffViewPopupWindow(content_height)
    let layout = dotfiles#fzf#file_tool_layout()
    return {
        \ 'border': layout.border,
        \ 'height': min([layout.height, max([4, a:content_height])]),
        \ 'width': layout.width,
        \ 'xoffset': layout.xoffset,
        \ 'yoffset': layout.yoffset,
        \ }
endfunction

function! DiffViewLocationPopupWindow()
    let layout = dotfiles#fzf#file_tool_layout()
    return {
        \ 'border': layout.border,
        \ 'height': min([&lines - 1, max([4, float2nr(&lines * 0.98)])]),
        \ 'width': layout.width,
        \ 'xoffset': layout.xoffset,
        \ 'yoffset': 0.5,
        \ }
endfunction

function! DiffViewPreviewCommand()
    return 'cat {5} | delta --paging=never --file-style=omit --width "$FZF_PREVIEW_COLUMNS"'
endfunction

function! CleanupDiffViewPreviews()
    if exists('g:diff_view_preview_directory')
        call delete(g:diff_view_preview_directory, 'rf')
        unlet g:diff_view_preview_directory
    endif
endfunction

function! PrepareDiffViewPreviews(view)
    call CleanupDiffViewPreviews()
    let g:diff_view_preview_directory = tempname()
    call mkdir(g:diff_view_preview_directory, 'p', 0700)
    let index = 1
    for location in a:view.locations
        let location.preview = g:diff_view_preview_directory . '/' . index . '.diff'
        call writefile(split(location.hunk, "\n", 1), location.preview)
        let index += 1
    endfor
endfunction

function! DiffViewExit(code)
    call CleanupDiffViewPreviews()
    call timer_start(0, function('RemoveFzfOverlayMarker'))
endfunction

function! DiffViewLocationOptions(view)
    let test_action = get(a:view, 'hideTests', 0) ? 'unhide tests' : 'hide tests'
    let search_action = shellescape(g:vim_dotfiles_directory . '/.vim/bin/diff-view-search-action')
    return g:fzf_picker_options + [
        \ '--bind=load:pos(' . a:view.position . ')',
        \ '--bind=/:transform:' . search_action,
        \ '--bind=down:transform:' . search_action,
        \ '--bind=esc:transform:' . search_action,
        \ '--bind=t:transform:' . search_action,
        \ '--bind=X:transform:' . search_action,
        \ '--delimiter=\t',
        \ '--disabled',
        \ '--expect=enter',
        \ '--footer=↑/↓ select  •  / search  •  enter open  •  t ' . test_action . '  •  X exit diff  •  esc close',
        \ '--footer-border=none',
        \ '--preview=' . DiffViewPreviewCommand(),
        \ '--preview-window=down,70%,border-top,wrap,noinfo',
        \ '--prompt=Change> ',
        \ '--with-nth=6..',
        \ ]
endfunction

function! DiffViewEntries(view)
    let entries = []
    let index = 1
    for location in a:view.locations
        let text = substitute(location.text, '\t', ' ', 'g')
        call add(entries, printf("%d\t%s\t%d\t%s\t%s\t%s:%d  %s", index, location.path, location.line, location.kind, get(location, 'preview', ''), location.path, location.line, text))
        let index += 1
    endfor
    return entries
endfunction

function! OpenDiffLocation(location)
    let root = resolve(get(g:, 'fzf_file_picker_root', getcwd()))
    let file = root . '/' . a:location.path
    if !filereadable(file)
        echo 'Changed file no longer exists: ' . a:location.path
        return
    endif

    let buffer = bufnr(file)
    let target_window = 0
    if buffer >= 0
        for window_id in win_findbuf(buffer)
            if win_id2tabwin(window_id)[0] == tabpagenr()
                let target_window = window_id
                break
            endif
        endfor
    endif
    if target_window > 0
        call win_gotoid(target_window)
    elseif resolve(expand('%:p')) !=# resolve(file)
        execute 'rightbelow vsplit ' . fnameescape(file)
    endif
    call cursor(min([max([1, a:location.line]), line('$')]), 1)
    normal! zt
endfunction

function! ApplyDiffSigns(view)
    call sign_unplace('view-diff-in-vim')
    let root = resolve(get(g:, 'fzf_file_picker_root', getcwd()))
    let sign_id = 1
    for sign in a:view.signs
        let file = root . '/' . sign.path
        if !filereadable(file)
            continue
        endif
        let buffer = bufadd(file)
        call bufload(buffer)
        let name = sign.kind ==# 'add' ? 'ViewDiffAdd' : 'ViewDiffChange'
        call sign_place(sign_id, 'view-diff-in-vim', name, buffer, {'lnum': sign.line, 'priority': 10})
        let sign_id += 1
    endfor
endfunction

function! ApplyDiffView(view)
    let g:view_diff_view = a:view
    call ApplyDiffSigns(a:view)
    let root = resolve(get(g:, 'fzf_file_picker_root', getcwd()))
    for location in a:view.locations
        if filereadable(root . '/' . location.path)
            call OpenDiffLocation(location)
            return
        endif
    endfor
endfunction

function! ClearDiffView()
    let output = ViewDiffCommand(['clear', g:fzf_file_picker_root])
    call sign_unplace('view-diff-in-vim')
    unlet! g:view_diff_view
    if v:shell_error
        echoerr empty(output) ? 'Cannot clear the Vim diff view' : trim(output)
    endif
endfunction

function! ReopenDiffView(timer)
    call OpenDiffView()
endfunction

function! ToggleDiffViewTests()
    let output = ViewDiffCommand(['toggle-tests', g:fzf_file_picker_root])
    if v:shell_error
        echoerr empty(output) ? 'Cannot toggle test files in the Vim diff view' : trim(output)
        return
    endif
    call timer_start(0, function('ReopenDiffView'))
endfunction

function! DiffViewResults(lines)
    let action = get(a:lines, 0, '')
    let selected_index = 1
    if empty(action) && index(['X', 't'], get(a:lines, 1, '')) >= 0
        let action = a:lines[1]
        let selected_index = 2
    endif
    if action ==# 'X'
        call ClearDiffView()
        return
    endif
    if action ==# 't'
        call ToggleDiffViewTests()
        return
    endif
    if len(a:lines) <= selected_index || action !=# 'enter'
        return
    endif
    let fields = split(a:lines[selected_index], "\t", 1)
    if len(fields) < 4
        return
    endif
    call OpenDiffLocation({'path': fields[1], 'line': str2nr(fields[2])})
endfunction

function! StartDiffView(line)
    let mode = matchstr(a:line, '^[^\t]\+')
    let output = ViewDiffCommand(['start', g:fzf_file_picker_root, mode])
    if v:shell_error || empty(output)
        echoerr empty(output) ? 'Cannot start the Vim diff view' : trim(output)
        return
    endif
    let view = json_decode(output)
    if empty(view.locations)
        echo 'No changed locations'
        return
    endif
    call ApplyDiffView(view)
endfunction

function! OpenDiffChoices()
    let output = ViewDiffCommand(['choices', g:fzf_file_picker_root])
    if v:shell_error || empty(output)
        echoerr empty(output) ? 'Cannot find Git diffs' : trim(output)
        return
    endif
    let choices = map(json_decode(output), 'v:val.id . "\t" . v:val.label')
    let options = g:fzf_picker_options + [
        \ '--delimiter=\t',
        \ '--prompt=Diff> ',
        \ '--with-nth=2..',
        \ ]
    call ActivateFzfOverlay()
    call fzf#run(fzf#wrap('diff-kind', {
        \ 'exit': function('DiffViewExit'),
        \ 'options': options,
        \ 'sink': function('StartDiffView'),
        \ 'source': choices,
        \ 'window': DiffViewPopupWindow(len(choices) + 4),
        \ }))
endfunction

function! OpenDiffView()
    if !filereadable(expand('%:p'))
        enew
    endif
    let output = ViewDiffCommand(['refresh', g:fzf_file_picker_root, expand('%:p'), line('.')])
    if v:shell_error || empty(output)
        echoerr empty(output) ? 'Cannot refresh the Vim diff view' : trim(output)
        return
    endif
    let view = json_decode(output)
    if !get(view, 'active', 0)
        call OpenDiffChoices()
        return
    endif
    let g:view_diff_view = view
    call ApplyDiffSigns(view)
    if empty(view.locations) && !get(view, 'hideTests', 0)
        echo 'No changed locations'
        return
    endif
    call PrepareDiffViewPreviews(view)
    let entries = DiffViewEntries(view)
    call ActivateFzfOverlay()
    call fzf#run(fzf#wrap('diff-locations', {
        \ 'exit': function('DiffViewExit'),
        \ 'options': DiffViewLocationOptions(view),
        \ 'sink*': function('DiffViewResults'),
        \ 'source': entries,
        \ 'window': DiffViewLocationPopupWindow(),
        \ }))
endfunction

nnoremap <silent> <C-M-d> :call OpenDiffView()<CR>
