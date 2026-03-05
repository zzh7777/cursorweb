![1772696674451](image/SKILL/1772696674451.png)---
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
| fee_ocur_time | 费用发生时间（datetime） |
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
| begndate / enddate | setl_d | datetime | 就诊开始/结束日期 |
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
| "同时" / "同天" | **同一天内** | `DATE(fee_ocur_time)` 相同 |
| "每日" / "每天" | **按天限额**（跨就诊累计） | `DATE(fee_ocur_time)` 分组，**不限 mdtrt_id** |
| "N小时内" | 指定时间窗口内 | 需计算 `TIMESTAMPDIFF(HOUR, t1, t2)` |
| "N天内不超过M次" | **周期频次限额**（跨就诊、跨机构） | LAG() 窗口函数 + DATEDIFF，见类型四 |

示例：规则说"A与B同时收费"→ 找同一天内既有A又有B的记录（`DATE(fee_ocur_time)`）；规则说"A与B不得重复收费"且无时间词 → 找同一次就诊内既有A又有B；规则说"14天内不超过1次"→ 用 LAG 取上次日期，DATEDIFF 判断间隔。

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

**类型三：折扣收费**（A与B共现时，B须按折扣率收费）

规则示例："血气分析同时进行无机元素测定时，无机元素测定须按70%收费"。体现在数据上：B 的 `cnt` 应为折扣因子的倍数（70% → cnt 为 0.7 的倍数）。

违规判定：找到不超过实际 cnt 的**最大合理数量**，差值即违规数量。

```sql
-- 以折扣率70%为例（折扣因子=0.7）
-- 用整数运算避免浮点精度问题：0.7 = 7/10

-- 最大合理数量
FLOOR(f.cnt * 10 / 7) * 7 / 10

-- 违规数量
f.cnt - FLOOR(f.cnt * 10 / 7) * 7 / 10

-- 违规金额 = inscp_amt 按违规数量占比分摊
ROUND(f.inscp_amt * (f.cnt - FLOOR(f.cnt * 10 / 7) * 7 / 10) / f.cnt, 2) AS violation_amt
```

- 通用公式：折扣因子 d = p/q（如 0.7 = 7/10），则 `FLOOR(cnt * q / p) * p / q`
- 只对违规数量 > 0 的记录计入
- 前提：A 与 B 须同天共现（EXISTS 判断 A 组存在）

**类型四：周期频次限额**（N天内不超过M次，超出部分违规）

规则示例："平衡试验(视动试验) 14天内支付不超过1次，评定间隔不短于14天"。

核心思路：按天聚合后，用 `LAG()` 窗口函数取前一次收费日期，`DATEDIFF` 算间隔，间隔 < N 天则违规。

```sql
WITH daily_agg AS (
    -- 第一步：按 人+机构+日期 聚合目标项目的每日费用
    SELECT
        f.psn_no,
        f.fixmedins_code,
        MAX(f.fixmedins_name)      AS fixmedins_name,
        MAX(s.psn_name)            AS psn_name,
        MAX(s.certno)              AS certno,
        DATE(f.fee_ocur_time)      AS fee_date,
        SUM(f.cnt)                 AS daily_cnt,
        SUM(f.inscp_amt)           AS daily_inscp_amt
    FROM fee_list_d f
    JOIN setl_d s ON f.setl_id = s.setl_id AND s.vali_flag = 1
    WHERE f.vali_flag = 1
      AND f.hilist_name = '目标项目名称'
      AND f.setl_id IS NOT NULL
    GROUP BY f.psn_no, f.fixmedins_code, DATE(f.fee_ocur_time)
),
with_prev AS (
    -- 第二步：LAG 取前一次收费日期（按参保人分区，跨机构）
    SELECT a.*,
        LAG(a.fee_date) OVER (
            PARTITION BY a.psn_no ORDER BY a.fee_date
        ) AS prev_fee_date
    FROM daily_agg a
)
-- 第三步：筛出间隔不足的违规记录
SELECT
    psn_no, psn_name, certno,
    fixmedins_code, fixmedins_name,
    prev_fee_date                      AS 上次费用日期,
    fee_date                           AS 本次费用日期,
    DATEDIFF(fee_date, prev_fee_date)  AS 间隔天数,
    daily_inscp_amt                    AS 违规金额
FROM with_prev
WHERE prev_fee_date IS NOT NULL
  AND DATEDIFF(fee_date, prev_fee_date) < N   -- N 为周期天数
ORDER BY 违规金额 DESC;
```

要点：

