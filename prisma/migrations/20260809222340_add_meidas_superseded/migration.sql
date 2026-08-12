-- AlterTable
ALTER TABLE `media` MODIFY `status` ENUM('pending', 'approved', 'rejected', 'superseded') NULL;

-- AlterTable
ALTER TABLE `scholar_references` MODIFY `status` ENUM('pending', 'approved', 'rejected', 'superseded') NOT NULL DEFAULT 'pending';

-- AlterTable
ALTER TABLE `scholar_versions` MODIFY `image_status` ENUM('pending', 'approved', 'rejected', 'superseded') NULL;

-- AlterTable
ALTER TABLE `scholar_works` MODIFY `status` ENUM('pending', 'approved', 'rejected', 'superseded') NOT NULL DEFAULT 'pending';
