
import hashlib
import sys
import json

def calculate_sha256(filepath):
    """Calculates the SHA256 hash of a file."""
    with open(filepath, 'rb') as f:
        bytes = f.read()
        readable_hash = hashlib.sha256(bytes).hexdigest()
    return readable_hash

if __name__ == "__main__":
    file_paths = json.loads(sys.argv[1])
    hashes = {}
    for path in file_paths:
        try:
            hashes[path] = calculate_sha256(path)
        except Exception as e:
            hashes[path] = f"Error: {e}"
    print(json.dumps(hashes))
