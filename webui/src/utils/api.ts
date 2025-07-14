import axios from 'axios';
import { TaskStatus, LogEntry, SystemInfo, HealthStatus, ConfigData } from '../types';

const api = axios.create({
  baseURL: '/api',
  timeout: 10000,
});

// 请求拦截器
api.interceptors.request.use(
  (config) => {
    console.log(`API Request: ${config.method?.toUpperCase()} ${config.url}`);
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// 响应拦截器
api.interceptors.response.use(
  (response) => {
    return response;
  },
  (error) => {
    console.error('API Error:', error.response?.data || error.message);
    return Promise.reject(error);
  }
);

// 任务管理 API
export const taskApi = {
  // 获取所有任务
  getTasks: () => api.get<TaskStatus[]>('/tasks'),
  
  // 获取指定任务
  getTask: (taskId: string) => api.get<TaskStatus>(`/tasks/${taskId}`),
  
  // 触发任务
  triggerTask: (taskId: string, force = false) => 
    api.post('/tasks/trigger', { task_id: taskId, force }),
  
  // 停止任务
  stopTask: (taskId: string) => api.post(`/tasks/${taskId}/stop`),
  
  // 获取任务日志
  getTaskLogs: (taskId: string, lines = 100) => 
    api.get(`/tasks/${taskId}/logs`, { params: { lines } }),
};

// 配置管理 API
export const configApi = {
  // 获取配置
  getConfig: () => api.get<ConfigData>('/config'),
  
  // 更新配置
  updateConfig: (config: Record<string, any>, backup = true) =>
    api.put('/config', { config, backup }),
  
  // 验证配置
  validateConfig: () => api.get('/config/validate'),
  
  // 获取配置备份列表
  getBackups: () => api.get('/config/backups'),
  
  // 恢复配置
  restoreConfig: (filename: string) => api.post(`/config/restore/${filename}`),
  
  // 删除备份
  deleteBackup: (filename: string) => api.delete(`/config/backups/${filename}`),
  
  // 获取配置模板
  getTemplate: () => api.get('/config/template'),
};

// 日志管理 API
export const logApi = {
  // 获取日志
  getLogs: (params?: { lines?: number; level?: string; keyword?: string }) =>
    api.get<{ logs: LogEntry[]; total_lines: number; filtered_lines: number }>('/logs', { params }),
  
  // 获取日志级别
  getLogLevels: () => api.get<{ levels: string[] }>('/logs/levels'),
  
  // 获取日志文件列表
  getLogFiles: () => api.get('/logs/files'),
  
  // 获取指定日志文件
  getLogFile: (filename: string, params?: { lines?: number; level?: string; keyword?: string }) =>
    api.get(`/logs/file/${filename}`, { params }),
  
  // 删除日志文件
  deleteLogFile: (filename: string) => api.delete(`/logs/file/${filename}`),
  
  // 清空当前日志
  clearLogs: () => api.post('/logs/clear'),
};

// 系统信息 API
export const systemApi = {
  // 获取系统信息
  getSystemInfo: () => api.get<SystemInfo>('/system/info'),
  
  // 获取健康状态
  getHealthStatus: () => api.get<HealthStatus>('/system/health'),
  
  // 获取统计信息
  getStats: () => api.get('/system/stats'),
  
  // 获取版本信息
  getVersion: () => api.get('/system/version'),
  
  // 重启应用
  restart: () => api.post('/system/restart'),
  
  // 获取环境信息
  getEnvironment: () => api.get('/system/environment'),
};

export default api;

