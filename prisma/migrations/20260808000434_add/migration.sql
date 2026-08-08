-- AlterTable
ALTER TABLE `scholar_references` ADD COLUMN `created_by` INTEGER NULL;

-- AlterTable
ALTER TABLE `scholar_works` ADD COLUMN `created_by` INTEGER NULL;

-- AddForeignKey
ALTER TABLE `scholar_references` ADD CONSTRAINT `scholar_references_created_by_fkey` FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE `scholar_works` ADD CONSTRAINT `scholar_works_created_by_fkey` FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON DELETE NO ACTION ON UPDATE NO ACTION;
