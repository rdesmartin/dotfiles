call plug#begin('~/.vim/plugged')

" Vim plugin for the_silver_searcher, 'ag', a replacement for the Perl module / CLI script 'ack'.
Plug 'rking/ag.vim'

" Full path fuzzy file, buffer, mru, tag, ... finder for Vim.
Plug 'kien/ctrlp.vim'

" Vim plugin, provides insert mode auto-completion for quotes, parens, brackets, etc.
Plug 'Raimondi/delimitMate'

" Vim plugin for intensely orgasmic commenting.
Plug 'scrooloose/nerdcommenter'

" Vim mode that uses Rope library to provide features like Python refactorings and code-assists.
Plug 'python-rope/ropevim'

" Perform all your vim insert mode completions with Tab
Plug 'ervandew/supertab'

" Syntax checking hacks for vim.
Plug 'scrooloose/syntastic'

" UltiSnips - The ultimate snippet solution for Vim. Send pull requests to SirVer/ultisnips!
"Plug 'SirVer/ultisnips'

" Dark powered asynchronous completion framework for neovim.
Plug 'Shougo/deoplete.nvim'

" Molokai color scheme for Vim.
Plug 'tomasr/molokai'

Plug 'altercation/vim-colors-solarized'
" Use CTRL-A/CTRL-X to increment dates, times, and more.
Plug 'tpope/vim-speeddating'

" Readline style insertion.
Plug 'tpope/vim-rsi'

" Go development plugin for Vim.
Plug 'fatih/vim-go'

call plug#end()

"#
"# Appearance
"#
set nocompatible


" Enable plugins
filetype plugin on

" Enable line numbers
set number

" Enable syntax highlighting
syntax enable
set background=dark
colorscheme solarized

" Set line at 80 columns
set colorcolumn=80

" Number of columns a tab counts for.
set tabstop=8

" Insert appropriate number of columns when pressing Tab key.
set expandtab

" Number of columns inserted for indentation.
set shiftwidth=4

" Number of columns Vim uses when Tab is pressed in insert mode.
set softtabstop=4

set modeline

" Underline current line when entering insert mode
autocmd InsertEnter * set cul
autocmd InsertLeave * set nocul

"#
"# Movement
"#

" Disable arrow keys
inoremap <Up> <NOP>
inoremap <Down> <NOP>
inoremap <Left> <NOP>
inoremap <Right> <NOP>
noremap <Up> <NOP>
noremap <Down> <NOP>
noremap <Left> <NOP>
noremap <Right> <NOP>

" Disable Backspace
noremap <BS> <Nop>
inoremap <BS> <Nop>

" Disable Delete
noremap <Del> <Nop>
inoremap <Del> <Nop>

" Moving (block of) lines around with Ctrl-j and Ctrl-k. Learned from
" http://reefpoints.dockyard.com/2013/09/26/vim-moving-lines-aint-hard.html
nnoremap <C-j> :m .+1<CR>==
nnoremap <C-k> :m .-2<CR>==

" Visual mode
vnoremap <C-j> :m '>+1<CR>gv=gv
vnoremap <C-k> :m '<-2<CR>gv=gv

" Map Leader key to Ctrl-w. This allows buffer switching with Leader-h|j|k|l.
map <leader> <C-w>

"#
"# Behaviour
"#

" Disable swap files.
set nobackup
set nowb
set noswapfile

" Leave insert mode by pressing jj.
imap jj <ESC>

" Save file in normal mode by pressing Enter
nnoremap <CR> :w<CR>

" Wrap line when it exceed textwidth.
set wrap

" Remove trailing white space on save.
autocmd BufWritePre * :%s/\s\+$//e

"#
"# kien/ctrlp.vim
"#

" Open Ctrl-P withe leader-p.
let g:ctrlp_map = '<leader>p'

" Open Ctrl0P to search in open buffers.
nnoremap <leader>b :CtrlPBuffer<cr>

" Usa ag (The Silver Searcher) for listening files if available.
if executable('ag')
    " Use ag over grep
    set grepprg=ag\ --nogroup\ --nocolor

    " Use ag in CtrlP for listing files. Lightning fast and respects .gitignore
    let g:ctrlp_user_command = 'ag %s --files-with-matches -g "" --ignore "\.git\|\.hg\|\.svn"'

    " ag is fast enough that CtrlP doesn't need to cache
    let g:ctrlp_use_caching = 0
else
    " Exclude files and folders from indexing.
    let g:ctrlp_custom_ignore = {
        \'dir': '\v(build|\.git|cache|log|vendor|lib|node_modules)$',
        \'file': '\v(\.pyc|tags)$'
        \ }
endif

"#
"# ervandew/supertab
"#

" Stolen from: http://stackoverflow.com/a/22253548/1073222
let g:SuperTabDefaultCompletionType = '<C-n>'

"#
"# scrooloose/syntastic
"#

" Run linter by pressing F5.
nnoremap <F5> :SyntasticCheck<cr>

"#
"# SirVer/ultisnips
"#
let g:UltiSnipsExpandTrigger = "<tab>"
let g:UltiSnipsJumpForwardTrigger = "<tab>"
let g:UltiSnipsJumpBackwardTrigger = "<s-tab>"

"#
"# Enable Deoplete at startup.
"#
let g:deoplete#enable_at_startup = 1

"#
"# Misc
"#

" Map Leader to space bar
let mapleader = "\<Space>"
