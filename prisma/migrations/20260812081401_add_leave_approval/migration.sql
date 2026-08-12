-- CreateEnum
CREATE TYPE "LeaveStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- AlterTable
ALTER TABLE "Leave" ADD COLUMN     "decidedAt" TIMESTAMP(3),
ADD COLUMN     "decidedById" TEXT,
ADD COLUMN     "decisionNote" TEXT,
ADD COLUMN     "status" "LeaveStatus" NOT NULL DEFAULT 'PENDING';

-- CreateIndex
CREATE INDEX "Leave_status_idx" ON "Leave"("status");

-- Leave recorded before approval existed was effective the moment it was
-- booked, so preserve that meaning rather than retroactively marking it
-- pending. Runs immediately after the column is added, so it can only ever
-- touch rows that predate this migration.
UPDATE "Leave" SET "status" = 'APPROVED', "decidedAt" = "createdAt" WHERE "status" = 'PENDING';
