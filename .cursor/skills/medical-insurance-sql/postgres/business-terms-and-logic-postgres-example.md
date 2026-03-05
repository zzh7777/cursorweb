# 业务术语与逻辑 — PostgreSQL 实现示例

概念与规则类型见 [common/business-terms-and-logic.md](../common/business-terms-and-logic.md)。以下为 **PostgreSQL** 下的写法示例（表名、字段名以当前库为准）。

---

## 类型一：重复/互斥

违规金额 = B 组符合范围金额求和

```sql
SUM(CASE WHEN f.hilist_name IN (B组项目) THEN f.inscp_amt ELSE 0 END) AS violation_amt
```

与 MySQL 写法一致。

---

## 类型二：数量超标

按超出比例分摊

```sql
ROUND(SUM(f.inscp_amt) * (SUM(f.cnt) - N) / NULLIF(SUM(f.cnt), 0)::numeric, 2) AS violation_amt
```

HAVING 条件：`SUM(f.cnt) > N`。注意整数除法在 PostgreSQL 中可能需 `::numeric` 或 `* 1.0` 以得到小数结果，按实际字段类型调整。

---

## 类型三：折扣收费

最大合理数量用整数运算，差值即违规数量。折扣因子 d = p/q 时，`FLOOR(cnt * q / p) * p / q`。前提：EXISTS 判断 A 组同天存在。

```sql
FLOOR(f.cnt * 10 / 7) * 7 / 10   -- 最大合理数量（70% 为例）
f.cnt - FLOOR(f.cnt * 10 / 7) * 7 / 10   -- 违规数量
ROUND((f.inscp_amt * (f.cnt - FLOOR(f.cnt * 10 / 7) * 7 / 10) / NULLIF(f.cnt, 0))::numeric, 2) AS violation_amt
```

---

## 类型四：周期频次

按天聚合后 LAG + 日期差。PostgreSQL 用**日期类型相减**得间隔天数，不用 `DATEDIFF`。

```sql
(f.fee_ocur_time)::date   -- 日期部分（或 DATE(f.fee_ocur_time) 若为 timestamp）
LAG(a.fee_date) OVER (PARTITION BY a.psn_no ORDER BY a.fee_date) AS prev_fee_date
(fee_date - prev_fee_date)   -- 间隔天数（date - date 得 integer 天）
```

筛选间隔不足：`WHERE (fee_date - prev_fee_date) < N`。不要用字符串截取日期。
