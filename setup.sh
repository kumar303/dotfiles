#!/bin/bash

# This file is run by Spin https://development.shopify.io/engineering/keytech/spin/personalizing
# Before this file runs in a Spin VM, the source will have been cloned to ~/dotfiles

if [ $SPIN ]; then
  echo "[kumar's dotfiles]: bootstrapping spin"

  # TODO: use the .gitconfig.local swapping method from
  # https://github.com/Shopify/dotfiles-starter-template
  git config --global alias.co checkout
  git config --global alias.br branch
  git config --global alias.ci commit
  git config --global alias.fix "commit -a --amend -C HEAD"
  git config --global alias.pp "\!git remote prune origin && git pull"
  git config --global alias.ri "rebase --interactive --autosquash HEAD~5"
  git config --global alias.st status

  cat ~/dotfiles/shopify/spin/.zshrc >> ~/.zshrc

  if [ -d /src/github.com/shopify/checkout-web/ ]; then
    echo "[kumar's dotfiles]: adding tasks.json to checkout-web"
    cd /src/github.com/shopify/checkout-web/
    yarn init-vscode
  fi
  if [ -d /src/github.com/shopify/shopify/ ]; then
    echo "[kumar's dotfiles]: adding some betas"
    cd /src/github.com/shopify/shopify/
    SHOP_ID=1 BETA=force_checkout_one ./bin/rake dev:betas:enable
  fi
fi