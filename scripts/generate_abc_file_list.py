#!/usr/bin/env python3
import os
import re
import json

def extract_title(abc_file_path):
    """Extract the title from an ABC file."""
    try:
        with open(abc_file_path, 'r', encoding='utf-8') as file:
            content = file.read()
            # Look for T: field which contains the title
            title_match = re.search(r'T:(.*?)$', content, re.MULTILINE)
            if title_match:
                return title_match.group(1).strip()
    except Exception as e:
        print(f"Error reading {abc_file_path}: {e}")
    
    # Return filename without extension if no title found
    return os.path.basename(abc_file_path).replace('.abc', '')

def generate_abc_file_list():
    """Scan the abc directory and generate a file list."""
    abc_dir = '../abc'
    
    # Ensure the directory exists
    if not os.path.exists(abc_dir):
        os.makedirs(abc_dir)
        print(f"Created {abc_dir} directory")
    
    # Get all .abc files
    abc_files = [f for f in os.listdir(abc_dir) if f.endswith('.abc')]
    
    # Create the file list with names and titles
    file_list = []
    for file in abc_files:
        filepath = os.path.join(abc_dir, file)
        title = extract_title(filepath)
        file_list.append({
            "name": title,
            "file": file
        })
    
    # Sort alphabetically by name
    file_list.sort(key=lambda x: x["name"])
    
    # Generate the JavaScript file
    with open('js/abc-file-list.js', 'w', encoding='utf-8') as js_file:
        js_file.write("// Auto-generated file list - do not edit manually\n")
        js_file.write("class AbcFileList {\n")
        js_file.write("    static getFiles() {\n")
        js_file.write(f"        return {json.dumps(file_list, indent=8)};\n")
        js_file.write("    }\n")
        js_file.write("}\n")
    
    print(f"Generated file list with {len(file_list)} ABC files")

if __name__ == "__main__":
    generate_abc_file_list()