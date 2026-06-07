import Link from "next/link";

export default function CheckEmailPage() {
  return (
    <main className="min-h-screen grid place-items-center px-6">
      <div className="card w-full max-w-md p-8 text-center">
        <h1 className="text-2xl font-semibold mb-2">Check your email</h1>
        <p className="text-sm text-gray-600 mb-6">
          We sent you a magic link. Click it from the same browser to sign in.
        </p>
        <Link href="/" className="btn-secondary inline-flex">Back to home</Link>
      </div>
    </main>
  );
}
