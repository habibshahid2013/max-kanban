import { auth, signOut } from "@/auth";
import Link from "next/link";

export default async function HomePage() {
  const session = await auth();

  if (!session?.user) {
    return (
      <main className="p-6">
        <h1 className="text-2xl font-semibold">Max Kanban</h1>
        <p className="mt-2 text-slate-600">
          You’re not signed in. Please sign in to view the board.
        </p>
        <Link
          className="mt-4 inline-block rounded-lg bg-slate-900 px-4 py-2 text-white"
          href="/signin"
        >
          Sign in
        </Link>
      </main>
    );
  }

  return (
    <main className="p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Max Kanban</h1>
          <p className="mt-1 text-slate-600">
            Signed in as <span className="font-medium">{session.user.email}</span>
          </p>
        </div>

        <form
          action={async () => {
            "use server";
            await signOut({ redirectTo: "/signin" });
          }}
        >
          <button className="rounded-lg border px-3 py-2 hover:bg-slate-50" type="submit">
            Sign out
          </button>
        </form>
      </div>

      <div className="mt-6 rounded-xl border p-4">
        <p className="text-slate-700">
          MVP is wired with Google login + database. Next step: build the Kanban board UI
          (columns/cards), and a simple API to create/update tasks.
        </p>
      </div>
    </main>
  );
}
