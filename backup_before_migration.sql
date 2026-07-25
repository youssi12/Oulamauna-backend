-- MySQL dump 10.13  Distrib 8.0.46, for Linux (x86_64)
--
-- Host: localhost    Database: Oulamaouna_db
-- ------------------------------------------------------
-- Server version	8.0.46-0ubuntu0.24.04.3

/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!50503 SET NAMES utf8mb4 */;
/*!40103 SET @OLD_TIME_ZONE=@@TIME_ZONE */;
/*!40103 SET TIME_ZONE='+00:00' */;
/*!40014 SET @OLD_UNIQUE_CHECKS=@@UNIQUE_CHECKS, UNIQUE_CHECKS=0 */;
/*!40014 SET @OLD_FOREIGN_KEY_CHECKS=@@FOREIGN_KEY_CHECKS, FOREIGN_KEY_CHECKS=0 */;
/*!40101 SET @OLD_SQL_MODE=@@SQL_MODE, SQL_MODE='NO_AUTO_VALUE_ON_ZERO' */;
/*!40111 SET @OLD_SQL_NOTES=@@SQL_NOTES, SQL_NOTES=0 */;

--
-- Table structure for table `bibliography`
--

DROP TABLE IF EXISTS `bibliography`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `bibliography` (
  `bibliography_id` int NOT NULL AUTO_INCREMENT,
  `scholar_id` int DEFAULT NULL,
  `title` varchar(255) DEFAULT NULL,
  `citation` text,
  `url` varchar(255) DEFAULT NULL,
  `created_by` int DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`bibliography_id`),
  KEY `scholar_id` (`scholar_id`),
  KEY `created_by` (`created_by`),
  CONSTRAINT `bibliography_ibfk_1` FOREIGN KEY (`scholar_id`) REFERENCES `scholars` (`scholar_id`),
  CONSTRAINT `bibliography_ibfk_2` FOREIGN KEY (`created_by`) REFERENCES `users` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `bibliography`
--

