# PlateMate Backend

## Setup

1. Install dependencies:
   ```bash
   pip install -r requirements.txt
   ```

2. Set up environment variables:
   ```bash
   cp .env.example .env
   # Edit .env with your credentials
   ```

3. Set up Firebase Authentication (see [FIREBASE_SETUP.md](FIREBASE_SETUP.md))

4. Run the server:
   ```bash
   uvicorn main:app --reload
   ```

## Authentication Setup

PlateMate uses Firebase Authentication to secure user accounts and ensure data is tied to specific users. Each user can only access their own data.

### Setting up Firebase Authentication

1. Follow the instructions in [FIREBASE_SETUP.md](FIREBASE_SETUP.md)
2. Run the setup helper script to check your configuration:
   ```bash
   python setup_firebase.py --check
   ```

3. If you have a Firebase service account JSON file, you can automatically add it to your .env file:
   ```bash
   python setup_firebase.py --generate-env path/to/firebase-credentials.json
   ```

### Testing Authentication

The backend includes tools to help troubleshoot authentication issues:

1. Run the authentication test script to check your Firebase setup:
   ```bash
   python test_firebase_auth.py
   ```

2. To test with an actual token, get a token from the frontend:
   - In the React Native app, run the getToken utility
   - Use the token with the test script:
     ```bash
     python test_firebase_auth.py --token "your-firebase-token"
     ```

## API Documentation

Once the server is running, you can access the API documentation at:
- Swagger UI: http://172.31.90.70:8000/docs
- ReDoc: http://172.31.90.70:8000/redoc

## Troubleshooting

### "The default Firebase app does not exist"

This error indicates the Firebase Admin SDK failed to initialize. Check:
1. Run `python setup_firebase.py --check` to verify your setup
2. Ensure you have a valid Firebase service account JSON file
3. Or set the `FIREBASE_CREDENTIALS_JSON` environment variable

### User Authentication Issues

If users are seeing each other's data:
1. Ensure Firebase Admin SDK is properly initialized
2. Check that user authentication is working by testing a token
3. Verify that routes are properly protected with authentication middleware 