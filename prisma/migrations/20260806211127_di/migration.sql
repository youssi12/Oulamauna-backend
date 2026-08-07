-- AlterTable
ALTER TABLE `disciplines` ADD COLUMN `language_id` INTEGER NULL;

-- CreateIndex
CREATE INDEX `language_id` ON `disciplines`(`language_id`);

-- AddForeignKey
ALTER TABLE `disciplines` ADD CONSTRAINT `disciplines_ibfk_1` FOREIGN KEY (`language_id`) REFERENCES `languages`(`language_id`) ON DELETE NO ACTION ON UPDATE NO ACTION;
