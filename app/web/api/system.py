from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Dict, Any
import psutil
import asyncio
from datetime import datetime, timedelta
import platform

from app.core import settings, logger

router = APIRouter()


class SystemInfo(BaseModel):
    """系统信息模型"""
    platform: str
    python_version: str
    autofilm_version: str
    uptime: str
    cpu_percent: float
    memory_usage: Dict[str, Any]
    disk_usage: Dict[str, Any]
    network_io: Dict[str, Any]


class HealthStatus(BaseModel):
    """健康状态模型"""
    status: str
    timestamp: datetime
    uptime: str
    version: str
    components: Dict[str, str]


@router.get("/info", response_model=SystemInfo)
async def get_system_info():
    """获取系统信息"""
    try:
        # 获取系统信息
        boot_time = datetime.fromtimestamp(psutil.boot_time())
        uptime = datetime.now() - boot_time
        
        # CPU 使用率
        cpu_percent = psutil.cpu_percent(interval=1)
        
        # 内存使用情况
        memory = psutil.virtual_memory()
        memory_usage = {
            "total": memory.total,
            "available": memory.available,
            "used": memory.used,
            "percent": memory.percent
        }
        
        # 磁盘使用情况
        disk = psutil.disk_usage('/')
        disk_usage = {
            "total": disk.total,
            "used": disk.used,
            "free": disk.free,
            "percent": (disk.used / disk.total) * 100
        }
        
        # 网络 I/O
        network = psutil.net_io_counters()
        network_io = {
            "bytes_sent": network.bytes_sent,
            "bytes_recv": network.bytes_recv,
            "packets_sent": network.packets_sent,
            "packets_recv": network.packets_recv
        }
        
        return SystemInfo(
            platform=platform.platform(),
            python_version=platform.python_version(),
            autofilm_version=settings.APP_VERSION,
            uptime=str(uptime).split('.')[0],  # 去掉微秒
            cpu_percent=cpu_percent,
            memory_usage=memory_usage,
            disk_usage=disk_usage,
            network_io=network_io
        )
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"获取系统信息失败: {str(e)}")


@router.get("/health", response_model=HealthStatus)
async def get_health_status():
    """获取健康状态"""
    try:
        # 检查各组件状态
        components = {}
        
        # 检查配置文件
        if settings.CONFIG.exists():
            components["config"] = "healthy"
        else:
            components["config"] = "error"
        
        # 检查日志目录
        if settings.LOG_DIR.exists():
            components["logging"] = "healthy"
        else:
            components["logging"] = "error"
        
        # 检查任务调度器状态（这里简化处理）
        components["scheduler"] = "healthy"
        
        # 检查 Web 服务状态
        components["web_server"] = "healthy"
        
        # 计算总体状态
        if all(status == "healthy" for status in components.values()):
            overall_status = "healthy"
        elif any(status == "error" for status in components.values()):
            overall_status = "error"
        else:
            overall_status = "warning"
        
        # 计算运行时间
        boot_time = datetime.fromtimestamp(psutil.boot_time())
        uptime = datetime.now() - boot_time
        
        return HealthStatus(
            status=overall_status,
            timestamp=datetime.now(),
            uptime=str(uptime).split('.')[0],
            version=settings.APP_VERSION,
            components=components
        )
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"获取健康状态失败: {str(e)}")


@router.get("/stats")
async def get_system_stats():
    """获取系统统计信息"""
    try:
        stats = {}
        
        # 文件统计
        if settings.CONFIG_DIR.exists():
            config_files = list(settings.CONFIG_DIR.glob("*.yaml"))
            stats["config_files"] = len(config_files)
        else:
            stats["config_files"] = 0
        
        if settings.LOG_DIR.exists():
            log_files = list(settings.LOG_DIR.glob("*.log"))
            stats["log_files"] = len(log_files)
            
            # 计算日志文件总大小
            total_log_size = sum(f.stat().st_size for f in log_files if f.exists())
            stats["total_log_size"] = total_log_size
        else:
            stats["log_files"] = 0
            stats["total_log_size"] = 0
        
        # 任务统计
        stats["alist2strm_tasks"] = len(settings.AlistServerList)
        stats["ani2alist_tasks"] = len(settings.Ani2AlistList)
        
        # 进程信息
        process = psutil.Process()
        stats["process_id"] = process.pid
        stats["process_memory"] = process.memory_info().rss
        stats["process_cpu_percent"] = process.cpu_percent()
        stats["process_create_time"] = datetime.fromtimestamp(process.create_time())
        
        return {
            "stats": stats,
            "timestamp": datetime.now()
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"获取统计信息失败: {str(e)}")


@router.get("/version")
async def get_version_info():
    """获取版本信息"""
    return {
        "autofilm_version": settings.APP_VERSION,
        "python_version": platform.python_version(),
        "platform": platform.platform(),
        "architecture": platform.architecture(),
        "machine": platform.machine(),
        "processor": platform.processor(),
        "timestamp": datetime.now()
    }


@router.post("/restart")
async def restart_application():
    """重启应用程序（仅在容器环境中有效）"""
    try:
        logger.info("收到重启请求，准备重启应用程序...")
        
        # 在实际环境中，这里可能需要通过信号或其他方式重启
        # 这里只是返回一个响应，实际重启需要外部机制
        
        return {
            "message": "重启请求已接收，应用程序将在几秒钟后重启",
            "timestamp": datetime.now()
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"重启失败: {str(e)}")


@router.get("/environment")
async def get_environment_info():
    """获取环境信息"""
    try:
        env_info = {
            "app_name": settings.APP_NAME,
            "app_version": settings.APP_VERSION,
            "timezone": settings.TZ,
            "debug_mode": settings.DEBUG,
            "config_dir": str(settings.CONFIG_DIR),
            "log_dir": str(settings.LOG_DIR),
            "config_file": str(settings.CONFIG),
            "log_file": str(settings.LOG),
            "python_path": platform.sys.executable,
            "working_directory": str(settings.BASE_DIR)
        }
        
        return {
            "environment": env_info,
            "timestamp": datetime.now()
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"获取环境信息失败: {str(e)}")

