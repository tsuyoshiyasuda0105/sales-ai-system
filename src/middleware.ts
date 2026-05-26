import { NextResponse, type NextRequest } from "next/server";

export function middleware(request: NextRequest) {
  // Vercel Cron endpoints authenticate separately via the CRON_SECRET bearer token, not x-api-key.
  if (request.nextUrl.pathname.startsWith("/api/v1/cron/")) {
    return NextResponse.next();
  }

  const expectedApiKey = process.env.SALES_API_KEY;

  if (!expectedApiKey) {
    return NextResponse.json(
      {
        ok: false,
        error: {
          code: "server_misconfigured",
          message: "SALES_API_KEY is not configured."
        }
      },
      { status: 500 }
    );
  }

  const providedApiKey = request.headers.get("x-api-key");

  if (providedApiKey !== expectedApiKey) {
    return NextResponse.json(
      {
        ok: false,
        error: {
          code: "unauthorized",
          message: "Valid x-api-key header is required."
        }
      },
      { status: 401 }
    );
  }

  return NextResponse.next();
}

export const config = {
  matcher: "/api/v1/:path*"
};
