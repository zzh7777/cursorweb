---
name: medical-insurance-sql
description: Generate MySQL SQL queries for medical insurance fraud detection and supervision rules. Use when writing SQL to detect insurance fraud, abuse, or violations against mdtrt_d (visit), setl_d (settlement), fee_list_d (fee detail) tables, or when the user mentions medical insurance monitoring rules.
---

# 医保线上监管 SQL 生成指南

本指南分为**公共部分**（[common/](common/)）与**数据库相关部分**（本文档）。公共部分为数据库无关的业务知识与判断依据；数据库相关部分针对MySQL和Postgres分别做了例子。

---

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

**公共部分（概念与判断依据）**见 [common/business-terms-and-logic.md](common/business-terms-and-logic.md)。

**实现示例**（与库相关的语法）按数据库分文件引用，运行时按环境选择：

- **MySQL**：[mysql/business-terms-and-logic-mysql-example.md](mysql/business-terms-and-logic-mysql-example.md)（类型一～四的 MySQL 写法）
- **PostgreSQL**：[postgres/business-terms-and-logic-postgres-example.md](postgres/business-terms-and-logic-postgres-example.md)（类型一～四的 PostgreSQL 写法）

---

## 四、踩坑清单

**公共部分（概念与检查要点）**见 [common/pitfalls.md](common/pitfalls.md)。

**与库相关的补充与示例**按数据库分文件引用，运行时按环境选择：

- **MySQL**：[mysql/pitfalls-mysql-example.md](mysql/pitfalls-mysql-example.md)
- **PostgreSQL**：[postgres/pitfalls-postgres-example.md](postgres/pitfalls-postgres-example.md)


---

## 五、规则分析时的标准输出结构

**公共部分（结构要求）**见 [common/standard-output-structure.md](common/standard-output-structure.md)。  
当前环境为 MySQL：须在「生成的 SQL」中给出**完整、可复制执行的 MySQL SQL**，列名用 `AS 中文别名`；自审与逻辑说明中可引用第四节、第六节的 MySQL 要点。

---

## 六、输出要求

**公共部分**见 [common/output-requirements.md](common/output-requirements.md)。

**与库相关的输出示例**按数据库分文件引用，运行时按环境选择：

- **MySQL**：[mysql/output-requirements-mysql-example.md](mysql/output-requirements-mysql-example.md)
- **PostgreSQL**：[postgres/output-requirements-postgres-example.md](postgres/output-requirements-postgres-example.md)

---

## 七、自审检查

**公共部分（概念项）**见 [common/self-review-checklist.md](common/self-review-checklist.md)。

**与库相关的自审补充**按数据库分文件引用，运行时按环境选择：

- **MySQL**：[mysql/self-review-checklist-mysql-example.md](mysql/self-review-checklist-mysql-example.md)
- **PostgreSQL**：[postgres/self-review-checklist-postgres-example.md](postgres/self-review-checklist-postgres-example.md)

**自审通过后再输出 SQL。**
