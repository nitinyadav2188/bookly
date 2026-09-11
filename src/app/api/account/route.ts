import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { findUserById, updateUserName } from "@/lib/users";

export const runtime = "nodejs";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const user = findUserById(session.user.id);
  if (!user) {
    return NextResponse.json(
      {
        user: {
          id: session.user.id,
          name: session.user.name,
          email: session.user.email,
          avatarUrl: session.user.image,
        },
      },
      { status: 200 },
    );
  }
  return NextResponse.json({
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      avatarUrl: user.avatar_url,
      createdAt: user.created_at,
      updatedAt: user.updated_at,
    },
  });
}

export async function PATCH(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    const body = (await request.json()) as { name?: string };
    const user = updateUserName(session.user.id, String(body.name ?? ""));
    return NextResponse.json({ user });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Could not update account.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
