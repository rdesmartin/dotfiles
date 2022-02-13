let g:go_fmt_autosave = 1
let g:go_metalinter_autosave = 1
let g:go_metalinter_enabled = ['vet', 'golint', 'errcheck']

nmap <leader>r <Plug>(go-run)
nmap <leader>h <Plug>(go-doc-browser)
nmap <leader>b <Plug>(go-build)
nmap <leader>s :GoMetaLinter<cr>

let g:syntastic_always_populate_loc_list = 1
let g:syntastic_auto_loc_list = 1

let g:go_highlight_functions = 1
let g:go_highlight_methods = 1
let g:go_highlight_fields = 1
let g:go_highlight_structs = 1
let g:go_highlight_interfaces = 1
let g:go_highlight_operators = 1
let g:go_highlight_build_constraints = 1
