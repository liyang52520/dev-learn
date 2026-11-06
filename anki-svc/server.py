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
from datetime import datetime, timedelta
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
PENDING_SNAPSHOT = {"value": False}
COL: Collection | None = None


# ---------------------------------------------------------------- 基础设施


def read_token() -> str:
    if not TOKEN_PATH.exists():
        TOKEN_PATH.write_text(os.urandom(24).hex(), encoding="utf-8")
        TOKEN_PATH.chmod(0o600)
    return TOKEN_PATH.read_text(encoding="utf-8").strip()


TOKEN = read_token()


def snapshot(reason: str = "auto", force: bool = False) -> Path | None:
    """用 sqlite 的在线备份接口做一致性快照，库开着也能安全执行。

    定时快照只在「上次快照后确实写过东西」时执行，避免空转产生几十份一样的库。
    """
    with LOCK:
        if not force and reason == "timer" and not PENDING_SNAPSHOT["value"]:
            return None
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

        PENDING_SNAPSHOT["value"] = False
        backups = sorted(BACKUP_DIR.glob("collection-*.anki2"))
        for old in backups[:-KEEP_BACKUPS]:
            old.unlink(missing_ok=True)
        print(f"[backup] {target.name} ({target.stat().st_size // 1024} KB)", flush=True)
        return target


def git_sync(message: str) -> tuple[bool, str]:
    """把 collection 提交并推到 dev-anki。返回真实结果，不能假报成功。"""
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
            return True, "没有改动，无需推送"
        subprocess.run(["git", "-C", str(DATA_DIR), "commit", "-q", "-m", message],
                       check=True, timeout=60, capture_output=True)
        subprocess.run(["git", "-C", str(DATA_DIR), "push", "-q", "origin", "HEAD"],
                       check=True, timeout=120, capture_output=True)
        print(f"[git] 已推送：{message}", flush=True)
        return True, "已提交并推送"
    except subprocess.CalledProcessError as exc:
        # 别把 Python 的异常串直接甩给页面：取 git 自己的最后一行报错，
        # 比如 "fatal: not a git repository"，这比退出码有用得多。
        raw = exc.stderr or b""
        if isinstance(raw, bytes):
            raw = raw.decode("utf-8", "replace")
        lines = [line.strip() for line in str(raw).splitlines() if line.strip()]
        reason = lines[-1] if lines else f"git 退出码 {exc.returncode}"
        print(f"[git] 同步失败：{reason}", flush=True)
        return False, reason
    except Exception as exc:  # noqa: BLE001
        print(f"[git] 同步失败：{exc}", flush=True)
        return False, str(exc)


def maintenance_loop() -> None:
    last_snap = time.time()
    last_git = time.time()
    last_checkpoint = time.time()
    while True:
        time.sleep(30)
        now = time.time()
        if now - last_snap >= SNAPSHOT_EVERY:
            snapshot("timer")
            last_snap = now
        if now - last_git >= GIT_SYNC_EVERY and DIRTY["value"]:
            DIRTY["value"] = False
            git_sync(f"复习 {datetime.now():%Y-%m-%d %H:%M} 自动同步")
            last_git = now
        # 每次评分都会写 WAL，定期回收，避免 -wal 一直长胖。
        if now - last_checkpoint >= 300:
            with LOCK:
                try:
                    COL.db.all("pragma wal_checkpoint(passive)")
                except Exception:  # noqa: BLE001
                    pass
            last_checkpoint = now


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


QUEUE_MODES = ("mixed", "due", "new")


def queue_view(limit: int = 1, mode: str = "mixed") -> dict:
    if mode not in QUEUE_MODES:
        mode = "mixed"
    with LOCK:
        deck_id()
        # 过滤模式需要往后多取一些，才能跨过被过滤掉的卡；日限额最多几百张，500 足够。
        fetch = limit if mode == "mixed" else 500
        queued = COL.sched.get_queued_cards(fetch_limit=fetch)
        picked = queued.cards
        if mode == "due":
            # get_queued_cards 会把「今天的学习卡」一起取出来，哪怕它还没到点
            # （学习步骤 10 分钟只是排期，不是已经到期）。这里按 due_total 的
            # 同一套标准再筛一次，否则点「只做到期」会提前 6 分钟弹出一张卡。
            now = int(time.time())
            crt = COL.db.scalar("select crt from col") or 0
            today_day = (now - crt + 4 * 3600) // 86400
            picked = [
                qc for qc in picked
                if (qc.card.ctype in (1, 3) and qc.card.due <= now)
                or (qc.card.ctype == 2 and qc.card.due <= today_day)
            ]
        elif mode == "new":
            picked = [qc for qc in picked if qc.card.ctype == 0]
        picked = picked[:limit]
        items = []
        for qc in picked:
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
            "due_total": due_total(),
        }


