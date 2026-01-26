#compilyng the harvested C code to AVR assembly and preparing the dataset
import os
import subprocess
import json
from tqdm import tqdm

RAW_DIR = "./data/raw_c"
ASM_DIR = "./data/intermediate_s"
DATASET_FILE = "./data/dataset.jsonl"

# We will run the compiler 3 times for each file
OPTIMIZATIONS = [
    ("-O0", "_O0"),  # No optimization (Literal translation)
    ("-Os", "_Os"),  # Size optimization (Standard firmware)
    ("-O3", "_O3")   # Speed optimization (Complex loops)
]

# Base command
GCC_BASE = "avr-gcc -S -mmcu=atmega328p -fno-asynchronous-unwind-tables -I/usr/lib/avr/include"

if not os.path.exists(ASM_DIR):
    os.makedirs(ASM_DIR)

def clean_assembly(asm_code):
    cleaned = []
    lines = asm_code.split('\n')
    for line in lines:
        line = line.strip()
        if not line or line.startswith("//") or line.startswith(";"): continue
        if line.startswith("."):
            if not line.endswith(":"): continue
        cleaned.append(line)
    return "\n".join(cleaned)

valid_pairs = 0
failed_count = 0

print("Starting Augmented Compilation Pipeline...")

with open(DATASET_FILE, "w") as jsonl_file:
    # Get list of all C files
    files = [f for f in os.listdir(RAW_DIR) if f.endswith(".c")]
    
    # We will process each file 3 times
    for c_file in tqdm(files, desc="Augmenting"):
        c_path = os.path.join(RAW_DIR, c_file)
        
        # Read the C code ONCE (same target for all 3 versions)
        try:
            with open(c_path, "r") as f:
                c_code = f.read()
        except:
            continue

        # Loop through our 3 optimization flavors
        for flag, suffix in OPTIMIZATIONS:
            s_filename = c_file.replace(".c", f"{suffix}.s")
            s_path = os.path.join(ASM_DIR, s_filename)
            
            # 1. Compile with specific flag
            cmd = f"{GCC_BASE} {flag} {c_path} -o {s_path}"
            result = subprocess.run(cmd, shell=True, stderr=subprocess.PIPE)
            
            if result.returncode == 0:
                try:
                    # 2. Read & Clean Assembly
                    with open(s_path, "r") as f:
                        raw_asm = f.read()
                    
                    clean_asm = clean_assembly(raw_asm)
                    
                    # Skip empty/broken outputs
                    if len(clean_asm) < 10: continue

                    # 3. Create JSON Entry
                    # We slightly vary the instruction prompt too, to help the model distinction
                    if flag == "-O0":
                        prompt = "Decompile this unoptimized AVR Assembly to C."
                    else:
                        prompt = "Decompile this AVR Assembly to C."

                    entry = {
                        "instruction": prompt,
                        "input": clean_asm,
                        "output": c_code
                    }
                    
                    jsonl_file.write(json.dumps(entry) + "\n")
                    valid_pairs += 1
                except:
                    pass
            else:
                # If it fails with -O0, it will likely fail with -Os too, so we just count it once effectively
                if flag == "-Os": failed_count += 1

print(f"Finished.")
print(f"Total Training Samples: {valid_pairs}")
print(f"(Real Files * 3 Optimizations + Synthetic * 3 Optimizations)")