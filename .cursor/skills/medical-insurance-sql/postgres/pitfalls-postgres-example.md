# 踩坑清单 — PostgreSQL 相关补充与示例

概念与检查要点见 [common/pitfalls.md](../common/pitfalls.md)。以下为 **PostgreSQL** 下的字段类型与写法注意。

---

- **日期/时间**：begndate、enddate、fee_ocur_time 为 timestamp/date 时，同天用 `(f.fee_ocur_time)::date` 或 `DATE(f.fee_ocur_time)`；住院天数用 `(s.enddate::date - s.begndate::date) + 1`；时间差（小时）用 `EXTRACT(EPOCH FROM (t2 - t1)) / 3600` 或等价写法。不要用 `ipt_days`。
- **住院判定**：med_type 住院类 21, 26, 28, 2105, 52。若 setl_d 为 integer、mdtrt_d/fee_list_d 为 varchar，比较时类型一致（显式 cast 若需）。
- **hosp_lv**：按实际表结构，mdtrt_d 可能为 varchar（药店 `'11'`），setl_d 可能为 integer（药店 `11`）。
- **退费**：保留 refd_setl_flag = 1，让 SUM 正负对冲。
- **JOIN 膨胀**：先子查询分别聚合 setl_d、fee_list_d，再按 setl_id 关联，不要直接 JOIN 后 SUM(setl_d 金额)。
- **hilist_name**：精确匹配 `=` 或 `IN()`，不用 LIKE。
- **排除**：med_type != 51（产前检查包）、inhosp_stas = '0'（在院未出院）、setl_type != 3（医疗救助）、f.setl_id IS NOT NULL（待结算）。
