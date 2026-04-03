import express from 'express';
import { authenticateToken } from '../middleware/auth';
import { errorHandler } from '../middleware/errorHandler';
import authRoutes from '../routes/auth';
import userRoutes from '../routes/users';
import projectRoutes from '../routes/projects';
import applicationRoutes from '../routes/applications';
import messageRoutes from '../routes/messages';
import paymentRoutes from '../routes/payments';
import testRoutes from '../routes/tests';
import adminRoutes from '../routes/admin';
import dashboardRoutes from '../routes/dashboard';

const app = express();

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok' });
});

app.use('/api/auth', authRoutes);
app.use('/api/users', authenticateToken, userRoutes);
app.use('/api/projects', authenticateToken, projectRoutes);
app.use('/api/applications', authenticateToken, applicationRoutes);
app.use('/api/messages', authenticateToken, messageRoutes);
app.use('/api/payments', authenticateToken, paymentRoutes);
app.use('/api/tests', authenticateToken, testRoutes);
app.use('/api/admin', authenticateToken, adminRoutes);
app.use('/api/dashboard', authenticateToken, dashboardRoutes);

app.use(errorHandler);

export { app };
