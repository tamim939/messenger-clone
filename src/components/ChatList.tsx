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
  serverTimestamp
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
      
      setChats(chatData.filter(c => c !== null) as (Chat & { otherUser: UserProfile })[]);
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
    <div className="flex flex-col h-full bg-[#000000]">
      <div className="p-4 bg-[#000000] sticky top-0 z-10 border-b border-white/5">
        <div className="relative group">
          <input 
            type="text" 
            placeholder="Search by name or @username..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-white/5 border border-white/5 rounded-2xl py-3 px-5 pr-20 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all placeholder:text-slate-600 font-medium text-white"
          />
          <div className="absolute right-4 top-1/2 -translate-y-1/2 flex items-center gap-2">
            {searchQuery && (
              <button 
                onClick={() => { setSearchQuery(''); setSearchResults([]); }}
                className="p-1 hover:bg-white/10 rounded-full text-slate-500 hover:text-white transition-all"
              >
                <X size={16} />
              </button>
            )}
            <Search size={18} className="text-slate-600 group-focus-within:text-indigo-500 transition-colors" />
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-0 py-2 no-scrollbar">
        {searchResults.length > 0 && (
          <div className="mb-6">
            <h3 className="text-[10px] font-bold text-slate-600 uppercase tracking-[0.2em] px-4 mb-3">Search Results</h3>
            {searchResults.map(user => (
              <button 
                key={user.uid}
                onClick={() => startNewChat(user)}
                className="w-full flex items-center gap-4 px-4 py-3 hover:bg-white/5 transition-colors group text-left"
              >
                <img 
                  src={user.photoURL || `https://api.dicebear.com/7.x/avataaars/svg?seed=${user.uid}`} 
                  alt={user.displayName}
                  className="w-12 h-12 rounded-full border border-white/5 shadow-sm"
                />
                <div>
                  <p className="font-bold text-white text-sm tracking-tight">{user.displayName}</p>
                  <p className="text-[10px] text-indigo-400 font-bold uppercase tracking-wider">@{user.username || 'user'}</p>
                </div>
              </button>
            ))}
            <div className="h-px bg-white/5 my-4 mx-4"></div>
          </div>
        )}

        {loading ? (
          <div className="flex items-center justify-center py-10">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-500"></div>
          </div>
        ) : chats.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center px-6">
            <div className="w-16 h-16 bg-white/5 rounded-full flex items-center justify-center text-slate-800 mb-4">
              <MessageCircle size={32} />
            </div>
            <p className="text-slate-600 text-xs font-medium italic">No conversations yet.</p>
          </div>
        ) : (
          <div className="space-y-0.5">
            <p className="px-4 text-[10px] font-bold text-slate-700 uppercase tracking-[0.2em] mb-4 mt-2">Active Messages</p>
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
                    ? 'bg-indigo-500/10' 
                    : 'hover:bg-white/5'
                }`}
              >
                <div className="relative flex-shrink-0">
                  <img 
                    src={chat.otherUser.photoURL || `https://api.dicebear.com/7.x/avataaars/svg?seed=${chat.otherUser.uid}`} 
                    alt={chat.otherUser.displayName}
                    className="w-13 h-13 rounded-full object-cover shadow-sm bg-slate-100 border border-white/5"
                  />
                  {chat.otherUser.status === 'online' && (
                    <div className="absolute bottom-0 right-0 w-3.5 h-3.5 bg-green-500 border-2 border-[#000000] rounded-full"></div>
                  )}
                </div>
                <div className="flex-1 min-w-0 text-left">
                  <div className="flex justify-between items-baseline mb-0.5">
                    <h4 className="font-bold text-white truncate text-sm tracking-tight">{chat.otherUser.displayName}</h4>
                    {chat.lastMessageAt && (
                      <span className="text-[9px] text-slate-600 font-bold uppercase">
                        {new Date(chat.lastMessageAt?.toDate()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    )}
                  </div>
                  <p className={`text-xs truncate ${activeChatId === chat.id ? 'text-white font-bold' : 'text-slate-500 font-medium'}`}>
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
              className="fixed bottom-0 inset-x-0 bg-[#1c1c1e] z-[70] rounded-t-[32px] overflow-hidden max-h-[85vh] flex flex-col"
            >
              {/* Handle */}
              <div className="w-full flex justify-center p-3">
                <div className="w-10 h-1.5 bg-white/10 rounded-full" />
              </div>

              <div className="flex-1 overflow-y-auto p-4 space-y-1">
                <div className="flex items-center gap-4 px-4 py-4 mb-2 border-b border-white/5">
                   <img 
                    src={selectedChatForActions.otherUser.photoURL || `https://api.dicebear.com/7.x/avataaars/svg?seed=${selectedChatForActions.otherUser.uid}`} 
                    alt="" 
                    className="w-12 h-12 rounded-full object-cover"
                  />
                  <h3 className="font-bold text-lg text-white">{selectedChatForActions.otherUser.displayName}</h3>
                </div>

                <ActionButton icon={<Pin size={20} />} label="Pin" />
                <ActionButton icon={<Archive size={20} />} label="Archive" />
                <ActionButton icon={<BellOff size={20} />} label="Mute" />
                <ActionButton icon={<Users size={20} />} label={`Create group chat with ${selectedChatForActions.otherUser.displayName.split(' ')[0]}`} />
                <ActionButton icon={<Maximize2 size={20} />} label="Open chat head" />
                <ActionButton icon={<Mail size={20} />} label="Mark as unread" />
                <ActionButton icon={<ShieldAlert size={20} />} label="Restrict" />
                <ActionButton icon={<Ban size={20} />} label="Block" />
                <ActionButton icon={<Trash2 size={20} />} label="Delete" color="text-red-500" onClick={() => setSelectedChatForActions(null)} />
              </div>

              <div className="p-4 bg-[#1c1c1e]">
                <button 
                  onClick={() => setSelectedChatForActions(null)}
                  className="w-full py-4 bg-white/5 text-white font-bold rounded-2xl hover:bg-white/10 transition-all"
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

function ActionButton({ icon, label, color = "text-white", onClick }: { icon: any, label: string, color?: string, onClick?: () => void }) {
  return (
    <button 
      onClick={onClick}
      className="w-full flex items-center gap-4 px-4 py-3.5 hover:bg-white/5 rounded-xl transition-all text-left"
    >
      <div className={color}>{icon}</div>
      <span className={`text-[15px] font-medium ${color}`}>{label}</span>
    </button>
  );
}
