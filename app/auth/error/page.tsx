import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function AuthErrorPage() {
  return (
    <div className="flex flex-1 items-center justify-center p-8">
      <div className="rounded-lg border border-border bg-card p-8 text-center shadow-lg">
        <h1 className="mb-4 text-2xl font-bold">Authentication Error</h1>
        <p className="mb-6 text-muted-foreground">
          There was a problem completing the authentication process. Please try
          again.
        </p>
        <Button asChild>
          <Link href="/login">Return to Login</Link>
        </Button>
      </div>
    </div>
  );
}
