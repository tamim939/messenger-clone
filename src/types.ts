export interface UserProfile {
  uid: string;
  displayName: string;
  username: string; // Used for searching or uniqueness
  email: string;
  photoURL?: string;
  status?: string;
  lastSeen?: any;
  bio?: string;
  blockedUsers?: string[];
}

export interface Chat {
  id: string;
  participants: string[];
  lastMessage?: string;
  lastMessageAt?: any;
  unreadCount?: Record<string, number>;
  isPinned?: Record<string, boolean>; // userId -> isPinned
  isArchived?: Record<string, boolean>; // userId -> isArchived
  mutedUntil?: Record<string, any>; // userId -> timestamp
}

export interface Message {
  id: string;
  senderId: string;
  text?: string;
  mediaUrl?: string;
  mediaType: 'text' | 'image' | 'video' | 'audio';
  createdAt: any;
}

export interface Story {
  id: string;
  userId: string;
  userDisplayName: string;
  userPhotoURL?: string;
  mediaUrl: string;
  mediaType: 'image' | 'video';
  createdAt: any;
  expiresAt: any;
  reactions?: Record<string, string>; // userId -> emoji
  commentCount?: number;
}
