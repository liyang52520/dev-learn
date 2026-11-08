"""数据备份操作：推送、合并、冲突解决、整机覆盖与每日自动推送。

模型：远端 `dev-anki` 上每台机器只写自己的分支（`machine/<主机名>`），
本地检出分支保持原样；推送时把本机 HEAD 推到自己的远端分支。
"""

from __future__ import annotations

import threading
from collections.abc import Iterator
from contextlib import contextmanager
from datetime import datetime
from typing import Literal, cast

from app.core.errors import AppError
from app.features.backup import repository as repo
from app.features.backup import state, status
from app.features.backup.schemas import BackupResult
from app.features.review import service as review_service

_OP = threading.Lock()
Side = Literal["local", "remote"]


@contextmanager
def _exclusive() -> Iterator[None]:
    """所有同步操作共用：互斥锁 + 结束后刷新状态缓存。"""
    if not _OP.acquire(blocking=False):
        raise AppError("已有同步操作在进行，请稍后再试", code="backup_busy", status=409)
    try:
        yield
    finally:
        _OP.release()
        status.invalidate()


@contextmanager
def _closed() -> Iterator[None]:
    """git 改写工作区前关闭 collection，结束后无论成败都恢复。"""
    review_service.close_for_sync()
    try:
        yield
    finally:
        review_service.resume_after_sync()


def _ensure_idle() -> None:
    if repo.merge_in_progress():
        raise AppError("有未完成的合并，请先完成或取消合并", code="backup_merging", status=409)


def _ensure_repo() -> None:
    if not repo.repo_ready():
        raise AppError(
            "backend/data 还不是独立 git 仓库，无法同步",
            code="backup_repo",
            status=400,
        )


def _validate_branch(raw: str) -> str:
    name = raw.strip()
    if name.startswith("origin/"):
        name = name[len("origin/") :]
    if not repo.valid_branch(name):
        raise AppError("分支名不合法", code="invalid_params", status=400)
    return name


def fetch_remote() -> BackupResult:
    """只更新远端跟踪分支，不改工作区，因此不用关闭 Anki。"""
    with _exclusive():
        _ensure_repo()
        try:
            repo.fetch_all()
        except repo.GitError as exc:
            raise AppError(
                f"获取远端分支失败：{exc}", code="backup_fetch_failed", status=502
            ) from exc
        message = "已获取远端分支列表。"
        return BackupResult(ok=True, status="fetched", branch=status.own_branch(), message=message)


def push() -> BackupResult:
    _ensure_idle()
    with _exclusive():
        return _push()


def _push() -> BackupResult:
    _ensure_repo()
    branch = status.own_branch()
    expected: str | None = ""
    changed = False
    commit = ""
    suspended = False
    try:
        expected = repo.remote_branch_sha(branch)
        review_service.prepare_sync()
        # git 提交前必须关闭 collection：WAL 里的最后一次评分也要落进主库。
        review_service.close_for_sync()
        suspended = True
        changed, commit = repo.commit_all(f"同步 {branch} {state.stamp()}")
    except repo.GitError as exc:
        state.record_sync(branch, False, str(exc))
        raise AppError(f"推送失败：{exc}", code="backup_push_failed", status=502) from exc
    finally:
        if suspended:
            review_service.resume_after_sync()

    try:
        # 网络推送放在恢复 collection 之后：同步期间复习页不会整段时间 503。
        repo.push(branch, expected)
        repo.update_tracking(branch)
    except repo.GitError as exc:
        state.record_sync(branch, False, str(exc))
        raise AppError(f"推送失败：{exc}", code="backup_push_failed", status=502) from exc

    head = "已提交并推送" if changed else "没有新改动，已推送当前提交"
    message = f"{head}（{branch}）"
    state.record_sync(branch, True, message, pushed=True)
    return BackupResult(ok=True, status="pushed", branch=branch, message=message, commit=commit)


def merge(branch: str) -> BackupResult:
    branch = _validate_branch(branch)
    if branch == status.own_branch():
        raise AppError("不能合并本机推送分支", code="invalid_params", status=400)
    _ensure_idle()
    suspended = False
    with _exclusive():
        try:
            _ensure_repo()
            review_service.prepare_sync()
            review_service.close_for_sync()
            suspended = True
            repo.commit_all(f"合并前保存本机 {state.stamp()}")
            try:
                repo.fetch_branch(branch)
                repo.merge_no_commit(branch)
            except repo.GitError as exc:
                raise AppError(f"合并失败：{exc}", code="backup_merge_failed", status=502) from exc

            found = status.conflicts()
            if found:
                state.set_merge(branch)
                suspended = False  # 交给解决或取消流程恢复复习
                return BackupResult(
                    ok=False,
                    status="conflict",
                    branch=branch,
                    message=f"有 {len(found)} 个文件冲突，请逐个选择保留本机还是采用对方。",
                    conflicts=found,
                )
            if not repo.merge_in_progress():
                review_service.resume_after_sync()
                suspended = False
                message = f"本机已经包含 {branch} 的全部内容，无需合并。"
                state.record_sync(branch, True, message)
                return BackupResult(ok=True, status="up-to-date", branch=branch, message=message)

            commit = repo.commit_merge(f"合并 {branch} {state.stamp()}")
            review_service.resume_after_sync()
            suspended = False
            message = f"已合并 {branch}，改动还在本机；确认无误后点「推送本机」。"
            state.record_sync(branch, True, message)
            return BackupResult(
                ok=True, status="merged", branch=branch, message=message, commit=commit
            )
        finally:
            if suspended:
                review_service.resume_after_sync()


