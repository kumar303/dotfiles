These are my [dotfiles](https://dotfiles.github.io/) for configs and stuff.
I mostly just copied them from people 😅

Here's what I run on a new machine.

```
git clone to ~/dev/dotfiles
cd ~/dev/dotfiles
find . -path './.*' -not -path './.git' -depth 1 -exec ln -s ~/dev/dotfiles/{} ~/{} \;
```
