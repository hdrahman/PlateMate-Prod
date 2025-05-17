#!/usr/bin/env python3
"""
Firebase Admin SDK Setup Utility

This script helps set up Firebase credentials for the PlateMate backend.
It can:
1. Check if Firebase credentials are properly configured
2. Generate a .env file with Firebase credentials from a JSON file
"""

import os
import json
import sys
import argparse
from pathlib import Path

def check_firebase_setup():
    """Check if Firebase credentials are properly set up."""
    # Check for environment variables
    firebase_cred_json = os.environ.get('FIREBASE_CREDENTIALS_JSON')
    firebase_sdk_path = os.environ.get('FIREBASE_ADMIN_SDK_PATH')
    
    if firebase_cred_json:
        print("✅ FIREBASE_CREDENTIALS_JSON environment variable is set")
        try:
            json.loads(firebase_cred_json)
            print("✅ FIREBASE_CREDENTIALS_JSON contains valid JSON")
            return True
        except json.JSONDecodeError:
            print("❌ FIREBASE_CREDENTIALS_JSON contains invalid JSON")
            return False
    
    if firebase_sdk_path:
        print(f"ℹ️ FIREBASE_ADMIN_SDK_PATH is set to: {firebase_sdk_path}")
        if os.path.exists(firebase_sdk_path):
            print(f"✅ Firebase credentials file exists at: {firebase_sdk_path}")
            try:
                with open(firebase_sdk_path, 'r') as f:
                    json.loads(f.read())
                print("✅ Firebase credentials file contains valid JSON")
                return True
            except json.JSONDecodeError:
                print("❌ Firebase credentials file contains invalid JSON")
                return False
        else:
            print(f"❌ Firebase credentials file not found at: {firebase_sdk_path}")
    
    # Check for default file location
    default_paths = [
        "firebase-admin-sdk.json",
        os.path.join(os.path.dirname(__file__), "firebase-admin-sdk.json")
    ]
    
    for path in default_paths:
        if os.path.exists(path):
            print(f"✅ Firebase credentials file found at: {path}")
            try:
                with open(path, 'r') as f:
                    json.loads(f.read())
                print("✅ Firebase credentials file contains valid JSON")
                return True
            except json.JSONDecodeError:
                print("❌ Firebase credentials file contains invalid JSON")
                return False
    
    print("❌ No Firebase credentials found")
    return False

def generate_env_from_json(json_file_path, env_file_path='.env'):
    """Generate/update .env file with Firebase credentials from JSON file."""
    try:
        # Ensure the JSON file exists
        if not os.path.exists(json_file_path):
            print(f"❌ File not found: {json_file_path}")
            return False
        
        # Read and validate JSON
        with open(json_file_path, 'r') as f:
            cred_json = json.loads(f.read())
        
        # Check if it's a valid Firebase credential file
        required_keys = ['type', 'project_id', 'private_key', 'client_email']
        for key in required_keys:
            if key not in cred_json:
                print(f"❌ Invalid Firebase credential file: missing '{key}'")
                return False
        
        # Check if .env file exists
        if os.path.exists(env_file_path):
            # Read existing .env content
            with open(env_file_path, 'r') as f:
                env_content = f.read()
            
            # Remove existing Firebase credential lines
            new_lines = []
            for line in env_content.splitlines():
                if not line.startswith('FIREBASE_CREDENTIALS_JSON=') and not line.startswith('FIREBASE_ADMIN_SDK_PATH='):
                    new_lines.append(line)
            
            # Ensure the file ends with a newline
            if new_lines and not new_lines[-1] == '':
                new_lines.append('')
        else:
            new_lines = []
        
        # Add Firebase credentials
        new_lines.append(f'FIREBASE_CREDENTIALS_JSON={json.dumps(cred_json)}')
        new_lines.append('')  # Ensure trailing newline
        
        # Write updated .env file
        with open(env_file_path, 'w') as f:
            f.write('\n'.join(new_lines))
        
        print(f"✅ Firebase credentials added to: {env_file_path}")
        return True
        
    except Exception as e:
        print(f"❌ Error: {str(e)}")
        return False

def main():
    parser = argparse.ArgumentParser(description='Firebase Admin SDK Setup Utility')
    parser.add_argument('--check', action='store_true', help='Check if Firebase credentials are properly configured')
    parser.add_argument('--generate-env', metavar='JSON_FILE', help='Generate .env file with Firebase credentials from JSON file')
    parser.add_argument('--env-file', default='.env', help='Path to .env file (default: .env)')
    
    args = parser.parse_args()
    
    # If no args provided, print help
    if len(sys.argv) == 1:
        parser.print_help()
        sys.exit(1)
    
    if args.check:
        check_firebase_setup()
    
    if args.generate_env:
        generate_env_from_json(args.generate_env, args.env_file)

if __name__ == '__main__':
    main() 