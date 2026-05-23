import type { Database } from "@/supabase/types";
import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";
import path from "path";

dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const secretKey = process.env.SUPABASE_SECRET_KEY!;

const supabase = createClient<Database>(url, secretKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

async function seed() {
  console.log("Starting database seed...");

  const ownerEmail = "owner@vids.tube";
  const ownerPassword = "Password123!";

  const { data: authData, error: authError } =
    await supabase.auth.admin.createUser({
      email: ownerEmail,
      password: ownerPassword,
      email_confirm: true,
    });

  if (authError) {
    console.error("Error creating owner user:", authError);
    process.exit(1);
  }

  console.log(`Created owner auth user: ${ownerEmail}`);

  if (authData.user) {
    const { error: channelError } = await supabase.from("channels").insert({
      owner_user_id: authData.user.id,
      slug: "owner",
      name: "Owner Channel",
      description: "The first channel on vids.tube.",
    });

    if (channelError) {
      console.error("Error creating owner channel:", channelError);
      process.exit(1);
    }

    console.log("Created owner channel");
  }

  console.log("Seed complete!");
}

seed()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("Seed failed:", error);
    process.exit(1);
  });
