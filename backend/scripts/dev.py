"""开发启动器：一条命令同时拉起 uvicorn 与 vite，任一退出即全部退出。"""

from __future__ import annotations

import os
import shutil
import signal
import subprocess
import sys
import time
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent.parent
BACKEND = ROOT / "backend"
FRONTEND = ROOT / "frontend"


def npm_command() -> str:
    for name in ("npm.cmd", "npm"):
        found = shutil.which(name)
        if found:
            return found
    fallback = Path.home() / ".local" / "node" / "npm.cmd"
    if fallback.exists():
        return str(fallback)
    raise SystemExit("找不到 npm：请先安装 Node.js LTS")


def python_command() -> str:
    for candidate in (BACKEND / ".venv" / "Scripts" / "python.exe", BACKEND / ".venv" / "bin" / "python"):
        if candidate.exists():
            return str(candidate)
    return sys.executable


def main() -> int:
    if not (FRONTEND / "node_modules").is_dir():
        print("正在安装前端依赖…")
        subprocess.run([npm_command(), "install"], cwd=FRONTEND, check=True)

    env = dict(os.environ)
    env.setdefault("ADMIN_PASSWORD", "yg-admin")
    backend = subprocess.Popen(
        [
            python_command(),
            "-m",
            "uvicorn",
            "app.main:app",
            "--reload",
            "--host",
            "127.0.0.1",
            "--port",
            "8000",
        ],
        cwd=BACKEND,
        env=env,
    )
    frontend = subprocess.Popen([npm_command(), "run", "dev"], cwd=FRONTEND, env=env)

    def shutdown(*_: object) -> None:
        for process in (frontend, backend):
            if process.poll() is None:
                process.terminate()

    signal.signal(signal.SIGINT, shutdown)
    try:
        while True:
            if backend.poll() is not None:
                print("后端已退出")
                return backend.returncode or 1
            if frontend.poll() is not None:
                print("前端已退出")
                return frontend.returncode or 1
            time.sleep(0.5)
    finally:
        shutdown()


if __name__ == "__main__":
    raise SystemExit(main())
