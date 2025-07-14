import React from 'react';
import { Layout, Typography, Space, Badge, Button } from 'antd';
import { useQuery } from 'react-query';
import { 
  ReloadOutlined,
  WifiOutlined,
  DisconnectOutlined 
} from '@ant-design/icons';
import { systemApi } from '../utils/api';
import { wsManager } from '../utils/websocket';

const { Header: AntHeader } = Layout;
const { Text } = Typography;

const Header: React.FC = () => {
  const { data: healthStatus, refetch } = useQuery(
    'health-status',
    () => systemApi.getHealthStatus().then(res => res.data),
    {
      refetchInterval: 30000, // 每30秒刷新一次
    }
  );

  const [wsConnected, setWsConnected] = React.useState(false);

  React.useEffect(() => {
    const checkConnection = () => {
      setWsConnected(wsManager.isConnected());
    };

    // 初始检查
    checkConnection();

    // 定期检查连接状态
    const interval = setInterval(checkConnection, 1000);

    return () => clearInterval(interval);
  }, []);

  const getStatusColor = (status?: string) => {
    switch (status) {
      case 'healthy':
        return 'success';
      case 'warning':
        return 'warning';
      case 'error':
        return 'error';
      default:
        return 'default';
    }
  };

  return (
    <AntHeader style={{ 
      background: '#fff', 
      padding: '0 24px',
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center'
    }}>
      <div>
        <Typography.Title level={4} style={{ margin: 0 }}>
          AutoFilm Web UI
        </Typography.Title>
        <Text type="secondary">
          版本 {healthStatus?.version || 'Unknown'}
        </Text>
      </div>
      
      <Space size="large">
        {/* WebSocket 连接状态 */}
        <Space>
          {wsConnected ? (
            <Badge status="success" text={<WifiOutlined />} />
          ) : (
            <Badge status="error" text={<DisconnectOutlined />} />
          )}
          <Text type="secondary">
            {wsConnected ? '已连接' : '未连接'}
          </Text>
        </Space>

        {/* 系统健康状态 */}
        <Space>
          <Badge 
            status={getStatusColor(healthStatus?.status)} 
            text="系统状态" 
          />
          <Text>
            {healthStatus?.status === 'healthy' ? '正常' : 
             healthStatus?.status === 'warning' ? '警告' : 
             healthStatus?.status === 'error' ? '错误' : '未知'}
          </Text>
        </Space>

        {/* 刷新按钮 */}
        <Button 
          icon={<ReloadOutlined />} 
          onClick={() => refetch()}
          size="small"
        >
          刷新
        </Button>
      </Space>
    </AntHeader>
  );
};

export default Header;

