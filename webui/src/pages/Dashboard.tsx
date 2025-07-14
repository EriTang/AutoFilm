import React from 'react';
import { Row, Col, Card, Statistic, Progress, List, Typography, Space, Button, Alert } from 'antd';
import { useQuery } from 'react-query';
import {
  PlayCircleOutlined,
  PauseCircleOutlined,
  CheckCircleOutlined,
  ExclamationCircleOutlined,
  ReloadOutlined,
} from '@ant-design/icons';
import { taskApi, systemApi } from '../utils/api';
import { TaskStatus, SystemInfo, HealthStatus } from '../types';
import { wsManager } from '../utils/websocket';

const { Title, Text } = Typography;

const Dashboard: React.FC = () => {
  // 获取任务状态
  const { data: tasks, refetch: refetchTasks } = useQuery<TaskStatus[]>(
    'tasks',
    () => taskApi.getTasks().then(res => res.data),
    {
      refetchInterval: 5000, // 每5秒刷新
    }
  );

  // 获取系统信息
  const { data: systemInfo } = useQuery<SystemInfo>(
    'system-info',
    () => systemApi.getSystemInfo().then(res => res.data),
    {
      refetchInterval: 10000, // 每10秒刷新
    }
  );

  // 获取健康状态
  const { data: healthStatus } = useQuery<HealthStatus>(
    'health-status',
    () => systemApi.getHealthStatus().then(res => res.data),
    {
      refetchInterval: 30000, // 每30秒刷新
    }
  );

  // WebSocket 实时更新
  React.useEffect(() => {
    const handleTaskUpdate = (data: TaskStatus) => {
      refetchTasks();
    };

    wsManager.on('task_status_update', handleTaskUpdate);

    return () => {
      wsManager.off('task_status_update', handleTaskUpdate);
    };
  }, [refetchTasks]);

  // 计算任务统计
  const taskStats = React.useMemo(() => {
    if (!tasks) return { total: 0, running: 0, completed: 0, error: 0 };
    
    return {
      total: tasks.length,
      running: tasks.filter(t => t.status === 'running').length,
      completed: tasks.filter(t => t.status === 'completed').length,
      error: tasks.filter(t => t.status === 'error').length,
    };
  }, [tasks]);

  // 获取运行中的任务
  const runningTasks = React.useMemo(() => {
    return tasks?.filter(t => t.status === 'running') || [];
  }, [tasks]);

  // 获取最近的任务
  const recentTasks = React.useMemo(() => {
    return tasks?.slice(0, 5) || [];
  }, [tasks]);

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'running':
        return <PlayCircleOutlined style={{ color: '#52c41a' }} />;
      case 'stopped':
        return <PauseCircleOutlined style={{ color: '#d9d9d9' }} />;
      case 'completed':
        return <CheckCircleOutlined style={{ color: '#1890ff' }} />;
      case 'error':
        return <ExclamationCircleOutlined style={{ color: '#ff4d4f' }} />;
      default:
        return null;
    }
  };

  return (
    <div>
      <Title level={2}>仪表板</Title>
      
      {/* 健康状态警告 */}
      {healthStatus?.status !== 'healthy' && (
        <Alert
          message="系统状态异常"
          description={`当前系统状态: ${healthStatus?.status}`}
          type={healthStatus?.status === 'warning' ? 'warning' : 'error'}
          showIcon
          style={{ marginBottom: 24 }}
        />
      )}

      {/* 任务统计卡片 */}
      <Row gutter={16} style={{ marginBottom: 24 }}>
        <Col span={6}>
          <Card>
            <Statistic
              title="总任务数"
              value={taskStats.total}
              prefix={<PlayCircleOutlined />}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="运行中"
              value={taskStats.running}
              valueStyle={{ color: '#52c41a' }}
              prefix={<PlayCircleOutlined />}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="已完成"
              value={taskStats.completed}
              valueStyle={{ color: '#1890ff' }}
              prefix={<CheckCircleOutlined />}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="错误"
              value={taskStats.error}
              valueStyle={{ color: '#ff4d4f' }}
              prefix={<ExclamationCircleOutlined />}
            />
          </Card>
        </Col>
      </Row>

      <Row gutter={16}>
        {/* 系统资源监控 */}
        <Col span={12}>
          <Card 
            title="系统资源" 
            extra={<Button icon={<ReloadOutlined />} size="small" />}
          >
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
                  <Text type="secondary">
                    {formatBytes(systemInfo.memory_usage.used)} / {formatBytes(systemInfo.memory_usage.total)}
                  </Text>
                </div>
                <div>
                  <Text strong>磁盘使用率</Text>
                  <Progress 
                    percent={Math.round(systemInfo.disk_usage.percent)} 
                    status={systemInfo.disk_usage.percent > 80 ? 'exception' : 'normal'}
                  />
                  <Text type="secondary">
                    {formatBytes(systemInfo.disk_usage.used)} / {formatBytes(systemInfo.disk_usage.total)}
                  </Text>
                </div>
                <div>
                  <Text strong>运行时间:</Text> <Text>{systemInfo.uptime}</Text>
                </div>
              </Space>
            ) : (
              <Text>加载中...</Text>
            )}
          </Card>
        </Col>

        {/* 运行中的任务 */}
        <Col span={12}>
          <Card title="运行中的任务">
            {runningTasks.length > 0 ? (
              <List
                dataSource={runningTasks}
                renderItem={(task) => (
                  <List.Item>
                    <List.Item.Meta
                      avatar={getStatusIcon(task.status)}
                      title={task.name}
                      description={
                        <div>
                          <div>{task.message}</div>
                          <Progress 
                            percent={Math.round(task.progress)} 
                            size="small" 
                            style={{ marginTop: 8 }}
                          />
                        </div>
                      }
                    />
                  </List.Item>
                )}
              />
            ) : (
              <Text type="secondary">暂无运行中的任务</Text>
            )}
          </Card>
        </Col>
      </Row>

      {/* 最近任务 */}
      <Row style={{ marginTop: 16 }}>
        <Col span={24}>
          <Card title="最近任务">
            <List
              dataSource={recentTasks}
              renderItem={(task) => (
                <List.Item
                  actions={[
                    <Button 
                      key="trigger" 
                      type="link" 
                      size="small"
                      onClick={() => taskApi.triggerTask(task.id)}
                      disabled={task.status === 'running'}
                    >
                      {task.status === 'running' ? '运行中' : '启动'}
                    </Button>
                  ]}
                >
                  <List.Item.Meta
                    avatar={getStatusIcon(task.status)}
                    title={task.name}
                    description={
                      <Space direction="vertical" size="small">
                        <Text type="secondary">类型: {task.type}</Text>
                        <Text type="secondary">状态: {task.status}</Text>
                        {task.message && <Text>{task.message}</Text>}
                        {task.last_run && (
                          <Text type="secondary">
                            最后运行: {new Date(task.last_run).toLocaleString()}
                          </Text>
                        )}
                      </Space>
                    }
                  />
                </List.Item>
              )}
            />
          </Card>
        </Col>
      </Row>
    </div>
  );
};

export default Dashboard;

