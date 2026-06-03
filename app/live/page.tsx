import { getOwnerChannelAction } from "@/app/layout.actions";
import { redirect } from "next/navigation";

export default async function LivePage() {
  const channel = await getOwnerChannelAction();
  redirect(channel ? `/${channel.slug}` : "/");
}
