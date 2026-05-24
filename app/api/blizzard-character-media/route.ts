import { NextResponse } from "next/server";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);

  const realm = searchParams.get("realm");
  const name = searchParams.get("name");

  if (!realm || !name) {
    return NextResponse.json({ error: "Missing realm or name" }, { status: 400 });
  }

  return NextResponse.json({
    renderUrl: null,
    message: "API route created. Next step is Blizzard token setup.",
  });
}