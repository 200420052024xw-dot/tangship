# 三种服务模式流程重构 & 车型池分离规划

## 概述

对现有三种服务模式（按趟结算/包月专线/租购服务）的下单流程进行差异化重构：按趟保持现有"选车→填地址→支付"流程；包月和租购改为"先收集信息→再选车→弹窗提示客服联系"模式。同时将车型池按服务类型完全分离，管理端可独立增删改查各车型池，并可编辑客服联系方式。平台：mobile（Taro 小程序）。

## 技术方案

| 维度 | 选择 | 理由 |
|------|------|------|
| 前端框架 | Taro + React + Tailwind | 项目已有，保持一致 |
| 后端框架 | NestJS + Supabase | 项目已有，保持一致 |
| 车型分离方式 | vehicle_catalog 表增加 `service_mode` 字段 | 比分表更简洁，查询时按 mode 过滤即可，admin 按 mode 分组管理 |
| 咨询提交存储 | 新增 `inquiries` 表 | 包月/租购的咨询记录需要独立存储，与 orders 分离 |
| 客服联系方式 | 新增 `contact_settings` 表（单行配置） | 管理端可修改，前端弹窗读取展示 |
| 信息表单 | 新增独立页面（非弹窗） | 包月/租购信息较多，独立页面体验更好 |

## 功能模块

### 1. 车型池分离

**核心变更**：`vehicle_catalog` 表新增 `service_mode` 字段（值为 `single` / `monthly` / `rental`），替代现有的 `modes_json` 数组。每个车型只属于一个服务类型。

- 前端首页：按当前 tab 过滤 `service_mode` 对应的车型列表
- 管理端：车型管理页按服务类型分 tab，每个 tab 独立增删改查
- 种子数据：将现有 `supportedModes` 包含多个 mode 的车型拆分为多行，每行一个 `service_mode`

### 2. 包月专线信息收集

**流程**：首页切换"包月专线" → 点击"申请包月方案" → 进入包月信息填写页 → 填完进入车型选择页 → 选择车型 → 弹窗提示客服联系

**收集字段**：

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| senderAddress | 地址对象 | 是 | 发货地址（复用地址选择组件） |
| receiverAddress | 地址对象 | 是 | 收货地址（复用地址选择组件） |
| contactName | string | 是 | 姓名 |
| phone | string | 是 | 电话 |
| companyName | string | 否 | 公司名称 |
| cargoType | string | 是 | 货物类型（预设选项+自定义） |
| deliveryCycle | string | 是 | 配送周期（每日/每周N次/自定义） |
| monthlyEstimate | number | 是 | 每月预计配送次数 |

### 3. 租购服务信息收集

**流程**：首页切换"租购服务" → 点击"咨询租赁/购买" → 进入租购信息填写页 → 填完进入车型选择页 → 选择车型 → 弹窗提示客服联系

**收集字段**：

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| contactName | string | 是 | 姓名 |
| phone | string | 是 | 电话 |
| companyName | string | 否 | 公司名称 |
| consultContent | string | 否 | 咨询内容 |

### 4. 客服联系弹窗

选车完成后弹出，内容：
- 标题："已收到您的咨询"
- 提示文案："我们的客服人员会尽快与您联系，请保持电话畅通"
- 展示联系方式（电话、微信等，从 `contact_settings` 读取）
- 确认按钮关闭弹窗

### 5. 管理端扩展

- **车型管理**：按服务类型分 tab（按趟/包月/租购），各自独立增删改查
- **咨询管理**：新增页面，列表展示包月/租购的咨询记录（含状态标记：待联系/已联系/已关闭）
- **联系方式设置**：在系统设置中新增联系方式编辑（客服电话、微信号、工作时间等）

## 数据结构

### 新增表：inquiries（咨询记录）

