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
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md bg-white rounded-3xl shadow-xl p-8 border border-slate-100"
      >
        <div className="flex flex-col items-center mb-8">
          <div className="w-16 h-16 bg-indigo-600 rounded-2xl flex items-center justify-center text-white mb-4 shadow-lg shadow-indigo-100">
            <MessageSquare size={32} />
          </div>
          <h1 className="text-3xl font-bold text-slate-800 tracking-tight">Connectify</h1>
          <p className="text-slate-500 mt-2 font-medium">{isLogin ? 'Welcome back!' : 'Create your account'}</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {!isLogin && (
            <div>
              <label className="block text-[11px] uppercase font-bold text-slate-400 tracking-widest mb-1 ml-1">Full Name</label>
              <input 
                type="text" 
                required 
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition-all placeholder:text-slate-300"
                placeholder="Jon doe"
              />
            </div>
          )}
          <div>
            <label className="block text-[11px] uppercase font-bold text-slate-400 tracking-widest mb-1 ml-1">Email Address</label>
            <input 
              type="email" 
              required 
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition-all placeholder:text-slate-300"
              placeholder="name@example.com"
            />
          </div>
          <div>
            <label className="block text-[11px] uppercase font-bold text-slate-400 tracking-widest mb-1 ml-1">Password</label>
            <input 
              type="password" 
              required 
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition-all placeholder:text-slate-300"
              placeholder="••••••••"
            />
          </div>

          {error && <p className="text-red-500 text-xs font-bold bg-red-50 p-3 rounded-xl border border-red-100 mt-2">{error}</p>}

          <button 
            type="submit" 
            disabled={loading}
            className="w-full bg-indigo-600 text-white py-3.5 rounded-2xl font-bold hover:bg-indigo-700 transition-all flex items-center justify-center gap-2 mt-4 shadow-lg shadow-indigo-100 disabled:opacity-50 active:scale-95"
          >
            {loading ? 'Processing...' : (isLogin ? <><LogIn size={20} /> Login</> : <><UserPlus size={20} /> Sign Up</>)}
          </button>
        </form>

        <div className="mt-6 flex items-center gap-4">
          <div className="h-px bg-slate-200 flex-1"></div>
          <span className="text-slate-400 text-sm uppercase tracking-wider font-medium">Or</span>
          <div className="h-px bg-slate-200 flex-1"></div>
        </div>

        <button 
          onClick={handleGoogleSignIn}
          className="w-full border border-slate-200 text-slate-700 py-3 rounded-xl font-semibold hover:bg-slate-50 transition-colors flex items-center justify-center gap-2 mt-6"
        >
          <img src="https://www.google.com/favicon.ico" alt="Google" className="w-5 h-5" />
          Continue with Google
        </button>

        <p className="text-center text-slate-500 mt-8">
          {isLogin ? "Don't have an account?" : "Already have an account?"}{' '}
          <button 
            onClick={() => setIsLogin(!isLogin)}
            className="text-indigo-600 font-bold hover:underline"
          >
            {isLogin ? 'Sign Up' : 'Login'}
          </button>
        </p>
      </motion.div>
    </div>
  );
}
