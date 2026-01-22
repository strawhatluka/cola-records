# Quick Setup Guide

## Step 1: Create your environment file

```bash
# Copy the example file
cp .env.example .env.local

# Or on Windows PowerShell:
copy .env.example .env.local
```

## Step 2: Add your GitHub token

1. Go to https://github.com/settings/tokens
2. Click "Generate new token (classic)"
3. Give it a name like "Cola Records"
4. Select scopes:
   - ✅ `public_repo`
   - ✅ `read:user`
5. Click "Generate token"
6. Copy the token (starts with `ghp_`)

## Step 3: Edit .env.local

Open `.env.local` and replace the placeholder:

```env
GITHUB_TOKEN=ghp_your_actual_token_here
```

## Step 4: Run the app

```bash
flutter run -d windows  # or macos/linux
```

## Notes

- The `.env.local` file is gitignored and won't be committed
- The token is automatically loaded on app startup
- It's stored securely using `flutter_secure_storage`
- You only need to set it up once

## Troubleshooting

**Warning about `.env.local` doesn't exist**
- This is expected until you create the file
- The warning will disappear after you create `.env.local`

**Token not working**
- Make sure you copied the entire token (starts with `ghp_`)
- Verify the token has the correct scopes
- Try generating a new token if issues persist
