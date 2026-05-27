import { NextResponse, type NextRequest } from "next/server";

export function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname;

  // 1. Vercel Cron endpoints authenticate via CRON_SECRET bearer in the route itself.
  if (pathname.startsWith("/api/v1/cron/")) {
    return NextResponse.next();
  }

  // 2. Other /api/v1/* endpoints: require x-api-key (= SALES_API_KEY).
  if (pathname.startsWith("/api/v1/")) {
    const expectedApiKey = process.env.SALES_API_KEY;

    if (!expectedApiKey) {
      return NextResponse.json(
        {
          ok: false,
          error: { code: "server_misconfigured", message: "SALES_API_KEY is not configured." }
        },
        { status: 500 }
      );
    }

    const providedApiKey = request.headers.get("x-api-key");
    if (providedApiKey !== expectedApiKey) {
      return NextResponse.json(
        {
          ok: false,
          error: { code: "unauthorized", message: "Valid x-api-key header is required." }
        },
        { status: 401 }
      );
    }

    return NextResponse.next();
  }

  // 3. Pages: optional Basic Auth gate. Only active when SITE_USERNAME and SITE_PASSWORD are
  // both set (so local dev / first deploys still work without setup); set both in Vercel env
  // vars to actually require credentials.
  const siteUsername = process.env.SITE_USERNAME;
  const sitePassword = process.env.SITE_PASSWORD;

  if (siteUsername && sitePassword) {
    const header = request.headers.get("authorization");
    let authorized = false;

    if (header && header.toLowerCase().startsWith("basic ")) {
      try {
        const decoded = atob(header.slice(6).trim());
        const separator = decoded.indexOf(":");
        if (separator > 0) {
          const user = decoded.slice(0, separator);
          const pass = decoded.slice(separator + 1);
          if (user === siteUsername && pass === sitePassword) {
            authorized = true;
          }
        }
      } catch {
        // fall through to 401
      }
    }

    if (!authorized) {
      return new NextResponse("Authentication required.", {
        status: 401,
        headers: { "WWW-Authenticate": 'Basic realm="Sedori AI", charset="UTF-8"' }
      });
    }
  }

  return NextResponse.next();
}

export const config = {
  // Match both API routes and page routes (except Next internals and static assets) so the
  // page-level Basic Auth check above can run on rendered pages.
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"]
};
