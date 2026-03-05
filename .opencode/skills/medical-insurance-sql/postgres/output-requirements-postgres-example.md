# 输出要求 — PostgreSQL 示例

公共部分见 [common/output-requirements.md](../common/output-requirements.md)。

**PostgreSQL 下**：按库规范使用表名/字段名（常见为小写）；输出列用 AS 中文别名，例如：

```sql
f.psn_no              AS 参保人编号,
MAX(s.psn_name)       AS 参保人姓名,
MAX(s.certno)         AS 证件号码,
f.fixmedins_code      AS 机构编号,
MAX(f.fixmedins_name) AS 机构名称,
ROUND(...::numeric, 2) AS 违规金额
```

金额四舍五入时可用 `ROUND(...::numeric, 2)` 避免整数除法；列名与公共要求一致。
