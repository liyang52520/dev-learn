#!/usr/bin/env python3
"""本地复习调度服务（单用户，只在本机/内网运行）。

职责：把 Anki 的 v3 调度器包成几个 JSON 接口。
题目内容不经过这里——站点自己从 data/study 渲染，本服务只返回「哪张卡、四个按钮叫什么、还剩多少」。

安全：
  * 只监听 REVIEW_HOSTS（默认 127.0.0.1），可用 Tailscale IP 额外开放
  * 来源 IP 必须落在 127.0.0.0/8 或 100.64.0.0/10（Tailscale 网段）
  * 除 /health 外都要带 X-Review-Token，token 首次启动生成到 .token（0600）

用法：
  .venv/bin/python server.py
  REVIEW_HOSTS=127.0.0.1,100.101.102.103 .venv/bin/python server.py
"""

from __future__ import annotations

import ipaddress
import json
import os
import shutil
import signal
import socket
import sqlite3
import subprocess
import threading
import time
from datetime import date, datetime, timedelta
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import urlparse

from anki.collection import Collection
from anki.decks import DeckId
from anki import scheduler_pb2
from anki.utils import int_time

BASE = Path(__file__).resolve().parent
DATA_DIR = BASE / "data"
COLL_PATH = DATA_DIR / "collection.anki2"
BACKUP_DIR = DATA_DIR / "backups"
TOKEN_PATH = BASE / ".token"

DECK_NAME = os.environ.get("REVIEW_DECK", "Java面试")
PORT = int(os.environ.get("REVIEW_PORT", "8765"))
HOSTS = [h.strip() for h in os.environ.get("REVIEW_HOSTS", "127.0.0.1").split(",") if h.strip()]

KEEP_BACKUPS = 30
SNAPSHOT_EVERY = 10 * 60      # 本地快照间隔（秒）
GIT_SYNC_EVERY = 15 * 60      # git 提交推送间隔（秒）
MAX_STATES = 64               # 缓存多少张卡的 states，供 answer 使用

ALLOWED_NETS = [
    ipaddress.ip_network("127.0.0.0/8"),
    ipaddress.ip_network("::1/128"),
    ipaddress.ip_network("100.64.0.0/10"),  # Tailscale CGNAT 网段
]

STATE_NAMES = {0: "new", 1: "learning", 2: "review", 3: "relearning"}

LOCK = threading.RLock()
PENDING: dict[int, tuple[scheduler_pb2.SchedulingStates, float]] = {}
DIRTY = {"value": False}
COL: Collection | None = None


# ---------------------------------------------------------------- 基础设施


def read_token() -> str:
    if not TOKEN_PATH.exists():
        TOKEN_PATH.write_text(os.urandom(24).hex(), encoding="utf-8")
        TOKEN_PATH.chmod(0o600)
    return TOKEN_PATH.read_text(encoding="utf-8").strip()


TOKEN = read_token()


def snapshot(reason: str = "auto") -> Path | None:
    """用 sqlite 的在线备份接口做一致性快照，库开着也能安全执行。"""
    BACKUP_DIR.mkdir(parents=True, exist_ok=True)
    stamp = datetime.now().strftime("%Y-%m-%d-%H%M%S")
    target = BACKUP_DIR / f"collection-{stamp}.anki2"
    try:
        src = sqlite3.connect(f"file:{COLL_PATH}?mode=ro", uri=True, timeout=5)
        dst = sqlite3.connect(target)
        with dst:
            src.backup(dst)
        src.close()
        dst.close()
    except Exception as exc:  # noqa: BLE001 - 快照失败不能影响复习
        print(f"[backup] 失败({reason}): {exc}", flush=True)
        if target.exists():
            target.unlink(missing_ok=True)
        return None

    backups = sorted(BACKUP_DIR.glob("collection-*.anki2"))
    for old in backups[:-KEEP_BACKUPS]:
        old.unlink(missing_ok=True)
    print(f"[backup] {target.name} ({target.stat().st_size // 1024} KB)", flush=True)
    return target


