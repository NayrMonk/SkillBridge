import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { createServer } from 'http';
import { Server } from 'socket.io';
import { Pool } from 'pg';
import { createClient } from 'redis';

// Import routes
import authRoutes from './routes/auth';
import userRoutes from './routes/users';
import projectRoutes from './routes/projects';
import applicationRoutes from './routes/applications';
import messageRoutes from './routes/messages';
import paymentRoutes from './routes/payments';
import testRoutes from './routes/tests';
import adminRoutes from './routes/admin';
import dashboardRoutes from './routes/dashboard';

// Import middleware
import { authenticateToken } from './middleware/auth';
import { errorHandler } from './middleware/errorHandler';

// Import services
import { MessageService } from './services/messageService';
import { NotificationService } from './services/notificationService';
import jwt from 'jsonwebtoken';

dotenv.config();

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: process.env.CLIENT_URL || 'http://localhost:5173',
    methods: ['GET', 'POST'],
    credentials: true
  }
});

const PORT = process.env.PORT || 3001;

// Database connections
export const db = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432'),
  database: process.env.DB_NAME || 'skillbridge',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'password',
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

export const redis = createClient({
  url: process.env.REDIS_URL || 'redis://localhost:6379'
});

redis.connect().catch(console.error);

// Middleware
app.use(cors({
  origin: process.env.CLIENT_URL || 'http://localhost:5173',
  credentials: true
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Request logging
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
  next();
});

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/users', authenticateToken, userRoutes);
app.use('/api/projects', authenticateToken, projectRoutes);
app.use('/api/applications', authenticateToken, applicationRoutes);
app.use('/api/messages', authenticateToken, messageRoutes);
app.use('/api/payments', authenticateToken, paymentRoutes);
app.use('/api/tests', authenticateToken, testRoutes);
app.use('/api/admin', authenticateToken, adminRoutes);
app.use('/api/dashboard', authenticateToken, dashboardRoutes);

// Socket.IO for real-time messaging
const messageService = new MessageService(db, redis);
const notificationService = new NotificationService(db, redis);

io.use((socket, next) => {
  const token = socket.handshake.auth.token;
  if (!token) {
    return next(new Error('Authentication required'));
  }
  // Verify JWT token

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key');
    socket.data.user = decoded;
    next();
  } catch (err) {
    next(new Error('Invalid token'));
  }
});

io.on('connection', (socket) => {
  const userId = socket.data.user.userId;
  console.log(`User connected: ${userId}`);
  
  // Join user's room for private messages
  socket.join(`user:${userId}`);
  
  // Update user's online status
  redis.set(`user:online:${userId}`, 'true', { EX: 300 });
  
  // Handle joining project rooms
  socket.on('join:project', (projectId: string) => {
    socket.join(`project:${projectId}`);
    console.log(`User ${userId} joined project ${projectId}`);
  });
  
  // Handle leaving project rooms
  socket.on('leave:project', (projectId: string) => {
    socket.leave(`project:${projectId}`);
    console.log(`User ${userId} left project ${projectId}`);
  });
  
  // Handle sending messages
  socket.on('message:send', async (data, callback) => {
    try {
      const { recipientId, projectId, contractId, content, attachments } = data;
      
      const message = await messageService.createMessage({
        senderId: userId,
        recipientId,
        projectId,
        contractId,
        content,
        attachments
      });
      
      // Emit to recipient
      io.to(`user:${recipientId}`).emit('message:receive', message);
      
      // Emit to sender for confirmation
      socket.emit('message:sent', message);
      
      // Create notification for recipient
      await notificationService.createNotification({
        userId: recipientId,
        type: 'new_message',
        title: 'New Message',
        message: `You have a new message`,
        data: { messageId: message.id, senderId: userId, projectId }
      });
      
      callback({ success: true, message });
    } catch (error) {
      console.error('Error sending message:', error);
      callback({ success: false, error: 'Failed to send message' });
    }
  });
  
  // Handle typing indicators
  socket.on('typing:start', (data) => {
    const { recipientId } = data;
    io.to(`user:${recipientId}`).emit('typing:start', { userId });
  });
  
  socket.on('typing:stop', (data) => {
    const { recipientId } = data;
    io.to(`user:${recipientId}`).emit('typing:stop', { userId });
  });
  
  // Handle mark as read
  socket.on('message:read', async (data) => {
    try {
      const { messageId } = data;
      await messageService.markAsRead(messageId, userId);
      
      // Notify sender that message was read
      const message = await messageService.getMessageById(messageId);
      if (message) {
        io.to(`user:${message.sender_id}`).emit('message:read_receipt', { messageId });
      }
    } catch (error) {
      console.error('Error marking message as read:', error);
    }
  });
  
  // Handle disconnect
  socket.on('disconnect', () => {
    console.log(`User disconnected: ${userId}`);
    redis.del(`user:online:${userId}`);
  });
});

// Error handling
app.use(errorHandler);

// Start server
httpServer.listen(PORT, () => {
  console.log(`🚀 SkillBridge Server running on port ${PORT}`);
  console.log(`📡 WebSocket server ready`);
  console.log(`🗄️  Database: ${process.env.DB_NAME || 'skillbridge'}`);
});

export { io, messageService, notificationService };
