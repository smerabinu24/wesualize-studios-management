-- CreateEnum
CREATE TYPE "LeaveKind" AS ENUM ('LEAVE', 'WORK_FROM_HOME');

-- AlterTable
ALTER TABLE "Leave" ADD COLUMN     "kind" "LeaveKind" NOT NULL DEFAULT 'LEAVE';
