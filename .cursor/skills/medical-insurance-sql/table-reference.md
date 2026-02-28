# 三表字段详细参考

本文件为 SKILL.md 的补充参考，包含监管规则中常用字段的完整信息。仅在需要查阅具体字段细节时读取。

---

## 一、mdtrt_d（就诊表）常用字段

总记录数约 590 万。

| 字段 | 类型 | 说明 | 空值率 | 备注 |
|------|------|------|--------|------|
| mdtrt_id | bigint | **主键**，就诊唯一标识 | 0% | |
| psn_no | varchar | 参保人编号 | 0% | 约 113.5 万独立人 |
| psn_name | varchar | 参保人姓名 | 0% | |
| certno | varchar | 证件号码 | 0% | |
| gend | varchar | 性别 | 0% | 1=男, 2=女, 0=未知, 9=未说明 |
| brdy | varchar | 出生日期 | 0% | **varchar**，格式 YYYY-MM-DD |
| age | double | 就诊时年龄 | 0% | 范围 0~850，P95=78 |
| insutype | varchar | 险种类型 | 0% | 310=职工, 390=居民, 340=离休 |
| psn_type | varchar | 人员类别 | 0% | 11=在职, 12=退休, 1501=普通居民 |
| fixmedins_code | varchar | 机构编号 | 0% | 12位编码 |
| fixmedins_name | varchar | 机构名称 | 0% | |
| hosp_lv | varchar | 医院等级 | 0% | **01**=三级特, **02**=三甲, **03**=三乙, **11**=药店（注意有前导零） |
| med_type | varchar | 医疗类别 | 0% | 见 SKILL.md 字典 |
| begntime | time | 就诊开始时间 | 0% | 仅时间部分 |
| endtime | time | 就诊结束时间 | 0.11% | 在院未出院记录为空 |
| inhosp_stas | varchar | 在院状态 | 0% | 0=出院, 1=在院 |
| ipt_days | integer | 住院天数 | 95% | 仅住院记录有值 |
| dscg_maindiag_code | varchar | 住院主诊断编码 | 94.9% | ICD-10 编码，仅住院有值 |
| dscg_maindiag_name | varchar | 住院主诊断名称 | 94.9% | |
| dise_name | varchar | 病种名称 | 54.4% | |
| chfpdr_name | varchar | 主诊医师姓名 | 12.1% | |
| vali_flag | varchar | 有效标志 | 0% | 1=有效, 0=无效 |

---

## 二、setl_d（结算表）常用字段

总记录数约 700 万。

| 字段 | 类型 | 说明 | 空值率 | 备注 |
|------|------|------|--------|------|
| setl_id | bigint | **主键**，结算唯一标识 | 0% | |
| mdtrt_id | bigint | **外键** → mdtrt_d | 0% | |
| psn_no | varchar | 参保人编号 | 0% | |
| psn_name | varchar | 参保人姓名 | 0% | |
| certno | varchar | 证件号码 | 0% | |
| gend | integer | 性别 | 0% | 1=男, 2=女 |
| brdy | varchar | 出生日期 | 0% | varchar YYYY-MM-DD |
| age | double | 年龄 | 0.15% | |
| insutype | integer | 险种 | 0% | 310=职工, 390=居民 |
| psn_type | integer | 人员类别 | 0% | |
| fixmedins_code | varchar | 机构编号 | 0% | |
| fixmedins_name | varchar | 机构名称 | 0% | |
| hosp_lv | integer | 医院等级 | 0% | 1=三级, 2=二级, 3=一级, **11=药店**（**integer，无前导零**） |
| med_type | integer | 医疗类别 | 0% | 同 mdtrt_d 字典，但为 **integer** 类型 |
| begndate | varchar | 开始日期 | 0% | YYYY-MM-DD |
| enddate | varchar | 结束日期 | 0% | YYYY-MM-DD |
| setl_time | time | 结算时间 | 0% | 仅时间，无日期部分 |
| setl_type | integer | 结算类型 | 0% | 1=中心报销, 2=联网结算, 3=医疗救助 |
| clr_type | integer | 清算类型 | 0.15% | 11=门诊, 21=住院, 41=药店 |
| medfee_sumamt | double | **医疗费总额** | 0% | 均值 874, P95=3480 |
| fulamt_ownpay_amt | double | 全自费金额 | 0% | |
| hifp_pay | double | **统筹基金支出** | 0% | 均值 519, P95=2018 |
| fund_pay_sumamt | double | **基金支付总额** | 0% | 均值 571, P95=2135 |
| acct_pay | double | 个人账户支出 | 0% | |
| psn_pay | double | 个人支付金额 | 0% | |
| cash_payamt | double | 现金支付 | 0% | |
| refd_setl_flag | integer | 退费标志 | 0% | 0=正常(94.76%), 1=退费(5.24%) |
| vali_flag | integer | 有效标志 | 0% | 1=有效(99.63%), 0=无效 |
| mid_setl_flag | integer | 中途结算标志 | 95.6% | 0=否, 1=是 |

