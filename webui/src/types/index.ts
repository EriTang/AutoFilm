export interface TaskStatus {
  id: string;
  name: string;
  type: 'alist2strm' | 'ani2alist';
  status: 'running' | 'stopped' | 'error' | 'completed';
  progress: number;
  message: string;
  last_run?: string;
  next_run?: string;
  config: Record<string, any>;
}

export interface LogEntry {
  timestamp: string;
  level: string;
  message: string;
  line_number: number;
}

export interface SystemInfo {
  platform: string;
  python_version: string;
  autofilm_version: string;
  uptime: string;
  cpu_percent: number;
  memory_usage: {
    total: number;
    available: number;
    used: number;
    percent: number;
  };
  disk_usage: {
    total: number;
    used: number;
    free: number;
    percent: number;
  };
  network_io: {
    bytes_sent: number;
    bytes_recv: number;
    packets_sent: number;
    packets_recv: number;
  };
}

export interface HealthStatus {
  status: 'healthy' | 'warning' | 'error';
  timestamp: string;
  uptime: string;
  version: string;
  components: Record<string, string>;
}

export interface ConfigData {
  config: Record<string, any>;
  file_path: string;
  last_modified: string;
}

export interface WebSocketMessage {
  type: string;
  data?: any;
  message?: string;
}

export interface ApiResponse<T = any> {
  data?: T;
  message?: string;
  timestamp?: string;
}

