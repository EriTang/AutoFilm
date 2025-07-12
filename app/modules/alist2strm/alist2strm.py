from asyncio import to_thread, Semaphore, TaskGroup
from os import PathLike
from pathlib import Path
from re import compile as re_compile

from aiofile import async_open

from app.core import logger
from app.utils import RequestUtils
from app.extensions import VIDEO_EXTS, SUBTITLE_EXTS, IMAGE_EXTS, NFO_EXTS
from app.modules.alist import AlistClient, AlistPath


class Alist2Strm:
    def __init__(
        self,
        url: str = "http://localhost:5244",
        username: str = "",
        password: str = "",
        token: str = "",
        source_dir: str = "/",
        target_dir: str | PathLike = "",
        flatten_mode: bool = False,
        subtitle: bool = False,
        image: bool = False,
        nfo: bool = False,
        mode: str = "AlistURL",
        overwrite: bool = False,
        other_ext: str = "",
        max_workers: int = 50,
        max_downloaders: int = 5,
        wait_time: float | int = 0,
        sync_server: bool = False,
        sync_ignore: str | None = None,
        **_,
    ) -> None:
        """
        实例化 Alist2Strm 对象

        :param url: Alist 服务器地址，默认为 "http://localhost:5244"
        :param username: Alist 用户名，默认为空
        :param password: Alist 密码，默认为空
        :param token: Alist 永久令牌，默认为空
        :param source_dir: 需要同步的 Alist 的目录，默认为 "/"
        :param target_dir: strm 文件输出目录，默认为当前工作目录
        :param flatten_mode: 平铺模式，将所有 Strm 文件保存至同一级目录，默认为 False
        :param subtitle: 是否下载字幕文件，默认为 False
        :param image: 是否下载图片文件，默认为 False
        :param nfo: 是否下载 .nfo 文件，默认为 False
        :param mode: Strm模式(AlistURL/RawURL/AlistPath)
        :param overwrite: 本地路径存在同名文件时是否重新生成/下载该文件，默认为 False
        :param sync_server: 是否同步服务器，启用后若服务器中删除了文件，也会将本地文件删除，默认为 True
        :param other_ext: 自定义下载后缀，使用西文半角逗号进行分割，默认为空
        :param max_workers: 最大并发数
        :param max_downloaders: 最大同时下载
        :param wait_time: 遍历请求间隔时间，单位为秒，默认为 0
        :param sync_ignore: 同步时忽略的文件正则表达式
        """

        self.client = AlistClient(url, username, password, token)
        self.mode = mode

        self.source_dir = source_dir
        self.target_dir = Path(target_dir)

        self.flatten_mode = flatten_mode
        if flatten_mode:
            subtitle = image = nfo = False

        download_exts: set[str] = set()
        if subtitle:
            download_exts |= SUBTITLE_EXTS
        if image:
            download_exts |= IMAGE_EXTS
        if nfo:
            download_exts |= NFO_EXTS
        if other_ext:
            download_exts |= frozenset(other_ext.lower().split(","))

        self.download_exts = download_exts
        # VIDEO_EXTS includes .m2ts for BDMV support
        self.process_file_exts = VIDEO_EXTS | download_exts

        self.overwrite = overwrite
        self.__max_workers = Semaphore(max_workers)
        self.__max_downloaders = Semaphore(max_downloaders)
        self.wait_time = wait_time
        self.sync_server = sync_server

        if sync_ignore:
            self.sync_ignore_pattern = re_compile(sync_ignore)
        else:
            self.sync_ignore_pattern = None

    def _should_process_file(self, path: AlistPath) -> bool:
        """
        判断文件是否需要处理
        根据 Alist2Strm 配置判断是否需要处理该文件
        将云盘上的文件对应的本地文件路径保存至 self.processed_local_paths

        :param path: AlistPath 对象
        :return: 是否需要处理该文件
        """
        if path.is_dir:
            return False

        if path.suffix.lower() not in self.process_file_exts:
            logger.debug(f"文件 {path.name} 不在处理列表中")
            return False

        try:
            local_path = self.__get_local_path(path)
        except OSError as e:  # 可能是文件名过长
            logger.warning(f"获取 {path.path} 本地路径失败：{e}")
            return False

        # 将文件路径添加到已处理列表中，用于后续清理
        self.processed_local_paths.add(local_path)

        if not self.overwrite and local_path.exists():
            if path.suffix.lower() in self.download_exts:  # 检查字幕、图片、nfo等非视频文件
                local_path_stat = local_path.stat()
                if local_path_stat.st_mtime < path.modified_timestamp:
                    logger.debug(f"文件 {local_path.name} 已过期，需要重新处理 {path.path}")
                    return True
                if local_path_stat.st_size < path.size:
                    logger.debug(f"文件 {local_path.name} 大小不一致，可能是本地文件损坏，需要重新处理 {path.path}")
                    return True
            logger.debug(f"文件 {local_path.name} 已存在，跳过处理 {path.path}")
            return False

        return True

    async def run(self) -> None:
        """
        处理主体
        包含 BDMV M2TS 处理逻辑
        """
        if self.mode not in ["AlistURL", "RawURL", "AlistPath"]:
            logger.warning(f"Alist2Strm 的模式 {self.mode} 不存在，已设置为默认模式 AlistURL")
            self.mode = "AlistURL"

        # 对于 RawURL 模式和 BDMV 处理，需要获取详细信息
        is_detail = True if self.mode == "RawURL" else True

        self.processed_local_paths = set()  # 重置已处理文件列表
        all_paths_from_alist = []
        logger.info(f"开始扫描源目录：{self.source_dir}")

        try:
            async for path_obj in self.client.iter_path(
                dir_path=self.source_dir,
                wait_time=self.wait_time,
                is_detail=is_detail,
                # 不传递 filter 参数，使用默认行为
            ):
                all_paths_from_alist.append(path_obj)
        except Exception as e:
            logger.error(f"扫描 Alist 目录 {self.source_dir} 时出错：{e}")
            return  # 如果初始扫描失败则停止

        logger.info(f"扫描完成，发现 {len(all_paths_from_alist)} 个项目。正在识别 BDMV 结构。")

        # BDMV 处理逻辑
        bdmv_largest_m2ts_map = {}  # BDMV_dir_path -> AlistPath of largest M2TS
        other_m2ts_in_bdmv_stream = set()  # Paths of M2TS files in STREAM, not the largest

        # 查找潜在的 BDMV 根目录
        potential_bdmv_roots = [p for p in all_paths_from_alist if p.is_dir and p.name.upper() == "BDMV"]

        for bdmv_path_obj in potential_bdmv_roots:
            bdmv_dir_path_str = bdmv_path_obj.path
            stream_dir_path_str = f"{bdmv_dir_path_str}/STREAM"
            logger.info(f"处理潜在的 BDMV 目录：{bdmv_dir_path_str}")
            
            # 查找 STREAM 目录下的 M2TS 文件
            m2ts_files_in_stream = []
            for path_obj in all_paths_from_alist:
                if (not path_obj.is_dir and
                   path_obj.path.startswith(stream_dir_path_str + "/") and
                   path_obj.suffix.lower() == ".m2ts"):
                    m2ts_files_in_stream.append(path_obj)
            
            if m2ts_files_in_stream:
                # 选择最大的 M2TS 文件作为主要视频文件
                largest_m2ts = max(m2ts_files_in_stream, key=lambda f: f.size)
                bdmv_largest_m2ts_map[bdmv_dir_path_str] = largest_m2ts
                logger.info(f"为 BDMV {bdmv_dir_path_str} 识别出最大的 M2TS 文件：{largest_m2ts.path} (大小：{largest_m2ts.size})")
                
                # 记录其他较小的 M2TS 文件，稍后跳过处理
                for m2ts_file in m2ts_files_in_stream:
                    if m2ts_file.path != largest_m2ts.path:
                        other_m2ts_in_bdmv_stream.add(m2ts_file.path)
            else:
                logger.info(f"在 {stream_dir_path_str} 中未找到 M2TS 文件，BDMV 目录：{bdmv_dir_path_str}")

        # 构建最终处理文件列表
        files_to_process_final_map = {}

        for path_obj in all_paths_from_alist:
            # 检查是否是主要的 BDMV M2TS 文件
            is_main_bdmv_m2ts = any(path_obj.path == main_m2ts.path for main_m2ts in bdmv_largest_m2ts_map.values())

            if is_main_bdmv_m2ts:
                if self._should_process_file(path_obj):
                    logger.info(f"添加主要 BDMV M2TS 文件到处理列表：{path_obj.path}")
                    files_to_process_final_map[path_obj.path] = path_obj
                continue

            # 跳过 BDMV 中的其他 M2TS 文件
            if path_obj.path in other_m2ts_in_bdmv_stream:
                logger.debug(f"跳过 BDMV/STREAM 中的非最大 M2TS 文件：{path_obj.path}")
                continue

            # 检查是否在已识别的 BDMV 结构内
            is_inside_processed_bdmv = False
            for bdmv_root_path in bdmv_largest_m2ts_map.keys():
                if path_obj.path.startswith(bdmv_root_path + "/"):
                    # 此文件在已识别主 M2TS 的 BDMV 结构内
                    # 我们只需要该结构中的主 M2TS
                    is_inside_processed_bdmv = True
                    break
            
            if is_inside_processed_bdmv:
                logger.debug(f"跳过已识别 BDMV 结构内的其他文件/目录：{path_obj.path}")
                continue
            
            # 常规文件/目录，不属于已识别的 BDMV 结构（或没有 M2TS 的 BDMV 结构）
            if self._should_process_file(path_obj):
                logger.debug(f"添加常规文件到处理列表：{path_obj.path}")
                files_to_process_final_map[path_obj.path] = path_obj

        logger.info(f"识别出 {len(files_to_process_final_map)} 个唯一文件进行处理。")

        # 并发处理文件
        async with self.__max_workers, TaskGroup() as tg:
            for path_obj_to_process in files_to_process_final_map.values():
                tg.create_task(self.__file_processer(path_obj_to_process))
        
        logger.info(f"文件处理任务已创建，等待完成。")

        # 清理过期文件
        if self.sync_server:
            await self.__cleanup_local_files()
            logger.info("清理本地文件完成。")
        logger.info("Alist2Strm 处理运行完成。")

    async def __file_processer(self, path: AlistPath) -> None:
        """
        异步保存文件至本地

        :param path: AlistPath 对象
        """
        local_path = self.__get_local_path(path)

        if self.mode == "AlistURL":
            content = path.url
        elif self.mode == "RawURL":
            content = path.download_url
        elif self.mode == "AlistPath":
            content = path.path
        else:
            # 这种情况应该在早期被捕获，但作为保护措施：
            logger.error(f"在 __file_processer 中遇到未知的 Alist2Strm 模式 '{self.mode}'，文件：{path.path}")
            return

        try:
            await to_thread(local_path.parent.mkdir, parents=True, exist_ok=True)
        except Exception as e:
            logger.error(f"为 {local_path} 创建父目录失败：{e}")
            return

        logger.debug(f"开始处理 {local_path} 对应 {path.path}")
        if local_path.suffix == ".strm":
            try:
                async with async_open(local_path, mode="w", encoding="utf-8") as file:
                    await file.write(content)
                logger.info(f".strm 文件 {local_path.name} 为 {path.path} 创建成功")
            except Exception as e:
                logger.error(f"写入 .strm 文件 {local_path} 失败：{e}")
        else:
            # 此分支用于可下载文件，如字幕、图片、nfo
            async with self.__max_downloaders:
                try:
                    await RequestUtils.download(path.download_url, local_path)
                    logger.info(f"文件 {local_path.name} 为 {path.path} 下载成功")
                except Exception as e:
                    logger.error(f"下载文件 {path.download_url} 到 {local_path} 失败：{e}")

    def __get_local_path(self, path: AlistPath) -> Path:
        """
        根据给定的 AlistPath 对象和当前的配置，计算出本地文件路径。
        包含 BDMV M2TS 文件的特殊处理逻辑。

        :param path: AlistPath 对象
        :return: 本地文件路径
        """
        # 检查是否是 BDMV 结构中的 m2ts 文件
        is_bdmv_m2ts = False
        if path.suffix.lower() == ".m2ts" and "/BDMV/STREAM/" in path.path:
            is_bdmv_m2ts = True
            
        if self.flatten_mode:
            # 扁平模式下，所有文件都直接放在目标目录下
            local_path_name = path.name
            local_path = self.target_dir / local_path_name
        else:
            # 非扁平模式下，需要特殊处理 BDMV 中的主 m2ts 文件
            if is_bdmv_m2ts:
                # 对于 BDMV 中的 m2ts 文件，提取电影目录名称
                # 例如：/movies/海边的异邦人 (2020)/BDMV/STREAM/00002.m2ts
                # 我们需要提取 "海边的异邦人 (2020)" 作为文件名
                
                # 先获取相对路径
                relative_path_str = path.path.replace(self.source_dir, "", 1)
                if relative_path_str.startswith("/"):
                    relative_path_str = relative_path_str[1:]
                
                # 分割路径，获取电影目录名称
                path_parts = relative_path_str.split("/")
                if len(path_parts) >= 4:  # 至少应该有 [电影名, BDMV, STREAM, 文件名]
                    movie_dir_name = path_parts[0]
                    # 使用电影目录名称作为文件名
                    local_path = self.target_dir / movie_dir_name / f"{movie_dir_name}.strm"
                    logger.info(f"BDMV m2ts 文件 {path.path} 将被扁平化为 {local_path}")
                    return local_path
            
            # 非 BDMV m2ts 文件或 BDMV 结构不完整，使用原有逻辑
            relative_path_str = path.path.replace(self.source_dir, "", 1)
            if relative_path_str.startswith("/"):
                relative_path_str = relative_path_str[1:]
            
            local_path = self.target_dir / Path(relative_path_str)

        if path.suffix.lower() in VIDEO_EXTS:
            local_path = local_path.with_suffix(".strm")

        return local_path

    async def __cleanup_local_files(self) -> None:
        """
        删除服务器中已删除的本地的 .strm 文件及其关联文件
        如果文件后缀在 sync_ignore 中，则不会被删除
        """
        logger.info("开始根据服务器状态清理本地文件。")

        if not self.target_dir.exists():
            logger.info(f"目标目录 {self.target_dir} 不存在。无需清理。")
            return

        if self.flatten_mode:
            all_local_files = [f for f in self.target_dir.iterdir() if f.is_file()]
        else:
            all_local_files = [f for f in self.target_dir.rglob("*") if f.is_file()]

        # self.processed_local_paths 包含在当前运行中*被考虑*处理的服务器文件对应的本地路径
        # （无论是被处理还是因为 overwrite=false 而跳过）
        files_to_delete = set(all_local_files) - self.processed_local_paths

        deleted_count = 0
        for file_path in files_to_delete:
            if self.sync_ignore_pattern and self.sync_ignore_pattern.search(file_path.name):
                logger.debug(f"文件 {file_path.name} 在同步忽略列表中，跳过删除。")
                continue

            try:
                if file_path.exists():  # 删除前再次检查存在性
                    await to_thread(file_path.unlink)
                    logger.info(f"删除过期的本地文件：{file_path}")
                    deleted_count += 1

                    if not self.flatten_mode:
                        # 检查并删除空目录
                        parent_dir = file_path.parent
                        while parent_dir != self.target_dir and parent_dir.exists() and not any(parent_dir.iterdir()):
                            try:
                                parent_dir.rmdir()
                                logger.info(f"删除空目录：{parent_dir}")
                            except OSError as e_rmdir:
                                logger.warning(f"删除空目录 {parent_dir} 失败：{e_rmdir}")
                                break  # 如果一个失败则停止尝试删除父目录
                            parent_dir = parent_dir.parent
            except Exception as e_delete:
                logger.error(f"删除文件 {file_path} 时出错：{e_delete}")
        logger.info(f"清理完成。删除了 {deleted_count} 个文件。")