- **LAG 按 `psn_no` 分区**，不限机构——周期限额通常是患者级别的，跨机构也要检查
- **违规金额 = 违规次收费的全部 `inscp_amt`**（间隔不足则该次不应收费，全额违规）
- 用 `DATE(fee_ocur_time)` 提取日期，`DATEDIFF` 直接计算间隔，**不要用 LEFT() 或 STR_TO_DATE**
- 若规则为"N天内不超过M次"且 M > 1，将 LAG 改为 `LAG(fee_date, M)`（向前看 M 行）

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

### 1. 日期/时间字段类型

begndate、enddate、fee_ocur_time 均为 **datetime** 类型，可以直接使用日期函数。brdy（出生日期）是 **varchar**。

```sql
-- 日期过滤：字符串比较和日期函数均可
WHERE s.begndate >= '2025-12-01' AND s.begndate <= '2025-12-31'
WHERE DATE_FORMAT(s.begndate, '%Y-%m') = '2025-12'

-- 提取日期部分（用于"同天"分组）
DATE(f.fee_ocur_time)

-- 住院天数
DATEDIFF(s.enddate, s.begndate) + 1

-- 时间差（小时）
TIMESTAMPDIFF(HOUR, t1, t2)
```

### 2. 住院天数与住院判定

**住院天数**：不要用 `ipt_days` 字段（空值率 95%，数据不准确），用 `DATEDIFF(enddate, begndate) + 1` 自行计算。

**判断是否住院**：用 `med_type` 判定，住院类值如下：

| med_type | 含义 |
|----------|------|
| 21 | 普通住院 |
| 26 | 单病种住院 |
| 28 | 日间手术 |
| 2105 | 按床日付费住院 |
| 52 | 生育住院 |

```sql
-- setl_d（med_type 为 integer）
WHERE s.med_type IN (21, 26, 28, 2105, 52)

-- mdtrt_d / fee_list_d（med_type 为 varchar）
WHERE m.med_type IN ('21', '26', '28', '2105', '52')
```

### 3. hosp_lv 两表类型不同

| 表 | 类型 | 药店值 | 三级值 |
|----|------|--------|--------|
| mdtrt_d | varchar | `'11'` | `'01'` |
| setl_d | integer | `11` | `1` |

### 4. med_type 两表类型不同

setl_d 中是 **integer**，mdtrt_d / fee_list_d 中是 **varchar**。

### 5. 退费记录金额为负

refd_setl_flag = 1 的退费记录，medfee_sumamt、hifp_pay 等为负值。默认保留让 SUM 正负对冲，**不要排除**，否则高估实际支出。

### 6. JOIN fee_list_d 与 setl_d 时金额膨胀

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

### 7. hilist_name 匹配规则

- 数据中统一使用半角括号 `()`，**不需要处理全角**
- **不要用 LIKE 模糊匹配**，直接用 `=` 或 `IN()` 精确匹配。项目名称是标准化的，不存在需要模糊的场景

### 8. 需要排除的特殊记录

| 场景 | 过滤条件 | 原因 |
|------|---------|------|
| 产前检查定额包 | `med_type != 51` | 8+ 字段豁免空值，非数据质量问题 |
| 在院未出院 | `inhosp_stas = '0'` | 无结算、无出院时间，住院类规则不适用 |
| 医疗救助结算 | `setl_type != 3` | hifp_pay 恒为 0，统筹类规则不适用 |
| 待结算明细 | `f.setl_id IS NOT NULL` | 费用已上传但未结算 |

---

## 五、规则分析时的标准输出结构

**当用户提供规则（JSON、图片、文字等）时，必须按以下结构完整输出，且必须包含可执行的 SQL。不得只做规则解读而不生成 SQL。**

### 1. 开场（必选）

- 说明已查阅本 SKILL.md 指南。
- 明确该规则对应的**规则类型**（类型一重复/互斥、类型二数量超标、类型三折扣收费、类型四周期频次等）。

示例：*「这条规则属于类型三：折扣收费——血气分析同时进行无机元素测定时，无机元素测定须按 70% 收费。」*

### 2. 规则分析表格（必选）

用表格归纳规则要素，便于后续写 SQL 时对齐逻辑。至少包含（按规则类型取舍）：

