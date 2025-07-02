#!/usr/bin/env python3
import os
import re
import json

def is_valid_abc_file(abc_file_path):
    """Check if ABC file has a valid X: field with a number."""
    try:
        with open(abc_file_path, 'r', encoding='utf-8') as file:
            content = file.read()
            # Look for X: field - must contain a number
            x_match = re.search(r'^X:\s*(\d+)', content, re.MULTILINE)
            return x_match is not None
    except Exception as e:
        print(f"Error reading {abc_file_path}: {e}")
        return False

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
    # Get the directory containing this script
    script_dir = os.path.dirname(os.path.abspath(__file__))
    project_dir = os.path.dirname(script_dir)
    abc_dir = os.path.join(project_dir, 'abc')
    
    # Ensure the directory exists
    if not os.path.exists(abc_dir):
        os.makedirs(abc_dir)
        print(f"Created {abc_dir} directory")
    
    # Get all .abc files including in subfolders
    file_list = []
    for root, dirs, files in os.walk(abc_dir):
        for file in files:
            if file.endswith('.abc'):
                # Get the relative path from the abc directory
                rel_path = os.path.relpath(os.path.join(root, file), abc_dir)
                
                # Check if ABC file has valid X: field with number
                full_path = os.path.join(root, file)
                if not is_valid_abc_file(full_path):
                    # print(f"Skipping {rel_path} - no valid X: field with number")
                    continue
                
                # Extract title
                title = extract_title(full_path)
                
                # Get category from folder name
                category = os.path.dirname(rel_path)
                if category == '.':
                    category = 'General'  # Default category for files in root
                
                file_list.append({
                    "name": title,
                    "file": rel_path.replace('\\', '/'),  # Use forward slashes for URLs
                    "category": category
                })
    
    # Sort alphabetically by category then name
    file_list.sort(key=lambda x: (x["category"], x["name"]))
    
    # Generate the JavaScript file
    js_dir = os.path.join(project_dir, 'js', 'data')
    os.makedirs(js_dir, exist_ok=True)
    js_file_path = os.path.join(js_dir, 'abc-file-list.js')
    with open(js_file_path, 'w', encoding='utf-8') as js_file:
        js_file.write("// Auto-generated file list - do not edit manually\n")
        js_file.write("class AbcFileList {\n")
        js_file.write("    static getFiles() {\n")
        js_file.write(f"        return {json.dumps(file_list, indent=8)};\n")
        js_file.write("    }\n")
        js_file.write("}\n")
    
    print(f"Generated file list with {len(file_list)} ABC files")

def extract_doc_title(md_file_path):
    """Extract the title from a markdown file."""
    try:
        with open(md_file_path, 'r', encoding='utf-8') as file:
            content = file.read()
            # Look for the first # heading
            title_match = re.search(r'^#\s+(.*?)$', content, re.MULTILINE)
            if title_match:
                return title_match.group(1).strip()
    except Exception as e:
        print(f"Error reading {md_file_path}: {e}")
    
    # Return filename without extension if no title found
    return os.path.basename(md_file_path).replace('.md', '').replace('_', ' ').title()

def generate_docs_file_list():
    """Scan the docs directory and generate a file list."""
    # Get the directory containing this script
    script_dir = os.path.dirname(os.path.abspath(__file__))
    project_dir = os.path.dirname(script_dir)
    docs_dir = os.path.join(project_dir, 'docs')
    
    # Ensure the directory exists
    if not os.path.exists(docs_dir):
        os.makedirs(docs_dir)
        print(f"Created {docs_dir} directory")
    
    # Get all .md files
    file_list = []
    for root, dirs, files in os.walk(docs_dir):
        for file in files:
            if file.endswith('.md'):
                # Get the relative path from the docs directory
                rel_path = os.path.relpath(os.path.join(root, file), docs_dir)
                
                # Extract title
                full_path = os.path.join(root, file)
                title = extract_doc_title(full_path)
                
                file_list.append({
                    "name": title,
                    "file": rel_path.replace('\\', '/'),  # Use forward slashes for URLs
                })
    
    # Sort alphabetically by title
    file_list.sort(key=lambda x: x["name"])
    
    # Generate the JavaScript file
    js_dir = os.path.join(project_dir, 'js', 'data')
    os.makedirs(js_dir, exist_ok=True)
    js_file_path = os.path.join(js_dir, 'docs-file-list.js')
    with open(js_file_path, 'w', encoding='utf-8') as js_file:
        js_file.write("// Auto-generated docs file list - do not edit manually\n")
        js_file.write("class DocsFileList {\n")
        js_file.write("    static getFiles() {\n")
        js_file.write(f"        return {json.dumps(file_list, indent=8)};\n")
        js_file.write("    }\n")
        js_file.write("}\n")
    
    print(f"Generated docs file list with {len(file_list)} markdown files")

if __name__ == "__main__":
    generate_abc_file_list()
    generate_docs_file_list()
