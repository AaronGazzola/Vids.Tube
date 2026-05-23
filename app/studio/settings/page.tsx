"use client";

import { CustomToast } from "@/components/CustomToast";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";

export default function StudioSettingsPage() {
  const onSave = () => {
    toast.custom(() => (
      <CustomToast
        variant="notification"
        title="Channel settings"
        message="Coming soon"
      />
    ));
  };

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Settings</h1>
      <Card>
        <CardHeader>
          <CardTitle>Channel</CardTitle>
          <CardDescription>Your channel name and description.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Name</Label>
            <Input id="name" defaultValue="Owner Channel" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              rows={4}
              defaultValue="The first channel on vids.tube."
            />
          </div>
        </CardContent>
        <CardFooter>
          <Button onClick={onSave}>Save</Button>
        </CardFooter>
      </Card>
    </div>
  );
}
