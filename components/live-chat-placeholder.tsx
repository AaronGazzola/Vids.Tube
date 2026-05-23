import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function LiveChatPlaceholder() {
  return (
    <div className="flex h-full min-h-80 flex-col rounded-lg border">
      <div className="border-b p-3 text-sm font-medium">Live chat</div>
      <div className="flex flex-1 items-center justify-center p-6 text-center text-sm text-muted-foreground">
        Chat coming soon
      </div>
      <div className="flex gap-2 border-t p-3">
        <Input placeholder="Chat is disabled" disabled />
        <Button disabled>Send</Button>
      </div>
    </div>
  );
}
