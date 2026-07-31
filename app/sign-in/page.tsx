import Link from "next/link";
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { appUrl } from "@/lib/utils";

export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; error?: string }>;
}) {
  const { next, error } = await searchParams;

  async function action(formData: FormData) {
    "use server";
    const email = String(formData.get("email") ?? "").trim();
    if (!email) redirect("/sign-in?error=Email%20is%20required");

    const supabase = await createSupabaseServerClient();
    const redirectTo = appUrl(`/auth/callback?next=${encodeURIComponent(next ?? "/dashboard")}`);

    const { error } = await supabase.auth.signInWithOtp({
      
      email,
      options: { emailRedirectTo: redirectTo, shouldCreateUser: true },
      
    });
    
    if (error) {
      redirect(`/sign-in?error=${encodeURIComponent(error.message)}`);
    }
    redirect("/sign-in/check-email");
  }

  return (
    <main className="min-h-screen grid place-items-center px-6">
      <div className="card w-full max-w-md p-8">
        <Link href="/" className="flex items-center gap-2 mb-6">
          <div className="h-8 w-8 rounded-lg bg-brand-600 grid place-items-center text-white font-bold">S</div>
          <span className="font-semibold">SignVivo</span>
        </Link>
        <h1 className="text-2xl font-semibold mb-2">Sign in to SignVivo</h1>
        <p className="text-sm text-gray-600 mb-6">
          We'll email you a one-time link to sign in. No password needed.
        </p>
        <form action={action} className="space-y-4">
          <div>
            <label htmlFor="email" className="label">Work email</label>
            <input
              id="email"
              name="email"
              type="email"
              required
              autoComplete="email"
              placeholder="you@company.com"
              className="input"
            />
          </div>
          <button type="submit" className="btn-primary w-full">Send magic link</button>
          <Link href="/">
          <button className="bg-gradient-to-r from-purple-800 to-blue-600 mt-3 p-3 rounded-lg text-white font-bold ">Back Home</button>
          </Link>
        </form>
        {error && <p className="text-xs text-red-600 mt-4 text-center">{error}</p>}
        <p className="text-xs text-gray-500 mt-6 text-center">
          By continuing you agree to our terms and acknowledge our privacy notice.
        </p>
      </div>
    </main>
  );
}
