from fastapi import APIRouter, HTTPException, WebSocket
from pydantic import BaseModel
from typing import List, Optional
import asyncio
import json
from datetime import datetime
from pathlib import Path

from app.core import settings, logger

router = APIRouter()


class LogEntry(BaseModel):
    """日志条目模型"""
    timestamp: str
    level: str
    message: str
    line_number: int


class LogFilter(BaseModel):
    """日志过滤器模型"""
    level: Optional[str] = None
    keyword: Optional[str] = None
    start_time: Optional[datetime] = None
    end_time: Optional[datetime] = None


def parse_log_line(line: str, line_number: int) -> Optional[LogEntry]:
    """解析日志行"""
    try:
        # 简单的日志解析，假设格式为: [时间] [级别] 消息
        if not line.strip():
            return None
            
        # 尝试解析标准格式的日志
        parts = line.strip().split('] ', 2)
        if len(parts) >= 3:
            timestamp = parts[0].replace('[', '')
            level = parts[1].replace('[', '')
            message = parts[2]
        else:
            # 如果不是标准格式，将整行作为消息
            timestamp = datetime.now().strftime('%Y-%m-%d %H:%M:%S')
            level = 'INFO'
            message = line.strip()
        
        return LogEntry(
            timestamp=timestamp,
            level=level,
            message=message,
            line_number=line_number
        )
    except Exception:
        return None


@router.get("/")
async def get_logs(
    lines: int = 100,
    level: Optional[str] = None,
    keyword: Optional[str] = None
):
    """获取日志"""
    try:
        log_file = settings.LOG
        if not log_file.exists():
            return {
                "logs": [],
                "total_lines": 0,
                "message": "日志文件不存在"
            }
        
        with open(log_file, 'r', encoding='utf-8') as f:
            all_lines = f.readlines()
        
        # 解析日志
        parsed_logs = []
        for i, line in enumerate(all_lines, 1):
            log_entry = parse_log_line(line, i)
            if log_entry:
                # 应用过滤器
                if level and log_entry.level.upper() != level.upper():
                    continue
                if keyword and keyword.lower() not in log_entry.message.lower():
                    continue
                
                parsed_logs.append(log_entry)
        
        # 获取最后 N 行
        if lines > 0:
            parsed_logs = parsed_logs[-lines:]
        
        return {
            "logs": parsed_logs,
            "total_lines": len(all_lines),
            "filtered_lines": len(parsed_logs),
            "file_path": str(log_file)
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"读取日志失败: {str(e)}")


@router.get("/levels")
async def get_log_levels():
    """获取可用的日志级别"""
    return {
        "levels": ["DEBUG", "INFO", "WARNING", "ERROR", "CRITICAL"],
        "description": "可用的日志级别列表"
    }


@router.get("/files")
async def get_log_files():
    """获取所有日志文件"""
    try:
        log_files = []
        log_dir = settings.LOG_DIR
        
        for log_file in log_dir.glob("*.log"):
            stat = log_file.stat()
            log_files.append({
                "name": log_file.name,
                "path": str(log_file),
                "size": stat.st_size,
                "modified": datetime.fromtimestamp(stat.st_mtime),
                "is_current": log_file == settings.LOG
            })
        
        # 按修改时间倒序排列
        log_files.sort(key=lambda x: x["modified"], reverse=True)
        
        return {
            "files": log_files,
            "current_file": str(settings.LOG)
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"获取日志文件列表失败: {str(e)}")


@router.get("/file/{filename}")
async def get_log_file(
    filename: str,
    lines: int = 100,
    level: Optional[str] = None,
    keyword: Optional[str] = None
):
    """获取指定日志文件的内容"""
    try:
        log_file = settings.LOG_DIR / filename
        
        if not log_file.exists():
            raise HTTPException(status_code=404, detail="日志文件不存在")
        
        with open(log_file, 'r', encoding='utf-8') as f:
            all_lines = f.readlines()
        
        # 解析日志
        parsed_logs = []
        for i, line in enumerate(all_lines, 1):
            log_entry = parse_log_line(line, i)
            if log_entry:
                # 应用过滤器
                if level and log_entry.level.upper() != level.upper():
                    continue
                if keyword and keyword.lower() not in log_entry.message.lower():
                    continue
                
                parsed_logs.append(log_entry)
        
        # 获取最后 N 行
        if lines > 0:
            parsed_logs = parsed_logs[-lines:]
        
        return {
            "logs": parsed_logs,
            "total_lines": len(all_lines),
            "filtered_lines": len(parsed_logs),
            "file_name": filename,
            "file_path": str(log_file)
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"读取日志文件失败: {str(e)}")


@router.delete("/file/{filename}")
async def delete_log_file(filename: str):
    """删除指定的日志文件"""
    try:
        log_file = settings.LOG_DIR / filename
        
        if not log_file.exists():
            raise HTTPException(status_code=404, detail="日志文件不存在")
        
        # 不允许删除当前正在使用的日志文件
        if log_file == settings.LOG:
            raise HTTPException(status_code=400, detail="不能删除当前正在使用的日志文件")
        
        log_file.unlink()
        
        return {
            "message": "日志文件已删除",
            "filename": filename,
            "timestamp": datetime.now()
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"删除日志文件失败: {str(e)}")


@router.post("/clear")
async def clear_current_log():
    """清空当前日志文件"""
    try:
        log_file = settings.LOG
        
        # 备份当前日志
        backup_name = f"{log_file.stem}_backup_{datetime.now().strftime('%Y%m%d_%H%M%S')}.log"
        backup_path = settings.LOG_DIR / backup_name
        
        if log_file.exists():
            log_file.rename(backup_path)
        
        # 创建新的空日志文件
        log_file.touch()
        
        logger.info(f"日志文件已清空，备份保存为: {backup_name}")
        
        return {
            "message": "日志文件已清空",
            "backup_file": backup_name,
            "timestamp": datetime.now()
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"清空日志失败: {str(e)}")


@router.websocket("/stream")
async def log_stream(websocket: WebSocket):
    """实时日志流 WebSocket 端点"""
    await websocket.accept()
    
    try:
        log_file = settings.LOG
        
        # 获取文件当前大小
        if log_file.exists():
            last_size = log_file.stat().st_size
        else:
            last_size = 0
        
        while True:
            try:
                if log_file.exists():
                    current_size = log_file.stat().st_size
                    
                    # 如果文件变大了，读取新增内容
                    if current_size > last_size:
                        with open(log_file, 'r', encoding='utf-8') as f:
                            f.seek(last_size)
                            new_lines = f.readlines()
                        
                        # 发送新日志行
                        for line in new_lines:
                            log_entry = parse_log_line(line, 0)
                            if log_entry:
                                await websocket.send_text(json.dumps({
                                    "type": "log_entry",
                                    "data": log_entry.dict()
                                }, ensure_ascii=False))
                        
                        last_size = current_size
                
                # 等待一段时间再检查
                await asyncio.sleep(1)
                
            except Exception as e:
                await websocket.send_text(json.dumps({
                    "type": "error",
                    "message": f"读取日志失败: {str(e)}"
                }, ensure_ascii=False))
                break
                
    except Exception as e:
        logger.error(f"日志流 WebSocket 连接异常: {e}")
    finally:
        await websocket.close()

