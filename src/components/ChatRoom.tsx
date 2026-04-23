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
import { Send, Image as ImageIcon, Video, Mic, Paperclip, MoreVertical, Phone, Video as VideoCall, ChevronLeft, Smile } from 'lucide-react';
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

  const [isRecording, setIsRecording] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        const file = new File([audioBlob], `voice_${Date.now()}.webm`, { type: 'audio/webm' });
        
        setUploading(true);
        try {
          const storageRef = ref(storage, `chats/${chat.id}/${Date.now()}_voice.webm`);
          await uploadBytes(storageRef, file);
          const url = await getDownloadURL(storageRef);
          await sendMessage(undefined, { url, type: 'audio' });
        } catch (err) {
          alert("Failed to send voice message");
        } finally {
          setUploading(false);
          stream.getTracks().forEach(track => track.stop());
        }
      };

      mediaRecorder.start();
      setIsRecording(true);
    } catch (err) {
      alert("Microphone access denied or not available");
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  };

  const sendMessage = async (e?: React.FormEvent, mediaData?: { url: string, type: Message['mediaType'] }) => {
    e?.preventDefault();
    if (!newMessage.trim() && !mediaData) return;

    const messageContent = newMessage;
    setNewMessage('');

    // Optimistic Update
    const tempId = `temp-${Date.now()}`;
    const optimisticMsg: Message = {
      id: tempId,
      senderId: auth.currentUser?.uid || '',
      text: messageContent,
      mediaUrl: mediaData?.url || null as any,
      mediaType: mediaData?.type || 'text',
      createdAt: { toDate: () => new Date() } as any // Mock firestore timestamp
    };

    setMessages(prev => [...prev, optimisticMsg]);

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
    if (!file || !auth.currentUser) return;

    const type = file.type.startsWith('image/') ? 'image' : file.type.startsWith('video/') ? 'video' : file.type.startsWith('audio/') ? 'audio' : 'text';
    if (type === 'text') {
      alert('Unsupported file type');
      return;
    }

    // Create local object URL for instant preview
    const localUrl = URL.createObjectURL(file);
    const tempId = `temp-file-${Date.now()}`;
    
    const optimisticMsg: Message = {
      id: tempId,
      senderId: auth.currentUser.uid,
      text: '',
      mediaUrl: localUrl,
      mediaType: type as any,
      createdAt: { toDate: () => new Date() } as any,
      isOptimistic: true // Custom flag to handle cleanup if needed
    } as any;

    setMessages(prev => [...prev, optimisticMsg]);
    setUploading(true);

    try {
      const storageRef = ref(storage, `chats/${chat.id}/${Date.now()}_${file.name}`);
      await uploadBytes(storageRef, file);
      const url = await getDownloadURL(storageRef);
      
      // Send the real message
      await sendMessage(undefined, { url, type: type as Message['mediaType'] });
      
      // Cleanup local URL
      URL.revokeObjectURL(localUrl);
    } catch (err) {
      console.error("Upload error:", err);
      alert("Failed to upload file");
      // Remove optimistic message on failure
      setMessages(prev => prev.filter(m => m.id !== tempId));
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="flex flex-col h-full bg-slate-50">
      {/* Header */}
      <header className="h-16 bg-white border-b border-slate-100 flex items-center px-6 justify-between shadow-sm z-10 sticky top-0">
        <div className="flex items-center gap-4">
          {onBack && (
            <button onClick={onBack} className="md:hidden p-2 -ml-2 text-slate-400 hover:text-indigo-600 transition-colors">
              <ChevronLeft size={24} />
            </button>
          )}
          <div className="relative">
            <img 
              src={chat.otherUser.photoURL || `https://api.dicebear.com/7.x/avataaars/svg?seed=${chat.otherUser.uid}`} 
              alt={chat.otherUser.displayName}
              className="w-10 h-10 rounded-full object-cover bg-slate-100 border border-slate-100 shadow-sm"
            />
            {chat.otherUser.status === 'online' && (
              <div className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 border-2 border-white rounded-full shadow-sm"></div>
            )}
          </div>
          <div className="min-w-0">
            <h3 className="font-bold text-slate-800 text-sm leading-tight truncate">{chat.otherUser.displayName}</h3>
            {chat.otherUser.status === 'online' ? (
              <span className="text-[10px] text-green-500 font-bold uppercase tracking-wider">Active Now</span>
            ) : (
              <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Offline</span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button className="w-9 h-9 rounded-full hover:bg-slate-100 flex items-center justify-center text-indigo-600 transition-all">
            <Phone size={18} />
          </button>
          <button className="w-9 h-9 rounded-full hover:bg-slate-100 flex items-center justify-center text-indigo-600 transition-all">
            <VideoCall size={18} />
          </button>
          <button className="w-9 h-9 rounded-full hover:bg-slate-100 flex items-center justify-center text-slate-400 transition-all">
            <MoreVertical size={18} />
          </button>
        </div>
      </header>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 no-scrollbar">
        {messages.map((msg, idx) => {
          const isMe = msg.senderId === auth.currentUser?.uid;
          
          return (
            <div key={msg.id} className={`flex ${isMe ? 'flex-row-reverse' : 'flex-row'} items-end gap-2.5`}>
              {!isMe && (
                <img 
                  src={chat.otherUser.photoURL || `https://api.dicebear.com/7.x/avataaars/svg?seed=${chat.otherUser.uid}`} 
                  alt=""
                  className="w-7 h-7 rounded-full bg-slate-900 flex-shrink-0"
                />
              )}
              
              <motion.div 
                initial={{ scale: 0.95, opacity: 0, y: 10 }}
                animate={{ scale: 1, opacity: 1, y: 0 }}
                className={`max-w-[75%] group relative`}
              >
                <div className={`px-4 py-2.5 rounded-[20px] shadow-sm ${
                  isMe 
                    ? 'bg-indigo-600 text-white rounded-br-none' 
                    : 'bg-white text-slate-800 rounded-bl-none border border-slate-200'
                }`}>
                  {msg.mediaUrl && (
                    <div className="mb-2 max-w-sm rounded-[14px] overflow-hidden bg-slate-50">
                      {msg.mediaType === 'image' && (
                        <img src={msg.mediaUrl || undefined} alt="sent image" className="max-h-80 w-full object-cover" />
                      )}
                      {msg.mediaType === 'video' && (
                        <video src={msg.mediaUrl} controls className="max-h-80" />
                      )}
                      {msg.mediaType === 'audio' && (
                        <audio src={msg.mediaUrl} controls className="w-full h-10" />
                      )}
                    </div>
                  )}
                  {msg.text && <p className="text-[15px] leading-snug font-medium">{msg.text}</p>}
                </div>
                {msg.createdAt && (idx === messages.length - 1 || messages[idx+1].senderId !== msg.senderId) && (
                  <span className={`text-[9px] mt-1 block font-bold text-slate-600 uppercase tracking-widest ${isMe ? 'text-right pr-1' : 'text-left pl-1'}`}>
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
      <footer className="bg-white p-4 flex flex-col gap-2 border-t border-slate-100">
        <div className="flex items-center gap-2">
          <div className="flex bg-slate-100 rounded-[24px] p-1.5 flex-1 items-center gap-1 border border-slate-100">
            <button 
              type="button" 
              onClick={() => fileInputRef.current?.click()}
              className="p-2 text-indigo-600 hover:bg-slate-200 rounded-full transition-all"
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
            
            <input 
              type="text" 
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              placeholder={isRecording ? "Recording..." : "Type a message..."}
              disabled={isRecording}
              className="flex-1 bg-transparent border-none py-2 px-3 text-[15px] focus:ring-0 text-slate-800 placeholder:text-slate-400 font-medium"
            />
            
            <button type="button" className="p-2 text-indigo-600 hover:bg-slate-200 rounded-full">
              <Smile size={20} />
            </button>
          </div>

          {newMessage.trim() || uploading ? (
             <button 
              type="submit" 
              disabled={!newMessage.trim() && !uploading}
              onClick={sendMessage}
              className="w-11 h-11 bg-indigo-600 text-white rounded-full flex items-center justify-center shadow-lg shadow-indigo-600/30 transform active:scale-95 disabled:opacity-50 transition-all"
            >
              <Send size={20} />
            </button>
          ) : (
            <button 
              type="button" 
              onMouseDown={startRecording}
              onMouseUp={stopRecording}
              onMouseLeave={stopRecording}
              onTouchStart={startRecording}
              onTouchEnd={stopRecording}
              className={`w-11 h-11 rounded-full flex items-center justify-center transition-all ${
                isRecording ? 'bg-red-500 animate-pulse scale-110 shadow-lg shadow-red-500/40' : 'bg-slate-100 text-indigo-600 hover:bg-slate-200'
              }`}
            >
              <Mic size={22} className={isRecording ? 'text-white' : ''} />
            </button>
          )}
        </div>
        {uploading && (
          <div className="px-4 py-1">
            <div className="h-1 bg-slate-100 rounded-full overflow-hidden">
               <motion.div 
                initial={{ width: 0 }}
                animate={{ width: '100%' }}
                className="h-full bg-indigo-600"
              />
            </div>
          </div>
        )}
      </footer>
    </div>
  );
}
