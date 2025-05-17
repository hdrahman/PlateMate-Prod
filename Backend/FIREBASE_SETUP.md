# Firebase Authentication Setup for PlateMate Backend

## Overview

PlateMate uses Firebase Authentication to secure user accounts and ensure data is tied to specific users. The backend verifies Firebase ID tokens to authenticate requests and ensure users can only access their own data.

## Setup Instructions

### 1. Create Firebase Project

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Create a new project or use the existing PlateMate project
3. Set up Authentication in the Firebase project and enable relevant sign-in methods (Email/Password, Google, etc.)

### 2. Generate Firebase Admin SDK Private Key

1. In the Firebase Console, go to Project Settings
2. Navigate to the "Service accounts" tab
3. Click "Generate new private key"
4. Download the JSON file

### 3. Configure Firebase Credentials (Choose ONE method)

#### Option A: Using a JSON file

Save the downloaded JSON file as `firebase-admin-sdk.json` in the Backend directory.

#### Option B: Using environment variables (Recommended for production)

Add the following to your `.env` file in the Backend directory:

```
# Option 1: Specify the path to your credentials file
FIREBASE_ADMIN_SDK_PATH=path/to/your/firebase-admin-sdk.json

# OR Option 2: Use the entire JSON content as an environment variable (more secure)
FIREBASE_CREDENTIALS_JSON={"type":"service_account","project_id":"your-project-id",...}
```

For Option 2, paste the entire contents of your Firebase service account JSON file as the value for `FIREBASE_CREDENTIALS_JSON`.

### 4. Install Dependencies

The required dependencies are already included in `requirements.txt`. Make sure to install them:

```bash
pip install -r requirements.txt
```

## Security Considerations

- Keep your Firebase Admin SDK private key secure and never commit it to version control
- For production, consider using the `FIREBASE_CREDENTIALS_JSON` environment variable approach instead of a file
- The backend is configured to only allow users to access their own data

## Troubleshooting

If you encounter authentication issues:

1. Check the server logs for Firebase initialization errors
2. Ensure the Firebase credentials are properly configured (either file exists or environment variable is set)
3. Verify that the credentials have the correct permissions
4. Verify that the Firebase project settings match between frontend and backend
5. Check logs for specific error messages related to token verification

### Common Error: "The default Firebase app does not exist"

This error indicates that the Firebase Admin SDK failed to initialize properly. Check:
- The firebase-admin-sdk.json file exists and is valid
- OR the FIREBASE_CREDENTIALS_JSON environment variable is correctly set
- The server has permission to read the credential file
- The credential itself hasn't been revoked or expired

## How It Works

1. The frontend sends Firebase ID tokens with each API request in the Authorization header
2. The backend verifies these tokens using the Firebase Admin SDK
3. User-specific data access is enforced through middleware that checks if the authenticated user matches the requested resource

## Troubleshooting

If you encounter authentication issues:

1. Make sure the Firebase Admin SDK JSON file is in the correct location
2. Check that the frontend is correctly obtaining and sending valid ID tokens
3. Verify that the Firebase project settings match between frontend and backend
4. Check logs for specific error messages related to token verification 