def git_sync(message: str) -> None:
    """把 collection 提交并推到 dev-anki。失败只打日志，不阻塞复习。"""
    try:
        # collection 是 WAL 模式：先把 -wal 里的内容 checkpoint 回主文件，
        # 否则单独提交 collection.anki2 会漏掉最近几次复习。
        if COL is not None:
            with LOCK:
                COL.db.all("pragma wal_checkpoint(truncate)")
        subprocess.run(["git", "-C", str(DATA_DIR), "add", "-A"], check=True, timeout=60,
                       capture_output=True)
        diff = subprocess.run(["git", "-C", str(DATA_DIR), "diff", "--cached", "--quiet"],
                              timeout=60)
        if diff.returncode == 0:
            return
        subprocess.run(["git", "-C", str(DATA_DIR), "commit", "-q", "-m", message],
                       check=True, timeout=60, capture_output=True)
        subprocess.run(["git", "-C", str(DATA_DIR), "push", "-q", "origin", "HEAD"],
                       check=True, timeout=120, capture_output=True)
        print(f"[git] 已推送：{message}", flush=True)
    except Exception as exc:  # noqa: BLE001
        print(f"[git] 同步失败：{exc}", flush=True)


def maintenance_loop() -> None:
    last_snap = time.time()
    last_git = time.time()
    while True:
        time.sleep(30)
        now = time.time()
        if now - last_snap >= SNAPSHOT_EVERY:
            with LOCK:
                snapshot("timer")
            last_snap = now
        if now - last_git >= GIT_SYNC_EVERY and DIRTY["value"]:
            DIRTY["value"] = False
            git_sync(f"复习 {datetime.now():%Y-%m-%d %H:%M} 自动同步")
            last_git = now


# ---------------------------------------------------------------- 调度逻辑


def deck_id() -> DeckId:
    did = COL.decks.id_for_name(DECK_NAME)
    if did is None:
        raise RuntimeError(f"collection 里没有 deck：{DECK_NAME}，先跑 import.py")
    COL.decks.select(DeckId(did))
    return DeckId(did)


def clean_label(text: str) -> str:
    # describe_next_states 返回的文案带 U+2068/U+2069 双向隔离符
    return text.replace("\u2068", "").replace("\u2069", "")


def queue_view(limit: int = 1) -> dict:
    with LOCK:
        deck_id()
        queued = COL.sched.get_queued_cards(fetch_limit=limit)
        items = []
        for qc in queued.cards:
            note = COL.get_note(qc.card.note_id)
            labels = [clean_label(x) for x in COL.sched.describe_next_states(qc.states)]
            PENDING[qc.card.id] = (qc.states, time.time())
            if len(PENDING) > MAX_STATES:
                for key in sorted(PENDING, key=lambda k: PENDING[k][1])[:-MAX_STATES]:
                    PENDING.pop(key, None)
            items.append({
                "card_id": qc.card.id,
                "qid": note["QID"],
                "state": STATE_NAMES.get(qc.card.ctype, "unknown"),
                "labels": labels,
            })
        return {
            "cards": items,
            "counts": {
                "new": queued.new_count,
                "learning": queued.learning_count,
                "review": queued.review_count,
            },
        }


def counts() -> dict:
    with LOCK:
        new, learning, review = COL.sched.counts()
        return {"new": new, "learning": learning, "review": review}


def answer(card_id: int, rating: int) -> dict:
    if rating not in (1, 2, 3, 4):
        raise ValueError("rating 必须是 1-4")
    with LOCK:
        cached = PENDING.get(card_id)
        if not cached:
            raise LookupError("这张卡的调度状态已过期，请重新取卡")
        states, shown_at = cached
        new_state = {
            1: states.again, 2: states.hard, 3: states.good, 4: states.easy
        }[rating]
        elapsed = int((time.time() - shown_at) * 1000)
        COL.sched.answer_card(scheduler_pb2.CardAnswer(
            card_id=card_id,
            current_state=states.current,
            new_state=new_state,
            rating=rating,
            answered_at_millis=int_time(1000),
            milliseconds_taken=max(0, min(elapsed, 120_000)),
        ))
        PENDING.pop(card_id, None)
        DIRTY["value"] = True
        # 顺手把下一张卡带回去：前端少一次往返（answer → queue 两跳变一跳）
        nxt = queue_view(1)
        return {
            "counts": nxt["counts"],
            "next": nxt["cards"][0] if nxt["cards"] else None,
        }


def undo() -> dict:
    with LOCK:
        if not COL.undo_status().undo:
            raise LookupError("没有可撤销的操作")
        COL.undo()
        PENDING.clear()
        DIRTY["value"] = True
        return {"counts": counts()}


