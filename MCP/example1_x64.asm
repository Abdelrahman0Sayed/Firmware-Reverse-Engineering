; Example 1: Simple function that doubles an integer
; Architecture: x86-64
; Description: Takes an integer parameter and returns it multiplied by 2

push rbp
mov rbp, rsp
mov DWORD PTR [rbp-4], edi
mov eax, DWORD PTR [rbp-4]
add eax, eax
pop rbp
ret

; Expected C output (approximately):
; int double_value(int param) {
;     return param * 2;
; }
