import React, { useState, useEffect, useRef } from 'react';
import { db, auth, storage } from '../lib/firebase';
import { doc, setDoc, getDoc } from 'firebase/firestore';
import { updateProfile } from 'firebase/auth';
import { ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage';
import { UserProfile } from '../types';
import { X, Camera, Save, User as UserIcon, Tag, Info } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface ProfileModalProps {
  onClose: () => void;
  user: any;
}

export default function ProfileModal({ onClose, user }: ProfileModalProps) {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [displayName, setDisplayName] = useState('');
  const [username, setUsername] = useState('');
  const [bio, setBio] = useState('');
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const fetchProfile = async () => {
      try {
        console.log('Fetching profile for:', user.uid);
        const userDocRef = doc(db, 'users', user.uid);
        const docSnap = await getDoc(userDocRef);
        
        if (docSnap.exists()) {
          const data = docSnap.data() as UserProfile;
          console.log('Profile data found:', data);
          setProfile(data);
          setDisplayName(data.displayName || user.displayName || '');
          setUsername(data.username || '');
          setBio(data.bio || '');
        } else {
          console.log('No user document found in Firestore, using auth data.');
          setDisplayName(user.displayName || '');
        }
      } catch (err) {
        console.error('Error fetching profile:', err);
      }
    };
    fetchProfile();
  }, [user.uid, user.displayName]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    console.log('Starting profile save...');
    setLoading(true);
    try {
      const userRef = doc(db, 'users', user.uid);
      
      // Use setDoc with { merge: true } to ensure it works even if doc doesn't exist
      await setDoc(userRef, {
        displayName,
        username,
        bio,
        updatedAt: new Date().toISOString()
      }, { merge: true });

      console.log('Firestore doc updated');

      if (auth.currentUser) {
        await updateProfile(auth.currentUser, { displayName });
        console.log('Auth profile updated');
      }
      
      alert('Profile updated successfully!');
      onClose();
    } catch (err: any) {
      console.error('Error updating profile:', err);
      alert(`Failed to update profile: ${err.message || 'Unknown error'}. 
      Make sure your Firestore Rules are set correctly in the Firebase Console.`);
    } finally {
      setLoading(false);
    }
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Limit to 5MB
    if (file.size > 5 * 1024 * 1024) {
      alert('File is too large! Please choose an image smaller than 5MB.');
      return;
    }

    setUploading(true);
    setUploadProgress(0);
    
    try {
      const storageRef = ref(storage, `avatars/${user.uid}`);
      const uploadTask = uploadBytesResumable(storageRef, file);

      uploadTask.on('state_changed', 
        (snapshot) => {
          const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
          setUploadProgress(progress);
        }, 
        (error) => {
          console.error('Upload failed:', error);
          alert(`Upload failed: ${error.message}`);
          setUploading(false);
        }, 
        async () => {
          const url = await getDownloadURL(uploadTask.snapshot.ref);
          const userRef = doc(db, 'users', user.uid);
          await setDoc(userRef, { photoURL: url }, { merge: true });

          if (auth.currentUser) {
            await updateProfile(auth.currentUser, { photoURL: url });
          }

          setProfile(prev => prev ? { ...prev, photoURL: url } : null);
          setUploading(false);
          setUploadProgress(0);
          alert('Photo updated successfully!');
        }
      );
    } catch (err: any) {
      console.error('Error starting upload:', err);
      alert(`Error starting upload: ${err.message}`);
      setUploading(false);
    }
  };

  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[100] bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4"
    >
      <motion.div 
        initial={{ scale: 0.9, y: 20 }}
        animate={{ scale: 1, y: 0 }}
        className="w-full max-w-md bg-white rounded-[32px] shadow-2xl overflow-hidden"
      >
        <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-white sticky top-0">
          <h2 className="text-xl font-bold text-slate-800">Edit Profile</h2>
          <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-full text-slate-400 trasition-colors">
            <X size={24} />
          </button>
        </div>

        <form onSubmit={handleSave} className="p-8 space-y-6">
          {/* Avatar Section */}
          <div className="flex flex-col items-center mb-8">
            <div className="relative group cursor-pointer" onClick={() => fileInputRef.current?.click()}>
              <div className="w-32 h-32 rounded-full border-4 border-indigo-50 bg-indigo-50 overflow-hidden shadow-inner flex items-center justify-center">
                {profile?.photoURL ? (
                  <img src={profile.photoURL} alt="" className="w-full h-full object-cover" />
                ) : (
                  <UserIcon size={64} className="text-indigo-200" />
                )}
                {uploading && (
                  <div className="absolute inset-0 bg-white/60 flex flex-col items-center justify-center">
                    <div className="relative w-12 h-12">
                      <svg className="w-full h-full transform -rotate-90">
                        <circle
                          cx="24"
                          cy="24"
                          r="20"
                          stroke="currentColor"
                          strokeWidth="4"
                          fill="transparent"
                          className="text-slate-200"
                        />
                        <circle
                          cx="24"
                          cy="24"
                          r="20"
                          stroke="currentColor"
                          strokeWidth="4"
                          fill="transparent"
                          strokeDasharray={125.6}
                          strokeDashoffset={125.6 - (125.6 * uploadProgress) / 100}
                          className="text-indigo-600 transition-all duration-300"
                        />
                      </svg>
                      <div className="absolute inset-0 flex items-center justify-center text-[10px] font-bold text-indigo-600">
                        {Math.round(uploadProgress)}%
                      </div>
                    </div>
                  </div>
                )}
              </div>
              <div className="absolute bottom-0 right-0 p-2.5 bg-indigo-600 text-white rounded-full shadow-lg border-2 border-white group-hover:scale-110 transition-transform">
                <Camera size={18} />
              </div>
              <input type="file" hidden ref={fileInputRef} onChange={handleImageUpload} accept="image/*" />
            </div>
            <p className="text-[10px] uppercase font-bold text-slate-400 mt-4 tracking-widest">Change Profile Photo</p>
          </div>

          <div className="space-y-4">
            <div>
              <label className="flex items-center gap-2 text-[11px] uppercase font-bold text-slate-400 tracking-widest mb-1.5 ml-1">
                <UserIcon size={14} /> Full Name
              </label>
              <input 
                type="text" 
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition-all placeholder:text-slate-300 font-medium"
                placeholder="What's your name?"
              />
            </div>

            <div>
              <label className="flex items-center gap-2 text-[11px] uppercase font-bold text-slate-400 tracking-widest mb-1.5 ml-1">
                <Tag size={14} /> Nickname / Username
              </label>
              <div className="relative">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 font-bold">@</span>
                <input 
                  type="text" 
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="w-full px-4 py-3 pl-8 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition-all placeholder:text-slate-300 font-medium"
                  placeholder="Set your nickname"
                />
              </div>
              <p className="text-[9px] text-slate-400 mt-1.5 ml-1 leading-relaxed">
                Your unique ID used for connections. Base on your name by default.
              </p>
            </div>

            <div>
              <label className="flex items-center gap-2 text-[11px] uppercase font-bold text-slate-400 tracking-widest mb-1.5 ml-1">
                <Info size={14} /> Bio
              </label>
              <textarea 
                value={bio}
                onChange={(e) => setBio(e.target.value)}
                className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition-all placeholder:text-slate-300 font-medium h-24 resize-none"
                placeholder="Write something about yourself..."
              />
            </div>
          </div>

          <button 
            type="submit" 
            disabled={loading || uploading}
            className="w-full bg-indigo-600 text-white py-4 rounded-2xl font-bold hover:bg-indigo-700 transition-all flex items-center justify-center gap-2 mt-6 shadow-lg shadow-indigo-100 disabled:opacity-50 active:scale-95"
          >
            {loading ? <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div> : <><Save size={20} /> Update Profile</>}
          </button>
        </form>
      </motion.div>
    </motion.div>
  );
}
