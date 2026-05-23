#!/bin/bash

echo "⚠️  WARNING: This will reset your database and delete ALL data!"
echo ""
read -p "Are you sure you want to continue? (yes/no): " confirmation

if [ "$confirmation" != "yes" ]; then
  echo "❌ Operation cancelled"
  exit 1
fi

echo ""
echo "🔄 Resetting database..."
npx supabase db reset --linked --yes

if [ $? -ne 0 ]; then
  echo "❌ Database reset failed"
  exit 1
fi

echo ""
echo "⏳ Waiting for PostgREST schema cache to refresh..."
sleep 3

echo ""
echo "🌱 Running seed script..."
tsx supabase/seed.ts

if [ $? -ne 0 ]; then
  echo "❌ Seed script failed"
  exit 1
fi

echo ""
echo "✅ Database reset and seed complete!"