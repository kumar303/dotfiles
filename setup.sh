#!/bin/bash

# This file is run by Spin https://development.shopify.io/engineering/keytech/spin/personalizing

if [ $SPIN ]; then
  echo "[kumar's dotfiles]: bootstrapping spin"
  git config --global alias.co checkout
  git config --global alias.br branch
  git config --global alias.ci commit
  git config --global alias.st status

  if [ -d /src/github.com/shopify/checkout-web/ ]; then
    echo "[kumar's dotfiles]: adding tasks.json to checkout-web"
    ln -sf ~/dotfiles/shopify/spin/checkout-web/.vscode/tasks.json /src/github.com/shopify/checkout-web/.vscode/tasks.json
  fi
  if [ -d /src/github.com/shopify/shopify/ ]; then
    echo "[kumar's dotfiles]: adding some betas"
    SHOP_ID=1 BETA=force_checkout_one bin/rake dev:betas:enable
  fi
fi