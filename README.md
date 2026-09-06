# Dotfiles

Personal configuration for Vim, Git, [Ghostty](https://ghostty.org/), and
[Herdr](https://github.com/ogulcancelik/herdr).

## Setup

Required: Node.js, Vim, Ghostty, and Herdr.

1. Install the Herdr skill:

   ```sh
   npx skills add ogulcancelik/herdr
   ```

2. Link the tracked dotfiles and plugin, then reload Herdr:

   ```sh
   ./setup.sh
   ```

The setup script recursively links each file under [`dotfiles`](dotfiles) to the
matching path under `~/`. It prompts before replacing existing files. Run it
again when this repository adds a dotfile.

### Manual setup

Add this `[include]` section to `.gitconfig`:

```gitconfig
[include]
    path = ~/.gitconfig.defaults
```

## Key bindings

### Terminal

| Scope | Key                 | Action                            |
| ----- | ------------------- | --------------------------------- |
| Herdr | `cmd+opt+backtick`  | Create a terminal tab             |
| Herdr | `ctrl+cmd+backtick` | Select the next terminal tab      |
| Herdr | `cmd+shift+k`       | Close the terminal tab            |
| Herdr | `ctrl+backtick`     | Show, hide, or focus the Vim pane |

### File navigation

| Scope | Key      | Action                     |
| ----- | -------- | -------------------------- |
| Vim   | `ctrl+p` | Open a file finder palette |
| Vim   | `ctrl+s` | Save the file              |

### Panes

| Scope | Key                 | Action                             |
| ----- | ------------------- | ---------------------------------- |
| Vim   | `ctrl+w`, `v/s`     | Open a vertical / horizontal split |
| Vim   | `ctrl+w`, `c`       | Close the split                    |
| Vim   | `ctrl+w`, `h/j/k/l` | Focus the left/down/up/right split |
| Vim   | `ctrl+w`, `w`       | Focus the next split               |

### Searching

| Scope | Key      | Action                                 |
| ----- | -------- | -------------------------------------- |
| Vim   | `ctrl+r` | Ripgrep through Vim's launch directory |
| Vim   | `ctrl+f` | Find text in the current file          |

## Vim

Install [fzf](https://github.com/junegunn/fzf),
[fd](https://github.com/sharkdp/fd), and
[ripgrep](https://github.com/BurntSushi/ripgrep):

```sh
brew install fzf fd ripgrep
```

`ctrl+r` and `ctrl+f` can pass any ripgrep option. Example of searching for the
text `authorization`:

```vim
:Rg authorization
:RgFile authorization
:Rg authorization -g'!**/*test*'
```

## Vim pane toggle

The local [`split-vim-above`](plugins/split-vim-above) plugin keeps one Vim pane
per working directory and workspace. It parks the running pane in an inactive
Herdr tab, then moves the same pane above the focused pane when reopened. The
pane takes 80% of the split and leaves unrelated Vim panes alone.

## Development

```sh
npm install
npm test
npm run typecheck
npm run format
```
