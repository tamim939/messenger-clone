import React, { useEffect, useState } from 'react';
import { db, auth } from '../lib/firebase';
import { 
  collection, 
  query, 
  where, 
  onSnapshot, 
  orderBy,
  getDoc,
  doc,
  addDoc,
  serverTimestamp
} from 'firebase/firestore';
import { UserProfile, Chat } from '../types';
import { Search, Plus, MessageCircle, X } from 'lucide-react';
import { motion } from 'motion/react';

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
      <div className="p-4 bg-white sticky top-0 z-10 border-b border-slate-50">
        <div className="relative group">
          <input 
            type="text" 
            placeholder="Search by name or @username..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-indigo-50/50 border border-indigo-100/50 rounded-2xl py-3 px-5 pr-20 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all placeholder:text-indigo-300 font-medium"
          />
          <div className="absolute right-4 top-1/2 -translate-y-1/2 flex items-center gap-2">
            {searchQuery && (
              <button 
                onClick={() => { setSearchQuery(''); setSearchResults([]); }}
                className="p-1 hover:bg-indigo-100 rounded-full text-indigo-400 hover:text-indigo-600 transition-all"
              >
                <X size={16} />
              </button>
            )}
            <Search size={18} className="text-indigo-400 group-focus-within:text-indigo-600 transition-colors" />
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-0 py-2">
        {searchResults.length > 0 && (
          <div className="mb-6">
            <h3 className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em] px-4 mb-3">Search Results</h3>
            {searchResults.map(user => (
              <button 
                key={user.uid}
                onClick={() => startNewChat(user)}
                className="w-full flex items-center gap-3 px-4 py-3 hover:bg-indigo-50 transition-colors group text-left border-l-4 border-transparent hover:border-indigo-500"
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
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
          </div>
        ) : chats.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center px-6">
            <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center text-slate-200 mb-4">
              <MessageCircle size={32} />
            </div>
            <p className="text-slate-400 text-xs font-medium italic">No conversations yet.</p>
          </div>
        ) : (
          <div className="space-y-0.5">
            <p className="px-4 text-[10px] font-bold text-slate-300 uppercase tracking-[0.2em] mb-4 mt-2">Active Messages</p>
            {chats.map(chat => (
              <button 
                key={chat.id}
                onClick={() => onChatSelect(chat)}
                className={`w-full flex items-center gap-3 px-4 py-3 transition-all group relative border-l-4 ${
                  activeChatId === chat.id 
                    ? 'bg-indigo-50 border-indigo-500' 
                    : 'hover:bg-slate-50 border-transparent'
                }`}
              >
                <div className="relative flex-shrink-0">
                  <img 
                    src={chat.otherUser.photoURL || `https://api.dicebear.com/7.x/avataaars/svg?seed=${chat.otherUser.uid}`} 
                    alt={chat.otherUser.displayName}
                    className="w-12 h-12 rounded-full object-cover shadow-sm bg-slate-100"
                  />
                  {chat.otherUser.status === 'online' && (
                    <div className="absolute bottom-0 right-0 w-3.5 h-3.5 bg-green-500 border-2 border-white rounded-full"></div>
                  )}
                </div>
                <div className="flex-1 min-w-0 text-left">
                  <div className="flex justify-between items-baseline mb-0.5">
                    <h4 className="font-bold text-slate-800 truncate text-sm tracking-tight">{chat.otherUser.displayName}</h4>
                    {chat.lastMessageAt && (
                      <span className="text-[9px] text-slate-400 font-bold uppercase">
                        {new Date(chat.lastMessageAt?.toDate()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    )}
                  </div>
                  <p className={`text-[12px] truncate leading-tight ${activeChatId === chat.id ? 'text-indigo-600 font-bold' : 'text-slate-500 font-medium italic'}`}>
                    {chat.lastMessage || 'Start a conversation...'}
                  </p>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
