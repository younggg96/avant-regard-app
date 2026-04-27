#!/usr/bin/env python3
"""
backfill_user_levels.py
========================

为**存量用户**做一次等级回溯计算.

背景
----
等级系统 (migration 038) 上线时, 老用户的 `user_level_progress.counters`
是空的, 他们之前产生的行为 (发帖 / 点赞 / 关注 / 评论 / 档案) 都不会被
回溯计入. 这个脚本根据业务表里当前存在的真实行数给每个用户的 counters
做一次填补, 并静默升级到**能达到的最高 AUTO 等级**.

红线
----
  1. **只升不降**: DB 触发器强制, 重复跑不会回退等级.
  2. **不重发权益**: 使用 `level_service._silent_grant_benefit`, 已有记录则跳过.
  3. **不发通知**: 回填专用 `_silent_upgrade`, 避免老用户收到大量历史升级消息.
  4. **Lv4 达标**: 创建 level_upgrade_requests PENDING, 由运营人工审核; 不自动升级.
  5. **Lv5**: 仅 admin 手动赋级, 本脚本绝不触发.

用法
----
    cd backend
    source venv/bin/activate

    # 1) 干跑 (只统计不写库)
    python scripts/backfill_user_levels.py --dry-run

    # 2) 处理前 100 个 (用于分批测试)
    python scripts/backfill_user_levels.py --limit 100

    # 3) 单用户回填
    python scripts/backfill_user_levels.py --user-id 42

    # 4) 全量执行
    python scripts/backfill_user_levels.py

输出
----
终端打印每 100 个用户的进度 + 最终等级分布统计. 明细写入 Python logging,
按需重定向到文件:

    python scripts/backfill_user_levels.py 2>&1 | tee backfill.log

幂等保证
--------
重复执行是安全的:
  - counters 取 max(real_table_count, existing); 真实表倒退只会让 counters
    "等同或小于历史值"; 等级仍由触发器守住不回退.
  - user_level_benefits UNIQUE(user_id, benefit_id) + _silent_grant_benefit
    的 "if exists then skip" 保证不会重复发福利.
  - level_upgrade_requests 对 (user_id, target_level) WHERE status='PENDING'
    有 partial unique index, 重复创建被忽略.
"""

from __future__ import annotations

import argparse
import logging
import os
import sys
import time
from pathlib import Path

# 允许 `python scripts/xxx.py` 直接跑 (而不是 `python -m`)
BACKEND_ROOT = Path(__file__).resolve().parents[1]
if str(BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(BACKEND_ROOT))


def _setup_logging(verbose: bool) -> None:
    level = logging.DEBUG if verbose else logging.INFO
    logging.basicConfig(
        format="[%(asctime)s] %(levelname)s %(name)s: %(message)s",
        datefmt="%H:%M:%S",
        level=level,
    )
    # Supabase 客户端的日志太啰嗦, 压到 WARNING
    for noisy in ("httpx", "httpcore", "hpack", "urllib3", "supabase", "postgrest"):
        logging.getLogger(noisy).setLevel(logging.WARNING)


def _parse_args() -> argparse.Namespace:
    p = argparse.ArgumentParser(
        description="存量用户等级回填脚本 (幂等, 可 dry-run)",
    )
    p.add_argument("--dry-run", action="store_true",
                   help="只计算, 不写数据库")
    p.add_argument("--user-id", type=int, default=None,
                   help="只处理指定用户; 不传则扫描全量")
    p.add_argument("--limit", type=int, default=None,
                   help="最多处理 N 个用户, 用于小范围测试")
    p.add_argument("--offset", type=int, default=0,
                   help="从 users 表的第几行起扫描 (分批续跑)")
    p.add_argument("--verbose", "-v", action="store_true",
                   help="打印 DEBUG 级别日志")
    return p.parse_args()


def main() -> int:
    args = _parse_args()
    _setup_logging(args.verbose)

    # 延迟 import: 让 --help 不依赖环境变量
    from app.services.level_service import level_service

    mode = "DRY RUN" if args.dry_run else "LIVE"
    print(f"\n===== User Level Backfill · {mode} =====\n")

    t0 = time.time()

    if args.user_id:
        result = level_service.backfill_user(args.user_id, dry_run=args.dry_run)
        print(
            f"user {result['userId']}: "
            f"Lv{result['beforeLevel']} → Lv{result['afterLevel']}"
            + (f"  (pending Lv{result['pendingLevel']})" if result['pendingLevel'] else "")
        )
        print(f"counters: {result['counters']}")
        print(f"\nDone in {time.time() - t0:.1f}s")
        return 0

    summary = level_service.backfill_all(
        dry_run=args.dry_run,
        limit=args.limit,
        offset=args.offset,
    )

    dt = time.time() - t0
    print("\n--- Summary -----------------------------------------")
    print(f"  mode            : {mode}")
    print(f"  scanned         : {summary['scanned']}")
    print(f"  upgraded        : {summary['upgraded']}")
    print(f"  lv4 pending     : {summary['pendingCreated']}")
    print(f"  errors          : {summary['errors']}")
    print(f"  elapsed         : {dt:.1f}s")
    print(f"  level dist.     : {summary['levelDistribution']}")
    print("-----------------------------------------------------")
    if args.dry_run:
        print("  (nothing written; re-run without --dry-run to apply)")
    print()

    return 1 if summary["errors"] > 0 else 0


if __name__ == "__main__":
    sys.exit(main())