LOCK TABLES `bibliography` WRITE;
/*!40000 ALTER TABLE `bibliography` DISABLE KEYS */;
/*!40000 ALTER TABLE `bibliography` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `blog_comments`
--

DROP TABLE IF EXISTS `blog_comments`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `blog_comments` (
  `comment_id` int NOT NULL AUTO_INCREMENT,
  `post_id` int DEFAULT NULL,
  `user_id` int DEFAULT NULL,
  `content` text,
  `created_at` timestamp NULL DEFAULT NULL,
  `deleted_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`comment_id`),
  KEY `post_id` (`post_id`),
  KEY `user_id` (`user_id`),
  CONSTRAINT `blog_comments_ibfk_1` FOREIGN KEY (`post_id`) REFERENCES `blog_posts` (`post_id`),
  CONSTRAINT `blog_comments_ibfk_2` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `blog_comments`
--

LOCK TABLES `blog_comments` WRITE;
/*!40000 ALTER TABLE `blog_comments` DISABLE KEYS */;
/*!40000 ALTER TABLE `blog_comments` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `blog_posts`
--

DROP TABLE IF EXISTS `blog_posts`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `blog_posts` (
  `post_id` int NOT NULL AUTO_INCREMENT,
  `author_id` int DEFAULT NULL,
  `title` varchar(255) DEFAULT NULL,
  `content` text,
  `status` enum('draft','published') DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`post_id`),
  KEY `author_id` (`author_id`),
  CONSTRAINT `blog_posts_ibfk_1` FOREIGN KEY (`author_id`) REFERENCES `users` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `blog_posts`
--

LOCK TABLES `blog_posts` WRITE;
/*!40000 ALTER TABLE `blog_posts` DISABLE KEYS */;
/*!40000 ALTER TABLE `blog_posts` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `comments`
--

DROP TABLE IF EXISTS `comments`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `comments` (
  `comment_id` int NOT NULL AUTO_INCREMENT,
  `scholar_id` int DEFAULT NULL,
  `user_id` int DEFAULT NULL,
  `content` text,
  `created_at` timestamp NULL DEFAULT NULL,
  `edited_at` timestamp NULL DEFAULT NULL,
  `deleted_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`comment_id`),
  KEY `scholar_id` (`scholar_id`),
  KEY `user_id` (`user_id`),
  CONSTRAINT `comments_ibfk_1` FOREIGN KEY (`scholar_id`) REFERENCES `scholars` (`scholar_id`),
  CONSTRAINT `comments_ibfk_2` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `comments`
--

LOCK TABLES `comments` WRITE;
/*!40000 ALTER TABLE `comments` DISABLE KEYS */;
/*!40000 ALTER TABLE `comments` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `discipline_translations`
--

DROP TABLE IF EXISTS `discipline_translations`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `discipline_translations` (
  `translation_id` int NOT NULL AUTO_INCREMENT,
  `discipline_id` int DEFAULT NULL,
  `language_id` int DEFAULT NULL,
  `name` varchar(255) DEFAULT NULL,
  PRIMARY KEY (`translation_id`),
  KEY `discipline_id` (`discipline_id`),
  KEY `language_id` (`language_id`),
  CONSTRAINT `discipline_translations_ibfk_1` FOREIGN KEY (`discipline_id`) REFERENCES `disciplines` (`discipline_id`),
  CONSTRAINT `discipline_translations_ibfk_2` FOREIGN KEY (`language_id`) REFERENCES `languages` (`language_id`)
) ENGINE=InnoDB AUTO_INCREMENT=4 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `discipline_translations`
--

LOCK TABLES `discipline_translations` WRITE;
/*!40000 ALTER TABLE `discipline_translations` DISABLE KEYS */;
INSERT INTO `discipline_translations` VALUES (1,1,1,'الحديث'),(2,1,2,'Hadith'),(3,1,3,'Hadith');
/*!40000 ALTER TABLE `discipline_translations` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `disciplines`
--

DROP TABLE IF EXISTS `disciplines`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `disciplines` (
  `discipline_id` int NOT NULL AUTO_INCREMENT,
  `created_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`discipline_id`)
) ENGINE=InnoDB AUTO_INCREMENT=2 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `disciplines`
--

LOCK TABLES `disciplines` WRITE;
/*!40000 ALTER TABLE `disciplines` DISABLE KEYS */;
INSERT INTO `disciplines` VALUES (1,NULL);
/*!40000 ALTER TABLE `disciplines` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `email_verifications`
--

DROP TABLE IF EXISTS `email_verifications`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `email_verifications` (
  `id` int NOT NULL AUTO_INCREMENT,
  `user_id` int NOT NULL,
  `token` varchar(255) NOT NULL,
  `expires_at` timestamp NOT NULL,
  PRIMARY KEY (`id`),
  KEY `user_id` (`user_id`),
  CONSTRAINT `email_verifications_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=10 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `email_verifications`
--

LOCK TABLES `email_verifications` WRITE;
/*!40000 ALTER TABLE `email_verifications` DISABLE KEYS */;
/*!40000 ALTER TABLE `email_verifications` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `internal_links`
--

DROP TABLE IF EXISTS `internal_links`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `internal_links` (
  `link_id` int NOT NULL AUTO_INCREMENT,
  `source_version_id` int DEFAULT NULL,
  `target_scholar_id` int DEFAULT NULL,
  PRIMARY KEY (`link_id`),
  KEY `source_version_id` (`source_version_id`),
  KEY `target_scholar_id` (`target_scholar_id`),
  CONSTRAINT `internal_links_ibfk_1` FOREIGN KEY (`source_version_id`) REFERENCES `scholar_versions` (`version_id`),
  CONSTRAINT `internal_links_ibfk_2` FOREIGN KEY (`target_scholar_id`) REFERENCES `scholars` (`scholar_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `internal_links`
--

LOCK TABLES `internal_links` WRITE;
/*!40000 ALTER TABLE `internal_links` DISABLE KEYS */;
/*!40000 ALTER TABLE `internal_links` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `languages`
--

DROP TABLE IF EXISTS `languages`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `languages` (
  `language_id` int NOT NULL AUTO_INCREMENT,
  `code` varchar(255) DEFAULT NULL,
  `name` varchar(255) DEFAULT NULL,
  PRIMARY KEY (`language_id`)
) ENGINE=InnoDB AUTO_INCREMENT=4 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `languages`
--

LOCK TABLES `languages` WRITE;
/*!40000 ALTER TABLE `languages` DISABLE KEYS */;
INSERT INTO `languages` VALUES (1,'ar','Arabic'),(2,'en','English'),(3,'fr','French');
/*!40000 ALTER TABLE `languages` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `media`
--

DROP TABLE IF EXISTS `media`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `media` (
  `media_id` int NOT NULL AUTO_INCREMENT,
  `scholar_id` int DEFAULT NULL,
  `file_name` varchar(255) DEFAULT NULL,
  `file_path` varchar(255) DEFAULT NULL,
  `file_type` enum('pdf','audio','video') DEFAULT NULL,
  `status` enum('pending','approved','rejected') DEFAULT NULL,
  `uploaded_by` int DEFAULT NULL,
  `uploaded_at` timestamp NULL DEFAULT NULL,
  `view_count` int DEFAULT NULL,
  `like_count` int DEFAULT NULL,
  PRIMARY KEY (`media_id`),
  KEY `scholar_id` (`scholar_id`),
  KEY `uploaded_by` (`uploaded_by`),
  CONSTRAINT `media_ibfk_1` FOREIGN KEY (`scholar_id`) REFERENCES `scholars` (`scholar_id`),
  CONSTRAINT `media_ibfk_2` FOREIGN KEY (`uploaded_by`) REFERENCES `users` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=3 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `media`
--

LOCK TABLES `media` WRITE;
/*!40000 ALTER TABLE `media` DISABLE KEYS */;
INSERT INTO `media` VALUES (2,1,'Media API Documentation.pdf','https://res.cloudinary.com/dhhzyuzxg/raw/upload/v1785006733/oulamauna/scholars/idyoxsatdzbnnkhabszu','pdf','rejected',1,'2026-07-25 18:12:14',0,0);
/*!40000 ALTER TABLE `media` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `notifications`
--

DROP TABLE IF EXISTS `notifications`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `notifications` (
  `notification_id` int NOT NULL AUTO_INCREMENT,
  `user_id` int DEFAULT NULL,
  `type` enum('NEW_SCHOLAR_SUBMISSION','EDIT_PROPOSAL','REPORT_SUBMITTED','COMMENT_ON_BLOG','COMMENT_ON_SCHOLAR','SCHOLAR_APPROVED','SCHOLAR_REJECTED') DEFAULT NULL,
  `message` text,
  `related_entity` varchar(255) DEFAULT NULL,
  `is_read` tinyint(1) DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`notification_id`),
  KEY `user_id` (`user_id`),
  CONSTRAINT `notifications_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=8 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `notifications`
--

LOCK TABLES `notifications` WRITE;
/*!40000 ALTER TABLE `notifications` DISABLE KEYS */;
INSERT INTO `notifications` VALUES (1,2,'NEW_SCHOLAR_SUBMISSION','New scholar submitted: \"ابن خلدون\"','scholar:2',0,'2026-07-25 13:21:05'),(2,2,'NEW_SCHOLAR_SUBMISSION','New scholar submitted: \"ابن خلدون\"','scholar:1',0,'2026-07-25 13:38:13'),(3,2,'SCHOLAR_APPROVED','Your scholar submission \"ابن خلدون\" has been approved.','scholar_version:1',0,'2026-07-25 13:44:49'),(4,1,'NEW_SCHOLAR_SUBMISSION','New language version submitted for scholar ID 1: \"Ibn Khaldun\"','scholar:1',0,'2026-07-25 13:55:39'),(5,1,'EDIT_PROPOSAL','Edit proposed for scholar ID 1 (\"ابن خلدون\")','scholar_version:3',0,'2026-07-25 13:58:27'),(6,1,'SCHOLAR_REJECTED','Your scholar submission \"ابن خلدون\" was rejected. Reason: the existing is alrey pefect ','scholar_version:3',0,'2026-07-25 14:03:55'),(7,1,'SCHOLAR_APPROVED','Your scholar submission \"Ibn Khaldun\" has been approved.','scholar_version:2',0,'2026-07-25 14:04:16');
/*!40000 ALTER TABLE `notifications` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `password_resets`
--

DROP TABLE IF EXISTS `password_resets`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `password_resets` (
  `id` int NOT NULL AUTO_INCREMENT,
  `user_id` int NOT NULL,
  `token` varchar(255) NOT NULL,
  `expires_at` timestamp NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `token` (`token`),
  KEY `user_id` (`user_id`),
  CONSTRAINT `password_resets_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `password_resets`
--

LOCK TABLES `password_resets` WRITE;
/*!40000 ALTER TABLE `password_resets` DISABLE KEYS */;
/*!40000 ALTER TABLE `password_resets` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `reports`
--

DROP TABLE IF EXISTS `reports`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `reports` (
  `report_id` int NOT NULL AUTO_INCREMENT,
  `reporter_id` int DEFAULT NULL,
  `content_type` enum('scholar','comment','blog_post','blog_comment') DEFAULT NULL,
  `content_id` int DEFAULT NULL,
  `reason` text,
  `status` varchar(255) DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`report_id`),
  KEY `reporter_id` (`reporter_id`),
  CONSTRAINT `reports_ibfk_1` FOREIGN KEY (`reporter_id`) REFERENCES `users` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `reports`
--

LOCK TABLES `reports` WRITE;
/*!40000 ALTER TABLE `reports` DISABLE KEYS */;
/*!40000 ALTER TABLE `reports` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `roles`
--

DROP TABLE IF EXISTS `roles`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `roles` (
  `role_id` int NOT NULL AUTO_INCREMENT,
  `role_name` varchar(255) DEFAULT NULL,
  PRIMARY KEY (`role_id`),
  UNIQUE KEY `role_name` (`role_name`)
) ENGINE=InnoDB AUTO_INCREMENT=4 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `roles`
--

LOCK TABLES `roles` WRITE;
/*!40000 ALTER TABLE `roles` DISABLE KEYS */;
INSERT INTO `roles` VALUES (1,'admin'),(3,'contributor'),(2,'user');
/*!40000 ALTER TABLE `roles` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `scholar_aliases`
--

DROP TABLE IF EXISTS `scholar_aliases`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `scholar_aliases` (
  `alias_id` int NOT NULL AUTO_INCREMENT,
  `version_id` int DEFAULT NULL,
  `alias_name` varchar(255) DEFAULT NULL,
  PRIMARY KEY (`alias_id`),
  KEY `version_id` (`version_id`),
  CONSTRAINT `scholar_aliases_ibfk_1` FOREIGN KEY (`version_id`) REFERENCES `scholar_versions` (`version_id`)
) ENGINE=InnoDB AUTO_INCREMENT=7 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `scholar_aliases`
--

LOCK TABLES `scholar_aliases` WRITE;
/*!40000 ALTER TABLE `scholar_aliases` DISABLE KEYS */;
INSERT INTO `scholar_aliases` VALUES (1,1,'Ibn Khaldun'),(2,1,'أبو زيد عبد الرحمن بن خلدون'),(3,2,'Abu Zayd Abd al-Rahman ibn Khaldun'),(4,2,'Ibn Khaldoun'),(5,3,'Ibn Khaldun'),(6,3,'أبو زيد عبد الرحمن بن خلدون');
/*!40000 ALTER TABLE `scholar_aliases` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `scholar_contributors`
--

DROP TABLE IF EXISTS `scholar_contributors`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `scholar_contributors` (
  `scholar_id` int NOT NULL,
  `user_id` int NOT NULL,
  PRIMARY KEY (`scholar_id`,`user_id`),
  KEY `user_id` (`user_id`),
  CONSTRAINT `scholar_contributors_ibfk_1` FOREIGN KEY (`scholar_id`) REFERENCES `scholars` (`scholar_id`),
  CONSTRAINT `scholar_contributors_ibfk_2` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `scholar_contributors`
--

LOCK TABLES `scholar_contributors` WRITE;
/*!40000 ALTER TABLE `scholar_contributors` DISABLE KEYS */;
INSERT INTO `scholar_contributors` VALUES (1,1),(1,2);
/*!40000 ALTER TABLE `scholar_contributors` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `scholar_disciplines`
--

DROP TABLE IF EXISTS `scholar_disciplines`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `scholar_disciplines` (
  `scholar_id` int NOT NULL,
  `discipline_id` int NOT NULL,
  PRIMARY KEY (`scholar_id`,`discipline_id`),
  KEY `discipline_id` (`discipline_id`),
  CONSTRAINT `scholar_disciplines_ibfk_1` FOREIGN KEY (`discipline_id`) REFERENCES `disciplines` (`discipline_id`),
  CONSTRAINT `scholar_disciplines_ibfk_2` FOREIGN KEY (`scholar_id`) REFERENCES `scholars` (`scholar_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `scholar_disciplines`
--

LOCK TABLES `scholar_disciplines` WRITE;
/*!40000 ALTER TABLE `scholar_disciplines` DISABLE KEYS */;
/*!40000 ALTER TABLE `scholar_disciplines` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `scholar_references`
--

DROP TABLE IF EXISTS `scholar_references`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `scholar_references` (
  `reference_id` int NOT NULL AUTO_INCREMENT,
  `version_id` int NOT NULL,
  `title` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `citation` text COLLATE utf8mb4_unicode_ci,
  `url` varchar(500) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  PRIMARY KEY (`reference_id`),
  KEY `scholar_references_version_id_idx` (`version_id`),
  CONSTRAINT `scholar_references_version_id_fkey` FOREIGN KEY (`version_id`) REFERENCES `scholar_versions` (`version_id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=7 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `scholar_references`
--

LOCK TABLES `scholar_references` WRITE;
/*!40000 ALTER TABLE `scholar_references` DISABLE KEYS */;
INSERT INTO `scholar_references` VALUES (1,1,'المقدمة','ابن خلدون، المقدمة، دار الفكر، بيروت.','https://archive.org/details/muqaddimah'),(2,1,'كتاب العبر وديوان المبتدأ والخبر','ابن خلدون، كتاب العبر، دار الكتب العلمية.',NULL),(3,1,'Encyclopaedia of Islam','Ibn Khaldūn, Encyclopaedia of Islam, Second Edition.','https://referenceworks.brill.com/'),(4,2,'The Muqaddimah','Ibn Khaldun, The Muqaddimah, Princeton University Press.','https://archive.org/details/muqaddimah'),(5,2,'The Muqaddimah: An Introduction to History','Translated by Franz Rosenthal.',NULL),(6,2,'Encyclopaedia of Islam','Ibn Khaldun, Encyclopaedia of Islam.','https://referenceworks.brill.com/');
/*!40000 ALTER TABLE `scholar_references` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `scholar_relationships`
--

DROP TABLE IF EXISTS `scholar_relationships`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `scholar_relationships` (
  `relation_id` int NOT NULL AUTO_INCREMENT,
  `scholar_id` int DEFAULT NULL,
  `related_scholar_id` int DEFAULT NULL,
  `relation_type` enum('teacher','student') DEFAULT NULL,
  PRIMARY KEY (`relation_id`),
  KEY `scholar_id` (`scholar_id`),
  KEY `related_scholar_id` (`related_scholar_id`),
  CONSTRAINT `scholar_relationships_ibfk_1` FOREIGN KEY (`scholar_id`) REFERENCES `scholars` (`scholar_id`),
  CONSTRAINT `scholar_relationships_ibfk_2` FOREIGN KEY (`related_scholar_id`) REFERENCES `scholars` (`scholar_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `scholar_relationships`
--

LOCK TABLES `scholar_relationships` WRITE;
/*!40000 ALTER TABLE `scholar_relationships` DISABLE KEYS */;
/*!40000 ALTER TABLE `scholar_relationships` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `scholar_versions`
--

DROP TABLE IF EXISTS `scholar_versions`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `scholar_versions` (
  `version_id` int NOT NULL AUTO_INCREMENT,
  `scholar_id` int DEFAULT NULL,
  `language_id` int DEFAULT NULL,
  `canonical_name` varchar(255) DEFAULT NULL,
  `region` varchar(255) DEFAULT NULL,
  `birth_date_gerogean` varchar(50) DEFAULT NULL,
  `birth_date_hijri` varchar(50) DEFAULT NULL,
  `death_date_gerogean` varchar(50) DEFAULT NULL,
  `death_date_hijri` varchar(50) DEFAULT NULL,
  `century_hijri` varchar(255) DEFAULT NULL,
  `century_gregorian` varchar(255) DEFAULT NULL,
  `biography` text,
  `status` enum('pending','approved','rejected') DEFAULT NULL,
  `created_by` int DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT NULL,
  `version_type` enum('creation','edition') NOT NULL DEFAULT 'creation',
  PRIMARY KEY (`version_id`),
  KEY `scholar_id` (`scholar_id`),
  KEY `language_id` (`language_id`),
  KEY `created_by` (`created_by`),
  CONSTRAINT `scholar_versions_ibfk_1` FOREIGN KEY (`scholar_id`) REFERENCES `scholars` (`scholar_id`),
  CONSTRAINT `scholar_versions_ibfk_2` FOREIGN KEY (`language_id`) REFERENCES `languages` (`language_id`),
  CONSTRAINT `scholar_versions_ibfk_3` FOREIGN KEY (`created_by`) REFERENCES `users` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=4 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `scholar_versions`
--

LOCK TABLES `scholar_versions` WRITE;
/*!40000 ALTER TABLE `scholar_versions` DISABLE KEYS */;
INSERT INTO `scholar_versions` VALUES (1,1,1,'ابن خلدون','شمال أفريقيا','1332-05-27','732','1406-03-17','808','القرن الثامن','القرن الرابع عشر','ابن خلدون مؤرخ ومفكر اجتماعي من شمال أفريقيا...','approved',2,'2026-07-25 13:38:13','creation'),(2,1,2,'Ibn Khaldun','North Africa','1332-05-27','732 AH','1406-03-17','808 AH','8th Century AH','14th Century','Ibn Khaldun was a North African historian, philosopher, judge, and sociologist. He is best known for writing the Muqaddimah, considered one of the earliest works on historiography and sociology.','approved',1,'2026-07-25 13:55:39','creation'),(3,1,1,'ابن خلدون',' ترقية شمال أفريقيا','1332-05-27','732','1406-03-17','808','القرن الثامن','القرن الرابع عشر','ابن خلدون مؤرخ وعالم اجتماع وفيلسوف ومفكر سياسي من شمال أفريقيا، وُلد في تونس في القرن الرابع عشر الميلادي، ويُعد من أبرز العلماء في الحضارة الإسلامية. اشتهر بكتابه «المقدمة» الذي وضع فيه أسسًا لدراسة العمران البشري وتحليل نشأة الدول وتطورها وسقوطها، كما تناول فيه الجوانب الاقتصادية والاجتماعية والثقافية للمجتمعات، مما جعله من رواد علم الاجتماع والتاريخ النقدي في العالم.','rejected',1,'2026-07-25 13:58:27','edition');
/*!40000 ALTER TABLE `scholar_versions` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `scholars`
--

DROP TABLE IF EXISTS `scholars`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `scholars` (
  `scholar_id` int NOT NULL AUTO_INCREMENT,
  `created_by` int DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`scholar_id`),
  KEY `created_by` (`created_by`),
  CONSTRAINT `scholars_ibfk_1` FOREIGN KEY (`created_by`) REFERENCES `users` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=2 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `scholars`
--

LOCK TABLES `scholars` WRITE;
/*!40000 ALTER TABLE `scholars` DISABLE KEYS */;
INSERT INTO `scholars` VALUES (1,2,'2026-07-25 13:38:13');
/*!40000 ALTER TABLE `scholars` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `users`
--

DROP TABLE IF EXISTS `users`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `users` (
  `id` int NOT NULL AUTO_INCREMENT,
  `username` varchar(255) DEFAULT NULL,
  `email` varchar(255) DEFAULT NULL,
  `password_hash` varchar(255) DEFAULT NULL,
  `role_id` int DEFAULT '3',
  `is_banned` tinyint(1) DEFAULT '0',
  `created_at` timestamp NULL DEFAULT NULL,
  `email_verified` tinyint(1) NOT NULL DEFAULT '0',
  `allowed_to_contribute` tinyint(1) NOT NULL DEFAULT '1',
  PRIMARY KEY (`id`),
  UNIQUE KEY `username` (`username`),
  UNIQUE KEY `email` (`email`),
  KEY `role_id` (`role_id`),
  CONSTRAINT `users_ibfk_1` FOREIGN KEY (`role_id`) REFERENCES `roles` (`role_id`)
) ENGINE=InnoDB AUTO_INCREMENT=3 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `users`
--

LOCK TABLES `users` WRITE;
/*!40000 ALTER TABLE `users` DISABLE KEYS */;
INSERT INTO `users` VALUES (1,'admin','admin@gmail.com','$2a$12$nZH44umG0l5vvWSS59/r2.uWOA4Q9b1cPPPIrNSJP0ZCrJV1naiFu',1,0,'2026-03-25 19:45:58',1,1),(2,'jir','jvoolz3032@minitts.net','$2b$12$ScK2RwIMR6HJiaOrObLqkOutPm8zcs0p9uNdPqsiTAIQVvb04UF9.',3,0,'2026-07-25 12:48:28',1,1);
/*!40000 ALTER TABLE `users` ENABLE KEYS */;
UNLOCK TABLES;
/*!40103 SET TIME_ZONE=@OLD_TIME_ZONE */;

/*!40101 SET SQL_MODE=@OLD_SQL_MODE */;
/*!40014 SET FOREIGN_KEY_CHECKS=@OLD_FOREIGN_KEY_CHECKS */;
/*!40014 SET UNIQUE_CHECKS=@OLD_UNIQUE_CHECKS */;
/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
/*!40111 SET SQL_NOTES=@OLD_SQL_NOTES */;

-- Dump completed on 2026-07-25 20:25:07
