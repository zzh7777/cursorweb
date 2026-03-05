# 业务术语与逻辑 — MySQL 实现示例

概念与规则类型见 [common/business-terms-and-logic.md](../common/business-terms-and-logic.md)。以下为 **MySQL** 下的写法示例（表名、字段名以当前库为准）。

---

## 类型一：重复/互斥

违规金额 = B 组 `inscp_amt` 求和

```sql
SUM(CASE WHEN f.hilist_name IN (B组项目) THEN f.inscp_amt ELSE 0 END) AS violation_amt
```

---

## 类型二：数量超标

按超出比例分摊

```sql
ROUND(SUM(f.inscp_amt) * (SUM(f.cnt) - N) / SUM(f.cnt), 2) AS violation_amt
```

HAVING 条件：`SUM(f.cnt) > N`

---

## 类型三：折扣收费

最大合理数量用整数运算，差值即违规数量。折扣因子 d = p/q 时，`FLOOR(cnt * q / p) * p / q`。前提：EXISTS 判断 A 组同天存在。

```sql
FLOOR(f.cnt * 10 / 7) * 7 / 10   -- 最大合理数量（70% 为例）
f.cnt - FLOOR(f.cnt * 10 / 7) * 7 / 10   -- 违规数量
ROUND(f.inscp_amt * (f.cnt - FLOOR(f.cnt * 10 / 7) * 7 / 10) / f.cnt, 2) AS violation_amt
```

---

## 类型四：周期频次

按天聚合后 LAG + 日期差。用 `DATE()`、`DATEDIFF`，不要用 `LEFT()` 或 `STR_TO_DATE`。

```sql
DATE(f.fee_ocur_time)   -- 日期部分
LAG(a.fee_date) OVER (PARTITION BY a.psn_no ORDER BY a.fee_date) AS prev_fee_date
DATEDIFF(fee_date, prev_fee_date)   -- 间隔天数（MySQL）
```
