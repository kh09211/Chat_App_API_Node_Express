CREATE OR REPLACE DATABASE chat_app_node;
GRANT ALL PRIVILEGES ON chat_app_node.* TO '__DATABASE_USERNAME__'@'localhost' IDENTIFIED BY '__PASSWORD_TO_DATABASE__';
USE chat_app_node;
CREATE OR REPLACE TABLE `comments` (
	`id` int(10) AUTO_INCREMENT,
	`username` varchar(20),
	`color` varchar(8),
	`comment` varchar(255),
	`room` varchar(255),
	PRIMARY KEY (id),
	INDEX `room_index` (`room`)
); 
CREATE OR REPLACE TABLE `tokens` (
	`id` int(10) AUTO_INCREMENT,
	`token` varchar(255),
	`color` varchar(8),
	`room` varchar(255),
	PRIMARY KEY (id),
	INDEX `room_index` (`room`),
	INDEX `token_index` (`token`)
);  
