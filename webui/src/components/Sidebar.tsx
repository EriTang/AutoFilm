import React from 'react';
import { Layout, Menu } from 'antd';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  DashboardOutlined,
  PlayCircleOutlined,
  SettingOutlined,
  FileTextOutlined,
  InfoCircleOutlined,
} from '@ant-design/icons';

const { Sider } = Layout;

const Sidebar: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();

  const menuItems = [
    {
      key: '/dashboard',
      icon: <DashboardOutlined />,
      label: '仪表板',
    },
    {
      key: '/tasks',
      icon: <PlayCircleOutlined />,
      label: '任务管理',
    },
    {
      key: '/config',
      icon: <SettingOutlined />,
      label: '配置管理',
    },
    {
      key: '/logs',
      icon: <FileTextOutlined />,
      label: '日志查看',
    },
    {
      key: '/system',
      icon: <InfoCircleOutlined />,
      label: '系统信息',
    },
  ];

  const handleMenuClick = (key: string) => {
    navigate(key);
  };

  return (
    <Sider width={200} theme="dark">
      <div style={{ 
        height: 32, 
        margin: 16, 
        background: 'rgba(255, 255, 255, 0.3)',
        borderRadius: 6,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: '#fff',
        fontWeight: 'bold'
      }}>
        AutoFilm
      </div>
      <Menu
        theme="dark"
        mode="inline"
        selectedKeys={[location.pathname]}
        items={menuItems}
        onClick={({ key }) => handleMenuClick(key)}
      />
    </Sider>
  );
};

export default Sidebar;

