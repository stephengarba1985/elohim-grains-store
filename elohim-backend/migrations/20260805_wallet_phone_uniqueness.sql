BEGIN;

-- 1) Ensure wallet_number column exists.
ALTER TABLE wallet_virtual_accounts
ADD COLUMN IF NOT EXISTS wallet_number VARCHAR(20);

-- 2) Resolve duplicate phones by keeping the lowest user id per phone and clearing others.
WITH ranked_phones AS (
  SELECT
    id,
    phone,
    ROW_NUMBER() OVER (PARTITION BY phone ORDER BY id ASC) AS rn
  FROM users
  WHERE phone IS NOT NULL
    AND BTRIM(phone) <> ''
)
UPDATE users u
SET phone = NULL
FROM ranked_phones rp
WHERE u.id = rp.id
  AND rp.rn > 1;

-- 3) Clear wallet_number for users whose phone was cleared.
UPDATE wallet_virtual_accounts va
SET wallet_number = NULL
FROM users u
WHERE va.user_id = u.id
  AND (u.phone IS NULL OR BTRIM(u.phone) = '');

-- 4) Backfill wallet_number from users.phone where wallet_number is still null.
UPDATE wallet_virtual_accounts va
SET wallet_number = u.phone
FROM users u
WHERE va.user_id = u.id
  AND va.wallet_number IS NULL;

-- 5) Enforce unique phone values on users.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'users_phone_unique'
      AND conrelid = 'users'::regclass
  ) THEN
    ALTER TABLE users
    ADD CONSTRAINT users_phone_unique UNIQUE (phone);
  END IF;
END $$;

-- 6) Keep only one named unique constraint for wallet_number.
ALTER TABLE wallet_virtual_accounts
DROP CONSTRAINT IF EXISTS wallet_virtual_accounts_wallet_number_key;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'wallet_number_unique'
      AND conrelid = 'wallet_virtual_accounts'::regclass
  ) THEN
    ALTER TABLE wallet_virtual_accounts
    ADD CONSTRAINT wallet_number_unique UNIQUE (wallet_number);
  END IF;
END $$;

COMMIT;