```
id: uuid PK
type: 'monthly' | 'rental'          -- 咨询类型
status: 'pending' | 'contacted' | 'closed'  -- 处理状态
vehicle_id: varchar → vehicle_catalog.id    -- 选中的车型
-- 包月专用字段
sender_address_json: text           -- 发货地址 JSON
receiver_address_json: text         -- 收货地址 JSON
cargo_type: varchar                 -- 货物类型
delivery_cycle: varchar            -- 配送周期
monthly_estimate: integer           -- 每月预计次数
-- 共用字段
contact_name: varchar              -- 姓名
phone: varchar                     -- 电话
company_name: varchar              -- 公司名称（选填）
consult_content: text              -- 咨询内容（选填，租购专用）
-- 系统
user_id: uuid → users.id
admin_note: text                   -- 管理员备注
contacted_by: varchar → admin_users.id  -- 联系人
contacted_at: timestamp            -- 联系时间
created_at: timestamp
updated_at: timestamp
```

### 新增表：contact_settings（客服联系方式，单行配置）

```
id: uuid PK
phone: varchar          -- 客服电话
wechat: varchar         -- 微信号
work_time: varchar      -- 工作时间描述
extra_info: text        -- 其他联系信息
updated_by: varchar → admin_users.id
updated_at: timestamp
```

### 变更表：vehicle_catalog

新增字段：
```
service_mode: varchar  -- 'single' | 'monthly' | 'rental'
```

废弃字段：`modes_json`（迁移完成后删除）

## 是否有原型设计

是（设计引导工具已开启）

## 实施步骤

1. **阶段一：原型设计** — 加载 design-canvas 技能，设计包月信息填写页、租购信息填写页、车型选择页（包月/租购共用）、客服联系弹窗、管理端咨询列表页和联系方式设置的 mobile 原型
2. **阶段二-1：数据库迁移 + 后端接口** — 新增 inquiries / contact_settings 表，vehicle_catalog 增加 service_mode 字段；实现咨询提交接口、咨询管理接口、联系方式读写接口、车型按 mode 过滤接口（涉及 server/src/storage、server/src/orders、server/src/operations）
3. **阶段二-2：前端页面开发** — 实现包月信息填写页（pages/inquiry/monthly）、租购信息填写页（pages/inquiry/rental）、车型选择页（pages/inquiry/select-vehicle）、客服联系弹窗组件；改造首页车型列表按 service_mode 过滤；改造车型详情页按钮跳转逻辑（涉及 src/pages/index、src/pages/inquiry、src/components/vehicle）
4. **阶段二-3：管理端扩展** — 车型管理按服务类型分 tab；新增咨询管理页面；新增联系方式设置（涉及 admin-web/src/App.tsx、admin-web/src/OperationsSettings.tsx）
5. **阶段二-4：验证与交付** — API 测试 + 前后端匹配验证 + pnpm validate + 编译检查

## 页面规格

##### @nav(mobile-tabbar)
> type: tabbar
> platform: mobile

- @page(/) 下单 | icon: package
- @page(/orders) 订单 | icon: clipboard-list
- @page(/profile) 我的 | icon: user

##### @page(/) 首页

**核心职责**：按服务模式展示对应车型列表，作为三种服务的统一入口。
**访问路径**：TabBar 直达。
**布局**：顶部轮播 → 服务模式切换 Tabs（按趟/包月/租购） → 车型卡片列表。
**列表项字段**：车型名称 / 副标题 / 载重 / 续航 / 参考起步价 / 首图

**交互说明**

| 元素 | 动作 | 响应 | 传参 | 备注 |
|------|------|------|------|------|
| 按趟 Tab | 切换 | 按 service_mode=single 过滤车型 | — | — |
| 包月 Tab | 切换 | 按 service_mode=monthly 过滤车型 | — | — |
| 租购 Tab | 切换 | 按 service_mode=rental 过滤车型 | — | — |
| 车型卡片 | 点击 | 按趟→跳转 @page(/vehicle-detail); 包月/租购→跳转 @page(/vehicle-detail) | vehicleId, mode | — |

##### @page(/vehicle-detail) 车型详情

**核心职责**：展示车型规格详情，提供下一步操作入口。
**访问路径**：从首页车型卡片进入。
**布局**：顶部导航栏 → 车型图片+名称+规格 → 适用场景 → 使用限制 → 底部操作按钮。

