# Karma System Database Migration

## Quick Setup (Run in Supabase SQL Editor)

Copy and paste this entire SQL script into your Supabase SQL Editor and click "Run":

```sql
-- ============================================
-- KARMA SYSTEM MIGRATION
-- ============================================

-- 1. Add karma column to profiles table (if not exists)
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'profiles' AND column_name = 'karma'
    ) THEN
        ALTER TABLE profiles ADD COLUMN karma INTEGER DEFAULT 0;
        RAISE NOTICE 'Added karma column to profiles table';
    ELSE
        RAISE NOTICE 'Karma column already exists';
    END IF;
END $$;

-- 2. Create index for faster karma queries
CREATE INDEX IF NOT EXISTS idx_profiles_karma ON profiles(karma DESC);

-- 3. Create safe karma increment function
CREATE OR REPLACE FUNCTION increment_karma(row_id UUID, amount INTEGER)
RETURNS void AS $$
BEGIN
  UPDATE profiles
  SET karma = GREATEST(0, COALESCE(karma, 0) + amount)
  WHERE id = row_id;
END;
$$ LANGUAGE plpgsql;

-- 4. Enable real-time for profiles table (for live karma updates)
-- Note: This might already be enabled
DO $$
BEGIN
    -- Check if publication exists and add table if needed
    IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
        -- Try to add the table (will silently fail if already added)
        BEGIN
            ALTER PUBLICATION supabase_realtime ADD TABLE profiles;
            RAISE NOTICE 'Added profiles to real-time publication';
        EXCEPTION WHEN duplicate_object THEN
            RAISE NOTICE 'Profiles already in real-time publication';
        END;
    END IF;
END $$;

-- 5. Optional: Set initial karma for existing users based on their activity
-- Uncomment the following if you want to backfill karma for existing users

/*
UPDATE profiles p
SET karma = (
    -- +10 per post
    (SELECT COUNT(*) * 10 FROM posts WHERE author_id = p.id) +
    -- +5 per like received on their posts
    (SELECT COUNT(*) * 5 FROM post_likes pl 
     JOIN posts po ON pl.post_id = po.id 
     WHERE po.author_id = p.id) +
    -- +1 per like given
    (SELECT COUNT(*) FROM post_likes WHERE user_id = p.id)
)
WHERE karma IS NULL OR karma = 0;
*/

-- 6. Verify the migration
SELECT 
    COUNT(*) as total_users,
    AVG(karma) as avg_karma,
    MAX(karma) as max_karma,
    COUNT(CASE WHEN karma >= 1000 THEN 1 END) as karma_kings
FROM profiles;

-- Success message
DO $$
BEGIN
    RAISE NOTICE '✅ Karma system migration completed successfully!';
    RAISE NOTICE 'Real-time updates are now enabled for karma changes.';
END $$;
```

## Verification

After running the migration, verify it worked:

1. Check the output in the SQL Editor - you should see a summary table
2. Visit any user profile - karma should now display correctly
3. Like a post - karma should update in real-time

## Troubleshooting

If karma still shows 0:
1. Check browser console for errors
2. Check server logs for "Profile fetch result" messages
3. Verify the karma column exists: `SELECT karma FROM profiles LIMIT 1;`
4. Try refreshing the page after liking a post

## Manual Testing

To manually test karma updates:
```sql
-- Give yourself some karma
UPDATE profiles 
SET karma = 1500 
WHERE username = 'your-username';

-- Check if it worked
SELECT username, karma FROM profiles WHERE username = 'your-username';
```
