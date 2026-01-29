import Link from "next/link";

export default function HomePage() {
  return (
    <main className="p-6">
      <h1 className="text-2xl font-semibold">Max Kanban</h1>
      <p className="mt-2 text-slate-600">
        Authentication is wired via NextAuth (Google). Use the buttons below.
      </p>

      <div className="mt-4 flex gap-3">
        <Link
          className="inline-block rounded-lg bg-slate-900 px-4 py-2 text-white"
          href="/api/auth/signin"
        >
          Sign in
        </Link>
        <Link className="inline-block rounded-lg border px-4 py-2" href="/api/auth/signout">
          Sign out
        </Link>
      </div>

      <div className="mt-6 rounded-xl border p-4">
        <p className="text-slate-700">
          Next step: build the actual Kanban board (columns/cards) + task CRUD.
        </p>
      </div>
    </main>
  );
}
