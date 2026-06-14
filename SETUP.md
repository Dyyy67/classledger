# ClassLedger – Setup Guide

## Prerequisites
- Node.js 18+ installed
- A Google account (for Firebase)

---

## Step 1: Create a Firebase Project

1. Go to [https://console.firebase.google.com](https://console.firebase.google.com)
2. Click **"Add project"** → name it `classledger` → click through
3. On the project dashboard, click the **Web icon `</>`** to register a web app
4. Give it the name `ClassLedger Web` → click **Register app**
5. Copy the `firebaseConfig` values shown — you'll need them in Step 3

---

## Step 2: Enable Firebase Services

### Authentication
1. In the Firebase console, go to **Build → Authentication**
2. Click **"Get started"** → **Sign-in method**
3. Enable **Email/Password** → Save

### Firestore Database
1. Go to **Build → Firestore Database**
2. Click **"Create database"**
3. Select **"Start in production mode"** → Choose a region (e.g., `asia-southeast1` for PH) → Done

### Deploy Security Rules
1. Go to **Firestore → Rules tab**
2. Replace the default rules with the contents of `firestore.rules` in this project
3. Click **Publish**

---

## Step 3: Configure Environment Variables

1. In the project root, copy `.env.example` to `.env`:
   ```
   cp .env.example .env
   ```
2. Open `.env` and fill in the values from your Firebase project settings:
   ```
   VITE_FIREBASE_API_KEY=AIza...
   VITE_FIREBASE_AUTH_DOMAIN=classledger-abc.firebaseapp.com
   VITE_FIREBASE_PROJECT_ID=classledger-abc
   VITE_FIREBASE_STORAGE_BUCKET=classledger-abc.appspot.com
   VITE_FIREBASE_MESSAGING_SENDER_ID=123456789
   VITE_FIREBASE_APP_ID=1:123456789:web:abc123
   ```

---

## Step 4: Install & Run

```bash
npm install
npm run dev
```

Open [http://localhost:5173](http://localhost:5173) in your browser.

---

## Step 5: First Use

1. Open the app and click **"Create Account"**
2. Fill in your full name, email, and password
3. You'll be prompted to create your first classroom (e.g., "Grade 4 – Beryl", "2025–2026")
4. Start adding students, campaigns, and transactions!

---

## Deployment (Optional)

To deploy to Firebase Hosting (free):

```bash
npm run build
npm install -g firebase-tools
firebase login
firebase init hosting   # set public dir to: dist
firebase deploy
```

Or deploy to **Vercel** (even easier):
```bash
npm install -g vercel
vercel
```

---

## Features Summary

| Feature | How it works |
|---|---|
| Receipt Sharing | After logging an income payment, tap "Share Receipt" to open WhatsApp or copy the message |
| Export Report | On the Ledger page, tap "Export Report" to download the ledger as a PNG image |
| Offline-first feel | Firestore caches data locally — works even with spotty internet |
| Multi-classroom | Create multiple classrooms and switch between them in the sidebar |
| Secure | Each teacher only sees their own data (Firestore Rules enforce this server-side) |
