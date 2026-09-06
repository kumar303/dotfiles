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
again when this repository adds a dotfile. Herdr's runtime files remain
untouched.
Add this `[include]` section to `.gitconfig`:

```gitconfig
[include]
    path = ~/.gitconfig.defaults
```

[View the Herdr configuration](dotfiles/.config/herdr/config.toml).

The setup script links the tracked
[Ghostty configuration](dotfiles/.config/ghostty/config.ghostty) to
`~/.config/ghostty/config.ghostty`. It maps `Option+Backspace` to `Control+W`
before the key reaches Herdr.

## Key bindings

Herdr's prefix is `Control+B`. Press and release the prefix before its next key.

### File navigation

| Scope | Key                        | Action                           |
| ----- | -------------------------- | -------------------------------- |
| Herdr | `Command+Option+Backtick`  | Create a terminal tab            |
| Herdr | `Control+Command+Backtick` | Select the next terminal tab     |
| Herdr | `Control+B`, `p`           | Select the previous terminal tab |
| Herdr | `Command+Shift+K`          | Close the terminal tab           |
| Vim   | `Control+P`                | Find and open a file             |
| Vim   | `Control+S`                | Save the file                    |

### Panes

| Scope | Key                    | Action                                       |
| ----- | ---------------------- | -------------------------------------------- |
| Herdr | `Control+Backtick`     | Show, hide, or focus the Vim pane            |
| Herdr | `Control+B`, `Shift+E` | Show, hide, or focus the Vim pane (fallback) |
| Herdr | `Control+B`, `v` / `-` | Open a vertical / horizontal split           |
| Herdr | `Control+B`, `x`       | Close the focused pane                       |
| Herdr | `Control+B`, `h/j/k/l` | Focus the left/down/up/right pane            |
| Vim   | `Control+W`, `v/s`     | Open a vertical / horizontal split           |
| Vim   | `Control+W`, `c`       | Close the split                              |
| Vim   | `Control+W`, `h/j/k/l` | Focus the left/down/up/right split           |

### Searching

| Scope | Key         | Action                                    |
| ----- | ----------- | ----------------------------------------- |
| Vim   | `Control+R` | Search files under Vim's launch directory |
| Vim   | `Control+F` | Search only the current file              |

## Vim

Install [fzf](https://github.com/junegunn/fzf),
[fd](https://github.com/sharkdp/fd), and
[ripgrep](https://github.com/BurntSushi/ripgrep):

```sh
brew install fzf fd ripgrep
```

The Homebrew `fzf` package includes the Vim integration used by `.vimrc`. No
separate Vim plugin checkout is needed.

Press `Control+S` to save in normal or insert mode. Saving in insert mode keeps
Vim in insert mode.

Press `Control+P` in Vim to fuzzy-find files under the directory where Vim
started. Splits and buffer changes do not change this root. The launcher includes
hidden files, respects `.gitignore`, and omits `.git` directories.

Press `Control+R` in a file or netrw directory view to enter `:Rg `. Add the
search pattern and optional ripgrep arguments, then press Enter. Use the arrow
keys to select a result and Enter to open it. The search uses Vim's launch
directory and respects `.gitignore`.

Press `Control+F` to enter `:RgFile ` and search only the current file. This
replaces Vim's default page-forward shortcut.

```vim
:Rg authentication
:Rg authentication -g '!**/*test*'
:Rg authentication -g'*.js' -g'!**/*test*'
```

Use ripgrep's short `-g` flag instead of `--glob`. The glob can follow `-g`
directly, as in `-g'!**/*test*'`.

## Vim pane toggle

The local [`split-vim-above`](plugins/split-vim-above) plugin keeps one Vim pane
per working directory and workspace. It parks the running pane in an inactive
Herdr tab, then moves the same pane above the focused pane when reopened. The
pane takes 80% of the split and leaves unrelated Vim panes alone.

Session metadata lives in Herdr's isolated `HERDR_PLUGIN_STATE_DIR`. The plugin
owns its JSON records and locks; Herdr owns the state directory location.

## Development

```sh
npm install
npm test
npm run typecheck
npm run format
```
