import { APP_NAME, APP_TAGLINE } from "@allplay/shared";

export default function HomePage() {
  return (
    <main className="mx-auto flex min-h-screen max-w-3xl flex-col justify-center px-6 py-16">
      <p className="mb-4 text-sm font-semibold tracking-widest text-electric">{APP_NAME}</p>
      <h1 className="text-4xl font-semibold tracking-tight sm:text-6xl">{APP_TAGLINE}</h1>
      <section aria-labelledby="foundation-title" className="mt-10 rounded-2xl bg-surface p-6">
        <h2 id="foundation-title" className="text-lg font-semibold">
          Project foundation
        </h2>
        <p className="mt-3 leading-relaxed text-slate-300">
          This is the Phase 1 development shell. Rooms, the music library, administrator login and
          synchronized playback are not available yet.
        </p>
      </section>
    </main>
  );
}
