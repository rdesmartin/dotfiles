let g:go_fmt_command = "goimports"

au FileType go nmap <leader>b :w<CR><Plug>(go-build)
au FileType go nmap <leader>r :w<CR><Plug>(go-run)

" Use only the quickfix window for error lists, don't use location list.
let g:go_list_type = "quickfix"

" Navigate through quickfix window with Ctrl+n and Ctrl+m.
map <C-n> :cnext<CR>
map <C-m> :cprevious<CR>

" Close quickfix window with <leader>a
nnoremap <leader>a :cclose<CR>

" Show and update type info of object under cursor in status line.
let g:go_auto_type_info = 1
set updatetime=100
