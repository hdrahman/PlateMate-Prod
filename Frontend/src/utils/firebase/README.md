# Firebase Integration Guide

## Important: Firebase Initialization

This directory contains the only Firebase initialization code for the PlateMate app. To avoid the `app/duplicate-app` error, follow these guidelines:

### DO:
- Always import Firebase from the `utils/firebase/index` file
  ```typescript
  // Correct usage
  import { Auth, auth } from '../utils/firebase/index';
  // or
  import { getStoredAuthToken } from '../utils/firebase/auth';
  ```

### DON'T:
- Don't create additional Firebase initialization code
- Don't import Firebase directly in multiple places
- Don't use `firebaseConfig.js` or similar files to initialize Firebase

## Common Error

If you see this error, it means Firebase is being initialized multiple times:

```
[FirebaseError: Firebase: Firebase App named '[DEFAULT]' already exists with different options or config (app/duplicate-app).]
```

## Firebase Modules

The following modules are exported from `utils/firebase/index.ts`:

- `app`: The Firebase app instance
- `auth`: The Firebase auth instance
- `Auth`: All Firebase auth functions (from 'firebase/auth')
- `getStoredAuthToken()`: Get the stored Firebase auth token
- `getStoredUser()`: Get the stored user data 