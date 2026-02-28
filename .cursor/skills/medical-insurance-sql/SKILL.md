---
name: medical-insurance-sql
description: Generate MySQL SQL queries for medical insurance fraud detection and supervision rules. Use when writing SQL to detect insurance fraud, abuse, or violations against mdtrt_d (visit), setl_d (settlement), fee_list_d (fee detail) tables, or when the user mentions medical insurance monitoring rules.
---

# 医保线上监管 SQL 生成指南

## 一、三表结构

```
mdtrt_d（就诊表）──1:N──▶ setl_d（结算表）──1:N──▶ fee_list_d（费用明细表）
   PK: mdtrt_id              PK: setl_id              PK: bkkp_sn
   FK:                       FK: mdtrt_id             FK: setl_id, mdtrt_id
   三表共享: psn_no（参保人编号）
```

**选哪张表？**
- 金额汇总 → setl_d 单表
- 药品/项目明细 → fee_list_d（可关联 setl_d）
- 诊断信息 → mdtrt_d（关联 setl_d）
- 需要同时看汇总金额 + 明细 → 子查询分别聚合后再关联，**禁止直接 JOIN 后 SUM setl_d 金额字段**（一对多会膨胀）

## 二、字段速查

### 人员与机构（setl_d / mdtrt_d 均有）

| 字段 | 说明 |
|------|------|
| psn_no | 参保人编号（唯一标识） |
| psn_name | 姓名 |
| certno | 证件号码 |
| insutype | 险种：310=职工, 390=居民, 340=离休 |
| fixmedins_code | 机构编号 |
| fixmedins_name | 机构名称 |

### 结算表（setl_d）金额字段

| 字段 | 说明 |
|------|------|
| medfee_sumamt | 医疗费总额 |
| hifp_pay | 统筹基金支出 |
| fund_pay_sumamt | 基金支付总额（统筹+大病+救助等） |
| acct_pay | 个人账户支出 |
| psn_pay | 个人支付 |

### 费用明细表（fee_list_d）核心字段

| 字段 | 说明 |
|------|------|
| fee_ocur_time | 费用发生时间（varchar `YYYY-MM-DD HH:MM:SS`） |
| hilist_code / hilist_name | 医保目录编码 / 名称 |
| list_type | 101=西药, 102=饮片, 201=诊疗, 301=耗材 |
| det_item_fee_sumamt | 明细费用总额 |
| inscp_amt | **符合范围金额**（明细级违规金额计算专用） |
| pric / cnt | 单价 / 数量 |
| med_chrgitm_type | 收费类别：01=床位, 03=检查, 04=化验, 05=治疗, 06=手术, 09=西药, 11=中成药, 08=耗材 |
| bilg_dr_code / bilg_dr_name | 开单医师 |
| bilg_dept_codg / bilg_dept_name | 开单科室（药店记录全为空） |

### 通用过滤字段

| 字段 | 表 | 类型 | 说明 |
|------|-----|------|------|
| vali_flag | 三表 | int | **必须过滤 = 1** |
| med_type | 三表 | 见下方「坑」 | 医疗类别 |
| hosp_lv | mdtrt_d / setl_d | 见下方「坑」 | 医院等级，11=药店 |
| begndate | setl_d | varchar | 就诊日期 `YYYY-MM-DD` |
| refd_setl_flag | setl_d | varchar/int | 退费标志：0=正常, 1=退费（金额为负） |
| inhosp_stas | mdtrt_d | varchar | 在院状态：0=出院, 1=在院 |

### med_type 常用值

门诊：11=普通门诊, 14=门诊慢特病, 140101=门诊大病, 1301=急诊
住院：21=普通住院, 26=单病种, 28=日间手术
购药：41=定点药店购药, 9929=药店慢特病药
生育：51=生育门诊, 52=生育住院

完整字段详情见 [table-reference.md](table-reference.md)。

---

## 三、业务术语与逻辑约定

### 时间范围的隐含语义

| 规则措辞 | 实际含义 | SQL 层面 |
|---------|---------|---------|
| 无时间限定词 | **就诊级别**（同一次就诊内） | 同一 `mdtrt_id` |
| "同时" | **同一天内** | `LEFT(fee_ocur_time, 10)` 相同 |
| "N小时内" | 指定时间窗口内 | 需计算 fee_ocur_time 差值 |

示例：规则说"A与B同时收费"→ 找同一天内既有A又有B的记录；规则说"A与B不得重复收费"且无时间词 → 找同一次就诊内既有A又有B。

### 违规金额计算（inscp_amt）

明细级违规金额统一用 `inscp_amt`（符合范围金额），**不要用 det_item_fee_sumamt**。根据规则类型，计算方式不同：

**类型一：重复/互斥收费**（A与B同时收费，B为违规项）

- A、B 都是集合，不是单个项目
- B 是违规项（后者），违规金额 = B 的 `inscp_amt` 直接求和

```sql
SUM(CASE WHEN f.hilist_name IN (B组项目) THEN f.inscp_amt ELSE 0 END) AS violation_amt
```

**类型二：数量超标**（某项目收费次数超过阈值N，超出部分违规）

- 违规金额 = 总 inscp_amt 按超出比例分摊

```sql
ROUND(SUM(f.inscp_amt) * (SUM(f.cnt) - N) / SUM(f.cnt), 2) AS violation_amt
```

