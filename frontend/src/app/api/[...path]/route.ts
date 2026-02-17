import { NextRequest } from "next/server";

const BACKEND_API_BASE_URL = (
  process.env.BACKEND_API_BASE_URL ?? "http://127.0.0.1:8000"
).replace(/\/+$/, "");

function buildTargetUrl(baseUrl: string, path: string[], search: string) {
  return `${baseUrl}/${path.join("/")}${search}`;
}

function getBackendBaseCandidates() {
  if (process.env.BACKEND_API_BASE_URL) {
    return [BACKEND_API_BASE_URL];
  }
  if (BACKEND_API_BASE_URL.includes("127.0.0.1")) {
    return [BACKEND_API_BASE_URL, BACKEND_API_BASE_URL.replace("127.0.0.1", "localhost")];
  }
  if (BACKEND_API_BASE_URL.includes("localhost")) {
    return [BACKEND_API_BASE_URL, BACKEND_API_BASE_URL.replace("localhost", "127.0.0.1")];
  }
  return [BACKEND_API_BASE_URL];
}

async function proxy(request: NextRequest, path: string[]) {
  const baseCandidates = getBackendBaseCandidates();
  const method = request.method;
  const outboundHeaders = new Headers();
  const contentType = request.headers.get("content-type");

  if (contentType) {
    outboundHeaders.set("content-type", contentType);
  }

  let body: BodyInit | undefined;
  if (method !== "GET" && method !== "HEAD") {
    body = await request.arrayBuffer();
  }

  let backendResponse: Response | null = null;
  let lastError: unknown = null;
  for (const baseUrl of baseCandidates) {
    try {
      const targetUrl = buildTargetUrl(baseUrl, path, request.nextUrl.search);
      backendResponse = await fetch(targetUrl, {
        method,
        headers: outboundHeaders,
        body,
      });
      break;
    } catch (err) {
      lastError = err;
    }
  }

  if (!backendResponse) {
    const detail = `Backend unreachable at ${baseCandidates.join(" or ")}`;
    return Response.json(
      {
        detail,
        error: lastError instanceof Error ? lastError.message : "Unknown proxy error",
      },
      { status: 502 }
    );
  }

  const responseHeaders = new Headers();
  const passthroughHeaders = [
    "content-type",
    "content-disposition",
    "cache-control",
    "accept-ranges",
    "etag",
    "last-modified",
  ];
  for (const headerName of passthroughHeaders) {
    const value = backendResponse.headers.get(headerName);
    if (value) {
      responseHeaders.set(headerName, value);
    }
  }

  const responseBody = await backendResponse.arrayBuffer();
  return new Response(responseBody, {
    status: backendResponse.status,
    headers: responseHeaders,
  });
}

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ path: string[] }> }
) {
  const params = await context.params;
  return proxy(request, params.path);
}

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ path: string[] }> }
) {
  const params = await context.params;
  return proxy(request, params.path);
}

export async function PUT(
  request: NextRequest,
  context: { params: Promise<{ path: string[] }> }
) {
  const params = await context.params;
  return proxy(request, params.path);
}

export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ path: string[] }> }
) {
  const params = await context.params;
  return proxy(request, params.path);
}
