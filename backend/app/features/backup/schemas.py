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


class BackupRef(ApiModel):
    """覆盖前留下的安全引用。"""

    name: str
    ref: str
    sha: str
    created_at: str


class BackupStatus(ApiModel):
    repo: bool
    branch: str
    own_branch: str
    remote: str
    dirty: bool | None
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
    degraded: bool = False
    error: str = ""
    safety_refs: list[BackupRef] = Field(default_factory=list)


class BackupResult(ApiModel):
    ok: bool
    status: Literal[
        "pushed",
        "merged",
        "up-to-date",
        "conflict",
        "overwritten",
        "aborted",
        "fetched",
        "restored",
    ]
    branch: str
    message: str
    commit: str = ""
    conflicts: list[BackupConflict] = Field(default_factory=list)


class BackupBranchRequest(ApiModel):
    branch: str


class BackupRestoreRequest(ApiModel):
    ref: str = Field(min_length=1, max_length=200)


class BackupResolveRequest(ApiModel):
    resolutions: dict[str, Literal["local", "remote"]]
