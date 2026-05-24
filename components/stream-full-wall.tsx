import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Users } from "lucide-react";

export function StreamFullWall() {
  return (
    <Card className="flex aspect-video w-full items-center justify-center text-center">
      <CardHeader>
        <Users className="mx-auto mb-2 h-6 w-6 text-muted-foreground" />
        <CardTitle>Stream is full</CardTitle>
        <CardDescription>
          The viewer limit for this stream has been reached. Please try again
          shortly.
        </CardDescription>
      </CardHeader>
    </Card>
  );
}
