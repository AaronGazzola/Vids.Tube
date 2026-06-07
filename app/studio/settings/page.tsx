"use client";

import { ChannelSettingsForm } from "@/components/channel-settings-form";

export default function StudioSettingsPage() {
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Settings</h1>
      <ChannelSettingsForm />
    </div>
  );
}
