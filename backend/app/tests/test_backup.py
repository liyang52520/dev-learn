"""数据备份的后端测试：用 tmp 裸仓 + 两台机器模拟真实同步。"""

from __future__ import annotations

import subprocess
from pathlib import Path

import pytest

from app.core.errors import AppError
from app.features.backup import repository, service, status


class FakeReview:
    def __init__(self) -> None:
        self.suspended = False
        self.calls: list[str] = []

    def prepare_sync(self) -> None:
        self.calls.append("prepare")

    def close_for_sync(self) -> None:
        self.calls.append("close")
        self.suspended = True

    def resume_after_sync(self) -> None:
        self.calls.append("resume")
        self.suspended = False

    def sync_suspended(self) -> bool:
        return self.suspended

    def anki_available(self) -> bool:
        return True


class FakeSettings:
    def __init__(self, data_dir: Path, branch: str) -> None:
        self.data_dir = data_dir
        self.data_sync_branch = branch

    @property
    def anki_dir(self) -> Path:
        return self.data_dir / "anki"


def git(cwd: Path, *args: str) -> str:
    result = subprocess.run(
        ["git", "-C", str(cwd), *args], check=True, capture_output=True, text=True
    )
    return result.stdout.strip()


def commit(cwd: Path, message: str) -> None:
    git(cwd, "add", "-A")
    git(cwd, "commit", "-q", "-m", message)


def activate(monkeypatch: pytest.MonkeyPatch, data_dir: Path, branch: str) -> FakeReview:
    fake = FakeSettings(data_dir, branch)
    review = FakeReview()
    monkeypatch.setattr(repository, "settings", fake)
    monkeypatch.setattr(status, "settings", fake)
    monkeypatch.setattr(service, "review_service", review)
    monkeypatch.setattr(status, "review_service", review)
    status.invalidate()
    return review


@pytest.fixture
def remote(tmp_path: Path) -> Path:
    path = tmp_path / "remote.git"
    subprocess.run(["git", "init", "--bare", "-q", "-b", "main", str(path)], check=True)
    return path


@pytest.fixture
def repo_a(
    tmp_path: Path, remote: Path, monkeypatch: pytest.MonkeyPatch
) -> tuple[Path, Path, FakeReview]:
    path = tmp_path / "data"
    path.mkdir()
    git(path, "init", "-q", "-b", "main")
    git(path, "config", "user.email", "a@example.com")
    git(path, "config", "user.name", "Machine A")
    (path / "blog").mkdir()
    (path / "blog" / "a.md").write_text("base\n", encoding="utf-8")
    (path / "study").mkdir()
    (path / "study" / "index.json").write_text("{}\n", encoding="utf-8")
    (path / "anki").mkdir()
    (path / "anki" / "collection.anki2").write_bytes(b"base\x00")
    commit(path, "init")
    git(path, "remote", "add", "origin", str(remote))
    git(path, "push", "-q", "-u", "origin", "main")
    return path, remote, activate(monkeypatch, path, "machine/a")


def clone(remote: Path, dest: Path) -> Path:
    subprocess.run(["git", "clone", "-q", str(remote), str(dest)], check=True)
    git(dest, "config", "user.email", "b@example.com")
    git(dest, "config", "user.name", "Machine B")
    return dest


def make_machine_b(
    tmp_path: Path, remote: Path, monkeypatch: pytest.MonkeyPatch
) -> tuple[Path, FakeReview]:
    path = clone(remote, tmp_path / "data-b")
    return path, activate(monkeypatch, path, "machine/b")


def test_push_commits_all_and_creates_own_branch(repo_a: tuple[Path, Path, FakeReview]) -> None:
    path, remote, review = repo_a
    (path / "blog" / "a.md").write_text("A change\n", encoding="utf-8")
    result = service.push()

    assert result.ok and result.status == "pushed"
    assert git(remote, "rev-parse", "--verify", "refs/heads/machine/a")
    assert "prepare" in review.calls
    current = status.read()
    assert current.own_branch == "machine/a"
    assert current.own_pushed
    assert current.own_ahead == 0
    assert current.last_sync is not None and current.last_sync.ok


