"""数据备份接口的数据形状（Pydantic → camelCase）。"""

from __future__ import annotations

from typing import Literal

from pydantic import Field

from app.core.pagination import ApiModel


class BackupBranch(ApiModel):
    """远端分支相对本机 HEAD 的位置。"""

    name: str
    sha: str
    updated_at: str
    # ahead：只在本机 HEAD 里的提交数；behind：只在远端分支里的提交数。
    ahead: int
    behind: int
    is_own: bool


class BackupLastSync(ApiModel):
    at: str
    branch: str
    ok: bool
    message: str


class BackupConflict(ApiModel):
    path: str
    kind: Literal["text", "anki"]


class BackupStatus(ApiModel):
    repo: bool
    branch: str
    own_branch: str
    remote: str
    dirty: bool
    merging: bool
    merge_branch: str
    conflicts: list[BackupConflict]
    branches: list[BackupBranch]
    own_pushed: bool
    own_ahead: int
    own_behind: int
    last_sync: BackupLastSync | None
    anki_available: bool
    suspended: bool
    message: str


class BackupResult(ApiModel):
    ok: bool
    status: Literal[
        "pushed", "merged", "up-to-date", "conflict", "overwritten", "aborted", "fetched"
    ]
    branch: str
    message: str
    commit: str = ""
    conflicts: list[BackupConflict] = Field(default_factory=list)


class BackupBranchRequest(ApiModel):
    branch: str


class BackupResolveRequest(ApiModel):
    resolutions: dict[str, Literal["local", "remote"]]
