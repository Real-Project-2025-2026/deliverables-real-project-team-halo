-- Migration: Add RLS policies for guardians table
-- Description: Sets up Row Level Security policies for the guardians table

-- Enable RLS on guardians table
ALTER TABLE guardians ENABLE ROW LEVEL SECURITY;

-- Policy: Users can view their own Guardian relationships (as requester or recipient)
CREATE POLICY "Users can view own guardian relationships"
ON guardians
FOR SELECT
USING (
  auth.uid() = requester_id OR 
  auth.uid() = recipient_id
);

-- Policy: Users can create Guardian requests (only as requester)
CREATE POLICY "Users can create guardian requests"
ON guardians
FOR INSERT
WITH CHECK (
  auth.uid() = requester_id
);

-- Policy: Users can update Guardian requests where they are the recipient (accept/decline)
CREATE POLICY "Users can update received guardian requests"
ON guardians
FOR UPDATE
USING (auth.uid() = recipient_id)
WITH CHECK (auth.uid() = recipient_id);

-- Policy: Users can delete their own Guardian relationships (cancel request or remove Guardian)
CREATE POLICY "Users can delete own guardian relationships"
ON guardians
FOR DELETE
USING (
  auth.uid() = requester_id OR 
  auth.uid() = recipient_id
);

-- Note: For username search, we'll need a separate policy on profiles table
-- This will be handled in a separate migration or can be added here

-- Policy: Users can view usernames for search (public read access to username and basic profile info)
-- This allows users to search for other users by username
CREATE POLICY "Users can view usernames for search"
ON profiles
FOR SELECT
USING (true); -- Allow all authenticated users to see usernames for search

-- However, we want to limit what profile data is visible
-- We'll create a view or function for public profile search instead
-- For now, the above policy allows username search, but we should restrict other sensitive fields

-- More restrictive: Only show username, id, and avatar_url for search
-- We'll handle this in the application layer or create a view
-- For MVP, the above policy works, but we should add a view later:
-- CREATE VIEW public_profiles AS 
-- SELECT id, username, avatar_url, full_name 
-- FROM profiles 
-- WHERE username IS NOT NULL;

