import React from 'react';
import { 
  Card, 
  Row, 
  Col, 
  Statistic, 
  Progress, 
  Typography, 
  Space,
  Button,
  Table,
  Tag,
  Descriptions,
  Alert,
  Modal,
  message
} from 'antd';
import { useQuery, useMutation } from 'react-query';
import {
  ReloadOutlined,
  RestartAltOutlined,
  InfoCircleOutlined,
  CheckCircleOutlined,
  ExclamationCircleOutlined,
  CloseCircleOutlined,
} from '@ant-design/icons';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { systemApi } from '../utils/api';
import { SystemInfo, HealthStatus } from '../types';

const { Title, Text } = Typography;

const System: React.FC = () => {
  const [performanceData, setPerformanceData] = React.useState<any[]>([]);
  
  // 获取系统信息
  const { data: systemInfo, refetch: refetchSystemInfo } = useQuery<SystemInfo>(
    'system-info',
    () => systemApi.getSystemInfo().then(res => res.data),
    {
      refetchInterval: 5000, // 每5秒刷新
      onSuccess: (data) => {
        // 更新性能数据用于图表
        const now = new Date();
        setPerformanceData(prev => {
          const newData = [...prev, {
            time: now.toLocaleTimeString(),
            cpu: data.cpu_percent,
            memory: data.memory_usage.percent,
            timestamp: now.getTime(),
          }];
          // 只保留最近20个数据点
          return newData.slice(-20);
        });
      },
    }
  );

  // 获取健康状态
  const { data: healthStatus, refetch: refetchHealthStatus } = useQuery<HealthStatus>(
    'health-status',
    () => systemApi.getHealthStatus().then(res => res.data),
    {
      refetchInterval: 30000, // 每30秒刷新
    }
  );

  // 获取统计信息
  const { data: stats } = useQuery(
    'system-stats',
    () => systemApi.getStats().then(res => res.data)
  );

  // 获取版本信息
  const { data: versionInfo } = useQuery(
    'version-info',
    () => systemApi.getVersion().then(res => res.data)
  );

  // 获取环境信息
  const { data: envInfo } = useQuery(
    'environment-info',
    () => systemApi.getEnvironment().then(res => res.data)
  );

  // 重启应用
  const restartMutation = useMutation(
    () => systemApi.restart(),
    {
      onSuccess: () => {
        message.success('重启请求已发送');
      },
      onError: (error: any) => {
        message.error(`重启失败: ${error.response?.data?.detail || error.message}`);
      },
    }
  );

  // 格式化字节数
  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  // 获取状态颜色和图标
  const getStatusDisplay = (status: string) => {
    const statusMap = {
      healthy: { color: 'success', icon: <CheckCircleOutlined />, text: '正常' },
      warning: { color: 'warning', icon: <ExclamationCircleOutlined />, text: '警告' },
      error: { color: 'error', icon: <CloseCircleOutlined />, text: '错误' },
    };
    return statusMap[status as keyof typeof statusMap] || 
           { color: 'default', icon: <InfoCircleOutlined />, text: '未知' };
  };

  // 组件状态表格列
  const componentColumns = [
    {
      title: '组件',
      dataIndex: 'name',
      key: 'name',
      render: (name: string) => <Text strong>{name}</Text>,
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      render: (status: string) => {
        const display = getStatusDisplay(status);
        return (
          <Tag color={display.color} icon={display.icon}>
            {display.text}
          </Tag>
        );
      },
    },
  ];

  const componentData = healthStatus?.components 
    ? Object.entries(healthStatus.components).map(([name, status]) => ({
        key: name,
        name: name.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
        status,
      }))
    : [];

  const handleRestart = () => {
    Modal.confirm({
      title: '确认重启',
      content: '确定要重启 AutoFilm 应用程序吗？这将中断所有正在运行的任务。',
      onOk: () => restartMutation.mutate(),
    });
  };

  return (
    <div>
      <Title level={2}>系统信息</Title>
      
      {/* 系统状态概览 */}
      <Row gutter={16} style={{ marginBottom: 24 }}>
        <Col span={6}>
          <Card>
            <Statistic
              title="系统状态"
              value={healthStatus ? getStatusDisplay(healthStatus.status).text : '加载中'}
              prefix={healthStatus ? getStatusDisplay(healthStatus.status).icon : null}
              valueStyle={{ 
                color: healthStatus ? 
                  (healthStatus.status === 'healthy' ? '#52c41a' : 
                   healthStatus.status === 'warning' ? '#faad14' : '#f5222d') 
                  : undefined 
              }}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="运行时间"
              value={systemInfo?.uptime || '加载中'}
              prefix={<InfoCircleOutlined />}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="版本"
              value={versionInfo?.autofilm_version || '加载中'}
              prefix={<InfoCircleOutlined />}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Space direction="vertical" style={{ width: '100%' }}>
              <Button
                type="primary"
                icon={<ReloadOutlined />}
                onClick={() => {
                  refetchSystemInfo();
                  refetchHealthStatus();
                }}
                block
              >
                刷新信息
              </Button>
              <Button
                danger
                icon={<RestartAltOutlined />}
                onClick={handleRestart}
                loading={restartMutation.isLoading}
                block
              >
                重启应用
              </Button>
            </Space>
          </Card>
        </Col>
      </Row>

      <Row gutter={16}>
        {/* 系统资源监控 */}
        <Col span={12}>
          <Card title="资源使用情况">
            {systemInfo ? (
              <Space direction="vertical" style={{ width: '100%' }}>
                <div>
                  <Text strong>CPU 使用率</Text>
                  <Progress 
                    percent={Math.round(systemInfo.cpu_percent)} 
                    status={systemInfo.cpu_percent > 80 ? 'exception' : 'normal'}
                  />
                </div>
                <div>
                  <Text strong>内存使用率</Text>
                  <Progress 
                    percent={Math.round(systemInfo.memory_usage.percent)} 
                    status={systemInfo.memory_usage.percent > 80 ? 'exception' : 'normal'}
                  />
                  <Text type="secondary" style={{ fontSize: '12px' }}>
                    {formatBytes(systemInfo.memory_usage.used)} / {formatBytes(systemInfo.memory_usage.total)}
                  </Text>
                </div>
                <div>
                  <Text strong>磁盘使用率</Text>
                  <Progress 
                    percent={Math.round(systemInfo.disk_usage.percent)} 
                    status={systemInfo.disk_usage.percent > 80 ? 'exception' : 'normal'}
                  />
                  <Text type="secondary" style={{ fontSize: '12px' }}>
                    {formatBytes(systemInfo.disk_usage.used)} / {formatBytes(systemInfo.disk_usage.total)}
                  </Text>
                </div>
              </Space>
            ) : (
              <Text>加载中...</Text>
            )}
          </Card>
        </Col>

        {/* 组件状态 */}
        <Col span={12}>
          <Card title="组件状态">
            <Table
              columns={componentColumns}
              dataSource={componentData}
              pagination={false}
              size="small"
            />
          </Card>
        </Col>
      </Row>

      {/* 性能图表 */}
      <Row style={{ marginTop: 16 }}>
        <Col span={24}>
          <Card title="性能监控">
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={performanceData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="time" />
                <YAxis domain={[0, 100]} />
                <Tooltip />
                <Line 
                  type="monotone" 
                  dataKey="cpu" 
                  stroke="#1890ff" 
                  name="CPU %" 
                  strokeWidth={2}
                />
                <Line 
                  type="monotone" 
                  dataKey="memory" 
                  stroke="#52c41a" 
                  name="内存 %" 
                  strokeWidth={2}
                />
              </LineChart>
            </ResponsiveContainer>
          </Card>
        </Col>
      </Row>

      {/* 详细信息 */}
      <Row gutter={16} style={{ marginTop: 16 }}>
        <Col span={12}>
          <Card title="系统详情">
            {systemInfo && (
              <Descriptions column={1} size="small">
                <Descriptions.Item label="平台">{systemInfo.platform}</Descriptions.Item>
                <Descriptions.Item label="Python 版本">{systemInfo.python_version}</Descriptions.Item>
                <Descriptions.Item label="网络发送">{formatBytes(systemInfo.network_io.bytes_sent)}</Descriptions.Item>
                <Descriptions.Item label="网络接收">{formatBytes(systemInfo.network_io.bytes_recv)}</Descriptions.Item>
                <Descriptions.Item label="发送包数">{systemInfo.network_io.packets_sent}</Descriptions.Item>
                <Descriptions.Item label="接收包数">{systemInfo.network_io.packets_recv}</Descriptions.Item>
              </Descriptions>
            )}
          </Card>
        </Col>

        <Col span={12}>
          <Card title="环境信息">
            {envInfo && (
              <Descriptions column={1} size="small">
                <Descriptions.Item label="应用名称">{envInfo.environment.app_name}</Descriptions.Item>
                <Descriptions.Item label="调试模式">{envInfo.environment.debug_mode ? '开启' : '关闭'}</Descriptions.Item>
                <Descriptions.Item label="时区">{envInfo.environment.timezone}</Descriptions.Item>
                <Descriptions.Item label="配置目录">{envInfo.environment.config_dir}</Descriptions.Item>
                <Descriptions.Item label="日志目录">{envInfo.environment.log_dir}</Descriptions.Item>
                <Descriptions.Item label="工作目录">{envInfo.environment.working_directory}</Descriptions.Item>
              </Descriptions>
            )}
          </Card>
        </Col>
      </Row>

      {/* 统计信息 */}
      {stats && (
        <Row style={{ marginTop: 16 }}>
          <Col span={24}>
            <Card title="统计信息">
              <Row gutter={16}>
                <Col span={6}>
                  <Statistic title="配置文件数" value={stats.stats.config_files} />
                </Col>
                <Col span={6}>
                  <Statistic title="日志文件数" value={stats.stats.log_files} />
                </Col>
                <Col span={6}>
                  <Statistic 
                    title="日志总大小" 
                    value={formatBytes(stats.stats.total_log_size)} 
                  />
                </Col>
                <Col span={6}>
                  <Statistic 
                    title="进程内存" 
                    value={formatBytes(stats.stats.process_memory)} 
                  />
                </Col>
              </Row>
              <Row gutter={16} style={{ marginTop: 16 }}>
                <Col span={6}>
                  <Statistic title="Alist2Strm 任务" value={stats.stats.alist2strm_tasks} />
                </Col>
                <Col span={6}>
                  <Statistic title="Ani2Alist 任务" value={stats.stats.ani2alist_tasks} />
                </Col>
                <Col span={6}>
                  <Statistic title="进程 ID" value={stats.stats.process_id} />
                </Col>
                <Col span={6}>
                  <Statistic 
                    title="进程 CPU" 
                    value={`${stats.stats.process_cpu_percent.toFixed(2)}%`} 
                  />
                </Col>
              </Row>
            </Card>
          </Col>
        </Row>
      )}
    </div>
  );
};

export default System;

