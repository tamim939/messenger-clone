-- Database Setup Script for djsmmbdt_messenger

CREATE TABLE IF NOT EXISTS users (
    uid VARCHAR(128) PRIMARY KEY,
    displayName VARCHAR(255),
    username VARCHAR(255) UNIQUE,
    email VARCHAR(255),
    photoURL TEXT,
    bio TEXT,
    status VARCHAR(50) DEFAULT 'offline',
    lastSeen TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    blockedUsers JSON
);

CREATE TABLE IF NOT EXISTS chats (
    id INT AUTO_INCREMENT PRIMARY KEY,
    participants JSON, -- Array of uids
    lastMessage TEXT,
    lastMessageAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    unreadCount JSON, -- Map of uids to counts
    isPinned JSON,
    isArchived JSON,
    mutedUntil JSON
);

CREATE TABLE IF NOT EXISTS messages (
    id INT AUTO_INCREMENT PRIMARY KEY,
    chatId INT,
    senderId VARCHAR(128),
    text TEXT,
    mediaUrl TEXT,
    mediaType ENUM('text', 'image', 'video', 'audio') DEFAULT 'text',
    createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (chatId) REFERENCES chats(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS stories (
    id INT AUTO_INCREMENT PRIMARY KEY,
    userId VARCHAR(128),
    userDisplayName VARCHAR(255),
    userPhotoURL TEXT,
    mediaUrl TEXT,
    mediaType ENUM('image', 'video'),
    createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    expiresAt TIMESTAMP,
    commentCount INT DEFAULT 0,
    reactions JSON
);
