# 自审检查 — PostgreSQL 补充

公共部分（概念项）见 [common/self-review-checklist.md](../common/self-review-checklist.md)。

**PostgreSQL 自审补充**（写 PostgreSQL 时逐项过一遍）：

- [ ] 所有表名、字段名符合库规范（常见为小写）
- [ ] 类型匹配：字符串与字符串比较，数值与数值比较；timestamp/date 用日期函数或 cast，避免字符串截取
- [ ] 住院天数用 `(enddate::date - begndate::date) + 1`，不用 `ipt_days`
- [ ] "同天"用 `(fee_ocur_time)::date` 或 `DATE(fee_ocur_time)`，不用字符串截取
- [ ] med_type 住院用 `IN (21,26,28,2105,52)`，注意 setl_d 与 mdtrt_d/fee_list_d 类型可能不同，比较时一致
- [ ] hosp_lv / med_type 类型与所查表一致
- [ ] 已过滤 `vali_flag = 1`；退费保留对冲；setl_d 与 fee_list_d JOIN 时金额未膨胀
- [ ] GROUP BY 包含所有非聚合 SELECT 列；结果含参保人标识 + 机构标识 + 违规金额
- [ ] 时间语义：无限定词=就诊级(mdtrt_id)，"同时"=同天日期，"N小时内"=时间差，"N天内M次"=LAG+日期差（PostgreSQL 用 `(date1 - date2)` 得天数）
- [ ] 周期频次：LAG 按 `psn_no` 分区，用日期类型与日期相减，不用字符串截取
- [ ] 违规金额用 `inscp_amt`，计算方式与规则类型匹配；折扣收费用 `FLOOR(cnt*10/7)*7/10` 等整数运算；ROUND 必要时用 `::numeric`
- [ ] 已排除不适用的特殊记录；有歧义时已先澄清

**自审通过后再输出 SQL。**
