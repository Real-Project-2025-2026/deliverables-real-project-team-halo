-- Migration: Create guardians table
-- Description: Creates the guardians table for managing Guardian relationships and requests

-- Create guardian_status enum
DO $$ BEGIN
  CREATE TYPE guardian_status AS ENUM ('pending', 'accepted', 'blocked');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- Create guardians table
CREATE TABLE IF NOT EXISTS guardians (
  id BIGSERIAL PRIMARY KEY,
  requester_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  recipient_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  status guardian_status NOT NULL DEFAULT 'pending',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  accepted_at TIMESTAMPTZ,
  
  -- Ensure unique relationship (one request per pair)
  UNIQUE(requester_id, recipient_id),
  
  -- Prevent self-requests
  CHECK(requester_id != recipient_id)
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS guardians_requester_id_idx ON guardians(requester_id);
CREATE INDEX IF NOT EXISTS guardians_recipient_id_idx ON guardians(recipient_id);
CREATE INDEX IF NOT EXISTS guardians_status_idx ON guardians(status);
CREATE INDEX IF NOT EXISTS guardians_requester_status_idx ON guardians(requester_id, status);
CREATE INDEX IF NOT EXISTS guardians_recipient_status_idx ON guardians(recipient_id, status);

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_guardians_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for updated_at
DROP TRIGGER IF EXISTS guardians_updated_at_trigger ON guardians;
CREATE TRIGGER guardians_updated_at_trigger
  BEFORE UPDATE ON guardians
  FOR EACH ROW
  EXECUTE FUNCTION update_guardians_updated_at();

-- Set accepted_at when status changes to 'accepted'
CREATE OR REPLACE FUNCTION set_guardian_accepted_at()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'accepted' AND OLD.status != 'accepted' THEN
    NEW.accepted_at = NOW();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for accepted_at
DROP TRIGGER IF EXISTS guardians_accepted_at_trigger ON guardians;
CREATE TRIGGER guardians_accepted_at_trigger
  BEFORE UPDATE ON guardians
  FOR EACH ROW
  EXECUTE FUNCTION set_guardian_accepted_at();

-- Add comments
COMMENT ON TABLE guardians IS 'Guardian relationships and requests between users';
COMMENT ON COLUMN guardians.requester_id IS 'User who sent the Guardian request';
COMMENT ON COLUMN guardians.recipient_id IS 'User who received the Guardian request';
COMMENT ON COLUMN guardians.status IS 'Status of the Guardian relationship: pending, accepted, or blocked';
COMMENT ON COLUMN guardians.accepted_at IS 'Timestamp when the Guardian request was accepted';

