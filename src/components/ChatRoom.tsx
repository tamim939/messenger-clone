import React, { useEffect, useState, useRef } from 'react';
import { db, auth, storage } from '../lib/firebase';
import { 
  collection, 
  query, 
  onSnapshot, 
  orderBy,
  addDoc,
  serverTimestamp,
  doc,
  updateDoc
} from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { Message, UserProfile, Chat } from '../types';
import { Send, Image as ImageIcon, Video, Mic, Paperclip, MoreVertical, Phone, Video as VideoCall, ChevronLeft } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface ChatRoomProps {
  chat: Chat & { otherUser: UserProfile };
  onBack?: () => void;
}

export default function ChatRoom({ chat, onBack }: ChatRoomProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [uploading, setUploading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const q = query(
      collection(db, 'chats', chat.id, 'messages'),
      orderBy('createdAt', 'asc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const msgs = snapshot.docs.map(docSnap => ({
        ...docSnap.data(),
        id: docSnap.id
      })) as Message[];
      setMessages(msgs);
    });

    return () => unsubscribe();
  }, [chat.id]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const sendMessage = async (e?: React.FormEvent, mediaData?: { url: string, type: Message['mediaType'] }) => {
    e?.preventDefault();
    if (!newMessage.trim() && !mediaData) return;

    const messageContent = newMessage;
    setNewMessage('');

    try {
      await addDoc(collection(db, 'chats', chat.id, 'messages'), {
        senderId: auth.currentUser?.uid,
        text: messageContent,
        mediaUrl: mediaData?.url || null,
        mediaType: mediaData?.type || 'text',
        createdAt: serverTimestamp()
      });

      await updateDoc(doc(db, 'chats', chat.id), {
        lastMessage: mediaData ? `Sent a ${mediaData.type}` : messageContent,
        lastMessageAt: serverTimestamp()
      });
    } catch (err) {
      console.error("Error sending message:", err);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    try {
      const type = file.type.startsWith('image/') ? 'image' : file.type.startsWith('video/') ? 'video' : file.type.startsWith('audio/') ? 'audio' : 'text';
      if (type === 'text') throw new Error('Unsupported file type');

      const storageRef = ref(storage, `chats/${chat.id}/${Date.now()}_${file.name}`);
      await uploadBytes(storageRef, file);
      const url = await getDownloadURL(storageRef);
      
      await sendMessage(undefined, { url, type: type as Message['mediaType'] });
    } catch (err) {
      alert("Failed to upload file");
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="flex flex-col h-full bg-slate-50">
      {/* Header */}
      <header className="h-16 bg-white border-b border-slate-200 flex items-center px-6 justify-between shadow-sm z-10 sticky top-0">
        <div className="flex items-center gap-3">
          {onBack && (
            <button onClick={onBack} className="md:hidden p-2 -ml-2 text-slate-400 hover:text-indigo-600 transition-colors">
              <ChevronLeft size={24} />
            </button>
          )}
          <div className="relative">
            <img 
              src={chat.otherUser.photoURL || `https://api.dicebear.com/7.x/avataaars/svg?seed=${chat.otherUser.uid}`} 
              alt={chat.otherUser.displayName}
              className="w-10 h-10 rounded-full object-cover bg-indigo-100"
            />
            <div className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 border-2 border-white rounded-full"></div>
          </div>
          <div>
            <h3 className="font-bold text-slate-800 text-sm leading-tight">{chat.otherUser.displayName}</h3>
            <span className="text-[10px] text-green-500 font-bold uppercase tracking-wider">Active Now</span>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <button className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center text-slate-500 hover:bg-indigo-50 hover:text-indigo-600 transition-all">
            <Phone size={16} />
          </button>
          <button className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center text-slate-500 hover:bg-indigo-50 hover:text-indigo-600 transition-all">
            <VideoCall size={16} />
          </button>
          <button className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center text-slate-500 hover:bg-indigo-50 hover:text-indigo-600 transition-all">
            <MoreVertical size={16} />
          </button>
        </div>
      </header>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-6 space-y-6">
        <div className="flex justify-center mb-4">
          <span className="px-3 py-1 bg-slate-200 rounded-full text-[10px] font-bold text-slate-500 uppercase tracking-widest">Today</span>
        </div>
        {messages.map((msg, idx) => {
          const isMe = msg.senderId === auth.currentUser?.uid;
          
          return (
            <div key={msg.id} className={`flex ${isMe ? 'flex-row-reverse' : 'flex-row'} items-end gap-3`}>
              <img 
                src={isMe ? (auth.currentUser?.photoURL || undefined) : (chat.otherUser.photoURL || `https://api.dicebear.com/7.x/avataaars/svg?seed=${chat.otherUser.uid}`)} 
                alt=""
                className="w-8 h-8 rounded-full shadow-sm bg-slate-200 flex-shrink-0"
              />
              
              <motion.div 
                initial={{ scale: 0.95, opacity: 0, y: 10 }}
                animate={{ scale: 1, opacity: 1, y: 0 }}
                className={`max-w-[70%] group relative`}
              >
                <div className={`p-3 rounded-2xl shadow-sm ${
                  isMe 
                    ? 'bg-indigo-600 text-white rounded-br-none shadow-indigo-100' 
                    : 'bg-white text-slate-700 rounded-bl-none border border-slate-100'
                }`}>
                  {msg.mediaUrl && (
                    <div className="mb-2 rounded-xl overflow-hidden">
                      {msg.mediaType === 'image' && (
                        <img src={msg.mediaUrl || undefined} alt="sent image" className="max-h-60 w-full object-cover" />
                      )}
                      {msg.mediaType === 'video' && (
                        <video src={msg.mediaUrl} controls className="max-h-60" />
                      )}
                      {msg.mediaType === 'audio' && (
                        <audio src={msg.mediaUrl} controls className="w-full" />
                      )}
                    </div>
                  )}
                  {msg.text && <p className="text-sm leading-relaxed">{msg.text}</p>}
                </div>
                {msg.createdAt && (
                  <span className={`text-[9px] mt-1 block font-bold text-slate-400 opacity-0 group-hover:opacity-100 transition-opacity uppercase tracking-widest ${isMe ? 'text-right' : 'text-left'}`}>
                    {new Date(msg.createdAt?.toDate()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                )}
              </motion.div>
            </div>
          );
        })}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <footer className="h-20 bg-white border-t border-slate-200 px-6 flex items-center gap-4">
        <div className="flex gap-2">
          <button 
            type="button" 
            onClick={() => fileInputRef.current?.click()}
            className="p-2 text-indigo-500 hover:bg-slate-100 rounded-full transition-all"
            title="Upload Files"
          >
            <Paperclip size={20} />
          </button>
          <input 
            type="file" 
            className="hidden" 
            ref={fileInputRef} 
            onChange={handleFileUpload}
            accept="image/*,video/*,audio/*"
          />
          <button type="button" className="p-2 text-indigo-500 hover:bg-slate-100 rounded-full transition-all">
            <Mic size={20} />
          </button>
          <button type="button" className="p-2 text-indigo-500 hover:bg-slate-100 rounded-full transition-all md:block hidden">
            <ImageIcon size={20} />
          </button>
        </div>
        
        <div className="flex-1 relative">
          <input 
            type="text" 
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            placeholder="Type a message..."
            className="w-full bg-slate-100 border-none rounded-full py-3 px-6 text-sm focus:ring-2 focus:ring-indigo-500 transition-all text-slate-700"
          />
          <span className="absolute right-4 top-1/2 -translate-y-1/2 text-xl cursor-default opacity-50">😊</span>
          {uploading && (
            <div className="absolute right-12 top-1/2 -translate-y-1/2">
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-indigo-600"></div>
            </div>
          )}
        </div>

        <button 
          type="submit" 
          disabled={!newMessage.trim() && !uploading}
          onClick={sendMessage}
          className="w-10 h-10 bg-indigo-600 text-white rounded-full flex items-center justify-center shadow-lg shadow-indigo-100 transform active:scale-95 disabled:opacity-50 disabled:shadow-none transition-all"
        >
          <Send size={18} />
        </button>
      </footer>
    </div>
  );
}
