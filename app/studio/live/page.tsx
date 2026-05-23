import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function StudioLivePage() {
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Go Live</h1>
      <Card>
        <CardHeader>
          <CardTitle>Stream setup</CardTitle>
          <CardDescription>
            Connect OBS with these details. Available once live streaming is
            enabled.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="ingest">Ingest URL</Label>
            <Input id="ingest" readOnly value="rtmp://ingest.vids.tube/live" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="key">Stream key</Label>
            <Input id="key" readOnly value="•••••••• (coming soon)" />
          </div>
          <Button disabled>Start stream</Button>
        </CardContent>
      </Card>
    </div>
  );
}
