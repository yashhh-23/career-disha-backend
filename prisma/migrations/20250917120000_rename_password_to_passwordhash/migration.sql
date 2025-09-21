-- Rename users.password to users.passwordHash to preserve existing data
-- This matches the Prisma schema change from `password` to `passwordHash`

ALTER TABLE "users"
  RENAME COLUMN "password" TO "passwordHash";


