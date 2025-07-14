# AutoFilm Web UI

AutoFilm 现在包含了一个现代化的 Web 用户界面，提供实时监控、任务管理和配置管理功能。

## 🚀 新功能

### Web UI 界面
- **仪表板**: 系统概览和任务状态监控
- **任务管理**: 实时查看和控制 BDMV 处理任务
- **配置管理**: 可视化编辑 config.yaml 文件
- **日志查看**: 实时日志流和历史日志查询
- **系统监控**: 资源使用情况和性能图表

### 实时功能
- 🔄 WebSocket 实时任务状态更新
- 📊 实时系统资源监控
- 📝 实时日志流显示
- 🎯 任务进度实时跟踪

## 📦 部署方式

### Docker 部署（推荐）

```bash
# 构建镜像
docker build -t autofilm-webui .

# 运行容器
docker run -d \
  --name autofilm \
  -p 8000:8000 \
  -v /path/to/config:/config \
  -v /path/to/logs:/logs \
  -v /path/to/media:/media \
  autofilm-webui
```

### 开发环境

#### 后端开发
```bash
# 安装 Python 依赖
pip install -r requirements.txt

# 启动后端服务
python app/main.py
```

#### 前端开发
```bash
# 进入前端目录
cd webui

# 安装依赖
npm install

# 启动开发服务器
npm run dev
```

## 🌐 访问方式

启动后，您可以通过以下方式访问：

- **Web UI**: http://localhost:8000
- **API 文档**: http://localhost:8000/docs (Swagger UI)
- **健康检查**: http://localhost:8000/api/system/health

## 📱 功能说明

### 仪表板
- 任务统计概览
- 系统资源监控
- 运行中任务列表
- 最近任务历史

### 任务管理
- 查看所有 Alist2Strm 和 Ani2Alist 任务
- 手动启动/停止任务
- 实时查看任务进度
- 查看任务详细日志

### 配置管理
- 可视化编辑 config.yaml
- 配置验证和错误提示
- 自动备份和恢复功能
- 配置模板生成

### 日志查看
- 实时日志流显示
- 多级别日志过滤
- 关键词搜索功能
- 历史日志文件管理

### 系统监控
- CPU、内存、磁盘使用率
- 网络 I/O 统计
- 组件健康状态
- 性能趋势图表

## 🔧 API 接口

Web UI 提供完整的 RESTful API：

- `GET /api/tasks` - 获取任务列表
- `POST /api/tasks/trigger` - 触发任务
- `GET /api/config` - 获取配置
- `PUT /api/config` - 更新配置
- `GET /api/logs` - 获取日志
- `GET /api/system/info` - 系统信息
- `GET /api/system/health` - 健康状态

完整的 API 文档可在 `/docs` 路径查看。

## 🛠️ 技术栈

### 后端
- **FastAPI** - 现代 Python Web 框架
- **WebSocket** - 实时通信
- **Pydantic** - 数据验证
- **APScheduler** - 任务调度

### 前端
- **React 18** - 用户界面框架
- **TypeScript** - 类型安全
- **Ant Design** - UI 组件库
- **Vite** - 现代构建工具
- **React Query** - 数据状态管理
- **Recharts** - 图表组件

## 🔒 安全特性

- 配置文件自动备份
- 输入验证和错误处理
- 健康检查和监控
- 优雅的错误恢复

## 📝 更新日志

### v2.0.0 (Web UI 版本)
- ✨ 新增完整的 Web 用户界面
- 🔄 实时任务状态监控
- ⚙️ 可视化配置管理
- 📊 系统资源监控
- 📝 实时日志查看
- 🛡️ 增强的错误处理和恢复

## 🤝 贡献

欢迎提交 Issue 和 Pull Request！

## 📄 许可证

本项目采用 MIT 许可证。

