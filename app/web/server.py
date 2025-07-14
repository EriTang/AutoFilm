from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
import asyncio
import json
import logging
from typing import List, Dict, Any
from pathlib import Path

from app.core import settings, logger
from .api import tasks, config, logs, system


class ConnectionManager:
    """WebSocket 连接管理器"""
    
    def __init__(self):
        self.active_connections: List[WebSocket] = []
    
    async def connect(self, websocket: WebSocket):
        await websocket.accept()
        self.active_connections.append(websocket)
        logger.info(f"WebSocket 连接建立，当前连接数: {len(self.active_connections)}")
    
    def disconnect(self, websocket: WebSocket):
        if websocket in self.active_connections:
            self.active_connections.remove(websocket)
            logger.info(f"WebSocket 连接断开，当前连接数: {len(self.active_connections)}")
    
    async def send_personal_message(self, message: str, websocket: WebSocket):
        try:
            await websocket.send_text(message)
        except Exception as e:
            logger.error(f"发送 WebSocket 消息失败: {e}")
            self.disconnect(websocket)
    
    async def broadcast(self, message: Dict[str, Any]):
        """广播消息到所有连接的客户端"""
        if not self.active_connections:
            return
            
        message_str = json.dumps(message, ensure_ascii=False)
        disconnected = []
        
        for connection in self.active_connections:
            try:
                await connection.send_text(message_str)
            except Exception as e:
                logger.error(f"广播消息失败: {e}")
                disconnected.append(connection)
        
        # 清理断开的连接
        for connection in disconnected:
            self.disconnect(connection)


# 全局连接管理器
connection_manager = ConnectionManager()


@asynccontextmanager
async def lifespan(app: FastAPI):
    """应用生命周期管理"""
    logger.info("AutoFilm Web UI 启动中...")
    
    # 启动时的初始化逻辑
    yield
    
    # 关闭时的清理逻辑
    logger.info("AutoFilm Web UI 关闭中...")


def create_app() -> FastAPI:
    """创建 FastAPI 应用实例"""
    
    app = FastAPI(
        title="AutoFilm Web UI",
        description="AutoFilm 的 Web 管理界面",
        version=settings.APP_VERSION,
        lifespan=lifespan
    )
    
    # 添加 CORS 中间件
    app.add_middleware(
        CORSMiddleware,
        allow_origins=["*"],  # 生产环境中应该限制具体域名
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )
    
    # 静态文件服务
    static_dir = Path(__file__).parent / "static"
    if static_dir.exists():
        app.mount("/static", StaticFiles(directory=str(static_dir)), name="static")
    
    # 模板引擎
    templates_dir = Path(__file__).parent / "templates"
    if templates_dir.exists():
        templates = Jinja2Templates(directory=str(templates_dir))
    
    # 注册 API 路由
    app.include_router(tasks.router, prefix="/api/tasks", tags=["任务管理"])
    app.include_router(config.router, prefix="/api/config", tags=["配置管理"])
    app.include_router(logs.router, prefix="/api/logs", tags=["日志管理"])
    app.include_router(system.router, prefix="/api/system", tags=["系统信息"])
    
    @app.get("/")
    async def root():
        """根路径，返回 Web UI"""
        return {"message": "AutoFilm Web UI", "version": settings.APP_VERSION}
    
    @app.get("/health")
    async def health_check():
        """健康检查接口"""
        return {
            "status": "healthy",
            "version": settings.APP_VERSION,
            "timestamp": asyncio.get_event_loop().time()
        }
    
    @app.websocket("/ws")
    async def websocket_endpoint(websocket: WebSocket):
        """WebSocket 端点，用于实时通信"""
        await connection_manager.connect(websocket)
        try:
            while True:
                # 接收客户端消息
                data = await websocket.receive_text()
                try:
                    message = json.loads(data)
                    logger.debug(f"收到 WebSocket 消息: {message}")
                    
                    # 处理不同类型的消息
                    if message.get("type") == "ping":
                        await connection_manager.send_personal_message(
                            json.dumps({"type": "pong", "timestamp": asyncio.get_event_loop().time()}),
                            websocket
                        )
                    
                except json.JSONDecodeError:
                    logger.warning(f"收到无效的 JSON 消息: {data}")
                    
        except WebSocketDisconnect:
            connection_manager.disconnect(websocket)
        except Exception as e:
            logger.error(f"WebSocket 连接异常: {e}")
            connection_manager.disconnect(websocket)
    
    return app


# 导出连接管理器，供其他模块使用
__all__ = ["create_app", "connection_manager"]