def day_rows(days: int = 365) -> list[dict]:
    with LOCK:
        since = (date.today() - timedelta(days=days - 1)).isoformat()
        rows = COL.db.all(
            "select date(id/1000,'unixepoch','localtime') as d, count(*) "
            "from revlog group by d having d >= ? order by d", since)
        return [{"date": str(d), "count": int(c)} for d, c in rows]


def can_undo() -> bool:
    with LOCK:
        try:
            return bool(COL.undo_status().undo)
        except Exception:  # noqa: BLE001
            return False


def today_card_counts() -> tuple[int, int, int]:
    """今日学过的卡片数（按 cid 去重）与其中属于新卡的数。

    revlog 一次学习步骤会新增一条记录，同一张卡可能被记多次，
    所以「今日学了几张卡」必须 distinct，不能直接 count(*)。
    """
    with LOCK:
        row = COL.db.all(
            "select count(distinct cid), "
            "       count(distinct case when type = 0 then cid end), "
            "       count(distinct case when type in (2, 3) then cid end) "
            "from revlog "
            "where date(id / 1000, 'unixepoch', 'localtime') = date('now', 'localtime')"
        )[0]
    return int(row[0] or 0), int(row[1] or 0), int(row[2] or 0)


def next_due_epoch() -> int | None:
    """距离现在最近的一张卡的到期时间（秒）。

    Anki 的 due 语义按类型不同：学习/重学卡存的是时间戳，复习卡存的是「天数」，
    要加 collection 创建时间 crt 才能换算成时间。这里只用来做「下次什么时候回来」的提示，
    到日粒度即可，不做 day cutoff 的精确对齐。
    """
    with LOCK:
        crt = COL.db.scalar("select crt from col") or 0
        row = COL.db.scalar(
            "select min(case when type in (1,3) then due "
            "when type = 2 then due * 86400 + ? end) "
            "from cards where queue >= 0 and type in (1,2,3)",
            crt,
        )
    return int(row) if row else None


def stats() -> dict:
    rows = day_rows(365)
    by_day = {row["date"]: row["count"] for row in rows}
    today = date.today()
    streak = 0
    cursor = today
    if by_day.get(today.isoformat(), 0) == 0:
        cursor = today - timedelta(days=1)  # 今天还没开始不算断
    while by_day.get(cursor.isoformat(), 0) > 0:
        streak += 1
        cursor -= timedelta(days=1)
    cards_today, new_today, review_today = today_card_counts()
    config = get_config()
    with LOCK:
        total = COL.db.scalar("select count(*) from revlog") or 0
        notes = COL.db.scalar("select count(*) from notes") or 0
        new_remaining = COL.db.scalar(
            "select count(*) from cards where type = 0 and queue >= 0") or 0
    return {
        "counts": counts(),
        "today": cards_today,
        "today_new": new_today,
        "today_review": review_today,
        "new_per_day": config["new_per_day"],
        "rev_per_day": config["rev_per_day"],
        "can_undo": can_undo(),
        "new_remaining": int(new_remaining),
        "streak": streak,
        "total_reviews": int(total),
        "total_cards": int(notes),
        "next_due_epoch": next_due_epoch(),
        "days": rows,
    }


def get_config() -> dict:
    with LOCK:
        cfg = COL.decks.config_dict_for_deck_id(deck_id())
        return {
            "deck": DECK_NAME,
            "new_per_day": cfg["new"]["perDay"],
            "rev_per_day": cfg["rev"]["perDay"],
            "learning_steps": cfg["new"].get("delays"),
            "fsrs_enabled": bool(cfg.get("fsrsWeights") or cfg.get("desiredRetention")),
        }


def set_config(new_per_day: int | None, rev_per_day: int | None) -> dict:
    with LOCK:
        cfg = COL.decks.config_dict_for_deck_id(deck_id())
        if new_per_day is not None:
            cfg["new"]["perDay"] = max(0, min(int(new_per_day), 9999))
        if rev_per_day is not None:
            cfg["rev"]["perDay"] = max(0, min(int(rev_per_day), 9999))
        COL.decks.update_config(cfg)
        DIRTY["value"] = True
        return get_config()


# ---------------------------------------------------------------- HTTP


def ip_allowed(ip: str) -> bool:
    try:
        addr = ipaddress.ip_address(ip)
    except ValueError:
        return False
    return any(addr in net for net in ALLOWED_NETS)


