-- Migration: Add push_token to profiles table
-- Description: Adds a push_token column to store Expo Push Tokens for Guardian notifications

-- Add push_token column
ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS push_token TEXT;

-- Add index for faster lookups
CREATE INDEX IF NOT EXISTS profiles_push_token_idx ON profiles(push_token)
WHERE push_token IS NOT NULL;

-- Add comment
COMMENT ON COLUMN profiles.push_token IS 'Expo Push Token for receiving Guardian and trip notifications';

