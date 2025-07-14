from fastapi import APIRouter, HTTPException, BackgroundTasks
from pydantic import BaseModel
from typing import List, Dict, Any, Optional
import asyncio
from datetime import datetime

from app.core import settings, logger
from app.modules import Alist2Strm, Ani2Alist
from ..server import connection_manager

router = APIRouter()


class TaskStatus(BaseModel):
    """任务状态模型"""
    id: str
    name: str
    type: str  # alist2strm, ani2alist
    status: str  # running, stopped, error, completed
    progress: float = 0.0
    message: str = ""
    last_run: Optional[datetime] = None
    next_run: Optional[datetime] = None
    config: Dict[str, Any] = {}


class TaskTriggerRequest(BaseModel):
    """手动触发任务请求模型"""
    task_id: str
    force: bool = False


# 全局任务状态存储
task_statuses: Dict[str, TaskStatus] = {}
running_tasks: Dict[str, asyncio.Task] = {}


async def update_task_status(task_id: str, status: str, progress: float = 0.0, message: str = ""):
    """更新任务状态并广播到前端"""
    if task_id in task_statuses:
        task_statuses[task_id].status = status
        task_statuses[task_id].progress = progress
        task_statuses[task_id].message = message
        task_statuses[task_id].last_run = datetime.now()
        
        # 广播状态更新到所有连接的客户端
        await connection_manager.broadcast({
            "type": "task_status_update",
            "data": task_statuses[task_id].dict()
        })


async def run_alist2strm_task(server_config: Dict[str, Any], task_id: str):
    """运行 Alist2Strm 任务"""
    try:
        await update_task_status(task_id, "running", 0.0, "开始处理 Alist2Strm 任务")
        
        # 创建 Alist2Strm 实例
        alist2strm = Alist2Strm(**server_config)
        
        # 运行任务
        await alist2strm.run()
        
        await update_task_status(task_id, "completed", 100.0, "Alist2Strm 任务完成")
        logger.info(f"Alist2Strm 任务 {task_id} 执行完成")
        
    except Exception as e:
        error_msg = f"Alist2Strm 任务执行失败: {str(e)}"
        await update_task_status(task_id, "error", 0.0, error_msg)
        logger.error(error_msg)
    finally:
        # 清理运行中的任务记录
        if task_id in running_tasks:
            del running_tasks[task_id]


async def run_ani2alist_task(server_config: Dict[str, Any], task_id: str):
    """运行 Ani2Alist 任务"""
    try:
        await update_task_status(task_id, "running", 0.0, "开始处理 Ani2Alist 任务")
        
        # 创建 Ani2Alist 实例
        ani2alist = Ani2Alist(**server_config)
        
        # 运行任务
        await ani2alist.run()
        
        await update_task_status(task_id, "completed", 100.0, "Ani2Alist 任务完成")
        logger.info(f"Ani2Alist 任务 {task_id} 执行完成")
        
    except Exception as e:
        error_msg = f"Ani2Alist 任务执行失败: {str(e)}"
        await update_task_status(task_id, "error", 0.0, error_msg)
        logger.error(error_msg)
    finally:
        # 清理运行中的任务记录
        if task_id in running_tasks:
            del running_tasks[task_id]


def initialize_task_statuses():
    """初始化任务状态"""
    task_statuses.clear()
    
    # 初始化 Alist2Strm 任务状态
    for server in settings.AlistServerList:
        task_id = server.get("id", f"alist2strm_{len(task_statuses)}")
        task_statuses[task_id] = TaskStatus(
            id=task_id,
            name=server.get("name", task_id),
            type="alist2strm",
            status="stopped",
            config=server
        )
    
    # 初始化 Ani2Alist 任务状态
    for server in settings.Ani2AlistList:
        task_id = server.get("id", f"ani2alist_{len(task_statuses)}")
        task_statuses[task_id] = TaskStatus(
            id=task_id,
            name=server.get("name", task_id),
            type="ani2alist",
            status="stopped",
            config=server
        )


@router.get("/", response_model=List[TaskStatus])
async def get_tasks():
    """获取所有任务状态"""
    if not task_statuses:
        initialize_task_statuses()
    
    return list(task_statuses.values())


@router.get("/{task_id}", response_model=TaskStatus)
async def get_task(task_id: str):
    """获取指定任务状态"""
    if task_id not in task_statuses:
        raise HTTPException(status_code=404, detail="任务不存在")
    
    return task_statuses[task_id]


@router.post("/trigger")
async def trigger_task(request: TaskTriggerRequest, background_tasks: BackgroundTasks):
    """手动触发任务"""
    task_id = request.task_id
    
    if task_id not in task_statuses:
        raise HTTPException(status_code=404, detail="任务不存在")
    
    task_status = task_statuses[task_id]
    
    # 检查任务是否正在运行
    if task_id in running_tasks and not request.force:
        raise HTTPException(status_code=400, detail="任务正在运行中")
    
    # 如果强制执行，先停止现有任务
    if request.force and task_id in running_tasks:
        running_tasks[task_id].cancel()
        del running_tasks[task_id]
    
    # 根据任务类型启动相应的任务
    if task_status.type == "alist2strm":
        task = asyncio.create_task(run_alist2strm_task(task_status.config, task_id))
        running_tasks[task_id] = task
    elif task_status.type == "ani2alist":
        task = asyncio.create_task(run_ani2alist_task(task_status.config, task_id))
        running_tasks[task_id] = task
    else:
        raise HTTPException(status_code=400, detail="未知的任务类型")
    
    return {"message": f"任务 {task_id} 已启动", "task_id": task_id}


@router.post("/{task_id}/stop")
async def stop_task(task_id: str):
    """停止指定任务"""
    if task_id not in task_statuses:
        raise HTTPException(status_code=404, detail="任务不存在")
    
    if task_id not in running_tasks:
        raise HTTPException(status_code=400, detail="任务未在运行")
    
    # 取消任务
    running_tasks[task_id].cancel()
    del running_tasks[task_id]
    
    # 更新状态
    await update_task_status(task_id, "stopped", 0.0, "任务已手动停止")
    
    return {"message": f"任务 {task_id} 已停止"}


@router.get("/{task_id}/logs")
async def get_task_logs(task_id: str, lines: int = 100):
    """获取指定任务的日志"""
    if task_id not in task_statuses:
        raise HTTPException(status_code=404, detail="任务不存在")
    
    # 这里可以实现读取特定任务的日志
    # 暂时返回通用日志
    try:
        with open(settings.LOG, 'r', encoding='utf-8') as f:
            log_lines = f.readlines()
            return {
                "task_id": task_id,
                "logs": log_lines[-lines:] if lines > 0 else log_lines,
                "total_lines": len(log_lines)
            }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"读取日志失败: {str(e)}")


# 初始化任务状态
initialize_task_statuses()

