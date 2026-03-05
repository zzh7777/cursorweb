import os
import time
from contextlib import contextmanager

import pymysql
import pymysql.cursors

MAX_ROWS = 2000
QUERY_TIMEOUT = 60


def _get_config() -> dict:
    return {
        "host": os.getenv("MYSQL_HOST", ""),
        "port": int(os.getenv("MYSQL_PORT", "3306")),
        "user": os.getenv("MYSQL_USER", ""),
        "password": os.getenv("MYSQL_PASSWORD", ""),
        "database": os.getenv("MYSQL_DATABASE", ""),
    }


def is_configured() -> bool:
    cfg = _get_config()
    return bool(cfg["host"] and cfg["user"] and cfg["database"])


@contextmanager
def _get_connection():
    cfg = _get_config()
    if not cfg["host"]:
        raise RuntimeError("MySQL 未配置，请在 .env 中设置 MYSQL_HOST 等字段")
    conn = pymysql.connect(
        host=cfg["host"],
        port=cfg["port"],
        user=cfg["user"],
        password=cfg["password"],
        database=cfg["database"],
        charset="utf8mb4",
        cursorclass=pymysql.cursors.DictCursor,
        connect_timeout=10,
        read_timeout=QUERY_TIMEOUT,
        autocommit=True,
    )
    try:
        yield conn
    finally:
        conn.close()


def test_connection() -> dict:
    try:
        with _get_connection() as conn:
            with conn.cursor() as cur:
                cur.execute("SELECT 1 AS ok")
                cur.fetchone()
        return {"ok": True, "message": "连接成功"}
    except Exception as e:
        return {"ok": False, "message": str(e)}


def run_query(sql: str) -> dict:
    """Execute a read-only SQL query and return columns + rows."""
    sql_stripped = sql.strip().rstrip(";")

    forbidden = {"INSERT", "UPDATE", "DELETE", "DROP", "ALTER", "CREATE", "TRUNCATE", "REPLACE", "GRANT", "REVOKE"}
    first_keyword = sql_stripped.split()[0].upper() if sql_stripped else ""
    if first_keyword in forbidden:
        return {"error": f"禁止执行 {first_keyword} 语句，仅允许 SELECT 查询", "columns": [], "rows": [], "row_count": 0}

    if not sql_stripped.upper().startswith(("SELECT", "WITH", "SHOW", "DESCRIBE", "EXPLAIN")):
        return {"error": f"不支持的语句类型: {first_keyword}", "columns": [], "rows": [], "row_count": 0}

    has_limit = "LIMIT" in sql_stripped.upper().split("--")[0].split("/*")[0]
    exec_sql = sql_stripped if has_limit else f"{sql_stripped}\nLIMIT {MAX_ROWS}"

    start = time.time()
    try:
        with _get_connection() as conn:
            with conn.cursor() as cur:
                cur.execute(exec_sql)
                rows = cur.fetchall()
                columns = [desc[0] for desc in cur.description] if cur.description else []
        elapsed = round(time.time() - start, 2)

        serialized = []
        for row in rows:
            serialized.append({k: _serialize_value(v) for k, v in row.items()})

        return {
            "columns": columns,
            "rows": serialized,
            "row_count": len(serialized),
            "elapsed_seconds": elapsed,
            "truncated": not has_limit and len(serialized) >= MAX_ROWS,
        }
    except Exception as e:
        elapsed = round(time.time() - start, 2)
        return {"error": str(e), "columns": [], "rows": [], "row_count": 0, "elapsed_seconds": elapsed}


def _serialize_value(v):
    if v is None:
        return None
    if isinstance(v, (int, float, str, bool)):
        return v
    return str(v)
