import { signIn } from "@/auth";

export default function SignInPage() {
  return (
    <div className="min-h-screen flex items-center justify-center p-6">
      <div className="w-full max-w-sm rounded-xl border bg-white p-6 shadow-sm">
        <h1 className="text-xl font-semibold">Sign in</h1>
        <p className="mt-1 text-sm text-slate-600">
          Use Google to access the Kanban board.
        </p>

        <form
          className="mt-6"
          action={async () => {
            "use server";
            await signIn("google", { redirectTo: "/" });
          }}
        >
          <button
            className="w-full rounded-lg bg-slate-900 px-4 py-2 text-white hover:bg-slate-800"
            type="submit"
          >
            Continue with Google
          </button>
        </form>
      </div>
    </div>
  );
}
