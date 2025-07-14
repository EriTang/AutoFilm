import React from 'react';
import { 
  Card, 
  Button, 
  Space, 
  Typography, 
  message,
  Select,
  Input,
  Table,
  Tag,
  Modal,
  Popconfirm,
  Switch,
  InputNumber,
  Row,
  Col
} from 'antd';
import { useQuery, useMutation, useQueryClient } from 'react-query';
import {
  ReloadOutlined,
  ClearOutlined,
  DownloadOutlined,
  DeleteOutlined,
  EyeOutlined,
  SearchOutlined,
  PlayCircleOutlined,
  PauseCircleOutlined,
} from '@ant-design/icons';
import { logApi } from '../utils/api';
import { LogEntry } from '../types';

const { Title, Text } = Typography;
const { Option } = Select;
const { Search } = Input;

interface LogFile {
  name: string;
  path: string;
  size: number;
  modified: string;
  is_current: boolean;
}

const Logs: React.FC = () => {
  const [selectedLevel, setSelectedLevel] = React.useState<string>('');
  const [searchKeyword, setSearchKeyword] = React.useState('');
  const [logLines, setLogLines] = React.useState(100);
  const [autoRefresh, setAutoRefresh] = React.useState(false);
  const [selectedFile, setSelectedFile] = React.useState<string>('');
  const [realTimeLogs, setRealTimeLogs] = React.useState<LogEntry[]>([]);
  const [wsConnected, setWsConnected] = React.useState(false);
  
  const queryClient = useQueryClient();

  // 获取日志
  const { data: logsData, isLoading, refetch } = useQuery(
    ['logs', selectedLevel, searchKeyword, logLines, selectedFile],
    () => {
      if (selectedFile) {
        return logApi.getLogFile(selectedFile, {
          lines: logLines,
          level: selectedLevel || undefined,
          keyword: searchKeyword || undefined,
        }).then(res => res.data);
      } else {
        return logApi.getLogs({
          lines: logLines,
          level: selectedLevel || undefined,
          keyword: searchKeyword || undefined,
        }).then(res => res.data);
      }
    },
    {
      refetchInterval: autoRefresh ? 3000 : false,
    }
  );

  // 获取日志级别
  const { data: logLevels } = useQuery(
    'log-levels',
    () => logApi.getLogLevels().then(res => res.data)
  );

  // 获取日志文件列表
  const { data: logFiles } = useQuery<{ files: LogFile[] }>(
    'log-files',
    () => logApi.getLogFiles().then(res => res.data)
  );

  // 清空日志
  const clearLogsMutation = useMutation(
    () => logApi.clearLogs(),
    {
      onSuccess: () => {
        message.success('日志已清空');
        refetch();
      },
      onError: (error: any) => {
        message.error(`清空日志失败: ${error.response?.data?.detail || error.message}`);
      },
    }
  );

  // 删除日志文件
  const deleteLogFileMutation = useMutation(
    (filename: string) => logApi.deleteLogFile(filename),
    {
      onSuccess: () => {
        message.success('日志文件已删除');
        queryClient.invalidateQueries('log-files');
        if (selectedFile === filename) {
          setSelectedFile('');
        }
      },
      onError: (error: any) => {
        message.error(`删除日志文件失败: ${error.response?.data?.detail || error.message}`);
      },
    }
  );

  // WebSocket 实时日志
  React.useEffect(() => {
    if (!autoRefresh) return;

    const ws = new WebSocket(`ws://${window.location.host}/api/logs/stream`);
    
    ws.onopen = () => {
      setWsConnected(true);
      console.log('日志流 WebSocket 连接已建立');
    };
    
    ws.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data);
        if (message.type === 'log_entry') {
          setRealTimeLogs(prev => [...prev.slice(-99), message.data]);
        }
      } catch (error) {
        console.error('解析日志消息失败:', error);
      }
    };
    
    ws.onclose = () => {
      setWsConnected(false);
      console.log('日志流 WebSocket 连接已关闭');
    };
    
    ws.onerror = (error) => {
      console.error('日志流 WebSocket 错误:', error);
    };

    return () => {
      ws.close();
    };
  }, [autoRefresh]);

  // 获取日志级别颜色
  const getLogLevelColor = (level: string) => {
    const colors = {
      DEBUG: 'default',
      INFO: 'blue',
      WARNING: 'orange',
      ERROR: 'red',
      CRITICAL: 'magenta',
    };
    return colors[level as keyof typeof colors] || 'default';
  };

  // 日志表格列
  const logColumns = [
    {
      title: '时间',
      dataIndex: 'timestamp',
      key: 'timestamp',
      width: 180,
      render: (timestamp: string) => (
        <Text style={{ fontFamily: 'monospace', fontSize: '12px' }}>
          {timestamp}
        </Text>
      ),
    },
    {
      title: '级别',
      dataIndex: 'level',
      key: 'level',
      width: 80,
      render: (level: string) => (
        <Tag color={getLogLevelColor(level)}>{level}</Tag>
      ),
    },
    {
      title: '消息',
      dataIndex: 'message',
      key: 'message',
      ellipsis: true,
      render: (message: string) => (
        <Text style={{ fontFamily: 'monospace', fontSize: '12px' }}>
          {message}
        </Text>
      ),
    },
    {
      title: '行号',
      dataIndex: 'line_number',
      key: 'line_number',
      width: 80,
      render: (lineNumber: number) => (
        <Text type="secondary" style={{ fontSize: '12px' }}>
          {lineNumber}
        </Text>
      ),
    },
  ];

  // 日志文件表格列
  const fileColumns = [
    {
      title: '文件名',
      dataIndex: 'name',
      key: 'name',
      render: (name: string, record: LogFile) => (
        <Space>
          <Text strong={record.is_current}>{name}</Text>
          {record.is_current && <Tag color="green">当前</Tag>}
        </Space>
      ),
    },
    {
      title: '大小',
      dataIndex: 'size',
      key: 'size',
      render: (size: number) => `${(size / 1024).toFixed(2)} KB`,
    },
    {
      title: '修改时间',
      dataIndex: 'modified',
      key: 'modified',
      render: (modified: string) => new Date(modified).toLocaleString(),
    },
    {
      title: '操作',
      key: 'actions',
      render: (_, record: LogFile) => (
        <Space>
          <Button
            size="small"
            icon={<EyeOutlined />}
            onClick={() => setSelectedFile(record.name)}
          >
            查看
          </Button>
          {!record.is_current && (
            <Popconfirm
              title="确定要删除这个日志文件吗？"
              onConfirm={() => deleteLogFileMutation.mutate(record.name)}
            >
              <Button
                danger
                size="small"
                icon={<DeleteOutlined />}
                loading={deleteLogFileMutation.isLoading}
              >
                删除
              </Button>
            </Popconfirm>
          )}
        </Space>
      ),
    },
  ];

  const displayLogs = autoRefresh && realTimeLogs.length > 0 ? realTimeLogs : logsData?.logs || [];

  return (
    <div>
      <Title level={2}>日志查看</Title>
      
      {/* 控制面板 */}
      <Card style={{ marginBottom: 16 }}>
        <Row gutter={16} align="middle">
          <Col span={4}>
            <Text strong>日志级别:</Text>
            <Select
              style={{ width: '100%', marginTop: 4 }}
              placeholder="选择级别"
              allowClear
              value={selectedLevel || undefined}
              onChange={setSelectedLevel}
            >
              {logLevels?.levels.map(level => (
                <Option key={level} value={level}>{level}</Option>
              ))}
            </Select>
          </Col>
          
          <Col span={4}>
            <Text strong>日志文件:</Text>
            <Select
              style={{ width: '100%', marginTop: 4 }}
              placeholder="当前日志"
              allowClear
              value={selectedFile || undefined}
              onChange={setSelectedFile}
            >
              {logFiles?.files.map(file => (
                <Option key={file.name} value={file.name}>
                  {file.name} {file.is_current && '(当前)'}
                </Option>
              ))}
            </Select>
          </Col>
          
          <Col span={4}>
            <Text strong>显示行数:</Text>
            <InputNumber
              style={{ width: '100%', marginTop: 4 }}
              min={10}
              max={1000}
              value={logLines}
              onChange={(value) => setLogLines(value || 100)}
            />
          </Col>
          
          <Col span={6}>
            <Text strong>关键词搜索:</Text>
            <Search
              style={{ marginTop: 4 }}
              placeholder="搜索日志内容"
              value={searchKeyword}
              onChange={(e) => setSearchKeyword(e.target.value)}
              onSearch={() => refetch()}
            />
          </Col>
          
          <Col span={6}>
            <Space direction="vertical">
              <Space>
                <Switch
                  checked={autoRefresh}
                  onChange={setAutoRefresh}
                  checkedChildren={<PlayCircleOutlined />}
                  unCheckedChildren={<PauseCircleOutlined />}
                />
                <Text>实时刷新</Text>
                {autoRefresh && (
                  <Tag color={wsConnected ? 'green' : 'red'}>
                    {wsConnected ? '已连接' : '未连接'}
                  </Tag>
                )}
              </Space>
              
              <Space>
                <Button
                  icon={<ReloadOutlined />}
                  onClick={() => refetch()}
                  loading={isLoading}
                  size="small"
                >
                  刷新
                </Button>
                
                <Popconfirm
                  title="确定要清空当前日志文件吗？"
                  onConfirm={() => clearLogsMutation.mutate()}
                >
                  <Button
                    danger
                    icon={<ClearOutlined />}
                    loading={clearLogsMutation.isLoading}
                    size="small"
                  >
                    清空
                  </Button>
                </Popconfirm>
              </Space>
            </Space>
          </Col>
        </Row>
      </Card>

      {/* 日志内容 */}
      <Card 
        title={
          <Space>
            <Text>日志内容</Text>
            {logsData && (
              <Text type="secondary">
                (显示 {logsData.filtered_lines} / {logsData.total_lines} 行)
              </Text>
            )}
          </Space>
        }
      >
        <Table
          columns={logColumns}
          dataSource={displayLogs}
          rowKey={(record, index) => `${record.timestamp}-${index}`}
          loading={isLoading}
          size="small"
          pagination={{
            pageSize: 50,
            showSizeChanger: true,
            showQuickJumper: true,
            showTotal: (total) => `共 ${total} 条日志`,
          }}
          scroll={{ x: true }}
        />
      </Card>

      {/* 日志文件管理 */}
      <Card title="日志文件管理" style={{ marginTop: 16 }}>
        <Table
          columns={fileColumns}
          dataSource={logFiles?.files}
          rowKey="name"
          size="small"
          pagination={{
            pageSize: 10,
            showTotal: (total) => `共 ${total} 个文件`,
          }}
        />
      </Card>
    </div>
  );
};

export default Logs;

