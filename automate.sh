#!/usr/bin/env bash
echo ">> Installing system dependencies..."
sudo apt-get update -qq && sudo apt-get install -qq \
        zsh \
        git-core

HOMESHICK_DIR="$HOME"/.homesick/repos/homeshick

# Get Homeshick.
if [ ! -d "$HOMESHICK_DIR" ]; then
    echo ">> Cloning Homeshick into $HOMESHICK_DIR..."
    git clone -q git://github.com/andsens/homeshick.git $HOMESHICK_DIR
fi

source $HOMESHICK_DIR/homeshick.sh

# Get dotfiles
homeshick --batch clone git@github.com:rdesmartin/dotfiles.git
homeshick link --force

# Get FZF and install it.
if [ ! -d "$HOME/.fzf" ]; then
    echo ">> Cloning FZF into ~/.fzf..."
    git clone -q https://github.com/junegunn/fzf.git ~/.fzf
    $HOME/.fzf/install
fi

# Install Vim bundles
vim +PluginInstall +qall

# Change shell
echo ">> Provide your password to change shell to zsh."
chsh -s /usr/bin/zsh
echo ">> Done!"
