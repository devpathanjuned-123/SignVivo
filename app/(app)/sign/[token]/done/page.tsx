export default function DonePage() {
  return (
    <main className="min-h-screen grid place-items-center p-6">
      <div className="card p-10 max-w-md text-center">
        <div className="h-12 w-12 mx-auto rounded-full bg-emerald-100 grid place-items-center mb-4">
          <svg viewBox="0 0 24 24" className="h-6 w-6 text-emerald-700" fill="none" stroke="currentColor" strokeWidth="2.5">
            <path d="M4 12l5 5L20 6" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>
        <h1 className="text-xl font-semibold mb-2">Signed and submitted</h1>
        <p className="text-sm text-gray-600">
          Thank you. You'll receive an email with the completed document once all parties have signed.
        </p>
      </div>
    </main>
  );
}