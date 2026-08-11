-- AlterTable
ALTER TABLE "Project" ADD COLUMN     "autoArchive" BOOLEAN NOT NULL DEFAULT true;

-- AlterTable
ALTER TABLE "Task" ADD COLUMN     "autoArchive" BOOLEAN NOT NULL DEFAULT true;
