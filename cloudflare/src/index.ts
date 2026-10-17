/**
 * Cloudflare CDN Worker for Magari Car Rental
 *
 * Edge caching proxy for Supabase Storage vehicle assets (3D GLB models and images).
 *
 * Features:
 * - Ultra-fast global edge caching via Cloudflare Cache API (caches.default).
 * - Automatic immutable caching for versioned 3D models (.glb/.gltf) for 1 year.
 * - Stale-while-revalidate caching for vehicle images.
 * - Full CORS support (Access-Control-Allow-Origin: *) for WebGL/Three.js GLTF loaders.
 * - Transparent Range request (HTTP 206) support for chunked 3D model loading.
 * - Automatic path rewriting supporting both canonical Supabase paths and clean bucket paths.
 * - Cache status debugging headers (CF-Cache-Status / X-CDN-Cache).
 */

export interface Env {
  SUPABASE_URL: string;
  DEFAULT_BUCKET?: string;
}

const DEFAULT_ORIGIN = "https://mjrdngowtmhzybzrrfjy.supabase.co";
const DEFAULT_BUCKET_NAME = "vehicle-assets";

// Content type detection & caching rules
const THREE_D_MODEL_REGEX = /\.(glb|gltf|bin)(\?.*)?$/i;
const IMAGE_REGEX = /\.(jpe?g|png|webp|svg|gif|avif|ico)(\?.*)?$/i;

const CORS_HEADERS: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, HEAD, OPTIONS",
  "Access-Control-Allow-Headers":
    "Range, Content-Type, Authorization, If-None-Match, If-Modified-Since",
  "Access-Control-Expose-Headers":
    "Content-Length, Content-Range, ETag, Accept-Ranges, CF-Cache-Status, X-CDN-Cache",
  "Access-Control-Max-Age": "86400",
};

