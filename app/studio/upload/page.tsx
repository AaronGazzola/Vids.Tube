import { ComingSoon } from "@/components/coming-soon";
import { Card, CardContent } from "@/components/ui/card";

export default function StudioUploadPage() {
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Upload</h1>
      <Card>
        <CardContent className="p-6">
          <ComingSoon
            title="Video upload coming soon"
            description="Drag-and-drop upload will land here once video hosting is wired up."
          />
        </CardContent>
      </Card>
    </div>
  );
}
