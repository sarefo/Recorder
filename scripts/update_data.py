#!/usr/bin/env python3
import os
import re
import json
import hashlib
import datetime
import subprocess

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

def content_hash(path):
    """Short hash of a file's content (line endings normalized), so the service
    worker can tell whether its cached copy of a tune is current."""
    with open(path, 'rb') as f:
        data = f.read().replace(b'\r\n', b'\n')
    return hashlib.sha1(data).hexdigest()[:10]

def git_added_dates(project_dir):
    """Date each tune under abc/ first entered git, as YYYY-MM-DD, from one
    log pass (--no-renames, so a moved file counts as added at its move).
    Files not in the log yet are left out; the caller dates those today,
    which is right when the pre-commit hook regenerates this list."""
    out = {}
    try:
        log = subprocess.run(
            # core.quotepath=false keeps non-ASCII paths unquoted, so they
            # still match the paths update_data.py walks on disk
            ["git", "-c", "core.quotepath=false", "log", "--diff-filter=A",
             "--no-renames", "--name-only", "--format=%as", "--", "abc"],
            capture_output=True, text=True, check=True, cwd=project_dir,
            encoding="utf-8", errors="replace").stdout
    except (OSError, subprocess.CalledProcessError) as e:
        print(f"Added dates unavailable ({e}); regenerating without them")
        return out
    date_re = re.compile(r"^\d{4}-\d{2}-\d{2}$")
    date = None
    for line in log.splitlines():
        if not line.strip():
            continue
        if line.startswith("abc/") and date:
            # Log is newest-first, so the first add seen is the latest one
            out.setdefault(line[4:].replace("\\", "/"), date)
        elif date_re.match(line.strip()):
            date = line.strip()
        # anything else is not a date and not a path we asked for: skip it
    return out

def generate_abc_file_list():
    """Scan the abc directory and generate a file list."""
    # Get the directory containing this script
    script_dir = os.path.dirname(os.path.abspath(__file__))
    project_dir = os.path.dirname(script_dir)
    abc_dir = os.path.join(project_dir, 'abc')
    added_dates = git_added_dates(project_dir)
    today = datetime.date.today().isoformat()
    
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
                
                # Get category from folder name (forward slashes for nested folders on Windows)
                category = os.path.dirname(rel_path).replace('\\', '/')
                if category == '.':
                    category = 'General'  # Default category for files in root
                
                file_list.append({
                    "name": title,
                    "file": rel_path.replace('\\', '/'),  # Use forward slashes for URLs
                    "category": category,
                    "hash": content_hash(full_path),
                    # When the tune joined the repertoire; tunes not yet
                    # committed count as added today
                    "added": added_dates.get(rel_path.replace('\\', '/'), today)
                })
    
    # Sort alphabetically by category then name
    file_list.sort(key=lambda x: (x["category"], x["name"]))
    
    # Generate the JavaScript file
    js_dir = os.path.join(project_dir, 'js', 'data')
    os.makedirs(js_dir, exist_ok=True)
    js_file_path = os.path.join(js_dir, 'abc-file-list.js')
    with open(js_file_path, 'w', encoding='utf-8', newline='\n') as js_file:
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
    with open(js_file_path, 'w', encoding='utf-8', newline='\n') as js_file:
        js_file.write("// Auto-generated docs file list - do not edit manually\n")
        js_file.write("class DocsFileList {\n")
        js_file.write("    static getFiles() {\n")
        js_file.write(f"        return {json.dumps(file_list, indent=8)};\n")
        js_file.write("    }\n")
        js_file.write("}\n")
    
    print(f"Generated docs file list with {len(file_list)} markdown files")

def generate_note_index():
    """Index the pitches each tune uses (needs Node; the files dialog filters on it)."""
    script_dir = os.path.dirname(os.path.abspath(__file__))
    try:
        subprocess.run(["node", os.path.join(script_dir, "build_note_index.mjs")],
                       check=True, cwd=os.path.dirname(script_dir))
    except (OSError, subprocess.CalledProcessError) as e:
        print(f"Note index not regenerated: {e}")

if __name__ == "__main__":
    generate_abc_file_list()
    generate_docs_file_list()
    generate_note_index()
