import os

def create_file_listing(output_file="list_files.txt"):
    # Directories and files to list
    dirs_to_scan = ["../js", "../css"]
    specific_files = ["../index.html"]
    
    with open(output_file, "w") as f:
        # Process directories
        for directory in dirs_to_scan:
            if os.path.exists(directory):
                for root, _, files in os.walk(directory):
                    for filename in files:
                        filepath = os.path.join(root, filename)
                        f.write(f"==> Listing of {filepath} <==\n")
                        try:
                            with open(filepath, "r") as file_content:
                                f.write(file_content.read())
                                f.write("\n\n")
                        except Exception as e:
                            f.write(f"Error reading file: {str(e)}\n\n")
            else:
                f.write(f"Directory {directory} does not exist\n\n")
        
        # Process specific files
        for filepath in specific_files:
            if os.path.exists(filepath):
                f.write(f"==> Listing of {filepath} <==\n")
                try:
                    with open(filepath, "r") as file_content:
                        f.write(file_content.read())
                        f.write("\n\n")
                except Exception as e:
                    f.write(f"Error reading file: {str(e)}\n\n")
            else:
                f.write(f"File {filepath} does not exist\n\n")
    
    print(f"File listing created in {output_file}")

if __name__ == "__main__":
    create_file_listing()