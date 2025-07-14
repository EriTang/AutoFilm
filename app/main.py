from asyncio import get_event_loop
from sys import path
from os.path import dirname
import threading
import uvicorn

path.append(dirname(dirname(__file__)))

from apscheduler.schedulers.asyncio import AsyncIOScheduler  # type:ignore
from apscheduler.triggers.cron import CronTrigger  # type:ignore

from app.core import settings, logger
from app.extensions import LOGO
from app.modules import Alist2Strm, Ani2Alist
from app.web import create_app


def print_logo() -> None:
    """
    打印 Logo
    """

    print(LOGO)
    print(f" {settings.APP_NAME} {settings.APP_VERSION} ".center(65, "="))
    print("")


def start_web_server():
    """启动 Web 服务器"""
    try:
        app = create_app()
        logger.info("启动 Web UI 服务器，监听端口 8000")
        uvicorn.run(
            app,
            host="0.0.0.0",
            port=8000,
            log_level="info",
            access_log=False  # 避免重复日志
        )
    except Exception as e:
        logger.error(f"Web 服务器启动失败: {e}")


if __name__ == "__main__":
    print_logo()

    logger.info(f"AutoFilm {settings.APP_VERSION} 启动中...")
    logger.debug(f"是否开启 DEBUG 模式: {settings.DEBUG}")

    # 启动 Web 服务器（在后台线程中运行）
    web_thread = threading.Thread(target=start_web_server, daemon=True)
    web_thread.start()
    logger.info("Web UI 服务器已在后台启动")

    scheduler = AsyncIOScheduler()

    if settings.AlistServerList:
        logger.info("检测到 Alist2Strm 模块配置，正在添加至后台任务")
        for server in settings.AlistServerList:
            cron = server.get("cron")
            if cron:
                scheduler.add_job(
                    Alist2Strm(**server).run, trigger=CronTrigger.from_crontab(cron)
                )
                logger.info(f"{server['id']} 已被添加至后台任务")
            else:
                logger.warning(f"{server['id']} 未设置 cron")
    else:
        logger.warning("未检测到 Alist2Strm 模块配置")

    if settings.Ani2AlistList:
        logger.info("检测到 Ani2Alist 模块配置，正在添加至后台任务")
        for server in settings.Ani2AlistList:
            cron = server.get("cron")
            if cron:
                scheduler.add_job(
                    Ani2Alist(**server).run, trigger=CronTrigger.from_crontab(cron)
                )
                logger.info(f"{server['id']} 已被添加至后台任务")
            else:
                logger.warning(f"{server['id']} 未设置 cron")
    else:
        logger.warning("未检测到 Ani2Alist 模块配置")

    scheduler.start()
    logger.info("AutoFilm 启动完成")
    logger.info("Web UI 访问地址: http://localhost:8000")

    try:
        get_event_loop().run_forever()
    except (KeyboardInterrupt, SystemExit):
        logger.info("AutoFilm 程序退出！")
