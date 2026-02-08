# Poker PWA Lite - Deployment Guide

## Prerequisites
- GitHub account (to push code)
- Vercel account (free, for frontend)
- Render account (free, for backend)

---

## Step 1: Push to GitHub

```bash
cd e:\SHVMSTORAGE\POKERTeST\poker-pwa-lite
git init
git add .
git commit -m "Initial poker PWA"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/poker-pwa-lite.git
git push -u origin main
```

---

## Step 2: Deploy Backend to Render

1. Go to [render.com](https://render.com) → New → Web Service
2. Connect your GitHub repo
3. Configure:
   - **Name**: `poker-pwa-backend`
   - **Root Directory**: `backend`
   - **Build Command**: `npm install && npm run build`
   - **Start Command**: `npm start`
   - **Environment Variables**: None needed

4. Click Deploy
5. Copy your backend URL (e.g., `https://poker-pwa-backend.onrender.com`)

---

## Step 3: Deploy Frontend to Vercel

1. Go to [vercel.com](https://vercel.com) → New Project
2. Import your GitHub repo
3. Configure:
   - **Root Directory**: `frontend`
   - **Framework Preset**: Vite
   - **Environment Variables**:
     - `VITE_BACKEND_URL` = `https://poker-pwa-backend.onrender.com` (your Render URL)

4. Click Deploy

---

## Step 4: Update Backend CORS (if needed)

If you see CORS errors, update `backend/src/index.ts`:
```typescript
const io = new Server(httpServer, {
  cors: {
    origin: ['https://your-frontend.vercel.app', 'http://localhost:5173'],
    methods: ['GET', 'POST']
  }
});
```

---

## Your URLs

After deployment:
- **Frontend**: `https://poker-pwa-lite.vercel.app`
- **Backend**: `https://poker-pwa-backend.onrender.com`

Share the frontend URL with friends to play! 🎮