**交互说明**

| 元素 | 动作 | 响应 | 传参 | 备注 |
|------|------|------|------|------|
| 按趟-选用该车型 | 点击 | 跳转 @page(/order-create) | vehicleId, mode=single | 现有流程不变 |
| 包月-申请包月方案 | 点击 | 跳转 @page(/inquiry-monthly) | vehicleId | — |
| 租购-咨询租赁 | 点击 | 跳转 @page(/inquiry-rental) | vehicleId | — |
| 返回按钮 | 点击 | navigateBack | — | — |

##### @page(/inquiry-monthly) 包月专线信息填写

**核心职责**：收集包月专线客户信息。
**访问路径**：从车型详情页"申请包月方案"进入。
**布局**：顶部导航栏 → 发货地址（点击选择） → 收货地址（点击选择） → 姓名 → 电话 → 公司名称（选填） → 货物类型 → 配送周期 → 每月预计配送次数 → 底部"下一步"按钮。

**交互说明**

| 元素 | 动作 | 响应 | 传参 | 备注 |
|------|------|------|------|------|
| 发货地址栏 | 点击 | 跳转 @page(/address-list) 选择 | role=sender | 复用地址选择 |
| 收货地址栏 | 点击 | 跳转 @page(/address-list) 选择 | role=receiver | 复用地址选择 |
| 下一步 | 点击 | 校验必填项 → 跳转 @page(/inquiry-select-vehicle) | mode=monthly, info=表单数据 | — |
| 返回按钮 | 点击 | 弹出确认放弃弹窗 → 确认则返回 | — | — |

##### @page(/inquiry-rental) 租购服务信息填写

**核心职责**：收集租购服务客户信息。
**访问路径**：从车型详情页"咨询租赁"进入。
**布局**：顶部导航栏 → 姓名 → 电话 → 公司名称（选填） → 咨询内容（选填） → 底部"下一步"按钮。

**交互说明**

| 元素 | 动作 | 响应 | 传参 | 备注 |
|------|------|------|------|------|
| 下一步 | 点击 | 校验必填项 → 跳转 @page(/inquiry-select-vehicle) | mode=rental, info=表单数据 | — |
| 返回按钮 | 点击 | 弹出确认放弃弹窗 → 确认则返回 | — | — |

##### @page(/inquiry-select-vehicle) 咨询选车页

**核心职责**：包月/租购填写信息后选择车型并提交咨询。
**访问路径**：从包月/租购信息填写页"下一步"进入。
**布局**：顶部导航栏（标题"选择车型"） → 车型卡片列表（按 mode 过滤） → 选中状态标记。

**交互说明**

| 元素 | 动作 | 响应 | 传参 | 备注 |
|------|------|------|------|------|
| 车型卡片 | 点击 | 选中该车型（高亮） | vehicleId | 单选 |
| 确认提交 | 点击 | 提交咨询 → 弹出 @modal(contact-popup) | — | 需先选中车型 |

**弹窗 contact-popup**：
- 标题："已收到您的咨询"
- 提示："我们的客服人员会尽快与您联系，请保持电话畅通"
- 展示客服联系方式（电话、微信、工作时间）
- 确认按钮 → 关闭弹窗并返回首页

##### @page(/order-create) 按趟下单页

**核心职责**：按趟结算的完整下单流程（现有页面，无需改动核心逻辑）。
**访问路径**：从车型详情页"选用该车型"进入。
**布局**：与现有一致。

**交互说明**

| 元素 | 动作 | 响应 | 传参 | 备注 |
|------|------|------|------|------|
| 提交 | 点击 | 校验 → 跳转 @page(/order-confirm) | — | 现有流程 |

##### @page(/orders) 订单列表

**核心职责**：展示用户的按趟结算订单列表。
**访问路径**：TabBar 直达。
**布局**：与现有一致。

##### @page(/profile) 我的

**核心职责**：用户个人信息入口。
**访问路径**：TabBar 直达。
**布局**：与现有一致。
