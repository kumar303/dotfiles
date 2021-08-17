#!/bin/bash

# This file is run by Spin https://development.shopify.io/engineering/keytech/spin/personalizing

if [ $SPIN ]; then
  echo "[kumar's dotfiles]: bootstrapping spin"
  if [ -d /src/github.com/shopify/checkout-web/ ]; then
    echo "[kumar's dotfiles]: adding tasks.json to checkout-web"
    ln -sf ~/dotfiles/shopify/spin/checkout-web/.vscode/tasks.json /src/github.com/shopify/checkout-web/.vscode/tasks.json
  fi
fi