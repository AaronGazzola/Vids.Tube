import Link from "next/link";

export default function VerifyPage() {
  return (
    <div className="flex flex-1 items-center justify-center p-8">
      <div className="max-w-md rounded-lg border border-border bg-card p-8 text-center shadow">
        <h1 className="mb-4 text-2xl font-bold">Check your email</h1>
        <p className="mb-6 text-muted-foreground">
          We sent you a verification link. Click it to finish setting up your
          account, then log in.
        </p>
        <Link className="underline" href="/login">
          Back to login
        </Link>
      </div>
    </div>
  );
}
