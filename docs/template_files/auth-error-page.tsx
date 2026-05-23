import Link from "next/link";

export default function AuthErrorPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <div className="rounded-radius border border-border bg-card p-8 text-center shadow-lg">
        <h1 className="mb-4 text-2xl font-bold text-primary">
          Authentication Error
        </h1>
        <p className="mb-6 text-muted-foreground">
          There was a problem completing the authentication process. Please try
          again.
        </p>
        <Link
          href="/login"
          className="inline-block rounded-radius bg-primary px-6 py-2 text-primary-foreground hover:bg-primary/90"
        >
          Return to Login
        </Link>
      </div>
    </div>
  );
}
