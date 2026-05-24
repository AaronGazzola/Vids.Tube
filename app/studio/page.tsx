import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Radio, Settings } from "lucide-react";
import Link from "next/link";

export default function StudioOverviewPage() {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Studio</h1>

      <Card>
        <CardHeader>
          <CardTitle>Go live</CardTitle>
          <CardDescription>
            Grab your stream key and connect OBS to start streaming.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-3">
          <Button asChild>
            <Link href="/studio/live">
              <Radio className="mr-2 h-4 w-4" />
              Go live
            </Link>
          </Button>
          <Button variant="outline" asChild>
            <Link href="/studio/settings">
              <Settings className="mr-2 h-4 w-4" />
              Channel settings
            </Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