def resolve(resolutions: dict[str, str]) -> BackupResult:
    suspended = False
    with _exclusive():
        if not repo.merge_in_progress():
            raise AppError("没有进行中的合并", code="backup_merge_missing", status=409)
        found = status.conflicts()
        missing = [item.path for item in found if item.path not in resolutions]
        if missing:
            raise AppError(
                f"还有 {len(missing)} 个冲突未选择",
                code="backup_unresolved",
                status=400,
                fields={path: "请选择保留本机或采用对方" for path in missing},
            )
        branch = state.merge_branch()
        for item in found:
            side = cast(Side, resolutions[item.path])
            if side not in ("local", "remote"):
                raise AppError("冲突选择必须是 local 或 remote", code="invalid_params", status=400)
            repo.take_side(item.path, side)
            if item.kind == "anki":
                repo.clear_anki_runtime_files()
        remaining = repo.unmerged_paths()
        if remaining is None:
            raise AppError("无法读取剩余冲突", code="backup_status_failed", status=502)
        if remaining:
            raise AppError(
                "仍有未解决的冲突：" + "、".join(remaining),
                code="backup_unresolved",
                status=400,
            )
        try:
            # 提交合并会改写工作区，即使服务重启过也要先把 collection 关掉。
            review_service.close_for_sync()
            suspended = True
            commit = repo.commit_merge(f"合并 {branch} {state.stamp()}")
            repo.clear_anki_runtime_files()
            state.clear_merge()
            message = f"已合并 {branch}，改动还在本机；确认无误后点「推送本机」。"
            state.record_sync(branch, True, message)
            return BackupResult(
                ok=True, status="merged", branch=branch, message=message, commit=commit
            )
        finally:
            if suspended:
                review_service.resume_after_sync()


def abort() -> BackupResult:
    with _exclusive():
        branch = state.merge_branch()
        if repo.repo_ready() and repo.merge_in_progress():
            # 先关库再回退工作区；_closed 一定会恢复复习，MERGE_HEAD 守卫仍会拦住半合并数据。
            try:
                with _closed():
                    repo.abort_merge()
                    repo.clear_anki_runtime_files()
            except repo.GitError as exc:
                raise AppError(
                    f"取消合并失败：{exc}", code="backup_abort_failed", status=502
                ) from exc
        elif review_service.sync_suspended():
            # 上次操作中途退出留下的暂停态，取消时一并恢复。
            review_service.resume_after_sync()
        state.clear_merge()
        message = "已取消合并，本机数据保持合并前的状态。"
        return BackupResult(ok=True, status="aborted", branch=branch, message=message)


def overwrite(branch: str) -> BackupResult:
    branch = _validate_branch(branch)
    own = status.own_branch()
    if branch == own:
        raise AppError("不能用本机推送分支覆盖本机", code="invalid_params", status=400)
    _ensure_idle()
    with _exclusive():
        _ensure_repo()
        review_service.prepare_sync()
        safety = ""
        try:
            # fetch 只更新远端引用，不改工作区，可以在 collection 打开时进行。
            repo.fetch_branch(branch)
            # 提交与 reset 会改写工作区，必须在 collection 关闭后做。
            with _closed():
                repo.commit_all(f"覆盖前保存本机 {state.stamp()}")
                safety = repo.create_safety_ref(
                    f"{own.replace('/', '-')}-{datetime.now():%Y%m%d-%H%M%S}"
                )
                repo.reset_hard(f"origin/{branch}")
                repo.clear_anki_runtime_files()
        except repo.GitError as exc:
            raise AppError(f"覆盖失败：{exc}", code="backup_overwrite_failed", status=502) from exc
        message = (
            f"已用 {branch} 覆盖本机，安全引用保存在 {safety}。"
            "需要把本机分支也更新时，点「推送本机」。"
        )
        state.record_sync(branch, True, message)
        return BackupResult(
            ok=True, status="overwritten", branch=branch, message=message, commit=repo.head_sha()
        )


def restore(ref: str) -> BackupResult:
    """恢复到覆盖前留下的安全引用；恢复前再留一个当前状态的安全引用。"""
    _ensure_idle()
    branch = status.own_branch()
    with _exclusive():
        _ensure_repo()
        if not ref.startswith("refs/backup/"):
            raise AppError("只能恢复安全引用", code="invalid_params", status=400)
        review_service.prepare_sync()
        safety = ""
        try:
            # 提交与恢复都会改写工作区，必须在 collection 关闭后做。
            with _closed():
                repo.commit_all(f"恢复前保存本机 {state.stamp()}")
                safety = repo.create_safety_ref(f"before-restore-{datetime.now():%Y%m%d-%H%M%S}")
                repo.restore_safety_ref(ref)
                repo.clear_anki_runtime_files()
        except repo.GitError as exc:
            raise AppError(f"恢复失败：{exc}", code="backup_restore_failed", status=502) from exc
        message = f"已恢复到 {ref}；恢复前的状态保存在 {safety}。"
        state.record_sync(branch, True, message)
        return BackupResult(
            ok=True, status="restored", branch=branch, message=message, commit=repo.head_sha()
        )
