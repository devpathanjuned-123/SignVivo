import Link from "next/link";
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import Sidebar from "@/components/layout/Sidebar";
export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/sign-in");

  return (
    <div className="min-h-screen">
      <header className="border-b bg-white">
        <div className="mx-auto max-w-6xl px-6 h-14 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <div className="h-7 w-7 rounded-md bg-brand-600 grid place-items-center text-white font-bold text-sm">S</div>
            <span className="font-semibold">SignVivo</span>
          </Link>
          <div className="flex items-center gap-3">
            <span className="text-sm text-gray-600">{user.email}</span>
            
            <form action="/auth/signout" method="post">
              <button className="btn-ghost text-sm">Sign out</button>
            </form>
          </div>
        </div>
      </header>
      <div className="flex min-h-[calc(100vh-56px)]">
        <Sidebar/>
        {children}</div>
    </div>
  );
}
