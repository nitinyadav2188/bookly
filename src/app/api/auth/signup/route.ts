import { NextResponse } from "next/server";
import { createUser } from "@/lib/users";

export const runtime = "nodejs";

type SignupBody = {
  name?: string;
  email?: string;
  password?: string;
  confirmPassword?: string;
};

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as SignupBody;
    const name = String(body.name ?? "");
    const email = String(body.email ?? "");
    const password = String(body.password ?? "");
    const confirmPassword = String(body.confirmPassword ?? "");

    if (password !== confirmPassword) {
      return NextResponse.json({ error: "Passwords do not match." }, { status: 400 });
    }

    const user = await createUser({ name, email, password });
    return NextResponse.json({ user }, { status: 201 });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Could not create account.";
    const status = message.includes("already exists") ? 409 : 400;
    return NextResponse.json({ error: message }, { status });
  }
}
