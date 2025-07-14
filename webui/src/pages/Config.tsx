import React from 'react';
import { 
  Card, 
  Button, 
  Space, 
  Typography, 
  message,
  Modal,
  Table,
  Popconfirm,
  Alert,
  Tabs,
  Input,
  Switch,
  Form,
  Divider
} from 'antd';
import { useQuery, useMutation, useQueryClient } from 'react-query';
import {
  SaveOutlined,
  ReloadOutlined,
  HistoryOutlined,
  CheckCircleOutlined,
  ExclamationCircleOutlined,
  DeleteOutlined,
  DownloadOutlined,
} from '@ant-design/icons';
import { configApi } from '../utils/api';
import { ConfigData } from '../types';

const { Title, Text, Paragraph } = Typography;
const { TextArea } = Input;
const { TabPane } = Tabs;

interface ConfigBackup {
  filename: string;
  timestamp: string;
  size: number;
}

const Config: React.FC = () => {
  const [configText, setConfigText] = React.useState('');
  const [isEditing, setIsEditing] = React.useState(false);
  const [validationResult, setValidationResult] = React.useState<any>(null);
  
  const queryClient = useQueryClient();

  // 获取当前配置
  const { data: configData, isLoading } = useQuery<ConfigData>(
    'config',
    () => configApi.getConfig().then(res => res.data),
    {
      onSuccess: (data) => {
        setConfigText(JSON.stringify(data.config, null, 2));
      },
    }
  );

  // 获取配置备份列表
  const { data: backups } = useQuery<ConfigBackup[]>(
    'config-backups',
    () => configApi.getBackups().then(res => res.data)
  );

  // 获取配置模板
  const { data: template } = useQuery(
    'config-template',
    () => configApi.getTemplate().then(res => res.data)
  );

  // 更新配置
  const updateConfigMutation = useMutation(
    (config: Record<string, any>) => configApi.updateConfig(config, true),
    {
      onSuccess: () => {
        message.success('配置更新成功');
        setIsEditing(false);
        queryClient.invalidateQueries('config');
        queryClient.invalidateQueries('config-backups');
      },
      onError: (error: any) => {
        message.error(`配置更新失败: ${error.response?.data?.detail || error.message}`);
      },
    }
  );

  // 验证配置
  const validateConfigMutation = useMutation(
    () => configApi.validateConfig(),
    {
      onSuccess: (response) => {
        setValidationResult(response.data);
        if (response.data.valid) {
          message.success('配置验证通过');
        } else {
          message.warning('配置验证发现问题');
        }
      },
      onError: (error: any) => {
        message.error(`配置验证失败: ${error.response?.data?.detail || error.message}`);
      },
    }
  );

  // 恢复配置
  const restoreConfigMutation = useMutation(
    (filename: string) => configApi.restoreConfig(filename),
    {
      onSuccess: () => {
        message.success('配置恢复成功');
        queryClient.invalidateQueries('config');
        queryClient.invalidateQueries('config-backups');
      },
      onError: (error: any) => {
        message.error(`配置恢复失败: ${error.response?.data?.detail || error.message}`);
      },
    }
  );

  // 删除备份
  const deleteBackupMutation = useMutation(
    (filename: string) => configApi.deleteBackup(filename),
    {
      onSuccess: () => {
        message.success('备份删除成功');
        queryClient.invalidateQueries('config-backups');
      },
      onError: (error: any) => {
        message.error(`删除备份失败: ${error.response?.data?.detail || error.message}`);
      },
    }
  );

  // 保存配置
  const handleSaveConfig = () => {
    try {
      const config = JSON.parse(configText);
      updateConfigMutation.mutate(config);
    } catch (error) {
      message.error('配置格式错误，请检查 JSON 语法');
    }
  };

  // 重置配置
  const handleResetConfig = () => {
    if (configData) {
      setConfigText(JSON.stringify(configData.config, null, 2));
      setIsEditing(false);
    }
  };

  // 使用模板
  const handleUseTemplate = () => {
    if (template) {
      setConfigText(JSON.stringify(template.template, null, 2));
      setIsEditing(true);
    }
  };

  // 格式化 JSON
  const handleFormatJson = () => {
    try {
      const config = JSON.parse(configText);
      setConfigText(JSON.stringify(config, null, 2));
    } catch (error) {
      message.error('JSON 格式错误，无法格式化');
    }
  };

  // 备份表格列
  const backupColumns = [
    {
      title: '文件名',
      dataIndex: 'filename',
      key: 'filename',
    },
    {
      title: '创建时间',
      dataIndex: 'timestamp',
      key: 'timestamp',
      render: (timestamp: string) => new Date(timestamp).toLocaleString(),
    },
    {
      title: '文件大小',
      dataIndex: 'size',
      key: 'size',
      render: (size: number) => `${(size / 1024).toFixed(2)} KB`,
    },
    {
      title: '操作',
      key: 'actions',
      render: (_, record: ConfigBackup) => (
        <Space>
          <Button
            type="primary"
            size="small"
            icon={<DownloadOutlined />}
            onClick={() => restoreConfigMutation.mutate(record.filename)}
            loading={restoreConfigMutation.isLoading}
          >
            恢复
          </Button>
          <Popconfirm
            title="确定要删除这个备份吗？"
            onConfirm={() => deleteBackupMutation.mutate(record.filename)}
          >
            <Button
              danger
              size="small"
              icon={<DeleteOutlined />}
              loading={deleteBackupMutation.isLoading}
            >
              删除
            </Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <div>
      <Title level={2}>配置管理</Title>
      
      <Tabs defaultActiveKey="editor">
        <TabPane tab="配置编辑器" key="editor">
          <Card
            title="配置文件编辑"
            extra={
              <Space>
                <Button
                  icon={<CheckCircleOutlined />}
                  onClick={() => validateConfigMutation.mutate()}
                  loading={validateConfigMutation.isLoading}
                >
                  验证配置
                </Button>
                <Button
                  icon={<ReloadOutlined />}
                  onClick={handleResetConfig}
                  disabled={!isEditing}
                >
                  重置
                </Button>
                <Button
                  type="primary"
                  icon={<SaveOutlined />}
                  onClick={handleSaveConfig}
                  loading={updateConfigMutation.isLoading}
                  disabled={!isEditing}
                >
                  保存配置
                </Button>
              </Space>
            }
          >
            {/* 验证结果 */}
            {validationResult && (
              <div style={{ marginBottom: 16 }}>
                <Alert
                  message={validationResult.valid ? '配置验证通过' : '配置验证失败'}
                  type={validationResult.valid ? 'success' : 'error'}
                  showIcon
                  description={
                    <div>
                      {validationResult.errors?.length > 0 && (
                        <div>
                          <Text strong>错误:</Text>
                          <ul>
                            {validationResult.errors.map((error: string, index: number) => (
                              <li key={index}>{error}</li>
                            ))}
                          </ul>
                        </div>
                      )}
                      {validationResult.warnings?.length > 0 && (
                        <div>
                          <Text strong>警告:</Text>
                          <ul>
                            {validationResult.warnings.map((warning: string, index: number) => (
                              <li key={index}>{warning}</li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
                  }
                />
              </div>
            )}

            <Space style={{ marginBottom: 16 }}>
              <Button onClick={handleFormatJson}>格式化 JSON</Button>
              <Button onClick={handleUseTemplate}>使用模板</Button>
            </Space>

            <TextArea
              value={configText}
              onChange={(e) => {
                setConfigText(e.target.value);
                setIsEditing(true);
              }}
              placeholder="配置文件内容 (JSON 格式)"
              rows={20}
              style={{ fontFamily: 'monospace', fontSize: '12px' }}
            />

            {configData && (
              <div style={{ marginTop: 16 }}>
                <Text type="secondary">
                  配置文件路径: {configData.file_path}
                </Text>
                <br />
                <Text type="secondary">
                  最后修改: {new Date(configData.last_modified).toLocaleString()}
                </Text>
              </div>
            )}
          </Card>
        </TabPane>

        <TabPane tab="备份管理" key="backups">
          <Card title="配置备份">
            <Table
              columns={backupColumns}
              dataSource={backups}
              rowKey="filename"
              pagination={{
                pageSize: 10,
                showTotal: (total) => `共 ${total} 个备份`,
              }}
            />
          </Card>
        </TabPane>

        <TabPane tab="配置模板" key="template">
          <Card 
            title="配置模板"
            extra={
              <Button type="primary" onClick={handleUseTemplate}>
                使用此模板
              </Button>
            }
          >
            {template && (
              <div>
                <Paragraph>{template.description}</Paragraph>
                <pre style={{ 
                  background: '#f5f5f5', 
                  padding: '16px', 
                  borderRadius: '6px',
                  fontSize: '12px',
                  overflow: 'auto',
                  maxHeight: '500px'
                }}>
                  {JSON.stringify(template.template, null, 2)}
                </pre>
              </div>
            )}
          </Card>
        </TabPane>
      </Tabs>
    </div>
  );
};

export default Config;

