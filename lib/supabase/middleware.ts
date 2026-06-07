import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import type { Database } from "@/types/database";

/**
 * Refreshes the Supabase session on every request and forwards the new
 * cookies to the response. Required by @supabase/ssr.
 *
 * Also redirects unauthenticated visitors away from /dashboard and
 * /documents/* to /sign-in.
 */
export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(toSet) {
          toSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          toSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  const { data: { user } } = await supabase.auth.getUser();

  const url = new URL(request.url);
  const isProtected =
    url.pathname.startsWith("/dashboard") ||
    url.pathname.startsWith("/documents");

  if (isProtected && !user) {
    const redirectUrl = new URL("/sign-in", request.url);
    redirectUrl.searchParams.set("next", url.pathname + url.search);
    return NextResponse.redirect(redirectUrl);
  }

  return response;
}
