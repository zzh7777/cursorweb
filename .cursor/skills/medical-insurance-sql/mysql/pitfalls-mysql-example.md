# 踩坑清单 — MySQL 相关补充与示例

概念与检查要点见 [common/pitfalls.md](../common/pitfalls.md)。以下为 **MySQL** 下的字段类型与写法注意。

---

- **日期/时间**：begndate、enddate、fee_ocur_time 为 datetime；brdy 为 varchar。同天用 `DATE(f.fee_ocur_time)`，住院天数用 `DATEDIFF(s.enddate, s.begndate) + 1`，时间差用 `TIMESTAMPDIFF(HOUR, t1, t2)`。不要用 `ipt_days`。
- **住院判定**：med_type 住院类 21, 26, 28, 2105, 52。setl_d 为 integer，mdtrt_d/fee_list_d 为 varchar，比较时类型一致。
- **hosp_lv**：mdtrt_d 为 varchar（药店 `'11'`），setl_d 为 integer（药店 `11`）。
- **退费**：保留 refd_setl_flag = 1，让 SUM 正负对冲。
- **JOIN 膨胀**：先子查询分别聚合 setl_d、fee_list_d，再按 setl_id 关联，不要直接 JOIN 后 SUM(setl_d 金额)。
- **hilist_name**：精确匹配 `=` 或 `IN()`，不用 LIKE。
- **排除**：med_type != 51（产前检查包）、inhosp_stas = '0'（在院未出院）、setl_type != 3（医疗救助）、f.setl_id IS NOT NULL（待结算）。