def counts() -> dict:
    with LOCK:
        new, learning, review = COL.sched.counts()
        return {"new": new, "learning": learning, "review": review}


def answer(card_id: int, rating: int, mode: str = "mixed") -> dict:
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
            # CardAnswer.rating 的枚举从 0 开始（AGAIN=0…EASY=3），
            # 站点传的是 1-4，这里必须减一，否则每次评分都会落到隔壁按钮。
            rating=rating - 1,
            answered_at_millis=int_time(1000),
            milliseconds_taken=max(0, min(elapsed, 120_000)),
        ))
        PENDING.pop(card_id, None)
        DIRTY["value"] = True
        PENDING_SNAPSHOT["value"] = True
        # 顺手把下一张卡带回去：前端少一次往返（answer → queue 两跳变一跳）
        nxt = queue_view(1, mode)
        return {
            "counts": nxt["counts"],
            "due_total": nxt["due_total"],
            "next": nxt["cards"][0] if nxt["cards"] else None,
        }


def undo() -> dict:
    with LOCK:
        if not COL.undo_status().undo:
            raise LookupError("没有可撤销的操作")
        COL.undo()
        PENDING.clear()
        DIRTY["value"] = True
        PENDING_SNAPSHOT["value"] = True
        return {"counts": counts(), "due_total": due_total()}


# Anki 默认凌晨 4 点换日。SQL 里先把时间戳减 4 小时再取本地日期，
# 和调度器的「今天」保持一致，否则 0:00–4:00 的复习会被算到前一天。
DAY_SHIFT = "-4 hours"


def day_rows(days: int = 365) -> list[dict]:
    with LOCK:
        cutoff_ms = int((time.time() - days * 86400) * 1000)
        rows = COL.db.all(
            "select date(id / 1000, 'unixepoch', 'localtime', ?) as d, "
            "       count(distinct cid) "
            "from revlog where id >= ? group by d order by d",
            DAY_SHIFT, cutoff_ms)
        return [{"date": str(d), "count": int(c)} for d, c in rows]


def can_undo() -> bool:
    with LOCK:
        try:
            return bool(COL.undo_status().undo)
        except Exception:  # noqa: BLE001
            return False


def due_total() -> int:
    """当前真正到期、且没被日限额截断的卡片数（含学习中）。"""
    with LOCK:
        crt = COL.db.scalar("select crt from col") or 0
        now = int(time.time())
        today_day = (now - crt + 4 * 3600) // 86400
        row = COL.db.scalar(
            "select count(*) from cards where queue >= 0 and ("
            "(type in (1, 3) and due <= ?) or (type = 2 and due <= ?))",
            now, today_day)
    return int(row or 0)


def today_card_counts() -> tuple[int, int, int, int]:
    """今日学过 / 其中新学 / 复习 / 重学（都按 cid 去重）。

    revlog 一次学习步骤会新增一条记录，同一张卡可能被记多次，
    所以必须 distinct；另外「今天新学」的卡同一天再次出现时不再计入复习，
    避免进度条把同一张卡算两遍。
    """
    with LOCK:
        row = COL.db.all(
            "with t as ("
            "  select cid, type from revlog "
            "  where date(id / 1000, 'unixepoch', 'localtime', ?) = "
            "        date('now', 'localtime', ?)"
            "), n as (select distinct cid from t where type = 0) "
            "select (select count(distinct cid) from t), "
            "       (select count(*) from n), "
            "       (select count(distinct cid) from t "
            "         where type = 1 and cid not in (select cid from n)), "
            "       (select count(distinct cid) from t where type = 2)",
            DAY_SHIFT, DAY_SHIFT,
        )[0]
    return int(row[0] or 0), int(row[1] or 0), int(row[2] or 0), int(row[3] or 0)


def next_rollover_epoch() -> int:
    """下一次凌晨 4 点换日的时间戳。"""
    now = datetime.now()
    target = now.replace(hour=4, minute=0, second=0, microsecond=0)
    if target <= now:
        target += timedelta(days=1)
    return int(target.timestamp())


def next_due_epoch() -> int | None:
    """距离下一张卡可学还有多久（秒）。

    Anki 的 due 语义按类型不同：学习/重学卡存的是时间戳，复习卡存的是「天数」，
    要加 collection 创建时间 crt 才能换算成时间。
    如果当前因为日限额没卡了，但库里还有新卡，下一次要等到凌晨换日。
    """
    with LOCK:
        crt = COL.db.scalar("select crt from col") or 0
        row = COL.db.scalar(
            "select min(case when type in (1,3) then due "
            "when type = 2 then due * 86400 + ? end) "
            "from cards where queue >= 0 and type in (1,2,3)",
            crt,
        )
        new_left = COL.db.scalar(
            "select count(*) from cards where type = 0 and queue >= 0") or 0
    if row:
        return int(row)
    if new_left:
        return next_rollover_epoch()
    return None


