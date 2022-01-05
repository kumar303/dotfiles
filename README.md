These are my [dotfiles](https://dotfiles.github.io/) for configs and stuff.
I mostly just copied them from people 😅

Here's what I run on a new machine (todo: add this to `setup.sh` duh).

```
mkdir -p ~/src/github.com/kumar303
git clone https://github.com/kumar303/dotfiles.git ~/src/github.com/kumar303/dotfiles
cd ~/src/github.com/kumar303/dotfiles
find . -path './.*' -not -path './.git' -depth 1 -exec ln -s ~/src/github.com/kumar303/dotfiles/{} ~/{} \;
```

Add this `[includes]` section to `.gitconfig` :

```
[include]
	path = ~/.gitconfig.defaults
```