export default {
  async fetch(
    request: Request,
    env: Env,
    ctx: ExecutionContext
  ): Promise<Response> {
    const url = new URL(request.url);

    // 1. Handle CORS preflight requests
    if (request.method === "OPTIONS") {
      return new Response(null, {
        status: 204,
        headers: CORS_HEADERS,
      });
    }

    // 2. Reject unsupported methods (CDN is read-only)
    if (request.method !== "GET" && request.method !== "HEAD") {
      return new Response(
        JSON.stringify({ error: "Method not allowed. CDN only supports GET, HEAD, OPTIONS." }),
        {
          status: 405,
          headers: {
            "Content-Type": "application/json",
            Allow: "GET, HEAD, OPTIONS",
            ...CORS_HEADERS,
          },
        }
      );
    }

    // 3. Health check and info endpoints
    if (url.pathname === "/health" || url.pathname === "/healthz") {
      return new Response(
        JSON.stringify({
          status: "healthy",
          service: "magari-assets-cdn",
          supabase_origin: env.SUPABASE_URL || DEFAULT_ORIGIN,
          default_bucket: env.DEFAULT_BUCKET || DEFAULT_BUCKET_NAME,
          timestamp: new Date().toISOString(),
        }),
        {
          status: 200,
          headers: {
            "Content-Type": "application/json",
            "Cache-Control": "no-store",
            ...CORS_HEADERS,
          },
        }
      );
    }

    if (url.pathname === "/") {
      return new Response(
        JSON.stringify({
          service: "Magari Car Rental - Cloudflare CDN Edge Cache",
          status: "online",
          version: "1.0.0",
          routes: {
            storage: "/storage/v1/object/public/<bucket>/<path>",
            clean: "/<bucket>/<path>",
            models: "/models/<model-name>.glb",
            images: "/images/<image-name>.jpg",
            health: "/health",
          },
        }),
        {
          status: 200,
          headers: {
            "Content-Type": "application/json",
            "Cache-Control": "public, max-age=3600",
            ...CORS_HEADERS,
          },
        }
      );
    }

    // 4. Resolve origin URL path
    const originBase = (env.SUPABASE_URL || DEFAULT_ORIGIN).replace(/\/+$/, "");
    const bucket = env.DEFAULT_BUCKET || DEFAULT_BUCKET_NAME;

    let targetPath = url.pathname;
    if (targetPath.startsWith("/storage/v1/object/public/")) {
      // Direct canonical Supabase Storage path
      targetPath = targetPath;
    } else if (targetPath.startsWith(`/${bucket}/`)) {
      // Shorthand with bucket name: /vehicle-assets/...
      targetPath = `/storage/v1/object/public${targetPath}`;
    } else if (targetPath.startsWith("/models/") || targetPath.startsWith("/images/")) {
      // Shorthand directly to asset type: /models/foo.glb or /images/foo.jpg
      targetPath = `/storage/v1/object/public/${bucket}${targetPath}`;
    } else {
      // Default to bucket prefix
      targetPath = `/storage/v1/object/public/${bucket}${targetPath}`;
    }

    const targetUrl = new URL(`${originBase}${targetPath}${url.search}`);

    // 5. Check Cloudflare Edge Cache (only for GET requests without Range header)
    const cache = caches.default;
    const isRangeRequest = request.headers.has("Range");
    const cacheKey = new Request(url.toString(), {
      method: "GET",
      headers: request.headers,
    });

    if (!isRangeRequest && request.method === "GET") {
      const cachedResponse = await cache.match(cacheKey);
      if (cachedResponse) {
        const responseHeaders = new Headers(cachedResponse.headers);
        responseHeaders.set("X-CDN-Cache", "HIT");
        for (const [key, value] of Object.entries(CORS_HEADERS)) {
          responseHeaders.set(key, value);
        }
        return new Response(cachedResponse.body, {
          status: cachedResponse.status,
          statusText: cachedResponse.statusText,
          headers: responseHeaders,
        });
      }
    }

    // 6. Cache Miss — Fetch from Origin (Supabase Storage)
    const originHeaders = new Headers();
    const forwardHeaders = [
      "range",
      "if-none-match",
      "if-modified-since",
      "accept",
      "accept-encoding",
    ];
    for (const header of forwardHeaders) {
      const value = request.headers.get(header);
      if (value) originHeaders.set(header, value);
    }

    try {
      const originResponse = await fetch(targetUrl.toString(), {
        method: request.method,
        headers: originHeaders,
      });

      // 7. Handle 304 Not Modified
      if (originResponse.status === 304) {
        const headers = new Headers(originResponse.headers);
        for (const [key, value] of Object.entries(CORS_HEADERS)) {
          headers.set(key, value);
        }
        return new Response(null, { status: 304, headers });
      }

      // 8. Determine cache policy based on asset type
      const is3DModel = THREE_D_MODEL_REGEX.test(url.pathname) || THREE_D_MODEL_REGEX.test(targetPath);
      const isImage = IMAGE_REGEX.test(url.pathname) || IMAGE_REGEX.test(targetPath);

      let cacheControl = "public, max-age=604800, stale-while-revalidate=86400"; // 7 days default
      let cfTtl = 604800;

      if (is3DModel) {
        // 3D models: 1 year cache. Versioned via ?v=N query parameter
        cacheControl = "public, max-age=31536000, immutable";
        cfTtl = 31536000;
      } else if (isImage) {
        // Vehicle images: 30 days cache + stale-while-revalidate
        cacheControl = "public, max-age=2592000, stale-while-revalidate=86400";
        cfTtl = 2592000;
      }

      if (originResponse.status === 404) {
        // Cache 404s briefly (60s) to prevent origin stampedes while allowing newly uploaded assets to appear
        cacheControl = "public, max-age=60";
        cfTtl = 60;
      }

      // 9. Prepare response headers with CORS & caching
      const responseHeaders = new Headers(originResponse.headers);
      responseHeaders.set("Cache-Control", cacheControl);
      responseHeaders.set("X-CDN-Cache", "MISS");
      for (const [key, value] of Object.entries(CORS_HEADERS)) {
        responseHeaders.set(key, value);
      }

      // Ensure proper content type for 3D GLB models if Supabase sent generic octet-stream
      if (is3DModel && (!responseHeaders.get("Content-Type") || responseHeaders.get("Content-Type") === "application/octet-stream")) {
        responseHeaders.set("Content-Type", "model/gltf-binary");
      }

      const clientResponse = new Response(originResponse.body, {
        status: originResponse.status,
        statusText: originResponse.statusText,
        headers: responseHeaders,
      });

      // 10. Cache successful 200 responses asynchronously in Cloudflare edge
      if (
        originResponse.status === 200 &&
        request.method === "GET" &&
        !isRangeRequest
      ) {
        const cacheResponse = clientResponse.clone();
        ctx.waitUntil(cache.put(cacheKey, cacheResponse));
      }

      return clientResponse;
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to connect to storage origin";
      return new Response(
        JSON.stringify({
          error: "Bad Gateway",
          message,
          origin: targetUrl.toString(),
        }),
        {
          status: 502,
          headers: {
            "Content-Type": "application/json",
            "Cache-Control": "no-store",
            ...CORS_HEADERS,
          },
        }
      );
    }
  },
};
