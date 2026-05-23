import type { Database } from "@/supabase/types";
import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";
import path from "path";

dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SECRET_KEY!;

const supabase = createClient<Database>(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

async function seed() {
  console.log("Starting database seed...");

  const testUsers = [
    {
      email: "admin@example.com",
      password: "Password123!",
      username: "admin",
      role: "super-admin" as const,
    },
    {
      email: "user1@example.com",
      password: "Password123!",
      username: "alice",
      role: "user" as const,
    },
    {
      email: "user2@example.com",
      password: "Password123!",
      username: "bob",
      role: "user" as const,
    },
  ];

  const createdProfiles: Array<{
    userId: string;
    profileId: string;
    username: string;
  }> = [];

  for (const userData of testUsers) {
    const { data: authData, error: authError } =
      await supabase.auth.admin.createUser({
        email: userData.email,
        password: userData.password,
        email_confirm: true,
      });

    if (authError) {
      console.error(`Error creating user ${userData.email}:`, authError);
      continue;
    }

    console.log(`Created auth user: ${userData.email}`);

    if (authData.user) {
      const { data: profileData, error: profileError } = await supabase
        .from("profiles")
        .insert({
          user_id: authData.user.id,
          username: userData.username,
          role: userData.role,
          sticker_style: {},
        })
        .select()
        .single();

      if (profileError) {
        console.error(
          `Error creating profile for ${userData.email}:`,
          profileError
        );
      } else if (profileData) {
        console.log(`Created profile for ${userData.username}`);
        createdProfiles.push({
          userId: authData.user.id,
          profileId: profileData.id,
          username: userData.username,
        });
      }
    }
  }

  if (createdProfiles.length > 0) {
    const aliceProfile = createdProfiles.find((p) => p.username === "alice");
    const bobProfile = createdProfiles.find((p) => p.username === "bob");

    if (aliceProfile) {
      const { data: pageData, error: pageError } = await supabase
        .from("pages")
        .insert({
          profile_id: aliceProfile.profileId,
          user_id: aliceProfile.userId,
          view_count: 42,
        })
        .select()
        .single();

      if (pageError) {
        console.error("Error creating page for Alice:", pageError);
      } else if (pageData) {
        console.log("Created page for Alice");

        const { error: elementsError } = await supabase
          .from("page_elements")
          .insert([
            {
              page_id: pageData.id,
              user_id: aliceProfile.userId,
              type: "TEXT",
              content: "Welcome to my page!",
              position: { x: 100, y: 100 },
              style: { fontSize: 24, color: "#000000" },
            },
            {
              page_id: pageData.id,
              user_id: aliceProfile.userId,
              type: "SHAPE",
              content: "circle",
              position: { x: 300, y: 200 },
              style: { width: 50, height: 50, fill: "#ff0000" },
            },
          ]);

        if (elementsError) {
          console.error("Error creating page elements:", elementsError);
        } else {
          console.log("Created page elements for Alice");
        }

        if (bobProfile) {
          const { error: stickerError } = await supabase
            .from("stickers")
            .insert({
              page_id: pageData.id,
              profile_id: bobProfile.profileId,
              user_id: bobProfile.userId,
              type: "BEEP",
              position: { x: 200, y: 150 },
              style: { size: "medium" },
            });

          if (stickerError) {
            console.error("Error creating sticker:", stickerError);
          } else {
            console.log("Created sticker from Bob on Alice's page");
          }
        }
      }
    }
  }

  console.log("Seed complete!");
}

seed()
  .catch((error) => {
    console.error("Seed failed:", error);
    process.exit(1);
  })
  .then(() => {
    process.exit(0);
  });
