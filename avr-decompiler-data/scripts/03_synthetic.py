import os
import random

OUTPUT_DIR = "./data/raw_c"
NUM_FILES = 1000  # We will generate 1000 new functions

if not os.path.exists(OUTPUT_DIR):
    os.makedirs(OUTPUT_DIR)

def generate_math_func(id):
    ops = ["+", "-", "*", "&", "|", "^"]
    op = random.choice(ops)
    val = random.randint(1, 255)
    
    code = f"""#include <avr/io.h>
#include <stdint.h>

uint8_t synthetic_math_{id}(uint8_t a) {{
    uint8_t result = a {op} {val};
    if (result > 100) {{
        return result + 1;
    }} else {{
        return result;
    }}
}}
"""
    return code

def generate_gpio_func(id):
    ports = ["B", "C", "D"]
    port = random.choice(ports)
    pin = random.randint(0, 7)
    
    code = f"""#include <avr/io.h>
#include <stdint.h>

void synthetic_gpio_{id}(void) {{
    // Set direction
    DDR{port} |= (1 << {pin});
    // Toggle pin
    PORT{port} ^= (1 << {pin});
}}
"""
    return code

def generate_loop_func(id):
    iters = random.randint(5, 20)
    
    code = f"""#include <avr/io.h>
#include <stdint.h>

void synthetic_loop_{id}(void) {{
    uint8_t i;
    for(i=0; i<{iters}; i++) {{
        PORTB = i;
    }}
}}
"""
    return code

print(f"Generating {NUM_FILES} synthetic functions...")

for i in range(NUM_FILES):
    # Pick a random template
    type_idx = random.randint(0, 2)
    if type_idx == 0:
        content = generate_math_func(i)
    elif type_idx == 1:
        content = generate_gpio_func(i)
    else:
        content = generate_loop_func(i)
        
    # Save to the same folder as the real data
    with open(f"{OUTPUT_DIR}/synthetic_{i}.c", "w") as f:
        f.write(content)

print("Done! You can now re-run the compiler script.")