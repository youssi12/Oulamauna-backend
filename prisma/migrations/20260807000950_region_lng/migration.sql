/*
  Warnings:

  - Added the required column `language_id` to the `regions` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE `regions` ADD COLUMN `language_id` INTEGER NOT NULL;

-- AddForeignKey
ALTER TABLE `regions` ADD CONSTRAINT `regions_language_id_fkey` FOREIGN KEY (`language_id`) REFERENCES `languages`(`language_id`) ON DELETE RESTRICT ON UPDATE CASCADE;
