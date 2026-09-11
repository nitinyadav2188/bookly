import { NextResponse } from "next/server";
import { authConfig } from "@/auth";

export async function GET() {
  return NextResponse.json({
    googleEnabled: authConfig.googleEnabled,
  });
}
