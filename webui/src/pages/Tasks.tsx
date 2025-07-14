import React from 'react';
import { 
  Card, 
  Table, 
  Button, 
  Space, 
  Tag, 
  Progress, 
  Modal, 
  Typography, 
  message,
  Popconfirm,
  Drawer,
  Descriptions,
  Timeline
} from 'antd';
import { useQuery, useMutation, useQueryClient } from 'react-query';
import {
  PlayCircleOutlined,
  PauseCircleOutlined,
  ReloadOutlined,
  EyeOutlined,
  StopOutlined,
} from '@ant-design/icons';
import { taskApi } from '../utils/api';
import { TaskStatus } from '../types';
import { wsManager } from '../utils/websocket';

const { Title, Text, Paragraph } = Typography;

const Tasks: React.FC = () => {
  const [selectedTask, setSelectedTask] = React.useState<TaskStatus | null>(null);
  const [taskLogsVisible, setTaskLogsVisible] = React.useState(false);
  const [taskLogs, setTaskLogs] = React.useState<string[]>([]);
  
  const queryClient = useQueryClient();

  // 获取任务列表
  const { data: tasks, isLoading } = useQuery<TaskStatus[]>(
    'tasks',
    () => taskApi.getTasks().then(res => res.data),
    {
      refetchInterval: 3000, // 每3秒刷新
    }
  );

  // 触发任务
  const triggerTaskMutation = useMutation(
    ({ taskId, force }: { taskId: string; force: boolean }) => 
      taskApi.triggerTask(taskId, force),
    {
      onSuccess: () => {
        message.success('任务已启动');
        queryClient.invalidateQueries('tasks');
      },
      onError: (error: any) => {
        message.error(`启动任务失败: ${error.response?.data?.detail || error.message}`);
      },
    }
  );

  // 停止任务
  const stopTaskMutation = useMutation(
    (taskId: string) => taskApi.stopTask(taskId),
    {
      onSuccess: () => {
        message.success('任务已停止');
        queryClient.invalidateQueries('tasks');
      },
      onError: (error: any) => {
        message.error(`停止任务失败: ${error.response?.data?.detail || error.message}`);
      },
    }
  );

  // WebSocket 实时更新
  React.useEffect(() => {
    const handleTaskUpdate = (data: TaskStatus) => {
      queryClient.setQueryData<TaskStatus[]>('tasks', (oldTasks) => {
        if (!oldTasks) return oldTasks;
        return oldTasks.map(task => 
          task.id === data.id ? { ...task, ...data } : task
        );
      });
    };

    wsManager.on('task_status_update', handleTaskUpdate);

    return () => {
      wsManager.off('task_status_update', handleTaskUpdate);
    };
  }, [queryClient]);

  // 查看任务日志
  const handleViewLogs = async (task: TaskStatus) => {
    try {
      const response = await taskApi.getTaskLogs(task.id, 200);
      setTaskLogs(response.data.logs);
      setSelectedTask(task);
      setTaskLogsVisible(true);
    } catch (error: any) {
      message.error(`获取日志失败: ${error.response?.data?.detail || error.message}`);
    }
  };

  // 获取状态标签
  const getStatusTag = (status: string) => {
    const statusConfig = {
      running: { color: 'processing', text: '运行中' },
      stopped: { color: 'default', text: '已停止' },
      completed: { color: 'success', text: '已完成' },
      error: { color: 'error', text: '错误' },
    };
    
    const config = statusConfig[status as keyof typeof statusConfig] || 
                   { color: 'default', text: status };
    
    return <Tag color={config.color}>{config.text}</Tag>;
  };

  // 获取任务类型标签
  const getTypeTag = (type: string) => {
    const typeConfig = {
      alist2strm: { color: 'blue', text: 'Alist2Strm' },
      ani2alist: { color: 'green', text: 'Ani2Alist' },
    };
    
    const config = typeConfig[type as keyof typeof typeConfig] || 
                   { color: 'default', text: type };
    
    return <Tag color={config.color}>{config.text}</Tag>;
  };

  // 表格列定义
  const columns = [
    {
      title: '任务名称',
      dataIndex: 'name',
      key: 'name',
      render: (text: string, record: TaskStatus) => (
        <Space direction="vertical" size="small">
          <Text strong>{text}</Text>
          <Text type="secondary" style={{ fontSize: '12px' }}>
            ID: {record.id}
          </Text>
        </Space>
      ),
    },
    {
      title: '类型',
      dataIndex: 'type',
      key: 'type',
      render: (type: string) => getTypeTag(type),
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      render: (status: string, record: TaskStatus) => (
        <Space direction="vertical" size="small">
          {getStatusTag(status)}
          {record.status === 'running' && (
            <Progress 
              percent={Math.round(record.progress)} 
              size="small" 
              style={{ width: 100 }}
            />
          )}
        </Space>
      ),
    },
    {
      title: '消息',
      dataIndex: 'message',
      key: 'message',
      ellipsis: true,
      render: (message: string) => (
        <Text style={{ maxWidth: 200 }}>{message || '-'}</Text>
      ),
    },
    {
      title: '最后运行',
      dataIndex: 'last_run',
      key: 'last_run',
      render: (lastRun: string) => (
        <Text type="secondary">
          {lastRun ? new Date(lastRun).toLocaleString() : '-'}
        </Text>
      ),
    },
    {
      title: '操作',
      key: 'actions',
      render: (_, record: TaskStatus) => (
        <Space>
          <Button
            type="primary"
            icon={<PlayCircleOutlined />}
            size="small"
            onClick={() => triggerTaskMutation.mutate({ taskId: record.id, force: false })}
            disabled={record.status === 'running' || triggerTaskMutation.isLoading}
            loading={triggerTaskMutation.isLoading}
          >
            启动
          </Button>
          
          {record.status === 'running' && (
            <Popconfirm
              title="确定要停止这个任务吗？"
              onConfirm={() => stopTaskMutation.mutate(record.id)}
            >
              <Button
                danger
                icon={<StopOutlined />}
                size="small"
                loading={stopTaskMutation.isLoading}
              >
                停止
              </Button>
            </Popconfirm>
          )}
          
          <Button
            icon={<EyeOutlined />}
            size="small"
            onClick={() => handleViewLogs(record)}
          >
            日志
          </Button>
          
          <Popconfirm
            title="确定要强制重启这个任务吗？"
            onConfirm={() => triggerTaskMutation.mutate({ taskId: record.id, force: true })}
          >
            <Button
              icon={<ReloadOutlined />}
              size="small"
              disabled={triggerTaskMutation.isLoading}
            >
              重启
            </Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <div>
      <Title level={2}>任务管理</Title>
      
      <Card>
        <Table
          columns={columns}
          dataSource={tasks}
          rowKey="id"
          loading={isLoading}
          pagination={{
            pageSize: 10,
            showSizeChanger: true,
            showQuickJumper: true,
            showTotal: (total) => `共 ${total} 个任务`,
          }}
          expandable={{
            expandedRowRender: (record) => (
              <Descriptions size="small" column={2}>
                <Descriptions.Item label="配置信息">
                  <pre style={{ fontSize: '12px', maxHeight: '200px', overflow: 'auto' }}>
                    {JSON.stringify(record.config, null, 2)}
                  </pre>
                </Descriptions.Item>
                <Descriptions.Item label="下次运行">
                  {record.next_run ? new Date(record.next_run).toLocaleString() : '未设置'}
                </Descriptions.Item>
              </Descriptions>
            ),
          }}
        />
      </Card>

      {/* 任务日志抽屉 */}
      <Drawer
        title={`任务日志 - ${selectedTask?.name}`}
        placement="right"
        size="large"
        open={taskLogsVisible}
        onClose={() => setTaskLogsVisible(false)}
      >
        {selectedTask && (
          <Space direction="vertical" style={{ width: '100%' }}>
            <Descriptions size="small" column={1}>
              <Descriptions.Item label="任务ID">{selectedTask.id}</Descriptions.Item>
              <Descriptions.Item label="任务类型">{getTypeTag(selectedTask.type)}</Descriptions.Item>
              <Descriptions.Item label="当前状态">{getStatusTag(selectedTask.status)}</Descriptions.Item>
              <Descriptions.Item label="进度">
                <Progress percent={Math.round(selectedTask.progress)} />
              </Descriptions.Item>
            </Descriptions>
            
            <div style={{ marginTop: 16 }}>
              <Title level={4}>日志内容</Title>
              <div className="log-container" style={{ height: '400px' }}>
                {taskLogs.length > 0 ? (
                  taskLogs.map((log, index) => (
                    <div key={index} className="log-entry">
                      {log}
                    </div>
                  ))
                ) : (
                  <Text type="secondary">暂无日志</Text>
                )}
              </div>
            </div>
          </Space>
        )}
      </Drawer>
    </div>
  );
};

export default Tasks;

