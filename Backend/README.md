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

## RevenueCat Configuration

PlateMate uses RevenueCat for subscription management and promotional trials. **This is required core functionality.**

### Environment Variables

Add these to your `.env` file or Render environment variables:

```bash
# RevenueCat Secret API Key (from RevenueCat Dashboard → API Keys)
REVENUECAT_API_KEY=your_secret_api_key_here

# Optional: RevenueCat Webhook Secret for validating webhook signatures
REVENUECAT_WEBHOOK_SECRET=your_webhook_secret_here
```

### Getting Your RevenueCat API Key

1. Go to [RevenueCat Dashboard](https://app.revenuecat.com/)
2. Navigate to **Settings** → **API Keys**
3. Copy your **Secret API Key** (starts with `sk_`)
4. Add it to your environment variables as `REVENUECAT_API_KEY`

### Important Notes

- **NO FALLBACKS**: If the RevenueCat API key is not configured, promotional trial grants will FAIL immediately
- This ensures you know right away if subscription functionality is broken
- The server will start without the key but will log critical errors prominently
- All RevenueCat-related endpoints will return 500 errors until the key is configured

### Promotional Trial System

- **20-day trial**: Automatically granted to new users via `/api/subscription/grant-promotional-trial`
- **+10-day extension**: Granted when users subscribe via `/api/subscription/grant-extended-trial`
- **Total**: 30 days free before billing starts

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

### RevenueCat API Errors

**Error: "RevenueCat API key not configured"**
- Solution: Add `REVENUECAT_API_KEY` to your environment variables
- Get your key from RevenueCat Dashboard → Settings → API Keys

**Error: "RevenueCat API failed: 401"**
- Solution: Your API key is invalid or expired
- Regenerate a new secret API key in the RevenueCat dashboard

**Error: "RevenueCat API failed: 404"**
- This is normal for new users who don't exist in RevenueCat yet
- The system will automatically create them when granting trials

**Startup Warning: "❌ CRITICAL: REVENUECAT_API_KEY environment variable not set!"**
- This is intentional - the server still starts but promotional trials will fail
- Configure the API key immediately to restore subscription functionality