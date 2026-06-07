import os

# Folders and Files to ignore during crawl
IGNORE_DIRS = {'.git', '.agents', '.system_generated', '__pycache__'}
IGNORE_FILES = {'CODEBASE_MAP.md', '.DS_Store', 'Icon'}

def generate_tree_map(root_dir):
    output = []
    output.append("# Codebase Structure Map")
    output.append("")
    output.append("> [!NOTE]")
    output.append("> This index is generated automatically by running `python3 scripts/build_codebase_map.py`. Avoid manual edits.")
    output.append("")

    # Crawl directory tree recursively
    for current_root, subdirs, files in os.walk(root_dir):
        # Filter ignore dirs in-place to prevent recursive walk
        subdirs[:] = [d for d in sorted(subdirs) if d not in IGNORE_DIRS]
        sorted_files = sorted(files)

        relative_path = os.path.relpath(current_root, root_dir)
        
        # Calculate tree depth
        depth = 0 if relative_path == "." else len(relative_path.split(os.sep))
        indent = "    " * depth

        if relative_path == ".":
            output.append("- **Root Directory (/)**")
        else:
            folder_name = os.path.basename(current_root)
            output.append(f"{indent}- 📁 **{folder_name}/** (`/{relative_path}`)")

        # Render files list under folder
        file_indent = "    " * (depth + 1)
        for filename in sorted_files:
            if filename in IGNORE_FILES:
                continue
            
            absolute_filepath = os.path.join(current_root, filename)
            filesize_kb = os.path.getsize(absolute_filepath) / 1024.0
            
            output.append(f"{file_indent}- 📄 [{filename}](file://{absolute_filepath}) ({filesize_kb:.2f} KB)")

    return "\n".join(output)

if __name__ == "__main__":
    # The script lives under /scripts/, workspace root is the parent directory
    workspace_root = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
    
    codebase_map_content = generate_tree_map(workspace_root)
    output_filepath = os.path.join(workspace_root, "docs", "architecture", "CODEBASE_MAP.md")

    # Double check output parent folder presence
    os.makedirs(os.path.dirname(output_filepath), exist_ok=True)
    
    with open(output_filepath, "w", encoding="utf-8") as map_file:
        map_file.write(codebase_map_content)
        
    print(f"Success: Dynamic index generated at {output_filepath}")
