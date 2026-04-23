import React, { useEffect, useState } from 'react';
import { db, auth } from '../lib/firebase';
import { 
  collection, 
  query, 
  where, 
  onSnapshot, 
  orderBy,
  getDoc,
  getDocs,
  doc,
  setDoc,
  addDoc,
  deleteDoc,
  updateDoc,
  serverTimestamp,
  writeBatch
} from 'firebase/firestore';
import { UserProfile, Chat } from '../types';
import { Search, Plus, MessageCircle, X, Pin, Archive, BellOff, Users, Maximize2, Mail, Ban, Trash2, ShieldAlert } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface ChatListProps {
  onChatSelect: (chat: Chat & { otherUser: UserProfile }) => void;
  activeChatId?: string;
}

export default function ChatList({ onChatSelect, activeChatId }: ChatListProps) {
  const [chats, setChats] = useState<(Chat & { otherUser: UserProfile })[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!auth.currentUser) return;

    const q = query(
      collection(db, 'chats'),
      where('participants', 'array-contains', auth.currentUser.uid),
      orderBy('lastMessageAt', 'desc')
    );

    const unsubscribe = onSnapshot(q, async (snapshot) => {
      const chatData = await Promise.all(snapshot.docs.map(async (docSnap) => {
        const data = docSnap.data() as Chat;
        const otherUserId = data.participants.find(p => p !== auth.currentUser?.uid);
        
        if (!otherUserId) return null;

        // Fetch other user profile by Document ID (much faster and more reliable)
        const userDoc = await getDoc(doc(db, 'users', otherUserId));
        const otherUser = userDoc.exists() ? userDoc.data() as UserProfile : {
          uid: otherUserId,
          displayName: 'User',
          email: ''
        } as UserProfile;
        
        return {
          ...data,
          id: docSnap.id,
          otherUser
        };
      }));
      
      const filteredAndSorted = chatData
        .filter(c => c !== null)
        .filter(c => !c!.isArchived?.[auth.currentUser?.uid || ''])
        .sort((a, b) => {
          const aPinned = a!.isPinned?.[auth.currentUser?.uid || ''] ? 1 : 0;
          const bPinned = b!.isPinned?.[auth.currentUser?.uid || ''] ? 1 : 0;
          if (aPinned !== bPinned) return bPinned - aPinned;
          return 0; // Maintain the firestore orderBy('lastMessageAt', 'desc')
        }) as (Chat & { otherUser: UserProfile })[];
      
      setChats(filteredAndSorted);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  useEffect(() => {
    const delayDebounceFn = setTimeout(() => {
      handleSearchAuto();
    }, 500);

    return () => clearTimeout(delayDebounceFn);
  }, [searchQuery]);

  const [longPressTimer, setLongPressTimer] = useState<NodeJS.Timeout | null>(null);
  const [selectedChatForActions, setSelectedChatForActions] = useState<(Chat & { otherUser: UserProfile }) | null>(null);

  const handleTouchStart = (chat: Chat & { otherUser: UserProfile }) => {
    const timer = setTimeout(() => {
      setSelectedChatForActions(chat);
      if (window.navigator.vibrate) window.navigator.vibrate(50);
    }, 600);
    setLongPressTimer(timer);
  };

  const handleTouchEnd = () => {
    if (longPressTimer) clearTimeout(longPressTimer);
  };

  const handleDeleteChat = async () => {
    if (!selectedChatForActions || !auth.currentUser) return;
    
    const chatId = selectedChatForActions.id;
    const confirmDelete = confirm(`${selectedChatForActions.otherUser.displayName}-এর সাথে করা সব মেসেজ ডিলিট হয়ে যাবে। আপনি কি নিশ্চিত?`);
    if (!confirmDelete) return;

    try {
      // 1. Delete all messages in the chat
      const messagesQuery = query(collection(db, 'chats', chatId, 'messages'));
      const messagesSnap = await getDocs(messagesQuery);
      
      const batch = writeBatch(db);
      messagesSnap.docs.forEach((msgDoc) => {
        batch.delete(msgDoc.ref);
      });
      await batch.commit();

      // 2. Delete the chat document itself
      await deleteDoc(doc(db, 'chats', chatId));
      
      setSelectedChatForActions(null);
    } catch (err: any) {
      console.error('Error deleting chat:', err);
      alert(`ডিলিট করতে সমস্যা হয়েছে: ${err.message}`);
    }
  };

  const handlePinChat = async () => {
    if (!selectedChatForActions || !auth.currentUser) return;
    const isCurrentlyPinned = selectedChatForActions.isPinned?.[auth.currentUser.uid];
    try {
      await updateDoc(doc(db, 'chats', selectedChatForActions.id), {
        [`isPinned.${auth.currentUser.uid}`]: !isCurrentlyPinned
      });
      setSelectedChatForActions(null);
    } catch (err) {
      console.error('Error pinning chat:', err);
    }
  };

  const handleArchiveChat = async () => {
    if (!selectedChatForActions || !auth.currentUser) return;
    try {
      await updateDoc(doc(db, 'chats', selectedChatForActions.id), {
        [`isArchived.${auth.currentUser.uid}`]: true
      });
      setSelectedChatForActions(null);
    } catch (err) {
      console.error('Error archiving chat:', err);
    }
  };

  const handleMuteChat = async () => {
    if (!selectedChatForActions || !auth.currentUser) return;
    try {
      // Mute for 24 hours
      const muteUntil = new Date(Date.now() + 24 * 60 * 60 * 1000);
      await updateDoc(doc(db, 'chats', selectedChatForActions.id), {
        [`mutedUntil.${auth.currentUser.uid}`]: muteUntil.toISOString()
      });
      setSelectedChatForActions(null);
      alert('চ্যাটটি ২৪ ঘণ্টার জন্য মিউট করা হয়েছে।');
    } catch (err) {
      console.error('Error muting chat:', err);
    }
  };

  const handleMarkAsUnread = async () => {
    if (!selectedChatForActions || !auth.currentUser) return;
    try {
      await updateDoc(doc(db, 'chats', selectedChatForActions.id), {
        [`unreadCount.${auth.currentUser.uid}`]: (selectedChatForActions.unreadCount?.[auth.currentUser.uid] || 0) + 1
      });
      setSelectedChatForActions(null);
    } catch (err) {
      console.error('Error marking as unread:', err);
    }
  };

  const handleBlockUser = async () => {
    if (!selectedChatForActions || !auth.currentUser) return;
    const confirmBlock = confirm(`${selectedChatForActions.otherUser.displayName}-কে ব্লক করবেন?`);
    if (!confirmBlock) return;

    try {
      const userRef = doc(db, 'users', auth.currentUser.uid);
      const userSnap = await getDoc(userRef);
      const currentBlocked = userSnap.data()?.blockedUsers || [];
      
      if (!currentBlocked.includes(selectedChatForActions.otherUser.uid)) {
        await updateDoc(userRef, {
          blockedUsers: [...currentBlocked, selectedChatForActions.otherUser.uid]
        });
      }
      setSelectedChatForActions(null);
      alert('সফলভাবে ব্লক করা হয়েছে।');
    } catch (err) {
      console.error('Error blocking user:', err);
    }
  };

  const handleSearchAuto = async () => {
    const term = searchQuery.trim();
    if (!term) {
      setSearchResults([]);
      return;
    }

    // Search by Display Name
    const nameQ = query(
      collection(db, 'users'),
      where('displayName', '>=', term),
      where('displayName', '<=', term + '\uf8ff')
    );

    // Search by Username
    const usernameQ = query(
      collection(db, 'users'),
      where('username', '>=', term.toLowerCase()),
      where('username', '<=', term.toLowerCase() + '\uf8ff')
    );

    try {
      const [nameSnap, usernameSnap] = await Promise.all([
        getDocs(nameQ),
        getDocs(usernameQ)
      ]);

      const resultsMap = new Map<string, UserProfile>();
      
      nameSnap.docs.forEach(doc => {
        const data = doc.data() as UserProfile;
        if (data.uid !== auth.currentUser?.uid) {
          resultsMap.set(data.uid, data);
        }
      });

      usernameSnap.docs.forEach(doc => {
        const data = doc.data() as UserProfile;
        if (data.uid !== auth.currentUser?.uid) {
          resultsMap.set(data.uid, data);
        }
      });
      
      setSearchResults(Array.from(resultsMap.values()));
    } catch (err) {
      console.error("Search error:", err);
    }
  };

  const startNewChat = async (user: UserProfile) => {
    if (!auth.currentUser) return;
    
    // Clear search immediately to feel fast
    setSearchQuery('');
    setSearchResults([]);

    // Check if chat already exists in our current list
    const existingChat = chats.find(c => 
      c.participants && c.participants.includes(user.uid) && c.participants.includes(auth.currentUser!.uid)
    );

    if (existingChat) {
      onChatSelect(existingChat);
      return;
    }

    try {
      console.log('Creating new chat between:', auth.currentUser.uid, 'and', user.uid);
      
      // Create new chat document
      const chatData = {
        participants: [auth.currentUser.uid, user.uid],
        lastMessage: '',
        lastMessageAt: serverTimestamp(),
        unreadCount: { [user.uid]: 0, [auth.currentUser.uid]: 0 }
      };

      const docRef = await addDoc(collection(db, 'chats'), chatData);
      console.log('New chat created with ID:', docRef.id);

      // Select the chat immediately with a temporary object
      // (The onSnapshot listener will soon replace this with the official backend data)
      onChatSelect({
        id: docRef.id,
        ...chatData,
        lastMessageAt: null, // serverTimestamp hasn't resolved yet
        otherUser: user
      } as any);

    } catch (err: any) {
      console.error("Critical error in startNewChat:", err);
      alert(`Chat start failed: ${err.message || 'Check your internet or Firebase console'}`);
    }
  };

  return (
    <div className="flex flex-col h-full bg-white">
      <div className="p-4 bg-white sticky top-0 z-10 border-b border-slate-100">
        <div className="relative group">
          <input 
            type="text" 
            placeholder="Search by name or @username..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-slate-50 border border-slate-100 rounded-2xl py-3 px-5 pr-20 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-100 transition-all placeholder:text-slate-400 font-medium text-slate-800"
          />
          <div className="absolute right-4 top-1/2 -translate-y-1/2 flex items-center gap-2">
            {searchQuery && (
              <button 
                onClick={() => { setSearchQuery(''); setSearchResults([]); }}
                className="p-1 hover:bg-slate-200 rounded-full text-slate-400 hover:text-slate-600 transition-all"
              >
                <X size={16} />
              </button>
            )}
            <Search size={18} className="text-slate-400 group-focus-within:text-indigo-500 transition-colors" />
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-0 py-2 no-scrollbar">
        {searchResults.length > 0 && (
          <div className="mb-6">
            <h3 className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em] px-4 mb-3">Search Results</h3>
            {searchResults.map(user => (
              <button 
                key={user.uid}
                onClick={() => startNewChat(user)}
                className="w-full flex items-center gap-4 px-4 py-3 hover:bg-slate-50 transition-colors group text-left"
              >
                <img 
                  src={user.photoURL || `https://api.dicebear.com/7.x/avataaars/svg?seed=${user.uid}`} 
                  alt={user.displayName}
                  className="w-12 h-12 rounded-full border border-slate-100 shadow-sm"
                />
                <div>
                  <p className="font-bold text-slate-800 text-sm tracking-tight">{user.displayName}</p>
                  <p className="text-[10px] text-indigo-600 font-bold uppercase tracking-wider">@{user.username || 'user'}</p>
                </div>
              </button>
            ))}
            <div className="h-px bg-slate-100 my-4 mx-4"></div>
          </div>
        )}

        {loading ? (
          <div className="flex items-center justify-center py-10">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-500"></div>
          </div>
        ) : chats.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center px-6">
            <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center text-slate-300 mb-4">
              <MessageCircle size={32} />
            </div>
            <p className="text-slate-400 text-xs font-medium italic">No conversations yet.</p>
          </div>
        ) : (
          <div className="space-y-0.5">
            <p className="px-4 text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em] mb-4 mt-2">Active Messages</p>
            {chats.map(chat => (
              <button 
                key={chat.id}
                onClick={() => onChatSelect(chat)}
                onMouseDown={() => handleTouchStart(chat)}
                onMouseUp={handleTouchEnd}
                onMouseLeave={handleTouchEnd}
                onTouchStart={() => handleTouchStart(chat)}
                onTouchEnd={handleTouchEnd}
                className={`w-full flex items-center gap-4 px-4 py-3 transition-all group relative ${
                  activeChatId === chat.id 
                    ? 'bg-indigo-50 border-r-2 border-indigo-500' 
                    : 'hover:bg-slate-50'
                }`}
              >
                <div className="relative flex-shrink-0">
                  <img 
                    src={chat.otherUser.photoURL || `https://api.dicebear.com/7.x/avataaars/svg?seed=${chat.otherUser.uid}`} 
                    alt={chat.otherUser.displayName}
                    className="w-13 h-13 rounded-full object-cover shadow-sm bg-slate-100 border border-slate-50"
                  />
                  {chat.otherUser.status === 'online' && (
                    <div className="absolute bottom-0 right-0 w-3.5 h-3.5 bg-green-500 border-2 border-white rounded-full"></div>
                  )}
                </div>
                <div className="flex-1 min-w-0 text-left">
                  <div className="flex justify-between items-baseline mb-0.5">
                    <div className="flex items-center gap-1.5 min-w-0">
                      <h4 className={`font-bold truncate text-sm tracking-tight ${activeChatId === chat.id ? 'text-indigo-600' : 'text-slate-800'}`}>{chat.otherUser.displayName}</h4>
                      {chat.isPinned?.[auth.currentUser?.uid || ''] && (
                        <Pin size={10} className="text-indigo-500 fill-indigo-500 flex-shrink-0" />
                      )}
                    </div>
                    {chat.lastMessageAt && (
                      <span className="text-[9px] text-slate-400 font-bold uppercase flex-shrink-0">
                        {new Date(chat.lastMessageAt?.toDate()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    )}
                  </div>
                  <p className={`text-xs truncate ${activeChatId === chat.id ? 'text-slate-600 font-bold' : 'text-slate-500 font-medium'}`}>
                    {chat.lastMessage || 'No messages yet'}
                  </p>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Bottom Sheet Actions */}
      <AnimatePresence>
        {selectedChatForActions && (
          <>
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setSelectedChatForActions(null)}
              className="fixed inset-0 bg-black/60 z-[60] backdrop-blur-[2px]"
            />
            <motion.div 
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: "spring", damping: 25, stiffness: 300 }}
              className="fixed bottom-0 inset-x-0 bg-white z-[70] rounded-t-[32px] overflow-hidden max-h-[85vh] flex flex-col shadow-2xl border-t border-slate-100"
            >
              {/* Handle */}
              <div className="w-full flex justify-center p-3">
                <div className="w-10 h-1.5 bg-slate-200 rounded-full" />
              </div>

              <div className="flex-1 overflow-y-auto p-4 space-y-1">
                <div className="flex items-center gap-4 px-4 py-4 mb-2 border-b border-slate-100">
                   <img 
                    src={selectedChatForActions.otherUser.photoURL || `https://api.dicebear.com/7.x/avataaars/svg?seed=${selectedChatForActions.otherUser.uid}`} 
                    alt="" 
                    className="w-12 h-12 rounded-full object-cover shadow-sm"
                  />
                  <h3 className="font-bold text-lg text-slate-800">{selectedChatForActions.otherUser.displayName}</h3>
                </div>

                <ActionButton 
                  icon={<Pin size={20} className={selectedChatForActions.isPinned?.[auth.currentUser?.uid || ''] ? 'fill-current' : ''} />} 
                  label={selectedChatForActions.isPinned?.[auth.currentUser?.uid || ''] ? 'Unpin' : 'Pin'} 
                  onClick={handlePinChat}
                />
                <ActionButton icon={<Archive size={20} />} label="Archive" onClick={handleArchiveChat} />
                <ActionButton icon={<BellOff size={20} />} label="Mute" onClick={handleMuteChat} />
                <ActionButton icon={<Users size={20} />} label={`Create group chat with ${selectedChatForActions.otherUser.displayName.split(' ')[0]}`} />
                <ActionButton icon={<Maximize2 size={20} />} label="Open chat head" />
                <ActionButton icon={<Mail size={20} />} label="Mark as unread" onClick={handleMarkAsUnread} />
                <ActionButton icon={<ShieldAlert size={20} />} label="Restrict" />
                <ActionButton icon={<Ban size={20} />} label="Block" onClick={handleBlockUser} />
                <ActionButton icon={<Trash2 size={20} />} label="Delete" color="text-red-500" onClick={handleDeleteChat} />
              </div>

              <div className="p-4 bg-slate-50 border-t border-slate-100">
                <button 
                  onClick={() => setSelectedChatForActions(null)}
                  className="w-full py-4 bg-white text-slate-600 font-bold rounded-2xl hover:bg-slate-100 transition-all border border-slate-200"
                >
                  Close
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}

function ActionButton({ icon, label, color = "text-slate-700", onClick }: { icon: any, label: string, color?: string, onClick?: () => void }) {
  return (
    <button 
      onClick={onClick}
      className={`w-full flex items-center gap-4 px-4 py-3.5 hover:bg-slate-50 rounded-xl transition-all text-left group`}
    >
      <div className={`${color} group-hover:scale-110 transition-transform`}>{icon}</div>
      <span className={`text-[15px] font-bold ${color}`}>{label}</span>
    </button>
  );
}
