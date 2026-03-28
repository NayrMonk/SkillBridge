import { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuthStore } from '@/store/authStore';
import { api } from '@/api/client';
import { Button } from '@/components/ui/button';

import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import { io, type Socket } from 'socket.io-client';
import {
  Send,
  Search,
  MoreVertical,
  Phone,
  Video,
  Paperclip,
  ArrowLeft,
  Check,
  CheckCheck
} from 'lucide-react';
import { format, isToday, isYesterday } from 'date-fns';
import { toast } from 'sonner';

interface Conversation {
  id: string;
  otherParticipant: {
    id: string;
    displayName: string;
    avatarUrl?: string;
  };
  project?: {
    id: string;
    title: string;
  };
  lastMessage?: string;
  lastMessageAt?: string;
  unreadCount: number;
}

interface Message {
  id: string;
  sender_id: string;
  recipient_id: string;
  content: string;
  is_read: boolean;
  read_at?: string;
  created_at: string;
  sender_name?: string;
  sender_avatar?: string;
}

export const MessagesPage = () => {
  const { userId } = useParams<{ userId: string }>();
  const navigate = useNavigate();
  const { user, token } = useAuthStore();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [selectedConversation, setSelectedConversation] = useState<Conversation | null>(null);
  const [newMessage, setNewMessage] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMessages, setIsLoadingMessages] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const socketRef = useRef<Socket | null>(null);
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Initialize socket connection
  useEffect(() => {
    if (!token) return;

    const socket = io('http://localhost:3001', {
      auth: { token }
    });

    socketRef.current = socket;

    socket.on('connect', () => {
      console.log('Socket connected');
    });

    socket.on('message:receive', (message: Message) => {
      setMessages(prev => [...prev, message]);
      scrollToBottom();
    });

    socket.on('message:sent', (message: Message) => {
      setMessages(prev => [...prev, message]);
      scrollToBottom();
    });

    socket.on('typing:start', () => {
      setIsTyping(true);
    });

    socket.on('typing:stop', () => {
      setIsTyping(false);
    });

    socket.on('message:read_receipt', ({ messageId }: { messageId: string }) => {
      setMessages(prev => 
        prev.map(m => m.id === messageId ? { ...m, is_read: true } : m)
      );
    });

    return () => {
      socket.disconnect();
    };
  }, [token]);

  // Fetch conversations
  useEffect(() => {
    fetchConversations();
  }, []);

  // Load messages when userId changes
  useEffect(() => {
    if (userId) {
      const conversation = conversations.find(c => c.otherParticipant.id === userId);
      if (conversation) {
        loadMessages(conversation);
      }
    }
  }, [userId, conversations]);

  const fetchConversations = async () => {
    try {
      setIsLoading(true);
      const response = await api.getConversations();
      setConversations(response.conversations);
    } catch (error) {
      console.error('Failed to fetch conversations:', error);
      toast.error('Failed to load conversations');
    } finally {
      setIsLoading(false);
    }
  };

  const loadMessages = async (conversation: Conversation) => {
    try {
      setIsLoadingMessages(true);
      setSelectedConversation(conversation);
      
      const response = await api.getMessages(conversation.otherParticipant.id, {
        projectId: conversation.project?.id
      });
      
      setMessages(response.messages);
      scrollToBottom();
      
      // Join project room if applicable
      if (conversation.project?.id && socketRef.current) {
        socketRef.current.emit('join:project', conversation.project.id);
      }
    } catch (error) {
      console.error('Failed to load messages:', error);
      toast.error('Failed to load messages');
    } finally {
      setIsLoadingMessages(false);
    }
  };

  const sendMessage = async () => {
    if (!newMessage.trim() || !selectedConversation || !socketRef.current) return;

    const messageData = {
      recipientId: selectedConversation.otherParticipant.id,
      projectId: selectedConversation.project?.id,
      content: newMessage.trim(),
      attachments: []
    };

    socketRef.current.emit('message:send', messageData, (response: any) => {
      if (response.success) {
        setNewMessage('');
      } else {
        toast.error(response.error || 'Failed to send message');
      }
    });
  };

  const handleTyping = () => {
    if (!socketRef.current || !selectedConversation) return;

    socketRef.current.emit('typing:start', {
      recipientId: selectedConversation.otherParticipant.id
    });

    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }

    typingTimeoutRef.current = setTimeout(() => {
      socketRef.current?.emit('typing:stop', {
        recipientId: selectedConversation.otherParticipant.id
      });
    }, 2000);
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const formatMessageDate = (date: string) => {
    const messageDate = new Date(date);
    if (isToday(messageDate)) {
      return format(messageDate, 'h:mm a');
    } else if (isYesterday(messageDate)) {
      return 'Yesterday ' + format(messageDate, 'h:mm a');
    } else {
      return format(messageDate, 'MMM d, h:mm a');
    }
  };

  const filteredConversations = conversations.filter(conv =>
    conv.otherParticipant.displayName.toLowerCase().includes(searchQuery.toLowerCase()) ||
    conv.lastMessage?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="h-[calc(100vh-4rem)] -m-4 lg:-m-8">
      <div className="flex h-full">
        {/* Conversations Sidebar */}
        <div className={`w-full lg:w-80 border-r bg-white ${selectedConversation ? 'hidden lg:block' : ''}`}>
          <div className="p-4 border-b border-ink-6">
            <h2 className="text-lg font-semibold mb-4">Messages</h2>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-ink-4" />
              <Input
                placeholder="Search conversations..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>
          </div>

          <ScrollArea className="h-[calc(100%-5rem)]">
            {isLoading ? (
              <div className="p-4 space-y-4">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Skeleton key={i} className="h-16 w-full" />
                ))}
              </div>
            ) : filteredConversations.length === 0 ? (
              <div className="p-8 text-center">
                <p className="text-ink-4">No conversations yet</p>
              </div>
            ) : (
              <div className="divide-y divide-ink-6">
                {filteredConversations.map((conversation) => (
                  <button
                    key={conversation.id}
                    className={`w-full p-4 flex items-start gap-3 hover:bg-canvas transition-colors text-left ${
                      selectedConversation?.id === conversation.id ? 'bg-canvas' : ''
                    }`}
                    onClick={() => {
                      loadMessages(conversation);
                      navigate(`/dashboard/messages/${conversation.otherParticipant.id}`);
                    }}
                  >
                    <div className="h-10 w-10 rounded-full bg-brand flex items-center justify-center text-white font-medium flex-shrink-0">
                      {conversation.otherParticipant.displayName.charAt(0).toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <h4 className="font-semibold text-ink truncate">
                          {conversation.otherParticipant.displayName}
                        </h4>
                        {conversation.lastMessageAt && (
                          <span className="text-xs text-ink-4">
                            {format(new Date(conversation.lastMessageAt), 'h:mm a')}
                          </span>
                        )}
                      </div>
                      {conversation.project && (
                        <p className="text-xs text-ink-4 truncate">
                          Re: {conversation.project.title}
                        </p>
                      )}
                      <p className="text-sm text-ink-4 truncate">
                        {conversation.lastMessage || 'No messages yet'}
                      </p>
                    </div>
                    {conversation.unreadCount > 0 && (
                      <span className="h-5 w-5 rounded-full bg-brand text-white text-xs flex items-center justify-center flex-shrink-0">
                        {conversation.unreadCount}
                      </span>
                    )}
                  </button>
                ))}
              </div>
            )}
          </ScrollArea>
        </div>

        {/* Chat Area */}
        <div className={`flex-1 flex flex-col bg-canvas ${!selectedConversation ? 'hidden lg:flex' : ''}`}>
          {selectedConversation ? (
            <>
              {/* Chat Header */}
              <div className="p-4 border-b border-ink-6 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="lg:hidden"
                    onClick={() => {
                      setSelectedConversation(null);
                      navigate('/dashboard/messages');
                    }}
                  >
                    <ArrowLeft className="h-5 w-5" />
                  </Button>
                  <div className="h-10 w-10 rounded-full bg-brand flex items-center justify-center text-white font-medium">
                    {selectedConversation.otherParticipant.displayName.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <h3 className="font-semibold">{selectedConversation.otherParticipant.displayName}</h3>
                    {selectedConversation.project && (
                      <p className="text-xs text-ink-4">
                        Re: {selectedConversation.project.title}
                      </p>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Button variant="ghost" size="icon">
                    <Phone className="h-5 w-5" />
                  </Button>
                  <Button variant="ghost" size="icon">
                    <Video className="h-5 w-5" />
                  </Button>
                  <Button variant="ghost" size="icon">
                    <MoreVertical className="h-5 w-5" />
                  </Button>
                </div>
              </div>

              {/* Messages */}
              <ScrollArea className="flex-1 p-4">
                {isLoadingMessages ? (
                  <div className="space-y-4">
                    {Array.from({ length: 5 }).map((_, i) => (
                      <Skeleton key={i} className="h-16 w-3/4" />
                    ))}
                  </div>
                ) : messages.length === 0 ? (
                  <div className="h-full flex items-center justify-center">
                    <div className="text-center">
                      <p className="text-ink-4">No messages yet</p>
                      <p className="text-sm text-ink-4">Start the conversation!</p>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {messages.map((message, index) => {
                      const isOwn = message.sender_id === user?.id;
                      const showAvatar = index === 0 || messages[index - 1].sender_id !== message.sender_id;

                      return (
                        <div
                          key={message.id}
                          className={`flex ${isOwn ? 'justify-end' : 'justify-start'}`}
                        >
                          <div className={`flex gap-2 max-w-[70%] ${isOwn ? 'flex-row-reverse' : ''}`}>
                            {showAvatar && !isOwn && (
                              <div className="h-8 w-8 rounded-full bg-brand flex items-center justify-center text-white text-xs font-medium flex-shrink-0">
                                {message.sender_name?.charAt(0).toUpperCase()}
                              </div>
                            )}
                            {!showAvatar && !isOwn && <div className="w-8" />}
                            
                            <div
                              className={`px-4 py-2 rounded-2xl ${
                                isOwn
                                  ? 'bg-brand text-white rounded-br-md'
                                  : 'bg-canvas rounded-bl-md'
                              }`}
                            >
                              <p>{message.content}</p>
                              <div className={`flex items-center gap-1 mt-1 text-xs ${isOwn ? 'text-primary-foreground/70' : 'text-ink-4'}`}>
                                <span>{formatMessageDate(message.created_at)}</span>
                                {isOwn && (
                                  message.is_read ? (
                                    <CheckCheck className="h-3 w-3" />
                                  ) : (
                                    <Check className="h-3 w-3" />
                                  )
                                )}
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                    
                    {isTyping && (
                      <div className="flex justify-start">
                        <div className="flex gap-2">
                          <div className="h-8 w-8 rounded-full bg-brand flex items-center justify-center text-white text-xs font-medium">
                            {selectedConversation.otherParticipant.displayName.charAt(0).toUpperCase()}
                          </div>
                          <div className="px-4 py-2 rounded-2xl bg-canvas rounded-bl-md">
                            <div className="flex gap-1">
                              <span className="w-2 h-2 bg-canvas-foreground rounded-full animate-bounce" />
                              <span className="w-2 h-2 bg-canvas-foreground rounded-full animate-bounce delay-100" />
                              <span className="w-2 h-2 bg-canvas-foreground rounded-full animate-bounce delay-200" />
                            </div>
                          </div>
                        </div>
                      </div>
                    )}
                    
                    <div ref={messagesEndRef} />
                  </div>
                )}
              </ScrollArea>

              {/* Message Input */}
              <div className="p-4 border-t">
                <div className="flex items-center gap-2">
                  <Button variant="ghost" size="icon">
                    <Paperclip className="h-5 w-5" />
                  </Button>
                  <Input
                    placeholder="Type a message..."
                    value={newMessage}
                    onChange={(e) => {
                      setNewMessage(e.target.value);
                      handleTyping();
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        sendMessage();
                      }
                    }}
                    className="flex-1"
                  />
                  <Button onClick={sendMessage} disabled={!newMessage.trim()}>
                    <Send className="h-5 w-5" />
                  </Button>
                </div>
              </div>
            </>
          ) : (
            <div className="h-full flex items-center justify-center">
              <div className="text-center">
                <div className="h-16 w-16 rounded-full bg-canvas flex items-center justify-center mx-auto mb-4">
                  <Send className="h-8 w-8 text-ink-4" />
                </div>
                <h3 className="text-lg font-semibold mb-2">Select a conversation</h3>
                <p className="text-ink-4">Choose a conversation to start messaging</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
