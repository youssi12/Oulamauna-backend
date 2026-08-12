-- AlterTable
ALTER TABLE `scholar_versions` MODIFY `status` ENUM('pending', 'approved', 'rejected', 'superseded') NULL;
