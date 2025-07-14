from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Dict, Any, List
import yaml
import shutil
from datetime import datetime

from app.core import settings, logger

router = APIRouter()


class ConfigUpdateRequest(BaseModel):
    """配置更新请求模型"""
    config: Dict[str, Any]
    backup: bool = True


class ConfigBackup(BaseModel):
    """配置备份信息模型"""
    filename: str
    timestamp: datetime
    size: int


@router.get("/")
async def get_config():
    """获取当前配置"""
    try:
        with open(settings.CONFIG, 'r', encoding='utf-8') as f:
            config = yaml.safe_load(f)
        
        return {
            "config": config,
            "file_path": str(settings.CONFIG),
            "last_modified": datetime.fromtimestamp(settings.CONFIG.stat().st_mtime)
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"读取配置失败: {str(e)}")


@router.put("/")
async def update_config(request: ConfigUpdateRequest):
    """更新配置"""
    try:
        # 备份现有配置
        if request.backup:
            backup_filename = f"config_backup_{datetime.now().strftime('%Y%m%d_%H%M%S')}.yaml"
            backup_path = settings.CONFIG_DIR / backup_filename
            shutil.copy2(settings.CONFIG, backup_path)
            logger.info(f"配置已备份到: {backup_path}")
        
        # 验证配置格式
        try:
            yaml.safe_dump(request.config)
        except yaml.YAMLError as e:
            raise HTTPException(status_code=400, detail=f"配置格式无效: {str(e)}")
        
        # 写入新配置
        with open(settings.CONFIG, 'w', encoding='utf-8') as f:
            yaml.safe_dump(request.config, f, default_flow_style=False, allow_unicode=True)
        
        logger.info("配置文件已更新")
        
        return {
            "message": "配置更新成功",
            "backup_created": request.backup,
            "timestamp": datetime.now()
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"更新配置失败: {str(e)}")


@router.get("/validate")
async def validate_config():
    """验证当前配置"""
    try:
        with open(settings.CONFIG, 'r', encoding='utf-8') as f:
            config = yaml.safe_load(f)
        
        errors = []
        warnings = []
        
        # 验证 Alist2Strm 配置
        if "Alist2StrmList" in config:
            for i, server in enumerate(config["Alist2StrmList"]):
                if not server.get("url"):
                    errors.append(f"Alist2StrmList[{i}]: 缺少 url 配置")
                if not server.get("id"):
                    warnings.append(f"Alist2StrmList[{i}]: 建议设置 id")
                if not server.get("cron"):
                    warnings.append(f"Alist2StrmList[{i}]: 未设置 cron，任务不会自动执行")
        
        # 验证 Ani2Alist 配置
        if "Ani2AlistList" in config:
            for i, server in enumerate(config["Ani2AlistList"]):
                if not server.get("id"):
                    warnings.append(f"Ani2AlistList[{i}]: 建议设置 id")
                if not server.get("cron"):
                    warnings.append(f"Ani2AlistList[{i}]: 未设置 cron，任务不会自动执行")
        
        return {
            "valid": len(errors) == 0,
            "errors": errors,
            "warnings": warnings,
            "timestamp": datetime.now()
        }
        
    except Exception as e:
        return {
            "valid": False,
            "errors": [f"配置文件读取失败: {str(e)}"],
            "warnings": [],
            "timestamp": datetime.now()
        }


@router.get("/backups")
async def get_config_backups():
    """获取配置备份列表"""
    try:
        backups = []
        for backup_file in settings.CONFIG_DIR.glob("config_backup_*.yaml"):
            stat = backup_file.stat()
            backups.append(ConfigBackup(
                filename=backup_file.name,
                timestamp=datetime.fromtimestamp(stat.st_mtime),
                size=stat.st_size
            ))
        
        # 按时间倒序排列
        backups.sort(key=lambda x: x.timestamp, reverse=True)
        
        return backups
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"获取备份列表失败: {str(e)}")


@router.post("/restore/{backup_filename}")
async def restore_config(backup_filename: str):
    """从备份恢复配置"""
    try:
        backup_path = settings.CONFIG_DIR / backup_filename
        
        if not backup_path.exists():
            raise HTTPException(status_code=404, detail="备份文件不存在")
        
        # 验证备份文件
        with open(backup_path, 'r', encoding='utf-8') as f:
            backup_config = yaml.safe_load(f)
        
        # 备份当前配置
        current_backup = f"config_before_restore_{datetime.now().strftime('%Y%m%d_%H%M%S')}.yaml"
        shutil.copy2(settings.CONFIG, settings.CONFIG_DIR / current_backup)
        
        # 恢复配置
        shutil.copy2(backup_path, settings.CONFIG)
        
        logger.info(f"配置已从备份 {backup_filename} 恢复")
        
        return {
            "message": "配置恢复成功",
            "restored_from": backup_filename,
            "current_backup": current_backup,
            "timestamp": datetime.now()
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"恢复配置失败: {str(e)}")


@router.delete("/backups/{backup_filename}")
async def delete_config_backup(backup_filename: str):
    """删除配置备份"""
    try:
        backup_path = settings.CONFIG_DIR / backup_filename
        
        if not backup_path.exists():
            raise HTTPException(status_code=404, detail="备份文件不存在")
        
        backup_path.unlink()
        
        return {
            "message": "备份文件已删除",
            "filename": backup_filename,
            "timestamp": datetime.now()
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"删除备份失败: {str(e)}")


@router.get("/template")
async def get_config_template():
    """获取配置模板"""
    template = {
        "Settings": {
            "DEV": False
        },
        "Alist2StrmList": [
            {
                "id": "alist_server_1",
                "url": "http://localhost:5244",
                "username": "admin",
                "password": "password",
                "token": "",
                "source_dir": "/",
                "target_dir": "/media",
                "flatten_mode": False,
                "subtitle": True,
                "image": True,
                "nfo": True,
                "mode": "RawURL",
                "overwrite": False,
                "sync_server": True,
                "max_workers": 50,
                "max_downloaders": 5,
                "wait_time": 0,
                "cron": "0 2 * * *"
            }
        ],
        "Ani2AlistList": [
            {
                "id": "ani2alist_1",
                "src_domain": "example.com",
                "dst_domain": "your-alist.com",
                "dst_token": "your-alist-token",
                "cron": "0 3 * * *"
            }
        ]
    }
    
    return {
        "template": template,
        "description": "AutoFilm 配置文件模板，包含所有可用选项和默认值"
    }

