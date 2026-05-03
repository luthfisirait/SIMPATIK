import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";

import { Shell } from "@/components/layout/Shell";
import { authOptions } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const session = await getServerSession(authOptions);

  if (!session?.user) {
    redirect("/login");
  }

  return <Shell user={session.user}>{children}</Shell>;
}
