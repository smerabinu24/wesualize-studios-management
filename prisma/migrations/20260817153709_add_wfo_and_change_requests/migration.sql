-- AlterEnum
ALTER TYPE "LeaveKind" ADD VALUE 'WORK_FROM_OFFICE';

-- AlterTable
ALTER TABLE "Leave" ADD COLUMN     "allotted" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "requestedKind" "LeaveKind",
ADD COLUMN     "requestedReason" TEXT;

-- CreateIndex
CREATE INDEX "Leave_requestedKind_idx" ON "Leave"("requestedKind");