- 公式含义：超出次数占总次数的比例 × 总符合范围金额
- HAVING 条件：`SUM(f.cnt) > N`

### 主动澄清机制

**规则描述存在歧义或信息不足时，必须先向用户提问澄清，确认后再生成 SQL。** 常见需要澄清的情况：

- 规则中的"A"/"B"具体对应哪些 hilist_code 或 med_chrgitm_type
- 阈值的精确数值或计算口径
- 时间范围未明确（哪个月、哪一年）
- 违规金额的计算方式不确定
- 规则适用的机构类型、医疗类别不明确

---

## 四、踩坑清单

以下是**已知的、反复出现的坑**，写 SQL 时必须注意：

### 1. 日期字段全是 varchar

begndate、enddate 格式 `YYYY-MM-DD`，fee_ocur_time 格式 `YYYY-MM-DD HH:MM:SS`，brdy（出生日期）也是 varchar。

```sql
-- 正确：字符串比较
WHERE s.begndate >= '2025-12-01' AND s.begndate <= '2025-12-31'
WHERE LEFT(s.begndate, 7) = '2025-12'

-- 错误：不要用日期函数
WHERE YEAR(s.begndate) = 2025 AND MONTH(s.begndate) = 12
```

### 2. hosp_lv 两表类型不同

| 表 | 类型 | 药店值 | 三级值 |
|----|------|--------|--------|
| mdtrt_d | varchar | `'11'` | `'01'` |
| setl_d | integer | `11` | `1` |

### 3. med_type 两表类型不同

setl_d 中是 **integer**，mdtrt_d / fee_list_d 中是 **varchar**。

### 4. 退费记录金额为负

refd_setl_flag = 1 的退费记录，medfee_sumamt、hifp_pay 等为负值。默认保留让 SUM 正负对冲，**不要排除**，否则高估实际支出。

### 5. JOIN fee_list_d 与 setl_d 时金额膨胀

setl_d 的金额是结算级汇总，fee_list_d 一条结算对应多条明细。直接 JOIN 后 SUM(hifp_pay) 会膨胀 N 倍。

```sql
-- 错误
SELECT SUM(s.hifp_pay) FROM setl_d s JOIN fee_list_d f ON s.setl_id = f.setl_id;

-- 正确：先分别聚合，再关联
SELECT a.hifp_sum, b.fee_cnt
FROM (SELECT setl_id, SUM(hifp_pay) AS hifp_sum FROM setl_d GROUP BY setl_id) a
JOIN (SELECT setl_id, COUNT(*) AS fee_cnt FROM fee_list_d GROUP BY setl_id) b
  ON a.setl_id = b.setl_id;
```

### 6. hilist_name 匹配规则

- 数据中统一使用半角括号 `()`，**不需要处理全角**
- **不要用 LIKE 模糊匹配**，直接用 `=` 或 `IN()` 精确匹配。项目名称是标准化的，不存在需要模糊的场景

### 7. 需要排除的特殊记录

| 场景 | 过滤条件 | 原因 |
|------|---------|------|
| 产前检查定额包 | `med_type != 51` | 8+ 字段豁免空值，非数据质量问题 |
| 在院未出院 | `inhosp_stas = '0'` | 无结算、无出院时间，住院类规则不适用 |
| 医疗救助结算 | `setl_type != 3` | hifp_pay 恒为 0，统筹类规则不适用 |
| 待结算明细 | `f.setl_id IS NOT NULL` | 费用已上传但未结算 |

---

## 四、输出要求

不限定固定模板，根据规则语义自行选择合适的 SQL 模式。但输出须满足：

1. **SQL 头部注释**：规则编号、名称、一句话描述
2. **可追溯**：结果中包含参保人标识（psn_no + psn_name + certno）和机构标识（fixmedins_code + fixmedins_name）
3. **违规金额**：必须有一列计算违规金额（超出阈值的部分、不应收费的金额等，视规则而定）
4. **辅助审查**：酌情添加就诊次数、结算笔数、时间范围等帮助人工判断的字段
5. **字段名小写**，中文别名用 AS

---

## 五、自审检查

SQL 写完后，逐项过一遍：

- [ ] 所有表名、字段名小写
- [ ] varchar 字段与字符串比较，int/double 字段与数字比较
- [ ] 日期字段用字符串比较，未使用日期函数
- [ ] hosp_lv / med_type 的类型与所查的表一致
- [ ] 已过滤 `vali_flag = 1`
- [ ] 退费记录处理正确（通常保留对冲）
- [ ] 若涉及 setl_d 与 fee_list_d JOIN，确认金额字段未膨胀
- [ ] GROUP BY 包含所有非聚合 SELECT 列
- [ ] 结果包含参保人标识 + 机构标识 + 违规金额
- [ ] 时间范围边界值正确（月末天数）
- [ ] 时间范围语义正确：无限定词=就诊级(mdtrt_id)，"同时"=同天，"N小时内"=时间差
- [ ] 违规金额用 `inscp_amt`（不是 `det_item_fee_sumamt`），且计算方式与规则类型匹配（重复收费→直接求和，数量超标→按比例分摊）
- [ ] 已排除不适用的特殊记录（按需）
- [ ] 规则有歧义时已先向用户澄清，未自行假设

**自审通过后再输出 SQL。**
