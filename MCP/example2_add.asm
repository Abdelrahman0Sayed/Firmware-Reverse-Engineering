; Example 2: Simple addition function
; Architecture: x86-64
; Description: Adds two integers and returns the result

push rbp
mov rbp, rsp
mov DWORD PTR [rbp-4], edi
mov DWORD PTR [rbp-8], esi
mov edx, DWORD PTR [rbp-4]
mov eax, DWORD PTR [rbp-8]
add eax, edx
pop rbp
ret

; Expected C output (approximately):
; int add(int a, int b) {
;     return a + b;
; }
