-- AlterTable
ALTER TABLE `media` ADD COLUMN `previous_media_id` INTEGER NULL;

-- AlterTable
ALTER TABLE `scholar_references` ADD COLUMN `previous_reference_id` INTEGER NULL;

-- AlterTable
ALTER TABLE `scholar_works` ADD COLUMN `previous_work_id` INTEGER NULL;
