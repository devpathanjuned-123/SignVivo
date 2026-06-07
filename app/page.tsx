import Link from "next/link";

const features = [
  { title: "Upload any PDF", body: "Drag a PDF, add fields, hit send. That's it." },
  { title: "Sign in the browser", body: "Recipients sign with a click — no account, no app." },
  { title: "Legally tracked", body: "Every view and signature gets an IP, timestamp, and audit trail." },
  { title: "Affordable", body: "Built for freelancers and small teams. No enterprise pricing." },
];

const tiers = [
  { name: "Free Trial", price: "$0", note: "14 days, no card", cta: "Start free" },
  { name: "Starter", price: "$9/mo", note: "Freelancers", cta: "Choose Starter" },
  { name: "Pro", price: "$29/mo", note: "Growing teams", cta: "Choose Pro" },
  { name: "Business", price: "$99/mo", note: "Team collaboration & API", cta: "Choose Business" },
];

export default function LandingPage() {
  return (
    <main className="min-h-screen bg-gradient-to-b from-white to-gray-50">
      <header className="mx-auto max-w-6xl px-6 py-6 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="h-8 w-8 rounded-lg bg-brand-600 grid place-items-center text-white font-bold">S</div>
          <span className="text-lg font-semibold">SignVivo</span>
        </div>
        <nav className="flex items-center gap-2">
          <Link href="/sign-in" className="btn-ghost">Sign in</Link>
          <Link href="/sign-in" className="btn-primary">Get started</Link>
        </nav>
      </header>

      <section className="mx-auto max-w-4xl px-6 py-20 text-center">
        <p className="text-sm font-medium text-brand-700 mb-4">Affordable e-signatures for small business</p>
        <h1 className="text-4xl md:text-6xl font-bold tracking-tight">
          Sign documents in minutes,<br />not days.
        </h1>
        <p className="mt-6 text-lg text-gray-600 max-w-2xl mx-auto">
          SignVivo helps freelancers, real-estate agencies, HR firms, and growing teams collect legally
          binding electronic signatures — at a fraction of enterprise pricing.
        </p>
        <div className="mt-8 flex items-center justify-center gap-3">
          <Link href="/sign-in" className="btn-primary text-base px-6 py-3">Start free trial</Link>
          <Link href="#pricing" className="btn-secondary text-base px-6 py-3">See pricing</Link>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-6 py-16 grid md:grid-cols-4 gap-6">
        {features.map((f) => (
          <div key={f.title} className="card p-6">
            <h3 className="font-semibold mb-2">{f.title}</h3>
            <p className="text-sm text-gray-600">{f.body}</p>
          </div>
        ))}
      </section>

      <section id="pricing" className="mx-auto max-w-6xl px-6 py-16">
        <h2 className="text-3xl font-bold text-center mb-2">Simple, honest pricing</h2>
        <p className="text-center text-gray-600 mb-10">70–90% less than legacy enterprise platforms.</p>
        <div className="grid md:grid-cols-4 gap-6">
          {tiers.map((t) => (
            <div key={t.name} className="card p-6 flex flex-col">
              <h3 className="font-semibold">{t.name}</h3>
              <div className="text-3xl font-bold mt-2">{t.price}</div>
              <p className="text-sm text-gray-600 mt-1">{t.note}</p>
              <Link href="/sign-in" className="btn-secondary mt-6">{t.cta}</Link>
            </div>
          ))}
        </div>
      </section>

      <footer className="mx-auto max-w-6xl px-6 py-10 text-center text-sm text-gray-500">
        © {new Date().getFullYear()} SignVivo
      </footer>
    </main>
  );
}