def last_backup() -> dict | None:
    files = sorted(BACKUP_DIR.glob("collection-*.anki2"))
    if not files:
        return None
    latest = files[-1]
    return {
        "name": latest.name,
        "size": latest.stat().st_size,
        "at": int(latest.stat().st_mtime),
        "count": len(files),
    }


def stats() -> dict:
    rows = day_rows(365)
    by_day = {row["date"]: row["count"] for row in rows}
    today = (datetime.now() - timedelta(hours=4)).date()
    streak = 0
    cursor = today
    if by_day.get(today.isoformat(), 0) == 0:
        cursor = today - timedelta(days=1)  # 今天还没开始不算断
    while by_day.get(cursor.isoformat(), 0) > 0:
        streak += 1
        cursor -= timedelta(days=1)
    cards_today, new_today, review_today, relearn_today = today_card_counts()
    config = get_config()
    with LOCK:
        total_reviews = COL.db.scalar(
            "select count(*) from revlog where type in (1, 2)") or 0
        total_answers = COL.db.scalar("select count(*) from revlog") or 0
        notes = COL.db.scalar("select count(*) from notes") or 0
        new_remaining = COL.db.scalar(
            "select count(*) from cards where type = 0 and queue >= 0") or 0
    return {
        "counts": counts(),
        "due_total": due_total(),
        "today": cards_today,
        "today_new": new_today,
        "today_review": review_today,
        "today_relearn": relearn_today,
        "new_per_day": config["new_per_day"],
        "rev_per_day": config["rev_per_day"],
        "can_undo": can_undo(),
        "new_remaining": int(new_remaining),
        "streak": streak,
        "total_reviews": int(total_reviews),
        "total_answers": int(total_answers),
        "total_cards": int(notes),
        "next_due_epoch": next_due_epoch(),
        "last_backup": last_backup(),
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
            # desiredRetention 默认就是 0.9，不能用它判断 FSRS 是否开启；
            # 只有真正写入权重（或显式 fsrsEnabled）才算启用。
            "fsrs_enabled": bool(
                cfg.get("fsrsEnabled")
                or cfg.get("fsrsWeights")
                or cfg.get("fsrsParams5")
            ),
            "new_order": cfg.get("newGatherPriority"),
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
        PENDING_SNAPSHOT["value"] = True
        return get_config()


def ensure_queue_order() -> None:
    """让新卡按「添加顺序」出队，也就是导入时的课程序。

    Anki 默认的新卡 gather order 是 deck / 随机，跨子 deck 时会先出
    字母序靠后的专题（实测第一张是 DDD，最后一课），必须显式改。
    """
    with LOCK:
        cfg = COL.decks.config_dict_for_deck_id(deck_id())
        if cfg.get("newGatherPriority") == 1 and cfg.get("newSortOrder") == 1:
            return
        cfg["newGatherPriority"] = 1  # LOWEST_POSITION：按新卡位置（导入顺序）
        cfg["newSortOrder"] = 1       # NO_SORT：不要再按模板重排
        COL.decks.update_config(cfg)
        DIRTY["value"] = True
        PENDING_SNAPSHOT["value"] = True
        print("[sched] 新卡顺序已改为按添加顺序（课程序）", flush=True)


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
                mode = "mixed"
                for part in query.split("&"):
                    if part.startswith("limit="):
                        limit = max(1, min(int(part[6:] or 1), 20))
                    elif part.startswith("mode="):
                        mode = part[5:]
                self._send(200, {"ok": True, **queue_view(limit, mode)})
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
                result = answer(
                    int(body.get("card_id", 0)),
                    int(body.get("rating", 0)),
                    str(body.get("mode") or "mixed"),
                )
                self._send(200, {"ok": True, **result})
            elif path == "/undo":
                self._send(200, {"ok": True, **undo()})
            elif path == "/config":
                self._send(200, {"ok": True, **set_config(
                    body.get("new_per_day"), body.get("rev_per_day"))})
            elif path == "/sync":
                snap = snapshot("manual", force=True)
                if snap is None:
                    self._fail(500, "快照失败，请检查服务日志")
                    return
                git_ok, git_msg = git_sync(f"手动同步 {datetime.now():%Y-%m-%d %H:%M}")
                if not git_ok:
                    self._send(502, {
                        "ok": False,
                        "error": f"快照已生成（{snap.name}），但 git 同步失败：{git_msg}",
                        "backup": snap.name,
                        "git": git_msg,
                    })
                    return
                self._send(200, {"ok": True, "backup": snap.name, "git": git_msg})
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
    ensure_queue_order()
    print(f"[server] deck: {DECK_NAME} | config: {get_config()}")
    print(f"[server] token: {TOKEN_PATH}（站点侧自动读取）")

    snapshot("startup", force=True)
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
