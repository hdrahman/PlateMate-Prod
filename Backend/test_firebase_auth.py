#!/usr/bin/env python3
"""
Firebase Authentication Test Script

This script tests the Firebase authentication setup for the PlateMate backend.
It helps diagnose authentication issues by:
1. Testing Firebase Admin SDK initialization
2. Testing token verification (if a token is provided)
"""

import os
import sys
import argparse
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

def test_firebase_admin_init():
    """Test Firebase Admin SDK initialization."""
    try:
        # First, try to import the module
        from auth.firebase_auth import initialize_firebase_admin
        
        print("✅ Successfully imported Firebase auth module")
        
        # Try to initialize Firebase Admin SDK
        result = initialize_firebase_admin()
        if result:
            print("✅ Firebase Admin SDK initialized successfully")
            return True
        else:
            print("❌ Firebase Admin SDK initialization failed")
            return False
    except ImportError as e:
        print(f"❌ Error importing Firebase auth module: {e}")
        print("   Make sure you're running this script from the Backend directory")
        return False
    except Exception as e:
        print(f"❌ Unexpected error: {e}")
        return False

def test_token_verification(token):
    """Test Firebase token verification."""
    try:
        # Import auth module
        from auth.firebase_auth import auth
        import firebase_admin
        
        # Verify the token
        print("🔍 Verifying the provided token...")
        decoded_token = auth.verify_id_token(token)
        
        print("✅ Token verification successful!")
        print(f"   User UID: {decoded_token.get('uid')}")
        print(f"   Email: {decoded_token.get('email')}")
        print(f"   Issued at: {decoded_token.get('iat')}")
        print(f"   Expires at: {decoded_token.get('exp')}")
        
        return True
    except ImportError as e:
        print(f"❌ Error importing Firebase modules: {e}")
        return False
    except firebase_admin.exceptions.FirebaseError as e:
        print(f"❌ Firebase error: {e}")
        print("   This is likely due to an invalid or expired token")
        return False
    except Exception as e:
        print(f"❌ Unexpected error: {e}")
        return False

def main():
    parser = argparse.ArgumentParser(description='Test Firebase Authentication Setup')
    parser.add_argument('--token', help='Firebase ID token to verify')
    
    args = parser.parse_args()
    
    print("=== Testing Firebase Admin SDK Initialization ===")
    init_success = test_firebase_admin_init()
    
    if args.token and init_success:
        print("\n=== Testing Token Verification ===")
        test_token_verification(args.token)
    elif args.token and not init_success:
        print("\n❌ Skipping token verification because Firebase Admin SDK initialization failed")
    else:
        print("\nℹ️ No token provided for verification. Run with --token to test token verification.")
    
    print("\n=== Testing Complete ===")

if __name__ == "__main__":
    main() 