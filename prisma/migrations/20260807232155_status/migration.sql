-- AlterTable
ALTER TABLE `scholar_references` ADD COLUMN `status` ENUM('pending', 'approved', 'rejected') NOT NULL DEFAULT 'pending';

-- AlterTable
ALTER TABLE `scholar_versions` ADD COLUMN `image_status` ENUM('pending', 'approved', 'rejected') NULL;

-- AlterTable
ALTER TABLE `scholar_works` ADD COLUMN `status` ENUM('pending', 'approved', 'rejected') NOT NULL DEFAULT 'pending';
