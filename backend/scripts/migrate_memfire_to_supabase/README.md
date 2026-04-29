# MemFire → Supabase 结构迁移工具

把 Avant Regard 的**空架构**从 MemFire Cloud 部署到官方 Supabase（海外节点）。

> ⚠️ 本工具**只迁移结构**：表、触发器、函数、扩展、RLS、Storage buckets。
> **不迁移任何业务数据、用户账号、文件**。目标项目是干净空库。

## 适用场景

- 想要一个海外节点的后端做开发/预发环境
- 准备做灰度/切流，先把结构对齐，数据后续再决定
- 给不同区域的用户建独立数据库（国内 / 海外各一份）

如果你要连带数据一起迁，可以在这个工具上扩展（见"后续扩展"），或直接用 `pg_dump` + Supabase Storage API 脚本。

## 结构清单

| 来源 | 迁什么 |
|---|---|
| `backend/app/db/memfiredb_full_schema.sql` | 37 张业务表、索引、触发器、函数、扩展（`uuid-ossp` 等） |
| MemFire Storage | bucket 名称、public/private、file_size_limit、allowed_mime_types（文件内容**不**迁） |

## 准备

### 1. 新建 Supabase 项目

1. [supabase.com](https://supabase.com) → New Project
2. 区域推荐 `ap-southeast-1`（新加坡，兼顾国内外延迟）
3. 记下：
   - Project URL（如 `https://abcdefg.supabase.co`）
   - `service_role` secret key（Settings → API）
   - Postgres connection string（Settings → Database → Connection string → URI），**可选但强烈推荐**

### 2. 安装依赖

```bash
cd backend
source venv/bin/activate   # 或用你自己的 venv
pip install -r requirements.txt
pip install -r scripts/migrate_memfire_to_supabase/requirements.txt

brew install libpq && brew link --force libpq   # 提供 psql / pg_dump
```

### 3. 配置环境变量

```bash
cd backend/scripts/migrate_memfire_to_supabase
cp .env.example .env
# 编辑 .env 填实际值
```

## 使用

从 `backend/` 目录执行（不要 `cd` 进子目录）：

### 先 dry-run

```bash
cd backend
MIGRATION_DRY_RUN=1 venv/bin/python -m scripts.migrate_memfire_to_supabase.migrate all
```

只读不写，验证：
- 双端点连接通
- 源 bucket 列表符合预期
- schema 文件找得到

### 正式迁移

```bash
cd backend
venv/bin/python -m scripts.migrate_memfire_to_supabase.migrate all
```

### 单阶段执行

```bash
venv/bin/python -m scripts.migrate_memfire_to_supabase.migrate schema
venv/bin/python -m scripts.migrate_memfire_to_supabase.migrate storage
```

## 幂等性

两个阶段重跑都安全：

| 阶段 | 幂等机制 |
|---|---|
| `schema` | SQL 里全是 `CREATE ... IF NOT EXISTS`，重复执行零副作用 |
| `storage` | 每个 bucket 建之前先查目标列表，已存在直接 skip |

中断随时可以重跑。

## 两种 schema 应用路径

**A. 填了 `TARGET_POSTGRES_URL`（推荐）**
脚本直接 `psql -f memfiredb_full_schema.sql` 应用，完整保留触发器 / 函数 / RLS，一条命令搞定。

**B. 没填 `TARGET_POSTGRES_URL`**
脚本会打印提示让你：
1. 打开 Supabase Dashboard → SQL Editor
2. 粘贴 `backend/app/db/memfiredb_full_schema.sql` 全部内容
3. 点 Run

然后继续跑 `storage` 阶段。

## 切换流量（结构就绪后）

结构迁完后，实际用起来前你还需要：

1. 决定数据怎么处理（保持 MemFire 为主，或者后续补迁数据）
2. 更新配置：
   - `backend/.env`: `SUPABASE_URL`/`SUPABASE_KEY`/`SUPABASE_SERVICE_KEY`
   - `frontend/.env`, `web/.env.local` 同步
3. 重启后端，重新构建 App

## 文件清单

```
backend/scripts/migrate_memfire_to_supabase/
├── README.md                  本文档
├── .env.example               配置模板
├── requirements.txt           额外依赖
├── __init__.py
├── migrate.py                 CLI 入口（schema / storage / all）
├── config.py                  配置加载 + 双端点客户端
├── migrate_schema.py          psql 应用 schema（回退手动）
└── migrate_storage.py         创建空 bucket（保留 public/mime/size 配置）
```

## 后续扩展（如果之后要迁数据）

本工具留了干净的分层，加数据迁移只需：

1. 新建 `migrate_data.py` + `tables.py`（FK 拓扑排序）
2. 新建 `migration_helpers.sql`（BIGSERIAL 序列重置 RPC）
3. 在 `migrate.py` 里加 `data` 子命令
4. 用 keyset 分页 + `upsert(on_conflict=pk)` 保留原 ID

认证用户类似，用 Supabase Admin API 逐个 `create_user` 就行（密码要用户重置）。

## 故障排查

| 症状 | 处置 |
|---|---|
| `Missing required env var` | `.env` 没填齐，检查四个 `*_SUPABASE_*` |
| `SOURCE_SUPABASE_URL and TARGET_SUPABASE_URL are identical` | 防呆校验，改 `.env` |
| `psql not found` | `brew install libpq && brew link --force libpq` |
| SQL Editor 里报 `extension "uuid-ossp" does not exist` | Supabase 默认允许，但先要在 Database → Extensions 里启用 |
| `new bucket API rejected: policy violation` | 目标 key 不是 `service_role`，换对 |
