" Insert break point when typing 'pdb'.
inoremap pdb import pdb; pdb.set_trace()

" Disable Pymode's linter, we use Syntastic for this.
let g:pymode_lint = 0

" Disable Pymode's functionality around breakpoints. By default this option is
" enabled and maps some functionality I don't use to Leader-b. I want to use
" Leader-b for myself.
let g:pymode_breakpoint = 0

" Use Flake8 as linter.
let g:syntastic_python_checkers = ['flake8']