---

## 三、fee_list_d（费用明细表）常用字段

总记录数约 9766 万。

| 字段 | 类型 | 说明 | 空值率 | 备注 |
|------|------|------|--------|------|
| bkkp_sn | varchar | **主键**，记账流水号 | 0% | |
| mdtrt_id | bigint | **外键** → mdtrt_d | 0% | |
| setl_id | bigint | **外键** → setl_d | 0.15% | 空值 = 在院待结算 |
| psn_no | varchar | 参保人编号 | 0% | |
| fixmedins_code | varchar | 机构编号 | 0% | |
| fixmedins_name | varchar | 机构名称 | 0% | |
| med_type | varchar | 医疗类别 | 0% | **varchar** 类型 |
| fee_ocur_time | varchar | 费用发生时间 | 0% | `YYYY-MM-DD HH:MM:SS`，varchar |
| hilist_code | varchar | 医保目录编码 | 0% | 国家统一编码 |
| hilist_name | varchar | 医保目录名称 | 0% | |
| list_type | integer | 目录类别 | 0% | 101=西药, 102=饮片, 201=诊疗, 301=耗材 |
| med_chrgitm_type | integer | 收费项目类别 | 0% | 01=床位, 03=检查, 04=化验, 05=治疗, 06=手术, 09=西药, 11=中成药, 08=耗材 |
| chrgitm_lv | integer | 收费项目等级 | 0% | 1=甲类, 2=乙类, 3=丙类 |
| det_item_fee_sumamt | double | **明细费用总额** | 0% | 均值 63, P95=200 |
| inscp_amt | double | **符合范围金额** | 0% | 明细级违规金额计算专用字段 |
| pric | double | 单价 | 0% | |
| cnt | double | 数量 | 0% | |
| selfpay_prop | double | 自付比例 | 0% | |
| bilg_dept_codg | varchar | 开单科室编码 | 1.64% | 药店记录全为空 |
| bilg_dept_name | varchar | 开单科室名称 | 1.64% | 药店记录全为空 |
| bilg_dr_code | varchar | 开单医师编码 | 2.66% | |
| bilg_dr_name | varchar | 开单医师姓名 | 4.04% | |
| prd_days | double | 周期天数 | 92.9% | 开药天数 |
| vali_flag | integer | 有效标志 | 0% | 全部为 1 |

---

## 四、关键数据质量提示

| 问题 | 影响 | 处理建议 |
|------|------|---------|
| 手术操作代码（oprn_oprt_code）100% 为空 | 手术相关规则无法执行 | 不可用 |
| 门诊诊断（otp_diag_info）为自然语言文本 | 门诊诊断匹配精度低 | 住院用 dscg_maindiag_code |
| 产前检查包（med_type=51）8+ 字段豁免空值 | 完整性规则误报 | 排除 `med_type != '51'` |
| 在院未出院（inhosp_stas=1）无结算 | 金额/天数规则不适用 | 过滤 `inhosp_stas = '0'` |
| 医疗救助（setl_type=3）hifp_pay 恒为 0 | 统筹支出规则误判 | 排除 `setl_type != 3` |
| fee_list_d.setl_id 0.15% 空值 | 无法关联结算表 | 过滤 `setl_id IS NOT NULL` |
| 药店无科室（bilg_dept_codg/name 为空） | 科室合规性规则不适用 | 排除 hosp_lv=11 |
| hosp_lv 在两表中类型不同 | 比较值写法不同 | mdtrt_d 用 '11'(varchar)，setl_d 用 11(int) |

---

## 五、hosp_lv 值对照

| mdtrt_d (varchar) | setl_d (integer) | 含义 |
|-------------------|-----------------|------|
| '01' | 1 | 三级特等 |
| '02' | 2 | 三级甲等 |
| '03' | 3 | 三级乙等/一级 |
| '11' | 11 | **药店（零售药房）** |

## 六、med_type 完整字典

**门诊类**: 11=普通门诊, 12=门诊挂号, 14=门诊慢特病, 15=特药, 16=中医特色门诊, 18=特药购药, 108=门诊慢特病, 110202=特药门诊, 140101=门诊大病, 991401=门诊抢救, 992001=门检特检特治, 992002=大学生外伤门诊, 1301=急诊抢救

**住院类**: 21=普通住院, 26=单病种住院, 28=日间手术, 2105=按床日付费住院

**购药类**: 41=定点药店购药, 9929=药店购慢特病药

**生育类**: 51=生育门诊, 52=生育住院
