# Dotfiles

This is my setup for [Herdr](https://github.com/ogulcancelik/herdr) and Vim in [Ghostty](https://ghostty.org/).

See [pie](https://github.com/kumar303/pie) for `pi` configuration.

# 📹

<details>
<summary>Demo screencast</summary>

https://github.com/user-attachments/assets/8d40875d-a127-4aa3-a8f3-656202a1e64d

</details>

## Setup

Required: Node.js 22 or newer, Vim, Ghostty, and Herdr.

1. Install Vim dependencies: [fzf](https://github.com/junegunn/fzf),
   [fd](https://github.com/sharkdp/fd),
   [ripgrep](https://github.com/BurntSushi/ripgrep),
   [Bat](https://github.com/sharkdp/bat),
   [Universal Ctags](https://github.com/universal-ctags/ctags), `jq`, and
   [Delta](https://github.com/dandavison/delta):

   ```sh
   brew install fzf fd ripgrep bat universal-ctags jq git-delta
   ```

2. Install the Herdr skill:

   ```sh
   npx skills add ogulcancelik/herdr
   ```

3. Link the tracked dotfiles and plugins, then reload Herdr:

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

## Zsh commands

| Command                              | Description            |
| ------------------------------------ | ---------------------- |
| `herdr-workspace-create [directory]` | create a new workspace |

## Key bindings

### Terminal

| Scope | Key                       | Action                            |
| ----- | ------------------------- | --------------------------------- |
| Herdr | `cmd+opt+backtick`        | Create a terminal tab             |
| Herdr | `ctrl+cmd+backtick`       | Select the next terminal tab      |
| Herdr | `ctrl+cmd+shift+backtick` | Select the previous terminal tab  |
| Herdr | `ctrl+shift+enter`        | Select a workspace                |
| Herdr | `cmd+shift+k`             | Close the terminal tab            |
| Herdr | `ctrl+backtick`           | Show, hide, or focus the Vim pane |

In the workspace switcher, use `up/down` to navigate, `/` to search, `enter` to select, and `esc` to close.

Press `ctrl+a` from Vim to include the current file and line. Select text first to include it as quoted context. Use `opt+left/right` to move one word. Press `enter` to send a prompt. Press `opt+enter` to queue a follow-up when the agent is working.

### File navigation

| Scope | Key          | Action                              |
| ----- | ------------ | ----------------------------------- |
| Vim   | `ctrl+p`     | Open a file picker                  |
| Vim   | `ctrl+tab`   | Switch between open or recent files |
| Vim   | `ctrl+l`     | List code symbols in the file       |
| Vim   | `ctrl+g`     | Open the line on GitHub's `main`    |
| Vim   | `ctrl+j`     | Open the import under the cursor    |
| Vim   | `ctrl+s`     | Save the file                       |
| Vim   | `ctrl+opt+d` | View changed Git locations          |

Press `ctrl+opt+d` again to list changed locations. Press `/` to search, then `↓` or `esc` to leave search. Press `t` to hide or unhide test files. Press `X` to exit diff mode.

### Panes

| Scope | Key                   | Action                             |
| ----- | --------------------- | ---------------------------------- |
| Vim   | `ctrl+a`              | Prompt an agent in the workspace   |
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

### Editing

| Scope | Key | Action |
| ----- | --- | ------ |
| Vim   | `u` | Undo   |
| Vim   | `U` | Redo   |

## Vim

In `ctrl+p` and `ctrl+r` results, `enter` opens a right split when the current
split has a file. `ctrl+enter` reuses the current split.

In the `ctrl+tab` switcher, `enter` focuses an open file or opens a recent file. `x` closes an open file.

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
