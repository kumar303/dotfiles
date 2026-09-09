# Dotfiles

This is my setup for [Herdr](https://github.com/ogulcancelik/herdr) and Vim in [Ghostty](https://ghostty.org/).

See [pie](https://github.com/kumar303/pie) for `pi` configuration.

# 📹

<details>
<summary>Demo screencast</summary>

https://github.com/user-attachments/assets/2d99c01b-bbeb-4ee6-b818-1d7eaf472ec6

</details>

## Setup

Required: Node.js, Vim, Ghostty, and Herdr.

1. Install the Herdr skill:

   ```sh
   npx skills add ogulcancelik/herdr
   ```

2. Link the tracked dotfiles and plugins, then reload Herdr:

   ```sh
   npm install
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

| Scope | Key      | Action                           |
| ----- | -------- | -------------------------------- |
| Vim   | `ctrl+p` | Open a file finder palette       |
| Vim   | `ctrl+l` | List code symbols in the file    |
| Vim   | `ctrl+g` | Open the line on GitHub's `main` |
| Vim   | `ctrl+j` | Open the import under the cursor |
| Vim   | `ctrl+s` | Save the file                    |

### Panes

| Scope | Key                   | Action                             |
| ----- | --------------------- | ---------------------------------- |
| Vim   | `ctrl+w`, `v/s`       | Open a vertical / horizontal split |
| Vim   | `ctrl+w`, `c`         | Close the split                    |
| Vim   | `ctrl+w`, `h/j/k/l`   | Focus the left/down/up/right split |
| Vim   | `ctrl+w`, `w`         | Focus the next split               |
| Vim   | `ctrl+cmd+left/right` | Move the file left/right           |
| Vim   | `ctrl+backslash`      | Duplicate in a right split         |

### Searching

| Scope | Key      | Action                                 |
| ----- | -------- | -------------------------------------- |
| Vim   | `ctrl+r` | Ripgrep through Vim's launch directory |
| Vim   | `ctrl+f` | Find text in the current file          |
| Vim   | `space`  | Clear search highlighting              |

## Vim

Install [fzf](https://github.com/junegunn/fzf),
[fd](https://github.com/sharkdp/fd),
[ripgrep](https://github.com/BurntSushi/ripgrep), and
[Universal Ctags](https://github.com/universal-ctags/ctags):

```sh
brew install fzf fd ripgrep universal-ctags jq
```

In `ctrl+p` and `ctrl+r` results, `enter` opens a right split when the current
split has a file. `ctrl+enter` reuses the current split.

Select text with `v`, then press `ctrl+r` to use it as the search term.
`ctrl+r` and `ctrl+f` can also pass any ripgrep option. Example of searching for
the text `authorization`:

```vim
:Rg -g'!**/*test*' authorization
:RgFile authorization
```

## Vim pane toggle

`ctrl+backtick` closes Vim when it hides the pane. Save changes before hiding
it.

## Development

```sh
npm install
npm test
npm run typecheck
npm run format
```
