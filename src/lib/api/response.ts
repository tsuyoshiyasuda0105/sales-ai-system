import { NextResponse } from "next/server";

export function ok<T>(data: T) {
  return NextResponse.json({
    ok: true,
    data
  });
}

export function badRequest(message: string) {
  return NextResponse.json(
    {
      ok: false,
      error: {
        code: "bad_request",
        message
      }
    },
    { status: 400 }
  );
}
