# Cloudflare Access Setup Guide

This guide explains how to set up Cloudflare Access (free tier) for authentication on the Pain Point Finder.

## Overview

Cloudflare Access provides:
- **Free for up to 50 users** (Zero Trust free tier)
- **Email OTP authentication** (no password needed)
- **JWT-based sessions** (verified by Cloudflare, passed to Worker)
- **Simple setup** via Cloudflare Dashboard

## Prerequisites

- Cloudflare account with the domain `koda-software.com` (or your domain) connected
- The Worker deployed at `ideas.koda-software.com`

## Step 1: Enable Cloudflare Zero Trust

1. Go to [Cloudflare Dashboard](https://dash.cloudflare.com)
2. Click **Zero Trust** in the left sidebar (or go to [one.dash.cloudflare.com](https://one.dash.cloudflare.com))
3. If this is your first time, create a team name (e.g., `koda-software`)
4. Choose the **Free plan** (up to 50 users)

## Step 2: Create an Access Application

1. In Zero Trust dashboard, go to **Access** → **Applications**
2. Click **Add an application**
3. Select **Self-hosted**

### Application Configuration

**Application name:** `Pain Point Finder`

**Session Duration:** `24 hours` (or your preference)

### Application Domain

Add the following subdomain:
- **Subdomain:** `ideas`
- **Domain:** `koda-software.com`
- **Path:** Leave empty (protects entire subdomain)

### Policy Configuration

Create a policy to control who can access:

**Policy name:** `Email OTP Login`

**Action:** `Allow`

**Include rules:**
- **Selector:** `Emails ending in`
- **Value:** `@gmail.com` (or leave open with `@` to allow any email)

Or for more restrictive access:
- **Selector:** `Emails`
- **Value:** List specific allowed emails

## Step 3: Configure Authentication Methods

1. Go to **Settings** → **Authentication**
2. Under **Login methods**, enable:
   - ✅ **One-time PIN** (email OTP) - Recommended for simplicity
   
Optional methods (if needed):
- Google
- GitHub
- Microsoft

## Step 4: Verify JWT Settings

The Worker automatically receives the JWT in the `CF-Access-JWT-Assertion` header. No additional configuration needed.

## Step 5: Run Database Migration

After deploying the updated Worker, run the migration to create the users table:

```bash
curl -X POST https://ideas.koda-software.com/api/trigger/migrate-v18-auth
```

## How It Works

### Authentication Flow

1. User visits `ideas.koda-software.com`
2. Cloudflare Access intercepts and shows login page
3. User enters email, receives OTP
4. User enters OTP, Cloudflare creates session
5. Cloudflare adds JWT to all requests as `CF-Access-JWT-Assertion` header
6. Worker extracts email from JWT, creates/updates user in DB
7. Frontend receives user info via `/api/me` endpoint

### Public vs Protected Routes

By default, Cloudflare Access protects **ALL** routes under the application domain.

If you want some routes to be public (like a landing page):

1. In Access Application settings, click **Add a path rule**
2. Add exception paths:
   - Path: `/api/stats` → **Bypass** (public stats)
   - Path: `/public/*` → **Bypass** (if you have public pages)

### JWT Payload Structure

The JWT contains:
```json
{
  "aud": ["32eafc7c8a610b..."],  // Application audience tag
  "email": "user@example.com",   // User's email
  "exp": 1706745600,             // Expiration timestamp
  "iat": 1706659200,             // Issued at
  "iss": "https://koda-software.cloudflareaccess.com",
  "sub": "a1b2c3d4-...",         // User ID
  "type": "app"
}
```

## API Endpoints

### Get Current User
```
GET /api/me
```

Returns:
```json
{
  "authenticated": true,
  "user": {
    "id": 1,
    "email": "user@example.com",
    "plan": "free",
    "first_seen": 1706659200000,
    "last_seen": 1706745600000,
    "preferences": {}
  }
}
```

### Update Preferences
```
POST /api/me/preferences
Content-Type: application/json

{
  "preferences": {
    "theme": "dark",
    "notifications": true
  }
}
```

### Logout
```
GET /api/logout
```

Returns logout URL. Frontend should redirect to it:
```json
{
  "logout_url": "https://ideas.koda-software.com/cdn-cgi/access/logout"
}
```

## Troubleshooting

### "Not authenticated" but logged in
- Check browser cookies are enabled
- Verify the domain matches exactly
- Try clearing cookies and re-authenticating

### JWT not received
- Ensure Cloudflare Access is enabled for the domain
- Check the application is set to "Self-hosted"
- Verify DNS is proxied through Cloudflare (orange cloud)

### Can't access application
- Check policy rules allow your email/domain
- Verify OTP method is enabled
- Check spam folder for OTP emails

## Cost

**Free tier includes:**
- Up to 50 users
- Unlimited login methods
- Session management
- Basic logging

No credit card required.

## Security Notes

1. **JWT Trust**: We trust the JWT without re-verifying since Cloudflare has already verified it. For extra security, you can verify the signature using the team's public key.

2. **Session Management**: Sessions are managed by Cloudflare. Users can be revoked from the Zero Trust dashboard.

3. **Audit Logs**: Access logs are available in Zero Trust → Logs → Access.
