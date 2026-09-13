function! dotfiles#fzf#open_command(key)
    return a:key ==# 'enter' && !empty(expand('%:p')) ? 'rightbelow vsplit' : 'edit'
endfunction

function! dotfiles#fzf#file_tool_layout()
    let pane_position = win_screenpos(0)
    let pane_width = winnr('$') == 1 ? max([1, float2nr((winwidth(0) - 1) / 2)]) : winwidth(0)
    let pane_height = winheight(0)
    let width = min([&columns, max([8, float2nr(pane_width * 0.95)])])
    let height = max([4, float2nr(pane_height * 0.8)])
    let leftmost = pane_position[1] == 1
    let side = leftmost ? 'right' : 'left'
    let col = leftmost ? pane_position[1] + pane_width + 1 : pane_position[1] - width - 1
    let col = min([max([1, col]), max([1, &columns - width + 1])])
    let row = min([pane_position[0], max([1, &lines - height + 1])])
    let x_range = max([1, &columns - width])
    let y_range = max([1, &lines - height])
    let triangle_col = side ==# 'right' ? col : col + width - 1
    return {
        \ 'border': 'sharp',
        \ 'col': col,
        \ 'height': height,
        \ 'pane_col': pane_position[1],
        \ 'pane_height': pane_height,
        \ 'pane_width': pane_width,
        \ 'row': row,
        \ 'side': side,
        \ 'triangle': side ==# 'right' ? '◀' : '▶',
        \ 'triangle_col': triangle_col,
        \ 'width': width,
        \ 'xoffset': (col - 1) * 1.0 / x_range,
        \ 'yoffset': (row - 1) * 1.0 / y_range,
        \ }
endfunction
