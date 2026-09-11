import { redirect } from "next/navigation";
import { auth } from "@/auth";
import AccountClient from "./AccountClient";

export const metadata = {
  title: "Account — Página",
  description: "Manage your Página display name.",
};

export default async function AccountPage() {
  const session = await auth();
  if (!session?.user) {
    redirect("/login?callbackUrl=/account");
  }
  return <AccountClient />;
}
