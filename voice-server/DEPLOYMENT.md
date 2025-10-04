# Voice Server Deployment Guide

This guide walks you through deploying the voice-server to production using Railway.

## Prerequisites

1. **Railway Account** - Sign up at [railway.app](https://railway.app)
2. **GitHub Repository** - Voice-server code must be in a GitHub repo
3. **API Keys**:
   - OpenAI API Key
   - Deepgram API Key

## Deployment Steps

### Step 1: Prepare Your Environment

The voice-server is already configured for deployment with:
- `Dockerfile` - Container configuration
- `railway.json` - Railway-specific settings
- `.dockerignore` - Files to exclude from build

### Step 2: Deploy to Railway

#### Option A: Deploy via Railway Dashboard (Recommended)

1. **Create New Project**
   - Go to [railway.app/new](https://railway.app/new)
   - Click "Deploy from GitHub repo"
   - Select your repository
   - Railway will auto-detect the Dockerfile

2. **Configure Build Settings**
   - Railway should automatically use `railway.json` configuration
   - If not, manually set:
     - **Build Context**: `voice-server`
     - **Dockerfile Path**: `voice-server/Dockerfile`

3. **Set Environment Variables**
   - In Railway dashboard, go to "Variables" tab
   - Add the following variables:

   ```bash
   OPENAI_API_KEY=sk-proj-... # Your OpenAI API key
   DEEPGRAM_API_KEY=... # Your Deepgram API key
   NEXT_APP_URL=https://your-nextjs-app.vercel.app # Your production Next.js URL
   PORT=7860 # Optional, Railway auto-assigns if not set
   ```

4. **Deploy**
   - Click "Deploy" or Railway will auto-deploy
   - Wait for build to complete (~2-3 minutes)
   - Railway will provide a public URL (e.g., `voice-server-production.railway.app`)

#### Option B: Deploy via Railway CLI

```bash
# Install Railway CLI
npm install -g @railway/cli

# Login to Railway
railway login

# Initialize project (from repository root)
railway init

# Link to project
railway link

# Set environment variables
railway variables set OPENAI_API_KEY=sk-proj-...
railway variables set DEEPGRAM_API_KEY=...
railway variables set NEXT_APP_URL=https://your-app.vercel.app

# Deploy
railway up
```

### Step 3: Verify Deployment

1. **Check Health Endpoint**
   ```bash
   curl https://your-voice-server.railway.app/health
   ```

   Expected response:
   ```json
   {
     "status": "healthy",
     "ready": true,
     "services": ["deepgram_stt", "deepgram_tts", "openai_llm", "rag_api"]
   }
   ```

2. **Check Status Endpoint**
   ```bash
   curl https://your-voice-server.railway.app/status
   ```

### Step 4: Configure Next.js App

1. **Add Environment Variable**

   In your Next.js deployment platform (Vercel, etc.), add:
   ```bash
   NEXT_PUBLIC_VOICE_SERVER_URL=https://your-voice-server.railway.app
   ```

2. **Redeploy Next.js App**
   - Redeploy to pick up the new environment variable

3. **Update Voice-Server with Next.js URL**

   In Railway dashboard, update:
   ```bash
   NEXT_APP_URL=https://your-nextjs-app.vercel.app
   ```

### Step 5: Test End-to-End

1. Open your Next.js app
2. Click voice mode button
3. Verify voice server connects
4. Test speaking and receiving responses

## Environment Variables Reference

### Voice-Server (Railway)

| Variable | Required | Description | Example |
|----------|----------|-------------|---------|
| `OPENAI_API_KEY` | Yes | OpenAI API key for GPT-4o-mini | `sk-proj-...` |
| `DEEPGRAM_API_KEY` | Yes | Deepgram API key for STT/TTS | `abc123...` |
| `NEXT_APP_URL` | Yes | Production Next.js app URL | `https://app.vercel.app` |
| `PORT` | No | Server port (Railway auto-assigns) | `7860` |
| `BUSINESS_ID` | No | Default business context | `uuid...` |

### Next.js App (Vercel/Platform)

| Variable | Required | Description | Example |
|----------|----------|-------------|---------|
| `NEXT_PUBLIC_VOICE_SERVER_URL` | Yes | Voice-server production URL | `https://voice.railway.app` |

## Monitoring & Logs

### Railway Dashboard
- **Logs**: Click "Deployments" → Select deployment → View logs
- **Metrics**: Monitor CPU, memory, network usage
- **Health Checks**: Railway automatically monitors `/health` endpoint

### Common Issues

**1. Voice server not responding**
- Check Railway logs for errors
- Verify environment variables are set
- Ensure health check endpoint is accessible

**2. RAG API connection fails**
- Verify `NEXT_APP_URL` is correct in Railway
- Check CORS settings in Next.js app
- Ensure Next.js app is accessible from Railway

**3. Build fails**
- Check Dockerfile syntax
- Verify `pyproject.toml` dependencies
- Review Railway build logs

## Scaling

### Horizontal Scaling
Railway supports auto-scaling:
1. Go to Settings → Scaling
2. Enable autoscaling based on CPU/memory
3. Set min/max replicas

### Cost Optimization
- **Development**: Use Railway's free tier ($5 credit/month)
- **Production**: Estimated $10-30/month depending on usage
- Monitor usage in Railway dashboard

## Alternative Deployment Platforms

### Render.com
1. Create new Web Service
2. Connect GitHub repository
3. Set build command: `docker build -f voice-server/Dockerfile .`
4. Set start command: `uv run python simple_server.py`
5. Add environment variables

### Fly.io
1. Install flyctl: `brew install flyctl`
2. Create fly.toml in voice-server/
3. Deploy: `fly deploy`

### Google Cloud Run / AWS ECS
- Use the same Dockerfile
- Configure environment variables
- Set health check to `/health`
- Expose port 7860

## Security Considerations

1. **API Keys**: Store in environment variables, never commit to git
2. **CORS**: Voice-server allows all origins (`*`), update for production if needed
3. **HTTPS**: Railway provides automatic HTTPS
4. **Rate Limiting**: Consider adding rate limiting for production

## Rollback

If you need to rollback:

1. **Railway Dashboard**
   - Go to Deployments
   - Click on previous successful deployment
   - Click "Redeploy"

2. **Railway CLI**
   ```bash
   railway rollback
   ```

## Support

- Railway Docs: [docs.railway.app](https://docs.railway.app)
- Voice Server Issues: Check repository issues
- API Documentation: See `/api` endpoints in simple_server.py

## Next Steps

After successful deployment:
1. Monitor logs for 24 hours
2. Test voice functionality across browsers
3. Set up alerts for downtime
4. Configure auto-scaling if needed
5. Document your production URLs
