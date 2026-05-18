# Deploying AI Debate Arena

You have two easy options: Vercel or Netlify. Pick one.

## 0) Prereqs
- Push this folder to a Git repo (GitHub/ GitLab)
- Fill `.env` (copy `.env.example` to `.env`)
  - `VITE_API_BASE_URL` set to your backend URL (e.g. https://api.yourdomain.com)
  - Firebase keys (to enable Sign in)
  - Optionally set `VITE_REQUIRE_AUTH=true` to require login

## 1) Vercel (recommended)
1. Install Vercel CLI: `npm i -g vercel`
2. Login: `vercel login`
3. From this folder run: `vercel` (first deploy) then `vercel --prod`
   - Build command: `npm run build`
   - Output dir: `dist`
4. In Vercel dashboard → Project → Settings → Environment Variables
   - Add the vars from `.env`
5. Redeploy

## 2) Netlify
1. Install Netlify CLI: `npm i -g netlify-cli`
2. Login: `netlify login`
3. Init: `netlify init`
4. Deploy: `netlify deploy --build --prod`
5. Add env vars in Netlify → Site settings → Environment

## CORS
Make sure your backend allows your deployed domain:
- Access-Control-Allow-Origin: https://YOUR_APP_DOMAIN
- Allow methods/headers for SSE endpoints

## Firebase Setup (for Sign in)
1. Go to https://console.firebase.google.com → create project
2. Add Web App → copy config into `.env` (API key, authDomain, projectId, appId)
3. Enable Authentication → Sign-in method → Google → Enable
4. Add your domain in Authorized domains

## Local Dev
```bash
cp .env.example .env
# fill values
npm install
npm run dev
```

## Build
```bash
npm install
npm run build
```
