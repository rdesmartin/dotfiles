" Allow JSX in normal JS files
let g:jsx_ext_required = 0

" Tell Syntastic which checker to use. Install checker using npm
" 'npm install -g jscs babel-jscs'.
let g:syntastic_javascript_checkers = ['jscs']

" Display ruler at column 120.
set colorcolumn=120