class Handler(BaseHTTPRequestHandler):
    server_version = "anki-review/1.0"
    protocol_version = "HTTP/1.1"

    def log_message(self, fmt: str, *args) -> None:  # 静音默认日志
        return

    # -- 工具

    def _send(self, code: int, payload: dict) -> None:
        body = json.dumps(payload, ensure_ascii=False).encode()
        self.send_response(code)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def _fail(self, code: int, message: str) -> None:
        self._send(code, {"ok": False, "error": message})

    def _body(self) -> dict:
        length = int(self.headers.get("Content-Length") or 0)
        if not length:
            return {}
        try:
            return json.loads(self.rfile.read(length).decode("utf-8") or "{}")
        except json.JSONDecodeError:
            return {}

    def _guard(self) -> bool:
        if not ip_allowed(self.client_address[0]):
            self._fail(403, "来源 IP 不在允许范围")
            return False
        token = self.headers.get("X-Review-Token", "")
        if not token or token != TOKEN:
            self._fail(401, "token 不正确")
            return False
        return True

    # -- 路由

    def do_GET(self) -> None:  # noqa: N802
        path = urlparse(self.path).path
        if path == "/health":
            self._send(200, {"ok": True, "deck": DECK_NAME, "host": socket.gethostname()})
            return
        if not self._guard():
            return
        query = urlparse(self.path).query
        try:
            if path == "/queue":
                limit = 1
                for part in query.split("&"):
                    if part.startswith("limit="):
                        limit = max(1, min(int(part[6:] or 1), 20))
                self._send(200, {"ok": True, **queue_view(limit)})
            elif path == "/stats":
                self._send(200, {"ok": True, **stats()})
            elif path == "/config":
                self._send(200, {"ok": True, **get_config()})
            else:
                self._fail(404, "未知接口")
        except Exception as exc:  # noqa: BLE001
            self._fail(500, str(exc))

    def do_POST(self) -> None:  # noqa: N802
        path = urlparse(self.path).path
        if not self._guard():
            return
        body = self._body()
        try:
            if path == "/answer":
                result = answer(int(body.get("card_id", 0)), int(body.get("rating", 0)))
                self._send(200, {"ok": True, **result})
            elif path == "/undo":
                self._send(200, {"ok": True, **undo()})
            elif path == "/config":
                self._send(200, {"ok": True, **set_config(
                    body.get("new_per_day"), body.get("rev_per_day"))})
            elif path == "/sync":
                snap = snapshot("manual")
                git_sync(f"手动同步 {datetime.now():%Y-%m-%d %H:%M}")
                self._send(200, {"ok": True, "backup": snap.name if snap else None})
            else:
                self._fail(404, "未知接口")
        except LookupError as exc:
            self._fail(409, str(exc))
        except Exception as exc:  # noqa: BLE001
            self._fail(500, str(exc))


def shutdown_handler(*_args) -> None:
    print("\n[server] 正在收尾…", flush=True)
    with LOCK:
        snapshot("shutdown")
        if DIRTY["value"]:
            git_sync(f"复习 {datetime.now():%Y-%m-%d %H:%M} 收尾同步")
        if COL is not None:
            COL.close()
    raise SystemExit(0)


def main() -> int:
    global COL
    if not COLL_PATH.exists():
        print(f"找不到 collection：{COLL_PATH}\n先运行：.venv/bin/python import.py")
        return 1
    COL = Collection(str(COLL_PATH))
    print(f"[server] collection: {COLL_PATH}")
    print(f"[server] deck: {DECK_NAME} | config: {get_config()}")
    print(f"[server] token: {TOKEN_PATH}（站点侧自动读取）")

    snapshot("startup")
    threading.Thread(target=maintenance_loop, daemon=True).start()

    servers = []
    for host in HOSTS:
        srv = ThreadingHTTPServer((host, PORT), Handler)
        servers.append(srv)
        threading.Thread(target=srv.serve_forever, daemon=True).start()
        print(f"[server] 监听 http://{host}:{PORT}")

    signal.signal(signal.SIGINT, shutdown_handler)
    signal.signal(signal.SIGTERM, shutdown_handler)
    print("[server] 就绪，Ctrl-C 结束")
    try:
        while True:
            time.sleep(3600)
    except KeyboardInterrupt:
        shutdown_handler()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
