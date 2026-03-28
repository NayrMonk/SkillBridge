import { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useAuthStore } from '@/store/authStore';
import { useUIStore } from '@/store/uiStore';
import { api } from '@/api/client';
import { Toaster } from '@/components/ui/sonner';

// Layouts
import { MainLayout } from '@/components/layout/MainLayout';
import { DashboardLayout } from '@/components/layout/DashboardLayout';

// Pages
import { LandingPage } from '@/pages/LandingPage';
import { LoginPage } from '@/pages/auth/LoginPage';
import { RegisterPage } from '@/pages/auth/RegisterPage';
import { FreelancerDashboard } from '@/pages/dashboard/FreelancerDashboard';
import { ClientDashboard } from '@/pages/dashboard/ClientDashboard';
import { ProjectsPage } from '@/pages/projects/ProjectsPage';
import { ProjectDetailPage } from '@/pages/projects/ProjectDetailPage';
import { PostProjectPage } from '@/pages/projects/PostProjectPage';
import { ApplicationsPage } from '@/pages/applications/ApplicationsPage';
import { MessagesPage } from '@/pages/messages/MessagesPage';
import { WalletPage } from '@/pages/payments/WalletPage';
import { ProfilePage } from '@/pages/profile/ProfilePage';
import { EditProfilePage } from '@/pages/profile/EditProfilePage';
import { TestsPage } from '@/pages/tests/TestsPage';
import { TakeTestPage } from '@/pages/tests/TakeTestPage';
import { AdminDashboard } from '@/pages/admin/AdminDashboard';
import { AdminUsersPage } from '@/pages/admin/AdminUsersPage';
import { AdminProjectsPage } from '@/pages/admin/AdminProjectsPage';
import { AdminTransactionsPage } from '@/pages/admin/AdminTransactionsPage';
import { NotFoundPage } from '@/pages/NotFoundPage';

// Protected Route Component
const ProtectedRoute = ({ 
  children, 
  allowedRoles 
}: { 
  children: React.ReactNode; 
  allowedRoles?: string[];
}) => {
  const { isAuthenticated, user } = useAuthStore();

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  if (allowedRoles && user && !allowedRoles.includes(user.role)) {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
};

// Initialize auth
const AuthInitializer = ({ children }: { children: React.ReactNode }) => {
  const { token, login, logout, setLoading } = useAuthStore();

  useEffect(() => {
    const initAuth = async () => {
      if (token) {
        try {
          setLoading(true);
          const data = await api.getCurrentUser();
          login(data.user, token);
        } catch (error) {
          console.error('Auth initialization failed:', error);
          logout();
        } finally {
          setLoading(false);
        }
      } else {
        setLoading(false);
      }
    };

    initAuth();
  }, []);

  return <>{children}</>;
};

// Theme Provider — Deep Forest only (no dark mode)
const ThemeProvider = ({ children }: { children: React.ReactNode }) => {
  useEffect(() => {
    // Remove any dark class — Deep Forest is always light
    document.documentElement.classList.remove('dark');
    document.documentElement.classList.add('light');
  }, []);
  return <>{children}</>;
};

function App() {
  return (
    <BrowserRouter>
      <ThemeProvider>
        <AuthInitializer>
          <Routes>
            {/* Public Routes */}
            <Route path="/" element={<MainLayout />}>  
              <Route index element={<LandingPage />} />
              <Route path="login" element={<LoginPage />} />
              <Route path="register" element={<RegisterPage />} />
              <Route path="projects" element={<ProjectsPage />} />
              <Route path="projects/:id" element={<ProjectDetailPage />} />
            </Route>

            {/* Protected Dashboard Routes */}
            <Route path="/dashboard" element={
              <ProtectedRoute>
                <DashboardLayout />
              </ProtectedRoute>
            }>
              <Route index element={<Navigate to="overview" replace />} />
              <Route path="overview" element={
                <ProtectedRoute allowedRoles={['freelancer']}>
                  <FreelancerDashboard />
                </ProtectedRoute>
              } />
              <Route path="client" element={
                <ProtectedRoute allowedRoles={['client']}>
                  <ClientDashboard />
                </ProtectedRoute>
              } />
              <Route path="applications" element={
                <ProtectedRoute allowedRoles={['freelancer']}>
                  <ApplicationsPage />
                </ProtectedRoute>
              } />
              <Route path="messages" element={<MessagesPage />} />
              <Route path="messages/:userId" element={<MessagesPage />} />
              <Route path="wallet" element={<WalletPage />} />
              <Route path="profile" element={<ProfilePage />} />
              <Route path="profile/edit" element={<EditProfilePage />} />
              <Route path="tests" element={
                <ProtectedRoute allowedRoles={['freelancer']}>
                  <TestsPage />
                </ProtectedRoute>
              } />
              <Route path="tests/take/:templateId" element={
                <ProtectedRoute allowedRoles={['freelancer']}>
                  <TakeTestPage />
                </ProtectedRoute>
              } />
              <Route path="post-project" element={
                <ProtectedRoute allowedRoles={['client']}>
                  <PostProjectPage />
                </ProtectedRoute>
              } />
            </Route>

            {/* Admin Routes */}
            <Route path="/admin" element={
              <ProtectedRoute allowedRoles={['admin']}>
                <DashboardLayout />
              </ProtectedRoute>
            }>
              <Route index element={<Navigate to="dashboard" replace />} />
              <Route path="dashboard" element={<AdminDashboard />} />
              <Route path="users" element={<AdminUsersPage />} />
              <Route path="projects" element={<AdminProjectsPage />} />
              <Route path="transactions" element={<AdminTransactionsPage />} />
            </Route>

            {/* 404 */}
            <Route path="*" element={<NotFoundPage />} />
          </Routes>
          <Toaster position="top-right" richColors />
        </AuthInitializer>
      </ThemeProvider>
    </BrowserRouter>
  );
}

export default App;
