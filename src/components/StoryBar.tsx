import React, { useEffect, useState, useRef } from 'react';
import { db, auth, storage } from '../lib/firebase';
import { 
  collection, 
  query, 
  onSnapshot, 
  where,
  orderBy,
  addDoc,
  serverTimestamp,
  updateDoc,
  doc,
  getDocs,
  limit
} from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { Story } from '../types';
import { Plus, X, ChevronLeft, ChevronRight, Send, Heart, ThumbsUp, Smile } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface UserStories {
  userId: string;
  userDisplayName: string;
  userPhotoURL?: string;
  stories: Story[];
}

export default function StoryBar() {
  const [userStoryGroups, setUserStoryGroups] = useState<UserStories[]>([]);
  const [selectedUserIndex, setSelectedUserIndex] = useState<number | null>(null);
  const [activeStoryIndex, setActiveStoryIndex] = useState(0);
  const [uploading, setUploading] = useState(false);
  const [commentText, setCommentText] = useState('');
  const [isSendingComment, setIsSendingComment] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const q = query(
      collection(db, 'stories'),
      where('expiresAt', '>', new Date().toISOString()),
      orderBy('createdAt', 'asc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const storyList = snapshot.docs.map(docSnap => ({
        ...docSnap.data(),
        id: docSnap.id
      })) as Story[];
      
      const groups: Record<string, UserStories> = {};
      
      storyList.forEach(s => {
        if (!groups[s.userId]) {
          groups[s.userId] = {
            userId: s.userId,
            userDisplayName: s.userDisplayName,
            userPhotoURL: s.userPhotoURL,
            stories: []
          };
        }
        groups[s.userId].stories.push(s);
      });
      
      // Convert to array and put current user first if they have stories
      const groupsArray = Object.values(groups);
      const sortedGroups = groupsArray.sort((a, b) => {
        if (a.userId === auth.currentUser?.uid) return -1;
        if (b.userId === auth.currentUser?.uid) return 1;
        return 0;
      });
      
      setUserStoryGroups(sortedGroups);
    });

    return () => unsubscribe();
  }, []);

  const handleStoryUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    try {
      const type = file.type.startsWith('image/') ? 'image' : 'video';
      const storageRef = ref(storage, `stories/${auth.currentUser?.uid}/${Date.now()}_${file.name}`);
      await uploadBytes(storageRef, file);
      const url = await getDownloadURL(storageRef);

      const expiresAt = new Date();
      expiresAt.setHours(expiresAt.getHours() + 24);

      await addDoc(collection(db, 'stories'), {
        userId: auth.currentUser?.uid,
        userDisplayName: auth.currentUser?.displayName,
        userPhotoURL: auth.currentUser?.photoURL,
        mediaUrl: url,
        mediaType: type,
        createdAt: new Date().toISOString(),
        expiresAt: expiresAt.toISOString(),
        reactions: {},
        commentCount: 0
      });
    } catch (err) {
      alert("Failed to upload story. Please check your Firebase Storage rules.");
    } finally {
      setUploading(false);
    }
  };

  const handleReaction = async (emoji: string) => {
    if (selectedUserIndex === null || !auth.currentUser) return;
    const story = userStoryGroups[selectedUserIndex].stories[activeStoryIndex];
    
    try {
      const storyRef = doc(db, 'stories', story.id);
      await updateDoc(storyRef, {
        [`reactions.${auth.currentUser.uid}`]: emoji
      });
    } catch (err) {
      console.error("Error reacting:", err);
    }
  };

  const handleSendComment = async () => {
    if (!commentText.trim() || selectedUserIndex === null || !auth.currentUser || isSendingComment) return;
    
    const story = userStoryGroups[selectedUserIndex].stories[activeStoryIndex];
    setIsSendingComment(true);
    
    try {
      // Add comment to subcollection
      await addDoc(collection(db, 'stories', story.id, 'comments'), {
        userId: auth.currentUser.uid,
        userDisplayName: auth.currentUser.displayName,
        userPhotoURL: auth.currentUser.photoURL,
        text: commentText,
        createdAt: serverTimestamp()
      });
      
      setCommentText('');
      // Potentially increment comment count
      await updateDoc(doc(db, 'stories', story.id), {
        commentCount: (story.commentCount || 0) + 1
      });
    } catch (err) {
      console.error("Error sending comment:", err);
    } finally {
      setIsSendingComment(false);
    }
  };

  const nextStory = () => {
    if (selectedUserIndex === null) return;
    const group = userStoryGroups[selectedUserIndex];
    if (activeStoryIndex < group.stories.length - 1) {
      setActiveStoryIndex(activeStoryIndex + 1);
    } else if (selectedUserIndex < userStoryGroups.length - 1) {
      setSelectedUserIndex(selectedUserIndex + 1);
      setActiveStoryIndex(0);
    } else {
      setSelectedUserIndex(null);
      setActiveStoryIndex(0);
    }
  };

  const prevStory = () => {
    if (selectedUserIndex === null) return;
    const group = userStoryGroups[selectedUserIndex];
    if (activeStoryIndex > 0) {
      setActiveStoryIndex(activeStoryIndex - 1);
    } else if (selectedUserIndex > 0) {
      const prevGroup = userStoryGroups[selectedUserIndex - 1];
      setSelectedUserIndex(selectedUserIndex - 1);
      setActiveStoryIndex(prevGroup.stories.length - 1);
    }
  };

  const reactions = ['❤️', '👍', '😂', '😮', '😢', '😡'];

  return (
    <div className="py-4 px-4 flex items-center gap-4 overflow-x-auto no-scrollbar bg-white border-b border-slate-100">
      {/* Create Story */}
      <div className="flex-shrink-0 flex flex-col items-center gap-2 w-16">
        <div 
          onClick={() => fileInputRef.current?.click()}
          className="relative w-16 h-16 rounded-full bg-slate-50 flex items-center justify-center cursor-pointer border-2 border-dashed border-slate-200 hover:border-indigo-500 hover:bg-indigo-50 transition-all group overflow-hidden"
        >
          {uploading ? (
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-indigo-500"></div>
          ) : (
            <>
              {auth.currentUser?.photoURL ? (
                <img src={auth.currentUser.photoURL || undefined} alt="" className="w-full h-full object-cover opacity-80 group-hover:opacity-50" />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-slate-300 group-hover:text-indigo-400">
                  <Plus size={24} />
                </div>
              )}
              <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                 <Plus size={24} className="text-indigo-600" />
              </div>
            </>
          )}
        </div>
        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest text-center">Your Story</span>
        <input 
          type="file" 
          hidden 
          ref={fileInputRef} 
          onChange={handleStoryUpload} 
          accept="image/*,video/*"
        />
      </div>

      {/* Story List grouped by user */}
      {userStoryGroups.map((group, idx) => {
        const isMe = group.userId === auth.currentUser?.uid;
        if (isMe && group.stories.length === 0) return null;
        
        return (
          <div 
            key={group.userId} 
            className="flex-shrink-0 flex flex-col items-center gap-2 w-16"
            onClick={() => {
              setSelectedUserIndex(idx);
              setActiveStoryIndex(0);
            }}
          >
            <div className={`p-1 rounded-full border-[3px] border-indigo-500 cursor-pointer hover:scale-105 transition-transform bg-white ring-2 ring-transparent active:ring-indigo-500/20`}>
              <img 
                src={group.userPhotoURL || `https://api.dicebear.com/7.x/avataaars/svg?seed=${group.userId}`} 
                alt={group.userDisplayName}
                className="w-14 h-14 rounded-full object-cover border-2 border-white"
              />
            </div>
            <span className="text-[11px] font-bold text-slate-500 truncate w-full text-center">
              {isMe ? 'You' : group.userDisplayName.split(' ')[0]}
            </span>
          </div>
        );
      })}

      {/* Story viewer modal */}
      <AnimatePresence>
        {selectedUserIndex !== null && (
          <motion.div 
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            className="fixed inset-0 z-[100] bg-black flex items-center justify-center"
          >
            <div className="absolute top-6 right-6 z-[110] flex items-center gap-4">
               <button 
                onClick={() => setSelectedUserIndex(null)}
                className="text-white hover:bg-white/20 p-2.5 rounded-full transition-colors flex items-center justify-center"
              >
                <X size={28} />
              </button>
            </div>

            <div className="relative w-full max-w-lg h-full md:h-[92vh] flex items-center">
               <button 
                onClick={prevStory}
                className="absolute -left-20 text-white/40 hover:text-white transition-colors hidden lg:block"
              >
                <ChevronLeft size={48} />
              </button>

              {/* Viewer Content */}
              <div className="w-full h-full relative overflow-hidden md:rounded-[40px] shadow-2xl bg-black border border-white/10 flex flex-col">
                {/* Progress Indicators */}
                <div className="absolute top-0 inset-x-0 h-1 flex gap-1.5 p-3 z-30">
                  {userStoryGroups[selectedUserIndex].stories.map((_, i) => (
                    <div key={i} className="flex-1 h-full bg-white/20 rounded-full overflow-hidden">
                      {i === activeStoryIndex ? (
                        <motion.div 
                          key={selectedUserIndex + '-' + i}
                          initial={{ width: 0 }}
                          animate={{ width: '100%' }}
                          transition={{ duration: 6, ease: 'linear' }}
                          onAnimationComplete={nextStory}
                          className="h-full bg-white"
                        />
                      ) : (
                        <div className={`h-full ${i < activeStoryIndex ? 'bg-white' : 'bg-transparent'}`} />
                      )}
                    </div>
                  ))}
                </div>

                {/* Story Header */}
                <div className="absolute top-10 left-6 right-6 flex items-center justify-between z-20">
                  <div className="flex items-center gap-3">
                    <img 
                      src={userStoryGroups[selectedUserIndex].userPhotoURL || `https://api.dicebear.com/7.x/avataaars/svg?seed=${userStoryGroups[selectedUserIndex].userId}`} 
                      alt="" 
                      className="w-10 h-10 rounded-full border-2 border-white/20"
                    />
                    <div>
                      <p className="text-white font-black text-sm">{userStoryGroups[selectedUserIndex].userDisplayName}</p>
                      <span className="text-[10px] text-white/60 font-bold uppercase tracking-widest">
                        {new Date(userStoryGroups[selectedUserIndex].stories[activeStoryIndex].createdAt).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Media */}
                <div className="flex-1 flex items-center justify-center bg-black relative">
                  {userStoryGroups[selectedUserIndex].stories[activeStoryIndex].mediaType === 'image' ? (
                    <img 
                      src={userStoryGroups[selectedUserIndex].stories[activeStoryIndex].mediaUrl} 
                      alt="" 
                      className="w-full h-full object-contain"
                    />
                  ) : (
                    <video 
                      src={userStoryGroups[selectedUserIndex].stories[activeStoryIndex].mediaUrl} 
                      autoPlay 
                      className="w-full h-full object-contain"
                    />
                  )}
                  
                  {/* Invisible Tap Zones for Navigation */}
                  <div className="absolute inset-0 flex">
                    <div className="w-1/3 h-full cursor-pointer" onClick={prevStory} />
                    <div className="w-2/3 h-full cursor-pointer" onClick={nextStory} />
                  </div>

                  {/* Existing Reactions Summary */}
                  <div className="absolute bottom-4 left-6 flex flex-wrap gap-1 z-20 pointer-events-none">
                    {userStoryGroups[selectedUserIndex].stories[activeStoryIndex].reactions && 
                      Object.entries(userStoryGroups[selectedUserIndex].stories[activeStoryIndex].reactions || {}).length > 0 && (
                      <div className="flex -space-x-2">
                        {Object.entries(userStoryGroups[selectedUserIndex].stories[activeStoryIndex].reactions || {}).slice(0, 5).map(([uid, emoji], i) => (
                          <div key={uid} className="w-8 h-8 rounded-full bg-white/10 backdrop-blur-md flex items-center justify-center border border-white/20 shadow-lg" style={{ zIndex: 10 - i }}>
                            <span className="text-sm">{emoji}</span>
                          </div>
                        ))}
                        {Object.entries(userStoryGroups[selectedUserIndex].stories[activeStoryIndex].reactions || {}).length > 5 && (
                          <div className="w-8 h-8 rounded-full bg-indigo-600 flex items-center justify-center border border-white/20 text-[10px] font-bold text-white shadow-lg">
                            +{Object.entries(userStoryGroups[selectedUserIndex].stories[activeStoryIndex].reactions || {}).length - 5}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                {/* Story Footer: Reactions & Comments */}
                <div className="bg-gradient-to-t from-black/80 to-transparent p-6 pb-10 space-y-6 z-20">
                   {/* Reactions Row */}
                   <div className="flex items-center justify-center gap-4">
                     {reactions.map(emoji => (
                       <button 
                        key={emoji}
                        onClick={() => handleReaction(emoji)}
                        className="text-2xl hover:scale-125 transition-transform duration-200 active:scale-95"
                       >
                         {emoji}
                       </button>
                     ))}
                   </div>

                   {/* Comment Input */}
                   <div className="flex items-center gap-3">
                     <div className="flex-1 relative">
                       <input 
                        type="text" 
                        value={commentText}
                        onChange={(e) => setCommentText(e.target.value)}
                        placeholder="Send message..."
                        className="w-full bg-white/10 border border-white/10 rounded-full py-3.5 px-6 text-sm text-white placeholder:text-white/40 focus:bg-white/20 focus:ring-0 transition-all outline-none"
                       />
                       <button className="absolute right-4 top-1/2 -translate-y-1/2 text-white/50">
                          <Smile size={20} />
                       </button>
                     </div>
                     <button 
                       onClick={handleSendComment}
                       disabled={!commentText.trim() || isSendingComment}
                       className={`w-12 h-12 rounded-full flex items-center justify-center transition-all ${commentText.trim() ? 'bg-indigo-600 text-white' : 'bg-white/5 text-white/20'}`}
                      >
                       <Send size={20} />
                     </button>
                   </div>
                </div>
              </div>

              <button 
                onClick={nextStory}
                className="absolute -right-20 text-white/40 hover:text-white transition-colors hidden lg:block"
              >
                <ChevronRight size={48} />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
