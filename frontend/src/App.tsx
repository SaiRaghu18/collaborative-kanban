import React, { lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';
import { AuthProvider } from '@/contexts/AuthContext';
import { SocketProvider } from '@/contexts/SocketContext';
import { TenantProvider } from '@/contexts/TenantContext';
import { Toaster } from '@/components/ui/toaster';
import { ErrorBoundary } from '@/components/common/ErrorBoundary';

import ProtectedRoute from '@/components/common/ProtectedRoute';
import DashboardLayout from '@/layouts/DashboardLayout';
import { PageLoader } from '@/components/common/LoadingStates';

// ─── Route Code-Splitting with React.lazy (Improves Initial Load Time) ───────
const LoginPage = lazy(() => import('@/pages/auth/LoginPage'));
const RegisterPage = lazy(() => import('@/pages/auth/RegisterPage'));
const DashboardPage = lazy(() => import('@/pages/dashboard/DashboardPage'));
const OrganizationsPage = lazy(() => import('@/pages/dashboard/OrganizationsPage'));
const OrganizationDetailPage = lazy(() => import('@/pages/dashboard/OrganizationDetailPage'));
const BoardsPage = lazy(() => import('@/pages/boards/BoardsPage'));
const BoardDetailPage = lazy(() => import('@/pages/boards/BoardDetailPage'));

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      staleTime: 1000 * 60 * 2, // 2 minutes
      refetchOnWindowFocus: false,
    },
    mutations: {
      retry: 0,
    },
  },
});

function RouteLoadingFallback() {
  return <PageLoader />;
}

export default function App() {
  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <SocketProvider>
            <TenantProvider>
              <BrowserRouter>
                <Suspense fallback={<RouteLoadingFallback />}>
                  <Routes>
                    {/* Public routes */}
                    <Route path="/login" element={<LoginPage />} />
                    <Route path="/register" element={<RegisterPage />} />

                    {/* Protected routes */}
                    <Route element={<ProtectedRoute />}>
                      <Route element={<DashboardLayout />}>
                        <Route path="/dashboard" element={<DashboardPage />} />
                        <Route path="/dashboard/organizations" element={<OrganizationsPage />} />
                        <Route
                          path="/dashboard/organizations/:organizationId"
                          element={<OrganizationDetailPage />}
                        />
                        <Route
                          path="/dashboard/workspaces/:workspaceId/boards"
                          element={<BoardsPage />}
                        />
                        <Route
                          path="/dashboard/boards/:boardId"
                          element={<BoardDetailPage />}
                        />
                      </Route>
                    </Route>

                    {/* Redirects */}
                    <Route path="/" element={<Navigate to="/dashboard" replace />} />
                    <Route path="*" element={<Navigate to="/dashboard" replace />} />
                  </Routes>
                </Suspense>
              </BrowserRouter>
              <Toaster />
              <ReactQueryDevtools initialIsOpen={false} />
            </TenantProvider>
          </SocketProvider>
        </AuthProvider>
      </QueryClientProvider>
    </ErrorBoundary>
  );
}
