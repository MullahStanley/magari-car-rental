# Cloudflare CDN Implementation Guide

This project includes a complete, production-ready Cloudflare CDN setup to accelerate delivery of vehicle assets (large 3D GLB models and vehicle gallery images), reduce Supabase bandwidth/egress, and deliver lower latency worldwide.

---

## 1. Architecture Overview

```
                                  ┌────────────────────────┐
                                  │      Client Browser    │
                                  └───────────┬────────────┘
                                              │
                      ┌───────────────────────┴───────────────────────┐
                      │                                               │
             (1) Web Pages & UI                              (2) Static Assets & Models
                      │                                               │
                      ▼                                               ▼
           ┌──────────────────────┐                      ┌─────────────────────────┐
           │ Next.js Application  │                      │ Cloudflare CDN Edge     │
           │ (Vercel / Node Host) │                      │ (Worker / Custom Domain)│
           └──────────────────────┘                      └────────────┬────────────┘
                                                                      │
                                                           Cache Hit? │
                                                               ├──────┴──────┐
                                                               │             │
                                                            Yes (HIT)     No (MISS)
                                                               │             │
                                                               ▼             ▼
                                                        [Fast Edge]   [Fetch & Cache]
                                                                             │
                                                                             ▼
                                                                  ┌────────────────────┐
                                                                  │  Supabase Storage  │
                                                                  │  (vehicle-assets)  │
                                                                  └────────────────────┘
```

### Caching Strategy

| Asset Type | Path / Extension | Cache Header | Edge TTL | Invalidation Strategy |
|---|---|---|---|---|
| **3D Models** | `.glb`, `.gltf`, `.bin` | `public, max-age=31536000, immutable` | 1 Year | Query versioning (`?v=N` via `MODEL_ASSET_VERSION`) |
| **Vehicle Images** | `.jpg`, `.png`, `.webp`, `.svg` | `public, max-age=2592000, stale-while-revalidate=86400` | 30 Days | Path timestamp (`/images/:id/:timestamp.ext`) |
| **Next.js Static Bundles** | `/_next/static/*` | `public, max-age=31536000, immutable` | 1 Year | Hashed bundle names |
| **Missing Assets (404)** | Any | `public, max-age=60` | 1 Minute | Short TTL protects origin while allowing newly uploaded files to show |

---

## 2. Quick Start: Deploying the Cloudflare Worker

The included worker in [`cloudflare/`](../cloudflare/) acts as an edge caching proxy in front of Supabase Storage. It handles CORS preflight, Range requests (for progressive 3D model loading), and edge caching using the Cloudflare Cache API.

### Step 1: Login to Cloudflare Wrangler

```bash
npx wrangler login
```

### Step 2: Deploy the Worker

```bash
npm run cdn:deploy
```

Once deployed, Wrangler will output your worker's public URL, for example:
`https://magari-assets-cdn.<your-subdomain>.workers.dev`

### Step 3: Configure Environment Variable

In your `.env.local` (and your production deployment platform, e.g., Vercel):

```bash
NEXT_PUBLIC_CDN_URL=https://magari-assets-cdn.<your-subdomain>.workers.dev
```

Restart your development server or redeploy:
```bash
npm run dev
```

Now, all 3D vehicle models and uploaded car images will automatically route through Cloudflare edge caching!

---

## 3. Custom Domain Setup (e.g., `cdn.yourdomain.com`)

If you manage your domain on Cloudflare, you can attach a custom subdomain directly to your worker or create a DNS proxy:

### Method A: Custom Domain on the Worker (Recommended)

1. Open **Cloudflare Dashboard** → **Workers & Pages** → select `magari-assets-cdn`.
2. Go to **Settings** → **Domains & Routes** → **Add Domain**.
3. Enter your desired CDN subdomain (e.g., `cdn.magaricarrental.com`).
4. Update your `NEXT_PUBLIC_CDN_URL`:
   ```bash
   NEXT_PUBLIC_CDN_URL=https://cdn.magaricarrental.com
   ```

### Method B: Cloudflare Cache Rules on a Subdomain (Without Worker)

If you prefer using Cloudflare DNS and Cache Rules directly:
1. In Cloudflare DNS, add a **CNAME** record:
   - Name: `cdn` (or `assets`)
   - Target: `<your-project-ref>.supabase.co`
   - Proxy status: **Proxied (Orange Cloud)**
2. In Cloudflare Dashboard, go to **Caching** → **Cache Rules** → **Create rule**:
   - Rule name: `Cache Supabase Storage Assets`
   - Matching criteria: `(http.host eq "cdn.yourdomain.com")`
   - Cache Eligibility: **Eligible for cache**
   - Edge Cache TTL: **Respect origin cache control** or **Override (30 days)**
   - Browser Cache TTL: **Respect origin cache control**

---

## 4. Cache Purging and Versioning

### 3D Models Versioning (Zero API Setup)

When uploading new or updated 3D models using `npm run upload:models`:
1. Open [`src/lib/utils.ts`](../src/lib/utils.ts).
2. Increment `MODEL_ASSET_VERSION`:
   ```typescript
   const MODEL_ASSET_VERSION = 3;
   ```
3. This appends `?v=3` to every 3D model URL, immediately bypassing stale edge and browser caches worldwide without needing manual API cache purges.

### Manual Cache Purge via Script

To purge the Cloudflare CDN cache via the Cloudflare API:

1. Add your Cloudflare credentials to `.env.local`:
   ```bash
   CLOUDFLARE_API_TOKEN=your-cloudflare-api-token
   CLOUDFLARE_ZONE_ID=your-cloudflare-zone-id
   ```
2. Run the purge script:
   ```bash
   # Purge specific model(s)
   npm run cdn:purge -- --files models/tesla_model_x_2020.glb

   # Purge entire cache
   npm run cdn:purge -- --all
   ```

---

## 5. Verification & Testing

To verify that assets are being served and cached by Cloudflare:

### 1. Test the Health Endpoint
```bash
curl -I https://magari-assets-cdn.<your-subdomain>.workers.dev/health
```
Expected response: `HTTP/2 200` with JSON health status.

### 2. Verify Edge Cache Hit
Fetch a 3D model twice:
```bash
# First request (MISS from edge, fetched from Supabase):
curl -sI "https://magari-assets-cdn.<your-subdomain>.workers.dev/models/tesla_model_x_2020.glb?v=2" | grep -i "cache"

# Second request (HIT from edge cache):
curl -sI "https://magari-assets-cdn.<your-subdomain>.workers.dev/models/tesla_model_x_2020.glb?v=2" | grep -i "cache"
```
Look for:
- `x-cdn-cache: HIT`
- `cf-cache-status: HIT`
- `cache-control: public, max-age=31536000, immutable`
- `access-control-allow-origin: *`

### 3. Verify in Browser DevTools
Open Network tab in DevTools, navigate to the 3D Showroom (`/` or `/cars/[id]`), and inspect the `.glb` download request. The response time will drop dramatically (often from ~1.5s to <100ms) once cached at your local Cloudflare PoP.
