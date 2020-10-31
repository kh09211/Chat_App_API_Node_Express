CREATE OR REPLACE DATABASE chat_app_node;
GRANT ALL PRIVILEGES ON chat_app_node.* TO '__DATABASE_USERNAME__'@'localhost' IDENTIFIED BY '__PASSWORD_TO_DATABASE__';
USE chat_app_node;
CREATE OR REPLACE TABLE `comments` (
	`id` int(10) AUTO_INCREMENT,
	`username` varchar(20),
	`color` varchar(8),
	`comment` varchar(255),
	PRIMARY KEY (id)
); 
CREATE OR REPLACE TABLE `tokens` (
	`id` int(10) AUTO_INCREMENT,
	`token` varchar(255),
	PRIMARY KEY (id)
);  
INSERT INTO 
	comments (username, color, comment)
VALUES
	('Test','#05b6c1','comment 1'),
	('Test','#05b6c1','comment 2'),
	('Test','#05b6c1','comment 3'),
	('Test','#05b6c1','comment 4'),
	('Test','#05b6c1','comment 5'),
	('Test','#05b6c1','comment 6'),
	('Test','#05b6c1','comment 7'),
	('Test','#05b6c1','comment 8'),
	('Test','#05b6c1','comment 9'),
	('Test','#05b6c1','comment 10'),
	('Test','#05b6c1','comment 11'),
	('Test','#05b6c1','comment 12'),
	('Test','#05b6c1','comment 13'),
	('Test','#05b6c1','comment 14'),
	('Test','#05b6c1','comment 15'),
	('Test','#05b6c1','comment 16'),
	('Test','#05b6c1','comment 17'),
	('Test','#05b6c1','comment 18'),
	('Test','#05b6c1','comment 19'),
	('Test','#05b6c1','comment 20'),
	('Test','#05b6c1','comment 21'),
	('Test','#05b6c1','comment 22'),
	('Test','#05b6c1','comment 23'),
	('Test','#05b6c1','comment 24'),
	('Test','#05b6c1','comment 25'),
	('Test','#05b6c1','comment 26'),
	('Test','#05b6c1','comment 27'),
	('Test','#05b6c1','comment 28'),
	('Test','#05b6c1','comment 29'),
	('Test','#05b6c1','comment 30'),
	('Test','#05b6c1','comment 31');
