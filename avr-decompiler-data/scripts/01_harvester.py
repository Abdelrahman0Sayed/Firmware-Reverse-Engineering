# here iam creating a script to extract all the c functions from the decompiled avr c code files

import os
import re

# Configuration
SOURCE_DIR = "./sources"
OUTPUT_DIR = "./data/raw_c"

# Regex to find C functions (simplified)
# Looks for: void/int/char name(...) { ... }
FUNC_PATTERN = r"([a-zA-Z0-9_]+)\s+([a-zA-Z0-9_*]+)\s*\(([^)]*)\)\s*\{"

if not os.path.exists(OUTPUT_DIR):
    os.makedirs(OUTPUT_DIR)

def extract_functions(file_path, file_id):
    try:
        with open(file_path, "r", encoding="utf-8", errors="ignore") as f:
            content = f.read()
            
        # Skip complex files with too many macros for now
        if "#ifdef" in content or "ASM" in content:
            return 0

        # Simple bracket counting to find function blocks
        matches = re.finditer(FUNC_PATTERN, content)
        count = 0
        
        for match in matches:
            start_idx = match.start()
            open_brackets = 0
            end_idx = -1
            
            # Walk forward from start to find the closing bracket
            for i, char in enumerate(content[start_idx:], start=start_idx):
                if char == "{":
                    open_brackets += 1
                elif char == "}":
                    open_brackets -= 1
                    if open_brackets == 0:
                        end_idx = i + 1
                        break
            
            if end_idx != -1:
                func_code = content[start_idx:end_idx]
                # Filter out tiny functions (likely stubs)
                if len(func_code.split('\n')) > 3: 
                    # Add standard headers so it compiles later
                    full_code = "#include <avr/io.h>\n#include <stdint.h>\n\n" + func_code
                    
                    with open(f"{OUTPUT_DIR}/func_{file_id}_{count}.c", "w") as out:
                        out.write(full_code)
                    count += 1
        return count
            
    except Exception as e:
        return 0

print("Harvesting functions...")
total_funcs = 0
file_id = 0

for root, dirs, files in os.walk(SOURCE_DIR):
    for file in files:
        if file.endswith(".c"):
            count = extract_functions(os.path.join(root, file), file_id)
            total_funcs += count
            file_id += 1

print(f"Done! Harvested {total_funcs} functions into {OUTPUT_DIR}")