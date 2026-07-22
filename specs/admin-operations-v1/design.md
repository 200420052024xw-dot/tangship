# 唐小识运营中心 V1 设计

## 界面

- Web 使用 264px 工业风侧栏，五个分组可容纳十余个入口；顶部只保留当前页面、全局通知和管理员信息。
- 工作台删除重复的订单/咨询列表，仅保留指标和全宽横向车型容量轨道；列表页使用独立筛选区和内容区。
- 订单详情顶部使用五步流程条，主体为左地址、右订单信息、全宽物品信息；拒绝原因按状态独立置底。
- 审核、配车和完成按钮使用明确的常驻主按钮样式；弹窗关闭操作缩小为右上角符号按钮。
- 管理员小程序保留工作台、订单、咨询和通知四个移动入口，复杂内容配置只在 Web 完成。

## 数据与状态

- `vehicle_catalog` 增加 `total_count`；订单增加 `reserved_vehicle_count`、`dispatch_note`、`dispatch_vehicle_count`、`vehicle_plate`、`completion_note`、`completion_proof_url`。
- `admin_users.nickname` 保存管理员显示昵称；订单与审核记录查询使用昵称并回退用户名。
- 预占数由处于 `pending_payment`、`paid`、`dispatching`、`delivering` 的订单汇总，不单独维护易漂移计数；参考可用数为 `total_count - reserved_count`，可为负数以表达软预警。
- 新增 `admin_notifications`，记录类型、标题、正文、目标路由、管理员范围、已读时间和创建时间。
- 订单推进只允许 `paid -> dispatching -> delivering -> completed`；每次推进写入状态日志和审计日志，完成时释放预占。

## API

- 扩展 `GET /api/admin/dashboard`，返回订单、咨询和车辆容量摘要。
- 扩展车型读写契约：`totalCount`、`reservedCount`、`availableCount`。
- `POST /api/admin/orders/:id/status` 推进履约状态，接收 `status`、`note`、`vehicleCount`、`vehiclePlate`；完成暂不强制凭证。
- `GET /api/admin/notifications`、`PUT /api/admin/notifications/:id/read`、`PUT /api/admin/notifications/read-all`。
- 保持 `{ code, msg, data }` 信封；数据库字段与 Supabase 表结构一致。

## 迁移与通知

- Supabase 使用幂等 SQL 增列、建表和索引。
- 站内通知写入 Supabase 通知表；微信提醒通过独立适配器预留，未配置线上凭据时不影响站内通知。
- 图片仍由 TOS 管理；当前订单完成流程不要求上传凭证，后续恢复时必须继续使用 TOS URL。
- 参考路线距离由前端使用地址快照坐标的 Haversine 距离乘城市道路修正系数计算，作为可编辑建议值；未配置地图路线 API 时不宣称为精确导航里程。
