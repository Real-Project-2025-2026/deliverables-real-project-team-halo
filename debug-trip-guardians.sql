-- Debug Query: Check trip_guardians entries
-- Run this in Supabase SQL Editor to debug why Guardian requests aren't showing

-- 1. Check if trip_guardians entries exist for a specific guardian
-- Replace 'GUARDIAN_USER_ID' with the actual Guardian user ID
SELECT 
  tg.id,
  tg.trip_id,
  tg.guardian_id,
  tg.status,
  tg.created_at,
  tg.responded_at,
  t.id as trip_id_check,
  t.user_id as trip_owner_id,
  t.status as trip_status
FROM trip_guardians tg
LEFT JOIN trips t ON t.id = tg.trip_id
WHERE tg.guardian_id = 'GUARDIAN_USER_ID'  -- Replace with actual Guardian ID
ORDER BY tg.created_at DESC;

-- 2. Check all trip_guardians entries (for debugging)
SELECT 
  tg.*,
  t.status as trip_status,
  t.user_id as trip_owner_id
FROM trip_guardians tg
LEFT JOIN trips t ON t.id = tg.trip_id
ORDER BY tg.created_at DESC
LIMIT 20;

-- 3. Check RLS policies on trip_guardians
SELECT 
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual,
  with_check
FROM pg_policies
WHERE tablename = 'trip_guardians';

-- 4. Check if RLS is enabled
SELECT 
  tablename,
  rowsecurity
FROM pg_tables
WHERE tablename = 'trip_guardians';

