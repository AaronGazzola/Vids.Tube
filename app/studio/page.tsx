import { Button } from "@/components/ui/button";
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Film, Radio, Upload } from "lucide-react";
import Link from "next/link";

const stats = [
  { label: "Videos", value: "0" },
  { label: "Followers", value: "0" },
  { label: "Credits earned", value: "0" },
];

const actions = [
  { href: "/studio/upload", label: "Upload a video", icon: Upload },
  { href: "/studio/live", label: "Go live", icon: Radio },
  { href: "/studio/videos", label: "Manage videos", icon: Film },
];

export default function StudioOverviewPage() {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Studio</h1>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {stats.map((stat) => (
          <Card key={stat.label}>
            <CardHeader>
              <CardDescription>{stat.label}</CardDescription>
              <CardTitle className="text-3xl">{stat.value}</CardTitle>
            </CardHeader>
          </Card>
        ))}
      </div>

      <div className="flex flex-wrap gap-3">
        {actions.map((action) => {
          const Icon = action.icon;
          return (
            <Button key={action.href} variant="outline" asChild>
              <Link href={action.href}>
                <Icon className="mr-2 h-4 w-4" />
                {action.label}
              </Link>
            </Button>
          );
        })}
      </div>
    </div>
  );
}
