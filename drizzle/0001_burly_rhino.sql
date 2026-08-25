CREATE TABLE `availability_slots` (
	`id` int AUTO_INCREMENT NOT NULL,
	`instructorUserId` int NOT NULL,
	`dayOfWeek` int,
	`specificDate` date,
	`startTime` varchar(5) NOT NULL,
	`endTime` varchar(5) NOT NULL,
	`isBlocked` boolean NOT NULL DEFAULT false,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `availability_slots_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `booking_events` (
	`id` int AUTO_INCREMENT NOT NULL,
	`bookingId` int NOT NULL,
	`actorUserId` int,
	`eventType` varchar(80) NOT NULL,
	`previousStatus` varchar(40),
	`nextStatus` varchar(40),
	`note` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `booking_events_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `bookings` (
	`id` int AUTO_INCREMENT NOT NULL,
	`learnerUserId` int NOT NULL,
	`instructorUserId` int NOT NULL,
	`packageCode` enum('trial','starter','license_path') NOT NULL,
	`packageName` varchar(120) NOT NULL,
	`lessonCount` int NOT NULL,
	`scheduledStart` timestamp NOT NULL,
	`scheduledEnd` timestamp NOT NULL,
	`pickupAddress` varchar(500) NOT NULL,
	`pickupLat` decimal(10,7),
	`pickupLng` decimal(10,7),
	`learnerNote` text,
	`pricePaise` int NOT NULL,
	`platformFeePaise` int NOT NULL,
	`bookingStatus` enum('draft','payment_pending','requested','confirmed','en_route','in_progress','completed','cancelled_by_learner','cancelled_by_instructor','declined','expired','refunded') NOT NULL DEFAULT 'draft',
	`paymentStatus` enum('not_started','pending','paid','failed','refunded') NOT NULL DEFAULT 'not_started',
	`cancellationReason` varchar(500),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `bookings_id` PRIMARY KEY(`id`),
	CONSTRAINT `bookings_instructor_start_unique` UNIQUE(`instructorUserId`,`scheduledStart`)
);
--> statement-breakpoint
CREATE TABLE `instructor_applications` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`status` enum('draft','submitted','under_review','verified','rejected','needs_more_info') NOT NULL DEFAULT 'draft',
	`reviewerUserId` int,
	`reviewNotes` text,
	`submittedAt` timestamp,
	`reviewedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `instructor_applications_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `instructor_profiles` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`bio` text,
	`languages` varchar(255) DEFAULT 'English',
	`city` varchar(80),
	`serviceAreas` varchar(500),
	`serviceLat` decimal(10,7),
	`serviceLng` decimal(10,7),
	`serviceRadiusKm` int NOT NULL DEFAULT 5,
	`vehicleTypes` varchar(120) NOT NULL DEFAULT 'car',
	`transmission` enum('manual','automatic','both') NOT NULL DEFAULT 'manual',
	`hasDualControl` boolean NOT NULL DEFAULT false,
	`pricePerLessonPaise` int NOT NULL DEFAULT 0,
	`verificationStatus` enum('draft','submitted','under_review','verified','rejected','suspended') NOT NULL DEFAULT 'draft',
	`isOnline` boolean NOT NULL DEFAULT false,
	`ratingAverage` decimal(3,2) NOT NULL DEFAULT '0.00',
	`ratingCount` int NOT NULL DEFAULT 0,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `instructor_profiles_id` PRIMARY KEY(`id`),
	CONSTRAINT `instructor_profiles_userId_unique` UNIQUE(`userId`)
);
--> statement-breakpoint
CREATE TABLE `notifications` (
	`id` int AUTO_INCREMENT NOT NULL,
	`recipientUserId` int NOT NULL,
	`bookingId` int,
	`notificationType` varchar(80) NOT NULL,
	`title` varchar(180) NOT NULL,
	`body` varchar(500) NOT NULL,
	`deliveryStatus` enum('queued','sent','failed','read') NOT NULL DEFAULT 'queued',
	`scheduledFor` timestamp,
	`sentAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `notifications_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `payment_sessions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`bookingId` int NOT NULL,
	`stripeCheckoutSessionId` varchar(255) NOT NULL,
	`stripePaymentIntentId` varchar(255),
	`processedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `payment_sessions_id` PRIMARY KEY(`id`),
	CONSTRAINT `payment_sessions_bookingId_unique` UNIQUE(`bookingId`),
	CONSTRAINT `payment_sessions_stripeCheckoutSessionId_unique` UNIQUE(`stripeCheckoutSessionId`)
);
--> statement-breakpoint
CREATE TABLE `profiles` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`fullName` varchar(120) NOT NULL,
	`phone` varchar(32),
	`city` varchar(80),
	`homeArea` varchar(160),
	`preferredVehicle` enum('car','bike','either') NOT NULL DEFAULT 'either',
	`activeRole` enum('learner','instructor') NOT NULL DEFAULT 'learner',
	`stripeCustomerId` varchar(255),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `profiles_id` PRIMARY KEY(`id`),
	CONSTRAINT `profiles_userId_unique` UNIQUE(`userId`)
);
--> statement-breakpoint
CREATE TABLE `ratings` (
	`id` int AUTO_INCREMENT NOT NULL,
	`bookingId` int NOT NULL,
	`learnerUserId` int NOT NULL,
	`instructorUserId` int NOT NULL,
	`stars` int NOT NULL,
	`body` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `ratings_id` PRIMARY KEY(`id`),
	CONSTRAINT `ratings_bookingId_unique` UNIQUE(`bookingId`)
);
--> statement-breakpoint
CREATE TABLE `role_memberships` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`role` enum('learner','instructor','admin') NOT NULL,
	`status` enum('enabled','pending','suspended') NOT NULL DEFAULT 'enabled',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `role_memberships_id` PRIMARY KEY(`id`),
	CONSTRAINT `role_memberships_user_role_unique` UNIQUE(`userId`,`role`)
);
--> statement-breakpoint
CREATE TABLE `verification_documents` (
	`id` int AUTO_INCREMENT NOT NULL,
	`instructorUserId` int NOT NULL,
	`documentType` enum('government_id','driving_license','instructor_certificate','vehicle_insurance') NOT NULL,
	`storageKey` varchar(500) NOT NULL,
	`fileName` varchar(255) NOT NULL,
	`reviewStatus` enum('submitted','approved','rejected') NOT NULL DEFAULT 'submitted',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `verification_documents_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `availability_slots` ADD CONSTRAINT `availability_slots_instructorUserId_users_id_fk` FOREIGN KEY (`instructorUserId`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `booking_events` ADD CONSTRAINT `booking_events_bookingId_bookings_id_fk` FOREIGN KEY (`bookingId`) REFERENCES `bookings`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `booking_events` ADD CONSTRAINT `booking_events_actorUserId_users_id_fk` FOREIGN KEY (`actorUserId`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `bookings` ADD CONSTRAINT `bookings_learnerUserId_users_id_fk` FOREIGN KEY (`learnerUserId`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `bookings` ADD CONSTRAINT `bookings_instructorUserId_users_id_fk` FOREIGN KEY (`instructorUserId`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `instructor_applications` ADD CONSTRAINT `instructor_applications_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `instructor_applications` ADD CONSTRAINT `instructor_applications_reviewerUserId_users_id_fk` FOREIGN KEY (`reviewerUserId`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `instructor_profiles` ADD CONSTRAINT `instructor_profiles_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `notifications` ADD CONSTRAINT `notifications_recipientUserId_users_id_fk` FOREIGN KEY (`recipientUserId`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `notifications` ADD CONSTRAINT `notifications_bookingId_bookings_id_fk` FOREIGN KEY (`bookingId`) REFERENCES `bookings`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `payment_sessions` ADD CONSTRAINT `payment_sessions_bookingId_bookings_id_fk` FOREIGN KEY (`bookingId`) REFERENCES `bookings`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `profiles` ADD CONSTRAINT `profiles_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `ratings` ADD CONSTRAINT `ratings_bookingId_bookings_id_fk` FOREIGN KEY (`bookingId`) REFERENCES `bookings`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `ratings` ADD CONSTRAINT `ratings_learnerUserId_users_id_fk` FOREIGN KEY (`learnerUserId`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `ratings` ADD CONSTRAINT `ratings_instructorUserId_users_id_fk` FOREIGN KEY (`instructorUserId`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `role_memberships` ADD CONSTRAINT `role_memberships_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `verification_documents` ADD CONSTRAINT `verification_documents_instructorUserId_users_id_fk` FOREIGN KEY (`instructorUserId`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `availability_instructor_date_idx` ON `availability_slots` (`instructorUserId`,`specificDate`);--> statement-breakpoint
CREATE INDEX `booking_events_booking_idx` ON `booking_events` (`bookingId`,`createdAt`);--> statement-breakpoint
CREATE INDEX `bookings_learner_status_idx` ON `bookings` (`learnerUserId`,`bookingStatus`);--> statement-breakpoint
CREATE INDEX `bookings_instructor_status_idx` ON `bookings` (`instructorUserId`,`bookingStatus`);--> statement-breakpoint
CREATE INDEX `instructor_applications_status_idx` ON `instructor_applications` (`status`,`createdAt`);--> statement-breakpoint
CREATE INDEX `instructor_profiles_discovery_idx` ON `instructor_profiles` (`city`,`verificationStatus`,`isOnline`);--> statement-breakpoint
CREATE INDEX `notifications_recipient_idx` ON `notifications` (`recipientUserId`,`createdAt`);--> statement-breakpoint
CREATE INDEX `ratings_instructor_idx` ON `ratings` (`instructorUserId`,`createdAt`);--> statement-breakpoint
CREATE INDEX `role_memberships_user_idx` ON `role_memberships` (`userId`);--> statement-breakpoint
CREATE INDEX `verification_documents_instructor_idx` ON `verification_documents` (`instructorUserId`);