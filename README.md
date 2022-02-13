dotfiles
========
Synchronize dotfiles with [homeshick][homeshick].

Installation
============
Setup everything automatically with...:

    $ curl -s https://raw.githubusercontent.com/rdesmartin/dotfiles/master/automate.sh | bash

...or do it manually. Get and enable homesick:

    $ git clone git://github.com/andsens/homeshick.git $HOME/.homesick/repos/homeshick
    $ source $HOME/.homesick/repos/homeshick/homeshick.sh

Download this repo:

    $ homeshick --batch clone https://github.com/rdesmartin/dotfiles.git

Link the dotfiles.

    $ homeshick link --force

Install [Vundle][vundle]:

    $ git clone https://github.com/gmarik/Vundle.vim.git ~/.vim/bundle/Vundle.vim

Install Vim bundles:

    vim +PluginInstall +qall

Make zsh default shell and restart the terminal:

    chsh -s /usr/bin/zsh

Dependencies
------------
The following system binaries are required.

* [ag][ag] a code searching tool similar to `ack`, with a focus on speed
* [autojump][autojump] a `cd` command that learns
* [fzf][fzf] a fuzzy finder for your shell
* [i3][i3] a tiling window manager
* [scrot][scrot], for taking screenshots
* [rofi][rofi] Ro
* [urxvt][urxvt] A terminal emulator
* [zsh][zsh], an alternative Unix shell

[ag]:https://github.com/ggreer/the_silver_searcher
[autojump]:https://github.com/joelthelion/autojump
[fzf]:https://github.com/junegunn/fzf
[i3]:https://i3wm.org/
[scrot]:https://launchpad.net/ubuntu/+source/scrot
[zsh]:http://www.zsh.org/

[homeshick]:https://github.com/andsens/homeshick
[vundle]:https://github.com/gmarik/Vundle.vim
