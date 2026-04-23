import React, { useEffect, useState, useRef } from 'react';
import { db, auth, storage } from '../lib/firebase';
import { 
  collection, 
  query, 
  onSnapshot, 
  where,
  orderBy,
  addDoc,
  serverTimestamp
} from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { Story } from '../types';
import { Plus, X, ChevronLeft, ChevronRight } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

export default function StoryBar() {
  const [stories, setStories] = useState<Story[]>([]);
  const [selectedStoryIndex, setSelectedStoryIndex] = useState<number | null>(null);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const q = query(
      collection(db, 'stories'),
      where('expiresAt', '>', new Date().toISOString()),
      orderBy('createdAt', 'desc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const storyList = snapshot.docs.map(doc => ({
        ...doc.data(),
        id: doc.id
      })) as Story[];
      
      // Group by user
      const uniqueStories: Story[] = [];
      const seenUsers = new Set();
      
      storyList.forEach(s => {
        if (!seenUsers.has(s.userId)) {
          uniqueStories.push(s);
          seenUsers.add(s.userId);
        }
      });
      
      setStories(uniqueStories);
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
        expiresAt: expiresAt.toISOString()
      });
    } catch (err) {
      alert("Failed to upload story");
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="py-4 px-2 flex items-center gap-4 overflow-x-auto no-scrollbar bg-white border-b border-slate-50">
      {/* Create Story */}
      <div className="flex-shrink-0 flex flex-col items-center gap-1.5 w-20">
        <div 
          onClick={() => fileInputRef.current?.click()}
          className="relative w-16 h-16 rounded-full bg-slate-50 flex items-center justify-center cursor-pointer border-2 border-dashed border-slate-200 hover:border-indigo-400 hover:bg-indigo-50 transition-all group overflow-hidden"
        >
          {uploading ? (
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-indigo-600"></div>
          ) : (
            <>
              {auth.currentUser?.photoURL ? (
                <img src={auth.currentUser.photoURL} alt="" className="w-full h-full object-cover opacity-50 group-hover:opacity-30" />
              ) : (
                <Plus size={24} className="text-slate-400 group-hover:text-indigo-500" />
              )}
              <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                 <Plus size={24} className="text-indigo-600" />
              </div>
            </>
          )}
        </div>
        <span className="text-[9px] font-bold text-slate-300 uppercase tracking-widest">You</span>
        <input 
          type="file" 
          hidden 
          ref={fileInputRef} 
          onChange={handleStoryUpload} 
          accept="image/*,video/*"
        />
      </div>

      {/* Story List */}
      {stories.map((story, idx) => (
        <div 
          key={story.id} 
          className="flex-shrink-0 flex flex-col items-center gap-1.5 w-20"
          onClick={() => setSelectedStoryIndex(idx)}
        >
          <div className="p-0.5 rounded-full border-2 border-indigo-500 cursor-pointer hover:scale-105 transition-transform bg-white">
            <img 
              src={story.userPhotoURL || `https://api.dicebear.com/7.x/avataaars/svg?seed=${story.userId}`} 
              alt={story.userDisplayName}
              className="w-14 h-14 rounded-full object-cover border-2 border-white"
            />
          </div>
          <span className="text-[10px] font-bold text-slate-800 truncate w-full text-center tracking-tight">
            {story.userDisplayName.split(' ')[0]}
          </span>
        </div>
      ))}

      {/* Story viewer modal */}
      <AnimatePresence>
        {selectedStoryIndex !== null && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] bg-black flex items-center justify-center"
          >
            <button 
              onClick={() => setSelectedStoryIndex(null)}
              className="absolute top-6 right-6 z-10 text-white hover:bg-white/20 p-2 rounded-full transition-colors"
            >
              <X size={32} />
            </button>

            <div className="relative w-full max-w-lg h-full max-h-[800px] flex items-center">
               <button 
                disabled={selectedStoryIndex === 0}
                onClick={() => setSelectedStoryIndex(s => s! - 1)}
                className="absolute -left-16 text-white/50 hover:text-white transition-colors disabled:opacity-0"
              >
                <ChevronLeft size={48} />
              </button>

              <div className="w-full h-full relative overflow-hidden md:rounded-3xl shadow-2xl">
                <div className="absolute top-0 inset-x-0 h-1.5 flex gap-1 p-2 z-10">
                  <div className="flex-1 h-full bg-white/30 rounded-full overflow-hidden">
                    <motion.div 
                      key={selectedStoryIndex}
                      initial={{ width: 0 }}
                      animate={{ width: '100%' }}
                      transition={{ duration: 5, ease: 'linear' }}
                      onAnimationComplete={() => {
                        if (selectedStoryIndex < stories.length - 1) {
                          setSelectedStoryIndex(s => s! + 1);
                        } else {
                          setSelectedStoryIndex(null);
                        }
                      }}
                      className="h-full bg-white"
                    />
                  </div>
                </div>

                <div className="absolute top-8 left-4 flex items-center gap-3 z-10">
                   <img 
                    src={stories[selectedStoryIndex].userPhotoURL || `https://api.dicebear.com/7.x/avataaars/svg?seed=${stories[selectedStoryIndex].userId}`} 
                    alt="" 
                    className="w-10 h-10 rounded-full border border-white/20"
                  />
                  <p className="text-white font-bold">{stories[selectedStoryIndex].userDisplayName}</p>
                </div>

                {stories[selectedStoryIndex].mediaType === 'image' ? (
                  <img 
                    src={stories[selectedStoryIndex].mediaUrl} 
                    alt="" 
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <video 
                    src={stories[selectedStoryIndex].mediaUrl} 
                    autoPlay 
                    className="w-full h-full object-cover"
                  />
                )}
              </div>

              <button 
                disabled={selectedStoryIndex === stories.length - 1}
                onClick={() => setSelectedStoryIndex(s => s! + 1)}
                className="absolute -right-16 text-white/50 hover:text-white transition-colors disabled:opacity-0"
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
