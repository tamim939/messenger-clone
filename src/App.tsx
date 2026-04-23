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
import { 
  LogOut, 
  Smile, 
  Settings, 
  User as UserIcon, 
  Search, 
  ChevronRight, 
  MessageCircle, 
  SquarePen, 
  Bell, 
  Menu, 
  Clapperboard 
} from 'lucide-react';
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
    <div className="h-screen bg-slate-50 flex flex-col md:flex-row overflow-hidden font-sans text-slate-900 selection:bg-indigo-500/30">
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
      <div className="flex-1 flex flex-col min-w-0 h-full relative">
        <div className="flex flex-1 min-w-0 overflow-hidden h-full">
          {/* Left Pane - List of Chats */}
          <div className={`w-full md:w-[380px] flex flex-col flex-shrink-0 bg-white border-r border-slate-200 ${selectedChat ? 'hidden md:flex' : 'flex'}`}>
            <div className="p-6 pb-2 bg-white flex justify-between items-center transition-all">
              <h1 className="text-2xl font-black text-indigo-600 tracking-tight uppercase">messenger</h1>
              <div className="flex items-center gap-3">
                 <button 
                  onClick={() => setShowProfile(true)}
                  className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center text-slate-600 hover:bg-indigo-50 hover:text-indigo-600 transition-all overflow-hidden border border-slate-200 shadow-sm group"
                >
                  {profile?.photoURL ? (
                    <img src={profile.photoURL || undefined} alt="" className="w-full h-full object-cover group-hover:scale-110 transition-transform" />
                  ) : (
                    <UserIcon size={20} />
                  )}
                </button>
              </div>
            </div>
            
            <div className="px-6 py-2">
              <div className="relative group">
                <input 
                  type="text" 
                  placeholder="Ask Meta AI or Search"
                  className="w-full bg-slate-100 border-none rounded-full py-2 px-10 text-sm focus:ring-2 focus:ring-indigo-100 transition-all placeholder:text-slate-400 text-slate-800"
                />
                <Search size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-indigo-500 transition-colors" />
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
                  <div className="w-80 bg-white hidden lg:flex flex-col items-center p-8 flex-shrink-0 border-l border-slate-200">
                    <div className="relative mb-6">
                      <img 
                        src={selectedChat.otherUser.photoURL || `https://api.dicebear.com/7.x/avataaars/svg?seed=${selectedChat.otherUser.uid}`}
                        alt="" 
                        className="w-28 h-28 rounded-full border-4 border-slate-50 object-cover shadow-sm"
                      />
                      <div className="absolute bottom-1 right-1 w-6 h-6 bg-green-500 border-4 border-white rounded-full"></div>
                    </div>
                    <h3 className="font-bold text-xl text-center text-slate-900 mb-1">{selectedChat.otherUser.displayName}</h3>
                    <p className="text-xs text-slate-500 mb-8 font-medium">@{selectedChat.otherUser.username || 'user'}</p>
                    
                    <div className="w-full space-y-6">
                      <div className="flex justify-center gap-6">
                         <div className="flex flex-col items-center gap-1.5">
                            <button className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center hover:bg-slate-200 transition-all text-slate-700"><UserIcon size={20} /></button>
                            <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Profile</span>
                         </div>
                         <div className="flex flex-col items-center gap-1.5">
                            <button className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center hover:bg-slate-200 transition-all text-slate-700"><Bell size={20} /></button>
                            <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Mute</span>
                         </div>
                         <div className="flex flex-col items-center gap-1.5">
                            <button className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center hover:bg-slate-200 transition-all text-slate-700"><Search size={20} /></button>
                            <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Search</span>
                         </div>
                      </div>

                      <div className="space-y-1">
                        <SidebarLink label="Chat Info" />
                        <SidebarLink label="Customize Chat" />
                        <SidebarLink label="Media, Files & Links" />
                        <SidebarLink label="Privacy & Support" />
                      </div>
                    </div>

                    <div className="mt-auto w-full pt-8">
                       <button className="w-full py-4 bg-red-50 text-red-500 font-bold rounded-2xl hover:bg-red-100 transition-all text-sm border border-red-100">Block User</button>
                    </div>
                  </div>
                </motion.div>
              ) : (
                <div className="flex-1 flex flex-col items-center justify-center text-center p-8 bg-slate-50">
                  <div className="w-24 h-24 bg-white rounded-[40px] flex items-center justify-center text-indigo-100 mb-8 shadow-sm">
                     <MessageCircle size={44} />
                  </div>
                  <h2 className="text-2xl font-black text-slate-900 mb-2">Social Connect</h2>
                  <p className="text-slate-500 max-w-sm mb-10 text-sm leading-relaxed font-medium">
                    Choose a chat to start high-performance, real-time messaging with your friends.
                  </p>
                  <div className="flex gap-4">
                    <button className="px-6 py-3 bg-indigo-600 text-white rounded-2xl text-[11px] font-black uppercase tracking-[0.2em] shadow-lg shadow-indigo-600/20 hover:scale-105 transition-all">New Chat</button>
                  </div>
                </div>
              )}
            </AnimatePresence>
          </div>
        </div>

        {/* Mobile Bottom Navigation */}
        {!selectedChat && (
          <div className="md:hidden bg-white border-t border-slate-100 px-6 py-2 flex justify-between items-center z-40 transition-all">
             <NavIcon icon={<MessageCircle size={22} />} label="Chats" active />
             <NavIcon icon={<Clapperboard size={22} />} label="Stories" />
             <NavIcon icon={<Bell size={22} />} label="Notifications" />
             <NavIcon icon={<Menu size={22} />} label="Menu" />
          </div>
        )}
      </div>

      <AnimatePresence>
        {showProfile && (
          <ProfileModal user={user} onClose={() => setShowProfile(false)} />
        )}
      </AnimatePresence>
    </div>
  );
}

function SidebarLink({ label }: { label: string }) {
  return (
    <button className="w-full flex justify-between items-center px-4 py-3.5 hover:bg-slate-50 rounded-xl transition-all text-left group">
      <span className="text-sm font-bold text-slate-600 group-hover:text-indigo-600">{label}</span>
      <ChevronRight size={16} className="text-slate-300 group-hover:text-indigo-400" />
    </button>
  );
}

function NavIcon({ icon, label, active = false }: { icon: any, label: string, active?: boolean }) {
  return (
    <div className="flex flex-col items-center gap-1 cursor-pointer group">
      <div className={`p-2 rounded-full transition-all ${active ? 'text-indigo-600 bg-indigo-50' : 'text-slate-400 hover:text-indigo-500 hover:bg-slate-50'}`}>
        {icon}
      </div>
      <span className={`text-[9px] font-extrabold uppercase tracking-widest ${active ? 'text-indigo-600' : 'text-slate-400 group-hover:text-indigo-500'}`}>{label}</span>
    </div>
  );
}