def test_status_without_repo(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> None:
    activate(monkeypatch, tmp_path / "empty", "machine/a")
    current = status.read()
    assert not current.repo
    assert "未初始化" in current.message


def test_merge_keeps_both_sides(
    repo_a: tuple[Path, Path, FakeReview], tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    path, remote, _ = repo_a
    service.push()
    path_b, _ = make_machine_b(tmp_path, remote, monkeypatch)
    (path_b / "study" / "index.json").write_text('{"b":1}\n', encoding="utf-8")
    assert service.push().ok

    activate(monkeypatch, path, "machine/a")
    (path / "blog" / "a.md").write_text("A side\n", encoding="utf-8")
    result = service.merge("machine/b")

    assert result.status == "merged"
    assert (path / "blog" / "a.md").read_text(encoding="utf-8") == "A side\n"
    assert (path / "study" / "index.json").read_text(encoding="utf-8") == '{"b":1}\n'


def test_text_conflict_must_be_resolved(
    repo_a: tuple[Path, Path, FakeReview], tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    path, remote, _ = repo_a
    service.push()
    path_b, _ = make_machine_b(tmp_path, remote, monkeypatch)
    (path_b / "blog" / "a.md").write_text("B side\n", encoding="utf-8")
    service.push()

    activate(monkeypatch, path, "machine/a")
    (path / "blog" / "a.md").write_text("A side\n", encoding="utf-8")
    result = service.merge("machine/b")

    assert result.status == "conflict"
    assert [item.path for item in result.conflicts] == ["blog/a.md"]
    assert result.conflicts[0].kind == "text"
    merging = status.read()
    assert merging.merging and merging.merge_branch == "machine/b"
    assert merging.suspended

    done = service.resolve({"blog/a.md": "local"})
    assert done.status == "merged"
    assert (path / "blog" / "a.md").read_text(encoding="utf-8") == "A side\n"
    assert not status.read().merging
    assert not status.read().suspended


def test_anki_conflict_can_take_remote(
    repo_a: tuple[Path, Path, FakeReview], tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    path, remote, _ = repo_a
    service.push()
    path_b, _ = make_machine_b(tmp_path, remote, monkeypatch)
    (path_b / "anki" / "collection.anki2").write_bytes(b"remote\x00")
    service.push()

    activate(monkeypatch, path, "machine/a")
    (path / "anki" / "collection.anki2").write_bytes(b"local\x00")
    result = service.merge("machine/b")
    assert result.status == "conflict"
    anki = next(item for item in result.conflicts if item.path == "anki/collection.anki2")
    assert anki.kind == "anki"

    service.resolve({"anki/collection.anki2": "remote"})
    assert (path / "anki" / "collection.anki2").read_bytes() == b"remote\x00"


def test_abort_merge_restores_local(
    repo_a: tuple[Path, Path, FakeReview], tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    path, remote, _ = repo_a
    service.push()
    path_b, _ = make_machine_b(tmp_path, remote, monkeypatch)
    (path_b / "blog" / "a.md").write_text("B side\n", encoding="utf-8")
    service.push()

    activate(monkeypatch, path, "machine/a")
    (path / "blog" / "a.md").write_text("A side\n", encoding="utf-8")
    assert service.merge("machine/b").status == "conflict"
    result = service.abort()

    assert result.status == "aborted"
    assert (path / "blog" / "a.md").read_text(encoding="utf-8") == "A side\n"
    assert not status.read().merging
    assert not repository.merge_in_progress()


def test_overwrite_resets_and_keeps_safety_ref(
    repo_a: tuple[Path, Path, FakeReview], tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    path, remote, _ = repo_a
    service.push()
    path_b, _ = make_machine_b(tmp_path, remote, monkeypatch)
    (path_b / "blog" / "a.md").write_text("B side\n", encoding="utf-8")
    service.push()

    activate(monkeypatch, path, "machine/a")
    (path / "blog" / "a.md").write_text("A side\n", encoding="utf-8")
    result = service.overwrite("machine/b")

    assert result.status == "overwritten"
    assert (path / "blog" / "a.md").read_text(encoding="utf-8") == "B side\n"
    refs = git(path, "for-each-ref", "--format=%(refname)", "refs/backup")
    assert refs.startswith("refs/backup/machine-a-")
    assert not status.read().suspended


@pytest.mark.parametrize("branch", ["machine/a", "bad branch", "../x", "-x"])
def test_rejects_invalid_or_own_branch(repo_a: tuple[Path, Path, FakeReview], branch: str) -> None:
    with pytest.raises(AppError):
        service.merge(branch)


def test_auto_push_runs_once_per_day(
    repo_a: tuple[Path, Path, FakeReview], monkeypatch: pytest.MonkeyPatch
) -> None:
    path, remote, _ = repo_a
    state = repository.read_state()
    state["last_push_at"] = 0
    state["last_attempt_at"] = 0
    repository.write_state(state)

    (path / "blog" / "a.md").write_text("auto\n", encoding="utf-8")
    service.auto_push()
    first = git(remote, "rev-parse", "refs/heads/machine/a")

    service.auto_push()
    assert git(remote, "rev-parse", "refs/heads/machine/a") == first
