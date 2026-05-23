import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Lock } from "lucide-react";
import Link from "next/link";

export function SignInWall() {
  return (
    <Card className="mx-auto w-full max-w-md text-center">
      <CardHeader>
        <Lock className="mx-auto mb-2 h-6 w-6 text-muted-foreground" />
        <CardTitle>Sign in to keep watching</CardTitle>
        <CardDescription>
          The free viewer limit for this stream has been reached. Signing up is
          free and gives you viewing credits.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex justify-center gap-2">
        <Button asChild>
          <Link href="/signup">Sign up free</Link>
        </Button>
        <Button variant="outline" asChild>
          <Link href="/login">Log in</Link>
        </Button>
      </CardContent>
    </Card>
  );
}
