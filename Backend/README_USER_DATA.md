# User Data Storage in PlateMate

## Overview

PlateMate stores user information in multiple places:

1. **Neon PostgreSQL Database**: Primary storage for all user profile data
2. **Local SQLite Database**: For offline functionality on the mobile app
3. **Firebase Authentication**: For user authentication and basic identity

## Database Schema

The `users` table in Neon PostgreSQL contains all user profile information:

- **Basic Info**: ID, Firebase UID, email, name, phone
- **Physical Attributes**: Height, weight, age, gender, activity level
- **Dietary Preferences**: Restrictions, allergies, cuisine preferences, spice tolerance
- **Health Goals**: Weight goal, health conditions, calorie targets, nutrient focus
- **App Settings**: Language, timezone, unit preference, etc.

## Data Flow

1. **User Registration**:
   - User registers via Firebase Authentication
   - Basic user info (Firebase UID, email, name) is stored in Neon database

2. **Onboarding Process**:
   - User completes onboarding flow entering detailed profile information
   - Profile data is sent to backend API and stored in Neon database

3. **Local Storage**:
   - App stores user preferences locally for offline functionality
   - When online, data syncs between local database and Neon database

## Scripts

### Creating/Updating Users

- `create_firebase_user.py`: Creates a basic user record with Firebase auth info
- `create_test_user.py`: Creates a fully populated test user with all fields

### Database Management

- `recreate_users_table.py`: Recreates the users table from scratch
- `check_users.py`: Displays all users and their profile data

## Requirements for User Setup

1. Firebase Auth UID must be stored with each user
2. User should only go through onboarding once
3. Profile data should be maintained in both Firebase and PostgreSQL

## Implementation Notes

- The frontend uses Firebase for authentication
- The `firebase_uid` field links users between Firebase Auth and our database
- The onboarding process checks if the user already exists before creating a new record
- The local database maintains a sync flag to know when to update from/to the server 