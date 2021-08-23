#!/bin/bash

# This file is run by Spin https://development.shopify.io/engineering/keytech/spin/personalizing

if [ $SPIN ]; then
  echo "[kumar's dotfiles]: bootstrapping spin"
  git config --global alias.co checkout
  git config --global alias.br branch
  git config --global alias.ci commit
  git config --global alias.st status

  # Install gh according to https://github.com/cli/cli/blob/trunk/docs/install_linux.md
  curl -fsSL https://cli.github.com/packages/githubcli-archive-keyring.gpg | sudo gpg --dearmor -o /usr/share/keyrings/githubcli-archive-keyring.gpg
  echo "deb [arch=$(dpkg --print-architecture) signed-by=/usr/share/keyrings/githubcli-archive-keyring.gpg] https://cli.github.com/packages stable main" | sudo tee /etc/apt/sources.list.d/github-cli.list > /dev/null
  sudo apt update
  sudo apt install gh

  if [ -d /src/github.com/shopify/checkout-web/ ]; then
    echo "[kumar's dotfiles]: adding tasks.json to checkout-web"
    ln -sf ~/dotfiles/shopify/spin/checkout-web/.vscode/tasks.json /src/github.com/shopify/checkout-web/.vscode/tasks.json
  fi
  if [ -d /src/github.com/shopify/shopify/ ]; then
    echo "[kumar's dotfiles]: adding some betas"
    cd /src/github.com/shopify/shopify/
    SHOP_ID=1 BETA=force_checkout_one ./bin/rake dev:betas:enable
  fi
fi