| 项目 | 内容 |
|------|------|
| 规则编号 | 如 131 |
| 违规类型 | 如 超标准收费（折扣收费类） |
| A组（触发项） | 如 血气分析 |
| B组（须折扣项/违规项） | 具体项目编码或名称列表 |
| 折扣率/阈值/周期 | 如 70%（折扣因子 d=7/10）、或 N 天内不超过 M 次 |
| 共现范围 | 如 "同时" → 同天 `DATE(fee_ocur_time)` |
| 违规判定 | 用一句话说明：何种情况算违规、违规数量/金额如何计算 |

### 3. 生成的 SQL（必选）

- 在「**生成的 SQL**」小标题下，给出**完整、可复制执行的 MySQL SQL**。
- SQL 顶部注释须包含：规则编号、规则名称、政策依据（如有）、逻辑简述。
- 列名统一用 `AS 中文别名`。

### 4. 自审检查（必选）

在「**自审检查**」下，根据本 SKILL 第四节、第六节的要点，列出与本条 SQL 相关的检查项，并标明已满足（如「已过滤 vali_flag=1」「折扣收费使用整数运算 FLOOR(cnt*10/7)*7/10」等）。

### 5. 逻辑说明（必选）

用 3～5 条短句概括：B 组如何匹配、A 组如何触发、违规判定公式、违规金额计算方式、以及如有歧义时的假设（如用 hilist_name 还是 hilist_code 匹配 A 组）。

---

## 六、输出要求

**分析规则时**：必须按**第五节「规则分析时的标准输出结构」**完整输出（开场 → 规则分析表格 → **生成的 SQL** → 自审检查 → 逻辑说明），**不得只做规则解读而不生成 SQL**。

**生成的 SQL 本身**须满足：

1. **SQL 头部注释**：规则编号、名称、政策依据（如有）、逻辑简述
2. **可追溯**：结果中包含参保人标识（psn_no + psn_name + certno）和机构标识（fixmedins_code + fixmedins_name）
3. **违规金额**：必须有一列计算违规金额（超出阈值的部分、不应收费的金额等，视规则而定）
4. **辅助审查**：酌情添加就诊次数、结算笔数、时间范围等帮助人工判断的字段
5. **字段名小写**
6. **所有输出列必须用 AS 指定中文别名**，示例：

```sql
f.psn_no              AS 参保人编号,
MAX(s.psn_name)       AS 参保人姓名,
MAX(s.certno)         AS 证件号码,
f.fixmedins_code      AS 机构编号,
MAX(f.fixmedins_name) AS 机构名称,
ROUND(...)            AS 违规金额
```

---

## 七、自审检查

SQL 写完后，逐项过一遍：

- [ ] 所有表名、字段名小写
- [ ] varchar 字段与字符串比较，int/double 字段与数字比较
- [ ] begndate/enddate/fee_ocur_time 是 datetime，可用日期函数；brdy 是 varchar 需字符串处理
- [ ] 住院天数用 `DATEDIFF(enddate, begndate) + 1`，不用 `ipt_days`
- [ ] "同天"分组用 `DATE(fee_ocur_time)`，不用 `LEFT()`
- [ ] 判断住院用 `med_type IN (21,26,28,2105,52)`，注意两表类型差异
- [ ] hosp_lv / med_type 的类型与所查的表一致
- [ ] 已过滤 `vali_flag = 1`
- [ ] 退费记录处理正确（通常保留对冲）
- [ ] 若涉及 setl_d 与 fee_list_d JOIN，确认金额字段未膨胀
- [ ] GROUP BY 包含所有非聚合 SELECT 列
- [ ] 结果包含参保人标识 + 机构标识 + 违规金额
- [ ] 时间范围边界值正确（月末天数）
- [ ] 时间范围语义正确：无限定词=就诊级(mdtrt_id)，"同时"=同天 `DATE()`，"N小时内"=`TIMESTAMPDIFF()`，"N天内M次"=LAG+DATEDIFF
- [ ] 周期频次规则：LAG 按 `psn_no` 分区（跨机构），用 `DATE()` 和 `DATEDIFF` 处理日期，不用 `LEFT()` 或 `STR_TO_DATE`
- [ ] 违规金额用 `inscp_amt`（不是 `det_item_fee_sumamt`），且计算方式与规则类型匹配（重复收费→直接求和，数量超标→按比例分摊，折扣收费→最大合理数量差值法，周期频次→全额违规）
- [ ] 折扣收费规则：用整数运算避免浮点精度（如 `FLOOR(cnt*10/7)*7/10`，不要 `FLOOR(cnt/0.7)*0.7`）
- [ ] 已排除不适用的特殊记录（按需）
- [ ] 规则有歧义时已先向用户澄清，未自行假设

**自审通过后再输出 SQL。**
