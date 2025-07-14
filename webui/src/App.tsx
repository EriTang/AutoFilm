import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { Layout, ConfigProvider, theme } from 'antd';
import { QueryClient, QueryClientProvider } from 'react-query';

import Sidebar from './components/Sidebar';
import Header from './components/Header';
import Dashboard from './pages/Dashboard';
import Tasks from './pages/Tasks';
import Config from './pages/Config';
import Logs from './pages/Logs';
import System from './pages/System';

import './App.css';

const { Content } = Layout;

// 创建 React Query 客户端
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: 1,
      staleTime: 30000, // 30 seconds
    },
  },
});

const App: React.FC = () => {
  return (
    <QueryClientProvider client={queryClient}>
      <ConfigProvider
        theme={{
          algorithm: theme.defaultAlgorithm,
          token: {
            colorPrimary: '#1890ff',
          },
        }}
      >
        <Router>
          <Layout style={{ minHeight: '100vh' }}>
            <Sidebar />
            <Layout>
              <Header />
              <Content style={{ margin: '16px', overflow: 'auto' }}>
                <div style={{ padding: 24, minHeight: 360 }}>
                  <Routes>
                    <Route path="/" element={<Navigate to="/dashboard" replace />} />
                    <Route path="/dashboard" element={<Dashboard />} />
                    <Route path="/tasks" element={<Tasks />} />
                    <Route path="/config" element={<Config />} />
                    <Route path="/logs" element={<Logs />} />
                    <Route path="/system" element={<System />} />
                  </Routes>
                </div>
              </Content>
            </Layout>
          </Layout>
        </Router>
      </ConfigProvider>
    </QueryClientProvider>
  );
};

export default App;

