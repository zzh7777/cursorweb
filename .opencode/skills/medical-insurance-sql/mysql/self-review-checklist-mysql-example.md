# 自审检查 — MySQL 补充

公共部分（概念项）见 [common/self-review-checklist.md](../common/self-review-checklist.md)。

**MySQL 自审补充**（写 MySQL 时逐项过一遍）：

- [ ] 所有表名、字段名小写
- [ ] varchar 与字符串比较，int/double 与数字比较；begndate/enddate/fee_ocur_time 为 datetime，brdy 为 varchar
- [ ] 住院天数用 `DATEDIFF(enddate, begndate) + 1`，不用 `ipt_days`
- [ ] "同天"用 `DATE(fee_ocur_time)`，不用 `LEFT()`
- [ ] med_type 住院用 `IN (21,26,28,2105,52)`，注意 setl_d 为 integer、mdtrt_d/fee_list_d 为 varchar
- [ ] hosp_lv / med_type 类型与所查表一致
- [ ] 已过滤 `vali_flag = 1`；退费保留对冲；setl_d 与 fee_list_d JOIN 时金额未膨胀
- [ ] GROUP BY 包含所有非聚合 SELECT 列；结果含参保人标识 + 机构标识 + 违规金额
- [ ] 时间语义：无限定词=就诊级(mdtrt_id)，"同时"=同天 `DATE()`，"N小时内"=`TIMESTAMPDIFF()`，"N天内M次"=LAG+DATEDIFF
- [ ] 周期频次：LAG 按 `psn_no` 分区，用 `DATE()` 和 `DATEDIFF`，不用 `LEFT()`/`STR_TO_DATE`
- [ ] 违规金额用 `inscp_amt`，计算方式与规则类型匹配；折扣收费用 `FLOOR(cnt*10/7)*7/10` 等整数运算
- [ ] 已排除不适用的特殊记录；有歧义时已先澄清

**自审通过后再输出 SQL。**
