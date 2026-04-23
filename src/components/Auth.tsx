import React, { useState } from 'react';
import { auth, db } from '../lib/firebase';
import { 
  createUserWithEmailAndPassword, 
  signInWithEmailAndPassword, 
  updateProfile,
  signInWithPopup,
  GoogleAuthProvider
} from 'firebase/auth';
import { doc, setDoc, getDoc } from 'firebase/firestore';
import { motion } from 'motion/react';
import { MessageSquare, LogIn, UserPlus } from 'lucide-react';

export default function Auth() {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      if (isLogin) {
        await signInWithEmailAndPassword(auth, email, password);
      } else {
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        const user = userCredential.user;

        await updateProfile(user, { displayName });
        
        // Generate a simple username from display name
        const baseUsername = displayName.toLowerCase().replace(/\s+/g, '_');
        const username = `${baseUsername}_${user.uid.substring(0, 5)}`;
        
        // Create user doc
        await setDoc(doc(db, 'users', user.uid), {
          uid: user.uid,
          displayName,
          username,
          email,
          createdAt: new Date().toISOString(),
          lastSeen: new Date().toISOString()
        });
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    const provider = new GoogleAuthProvider();
    try {
      const result = await signInWithPopup(auth, provider);
      const user = result.user;
      
      const userRef = doc(db, 'users', user.uid);
      const userSnap = await getDoc(userRef);
      
      if (!userSnap.exists()) {
        const baseUsername = user.displayName?.toLowerCase().replace(/\s+/g, '_') || 'user';
        const username = `${baseUsername}_${user.uid.substring(0, 5)}`;

        await setDoc(userRef, {
          uid: user.uid,
          displayName: user.displayName,
          username,
          email: user.email,
          photoURL: user.photoURL,
          createdAt: new Date().toISOString(),
          lastSeen: new Date().toISOString()
        });
      }
    } catch (err: any) {
      setError(err.message);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4 selection:bg-indigo-500/30">
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md bg-white rounded-[40px] p-10 shadow-2xl shadow-indigo-100 border border-slate-100"
      >
        <div className="flex flex-col items-center mb-10">
          <div className="w-20 h-20 bg-indigo-600 rounded-[30px] flex items-center justify-center text-white mb-6 shadow-2xl shadow-indigo-600/30">
            <MessageSquare size={40} />
          </div>
          <h1 className="text-4xl font-black text-indigo-600 tracking-tighter uppercase">messenger</h1>
          <p className="text-slate-400 mt-3 font-bold uppercase tracking-widest text-[10px]">{isLogin ? 'Sign in to your account' : 'Register a new account'}</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          {!isLogin && (
            <div className="space-y-1.5">
              <label className="block text-[10px] uppercase font-black text-slate-400 tracking-[0.2em] ml-4">Full Name</label>
              <input 
                type="text" 
                required 
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                className="w-full px-6 py-4 bg-slate-50 border border-slate-100 rounded-3xl focus:ring-2 focus:ring-indigo-100 outline-none transition-all placeholder:text-slate-300 text-slate-800 font-bold"
                placeholder="Jon doe"
              />
            </div>
          )}
          <div className="space-y-1.5">
            <label className="block text-[10px] uppercase font-black text-slate-400 tracking-[0.2em] ml-4">Email Address</label>
            <input 
              type="email" 
              required 
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-6 py-4 bg-slate-50 border border-slate-100 rounded-3xl focus:ring-2 focus:ring-indigo-100 outline-none transition-all placeholder:text-slate-300 text-slate-800 font-bold"
              placeholder="name@example.com"
            />
          </div>
          <div className="space-y-1.5">
            <label className="block text-[10px] uppercase font-black text-slate-400 tracking-[0.2em] ml-4">Password</label>
            <input 
              type="password" 
              required 
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-6 py-4 bg-slate-50 border border-slate-100 rounded-3xl focus:ring-2 focus:ring-indigo-100 outline-none transition-all placeholder:text-slate-300 text-slate-800 font-bold"
              placeholder="••••••••"
            />
          </div>

          {error && (
            <p className="text-red-500 text-[11px] font-bold bg-red-50 p-4 rounded-3xl border border-red-100">
              {error}
            </p>
          )}

          <button 
            type="submit" 
            disabled={loading}
            className="w-full bg-indigo-600 text-white py-5 rounded-3xl font-black uppercase tracking-widest text-xs hover:bg-indigo-700 transition-all flex items-center justify-center gap-3 mt-4 disabled:opacity-50 active:scale-95 shadow-xl shadow-indigo-600/20"
          >
            {loading ? 'Processing...' : (isLogin ? <><LogIn size={18} /> Sign In</> : <><UserPlus size={18} /> Join Now</>)}
          </button>
        </form>

        <div className="mt-10 flex items-center gap-4">
          <div className="h-px bg-slate-100 flex-1"></div>
          <span className="text-slate-300 text-[10px] font-black uppercase tracking-widest">Connect with</span>
          <div className="h-px bg-slate-100 flex-1"></div>
        </div>

        <button 
          onClick={handleGoogleSignIn}
          className="w-full bg-white border border-slate-200 text-slate-600 py-4 rounded-3xl font-bold hover:bg-slate-50 transition-all flex items-center justify-center gap-3 mt-8 text-sm group"
        >
          <img src="https://www.google.com/favicon.ico" alt="Google" className="w-5 h-5 group-hover:scale-110 transition-transform" />
          Continue with Google
        </button>

        <p className="text-center text-slate-600 mt-10 text-xs font-bold uppercase tracking-wider">
          {isLogin ? "New to the platform?" : "Joined us before?"}{' '}
          <button 
            onClick={() => setIsLogin(!isLogin)}
            className="text-indigo-500 hover:text-indigo-400 font-black"
          >
            {isLogin ? 'Create Account' : 'Sign In'}
          </button>
        </p>
      </motion.div>
    </div>
  );
}
