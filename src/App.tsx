import React, { useState, useEffect } from 'react';
import { auth, db } from './lib/firebase';
import { onAuthStateChanged, User } from 'firebase/auth';
import { doc, onSnapshot, setDoc, serverTimestamp } from 'firebase/firestore';
import Auth from './components/Auth';
import ChatList from './components/ChatList';
import ChatRoom from './components/ChatRoom';
import StoryBar from './components/StoryBar';
import ProfileModal from './components/ProfileModal';
import { Chat, UserProfile } from './types';
import { LogOut, Smile, Settings, User as UserIcon } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedChat, setSelectedChat] = useState<(Chat & { otherUser: UserProfile }) | null>(null);
  const [showProfile, setShowProfile] = useState(false);

  useEffect(() => {
    let unsubscribeProfile: (() => void) | null = null;

    const unsubscribeAuth = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      
      if (currentUser) {
        // Ensure user document exists with basic info
        const userRef = doc(db, 'users', currentUser.uid);
        setDoc(userRef, {
          uid: currentUser.uid,
          displayName: currentUser.displayName || 'User',
          email: currentUser.email,
          photoURL: currentUser.photoURL,
          status: 'online',
          lastSeen: serverTimestamp()
        }, { merge: true });

        // Real-time listener for user profile data
        unsubscribeProfile = onSnapshot(userRef, (snapshot) => {
          if (snapshot.exists()) {
            setProfile(snapshot.data() as UserProfile);
          }
        });
        
        setLoading(false);
      } else {
        setProfile(null);
        setLoading(false);
      }
    });

    return () => {
      unsubscribeAuth();
      if (unsubscribeProfile) unsubscribeProfile();
    };
  }, []);

  const handleLogout = async () => {
    if (user) {
      const userRef = doc(db, 'users', user.uid);
      await setDoc(userRef, {
        status: 'offline',
        lastSeen: serverTimestamp()
      }, { merge: true });
      auth.signOut();
      setSelectedChat(null);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="relative">
          <div className="w-16 h-16 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin"></div>
          <div className="absolute inset-0 flex items-center justify-center text-indigo-600">
            <Smile size={24} />
          </div>
        </div>
      </div>
    );
  }

  if (!user) {
    return <Auth />;
  }

  return (
    <div className="h-screen bg-slate-100 flex overflow-hidden font-sans text-slate-800">
      {/* Sidebar - Desktop Only */}
      <nav className="w-20 bg-white border-r border-slate-200 flex flex-col items-center py-8 gap-8 hidden md:flex z-30">
        <div className="w-12 h-12 bg-indigo-600 rounded-2xl flex items-center justify-center text-white shadow-lg shadow-indigo-100">
          <Smile size={24} />
        </div>
        <div className="flex-1 flex flex-col gap-4">
          <button 
            onClick={() => setShowProfile(true)}
            className="p-3 text-indigo-600 bg-indigo-50 rounded-2xl transition-all shadow-sm"
          >
            <UserIcon size={24} />
          </button>
          <button className="p-3 text-slate-400 hover:text-indigo-600 hover:bg-slate-50 rounded-2xl transition-all">
            <Settings size={24} />
          </button>
        </div>
        <button 
          onClick={handleLogout}
          className="p-3 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-2xl transition-all"
        >
          <LogOut size={24} />
        </button>
      </nav>

      {/* Main Content Area */}
      <div className="flex-1 flex min-w-0">
        {/* Left Pane - List of Chats */}
        <div className={`w-full md:w-80 flex flex-col flex-shrink-0 bg-white border-r border-slate-200 ${selectedChat ? 'hidden md:flex' : 'flex'}`}>
          <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-white">
            <h1 className="text-2xl font-bold text-indigo-600 tracking-tight">Connectify</h1>
            <div 
              onClick={() => setShowProfile(true)}
              className="w-10 h-10 rounded-full bg-slate-200 flex items-center justify-center border-2 border-indigo-100 cursor-pointer overflow-hidden transform hover:scale-110 transition-transform"
            >
               {profile?.photoURL ? (
                 <img src={profile.photoURL || undefined} alt="" className="w-full h-full object-cover" />
               ) : (
                 <span className="text-xs font-bold">{profile?.displayName?.substring(0, 2).toUpperCase() || '??'}</span>
               )}
            </div>
          </div>
          <StoryBar />
          <ChatList 
            onChatSelect={setSelectedChat} 
            activeChatId={selectedChat?.id} 
          />
        </div>

        {/* Right Pane - Active Chat */}
        <div className={`flex-1 min-w-0 bg-slate-50 flex ${!selectedChat ? 'hidden md:flex' : 'flex'}`}>
          <AnimatePresence mode="wait">
            {selectedChat ? (
              <motion.div 
                key={selectedChat.id}
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="flex flex-1"
              >
                <div className="flex-1 flex flex-col min-w-0 border-r border-slate-200">
                  <ChatRoom 
                    chat={selectedChat} 
                    onBack={() => setSelectedChat(null)} 
                  />
                </div>
                
                {/* Right Sidebar: Details - Desktop Only */}
                <div className="w-64 bg-white hidden lg:flex flex-col items-center p-6 flex-shrink-0">
                  <img 
                    src={selectedChat.otherUser.photoURL || `https://api.dicebear.com/7.x/avataaars/svg?seed=${selectedChat.otherUser.uid}`}
                    alt="" 
                    className="w-24 h-24 rounded-full bg-indigo-200 mb-4 object-cover"
                  />
                  <h3 className="font-bold text-lg text-center text-slate-800">{selectedChat.otherUser.displayName}</h3>
                  <p className="text-xs text-slate-400 mb-6">{selectedChat.otherUser.email}</p>
                  
                  <div className="w-full space-y-4">
                    <div className="flex items-center justify-between p-2 border-b border-slate-100">
                       <span className="text-xs font-semibold text-slate-600">Media & Links</span>
                       <span className="text-[10px] text-indigo-500 font-bold cursor-pointer">View all</span>
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                      <div className="aspect-square bg-slate-50 rounded-md border border-slate-200"></div>
                      <div className="aspect-square bg-slate-50 rounded-md border border-slate-200"></div>
                      <div className="aspect-square bg-slate-50 rounded-md border border-slate-200"></div>
                    </div>
                    
                    <div className="pt-4">
                       <button className="w-full py-2.5 bg-slate-50 text-slate-600 text-[11px] font-bold rounded-xl border border-slate-200 hover:bg-slate-100 transition-colors uppercase tracking-wider">Privacy & Support</button>
                       <button className="w-full py-2.5 mt-2 bg-red-50 text-red-600 text-[11px] font-bold rounded-xl border border-red-100 hover:bg-red-100 transition-colors uppercase tracking-wider">Block User</button>
                    </div>
                  </div>

                  <div className="mt-auto w-full">
                    <div className="p-4 bg-indigo-600 rounded-2xl text-white text-center shadow-lg shadow-indigo-100">
                      <p className="text-[9px] uppercase font-bold tracking-widest opacity-80 mb-1">Pro Account</p>
                      <p className="text-[11px] font-medium leading-tight">Unlimited storage for images & videos</p>
                    </div>
                  </div>
                </div>
              </motion.div>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center text-center p-8 bg-white/50 backdrop-blur-sm">
                <div className="w-24 h-24 bg-indigo-50 rounded-[40px] flex items-center justify-center text-indigo-600 mb-6 shadow-sm">
                   <Smile size={48} />
                </div>
                <h2 className="text-2xl font-bold text-slate-800 mb-2">Connect and Share</h2>
                <p className="text-slate-500 max-w-sm mb-8">
                  Pick a conversation from the left to start messaging, share photos, or post your latest updates in stories.
                </p>
                <div className="flex gap-4">
                  <div className="px-4 py-2 bg-indigo-100 text-indigo-700 rounded-lg text-[10px] font-bold uppercase tracking-wider">Messages</div>
                  <div className="px-4 py-2 bg-pink-100 text-pink-700 rounded-lg text-[10px] font-bold uppercase tracking-wider">Stories</div>
                  <div className="px-4 py-2 bg-slate-100 text-slate-700 rounded-lg text-[10px] font-bold uppercase tracking-wider">Media</div>
                </div>
              </div>
            )}
          </AnimatePresence>
        </div>
      </div>

      <AnimatePresence>
        {showProfile && (
          <ProfileModal user={user} onClose={() => setShowProfile(false)} />
        )}
      </AnimatePresence>
    </div>
  );
}
