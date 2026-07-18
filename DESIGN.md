# 唐小识无人运力配送小程序 - 设计指南

## 气质与意象

**关键词**：极简科技、工业未来、智能配送、低饱和、大留白

**具象场景**：
清晨的智能物流园区，冰川蓝的无人配送车整齐排列在星海白的仓储空间内，车身线条简洁流畅，充满科技感的金属光泽在晨光中微微闪烁。整个空间大留白设计，没有繁杂的装饰，只有必要的信息和简洁的操作指引，呈现出未来工业的冷静与精准。

## 视觉策略

- **摄影/图像方向**：使用九识原厂实拍图，车辆采用侧视图或斜角45度展示，背景干净无干扰
- **图形语言**：圆角卡片（rounded-lg）、轻微阴影、低饱和渐变、几何分割线
- **信息密度**：大留白、信息层级清晰、避免堆砌

## 配色方案

### 主色板
| 名称 | 色值 | Tailwind 类名 | 意象来源 |
|------|------|--------------|---------|
| 冰川蓝（主色） | #2088D8 | bg-blue-600, text-blue-600 | 九识无人车车身主色，代表科技与智能 |
| 星海白（底色） | #F8FAFB | bg-slate-50 | 晨光洒落的仓储空间，纯净无暇 |

### 辅助色
| 名称 | 艺值 | Tailwind 类名 | 意象来源 |
|------|------|--------------|---------|
| 深空灰 | #1E293B | text-slate-800 | 夜空深邃，承载重要信息 |
| 浅冰灰 | #94A3B8 | text-slate-400 | 冰面微光，辅助说明文字 |
| 极光青（点缀） | #06B6D4 | bg-cyan-500 | 能量流动，状态高亮 |

### 语义色
| 名称 | 色值 | Tailwind 类名 | 使用场景 |
|------|------|--------------|---------|
| 成功绿 | #10B981 | bg-emerald-500 | 订单完成、支付成功 |
| 警告橙 | #F59E0B | bg-amber-500 | 待处理、需注意 |
| 错误红 | #EF4444 | bg-red-500 | 订单失败、系统异常 |

## 字体排版

- **中文主字体**：思源黑体（Noto Sans SC）- 简洁现代无衬线
- **数字/英文**：DM Sans - 清晰易读的科技感字体
- **排版节奏**：
  - H1标题：text-2xl font-bold, mb-6
  - H2标题：text-xl font-semibold, mb-4
  - H3标题：text-lg font-medium, mb-3
  - 正文：text-base font-normal, mb-2
  - 辅助文字：text-sm text-slate-400, mb-2

## 间距系统

| 类型 | Tailwind 类名 | 像素值 | 使用场景 |
|------|--------------|-------|---------|
| 页面边距 | p-4, px-4 | 16px | 页面内容区与屏幕边缘 |
| 卡片内边距 | p-6 | 24px | 卡片内部内容间距 |
| 卡片间距 | gap-4, mb-4 | 16px | 卡片之间垂直间距 |
| 组件间距 | gap-3 | 12px | 表单项、按钮组内部间距 |
| 文字间距 | gap-2, mb-2 | 8px | 标题与正文、标签与内容 |

## 组件使用原则

**优先级原则**：通用 UI 组件（Button/Input/Card/Badge/Tabs/Dialog/Toast）优先从 `@/components/ui/*` 导入，禁止用 View/Text 手搓。

**页面布局前必做**：
1. 拆分页面所需 UI 单元（按钮、输入框、卡片、标签、弹层、空状态、加载态）
2. 每个 UI 单元优先映射到 `src/components/ui` 中已有组件
3. 仅在组件库未覆盖时使用 @tarojs/components 原生组件

**推荐组件组合**：
- 顶部标签切换：使用 `Tabs` 组件 + 自定义滑块动画
- 车型卡片：使用 `Card` + `CardContent` + `CardHeader`
- 参数弹窗：使用 `Dialog` + 缩放淡入动画
- 下单表单：使用 `Field` + `Input` + `InputGroup`
- 地址选择：使用 `Button` + `Popover` 或自定义地址选择组件
- 状态提示：使用 `Toast` 或 `Sonner`
- 加载态：使用 `Skeleton`

## 动效与交互

### 动画风格
- **运动性格**：轻盈、流畅、克制（不喧宾夺主）
- **缓动曲线**：ease-out（快速启动、缓慢结束，营造自然感）
- **时长建议**：200-300ms（短动画）、500-800ms（页面切换）

### 关键动画清单
| 场景 | 动画类型 | 实现方式 |
|------|---------|---------|
| 标签切换 | 滑动渐变 | CSS transform + opacity transition |
| 车型卡片加载 | 逐行淡入 | CSS animation delay + opacity |
| 卡片点击上浮 | hover translateY(-2px) | Tailwind hover:translate-y-[-2px] |
| 参数弹窗弹出 | 缩放淡入 | CSS transform scale(0.95→1) + opacity |
| 金额数字滚动 | 数字滚动动画 | CSS keyframes 或 JS 动画库 |
| 订单提交提示 | 上浮淡出 | CSS animation translateY + opacity |

### Tailwind 动画类名建议
```tsx
// 卡片 hover 上浮
className="hover:translate-y-[-2px] transition-all duration-300"

// 弹窗缩放淡入
className="animate-in fade-in-0 zoom-in-95 duration-300"

// 页面淡入
className="animate-in fade-in duration-500"
```

## 导航结构

### TabBar 配置（商户客户端）
| 页面 | 文本 | 图标（Lucide） | 说明 |
|------|------|--------------|------|
| 首页 | 下单 | Package | 下单入口、车型选择、费用计算 |
| 订单 | 订单 | ClipboardList | 订单列表、状态跟踪、轨迹查看 |
| 我的 | 我的 | User | 个人中心、消费记录、优惠券 |

### 页面路由
- `/pages/index/index` - 首页（下单页）
- `/pages/orders/index` - 订单列表
- `/pages/profile/index` - 个人中心
- `/pages/order-detail/index` - 订单详情
- `/pages/vehicle-detail/index` - 车型详情（可选弹窗替代）

## 小程序约束

### 包体积优化
- 车型图片必须使用 TOS 对象存储 URL，禁止打包到项目中
- 所有图片、视频资源走 TOS，仅 TabBar 图标使用本地 PNG
- 使用分包加载（订单详情、车型详情等独立分包）

### 性能优化
- 车型列表使用虚拟滚动（长列表场景）
- 图片使用 CDN 加速 + 懒加载
- 动画避免过度使用，影响低端机型性能

### 跨端兼容
- H5 端：底部固定元素 `bottom: 50px` 避开 TabBar
- Input/Textarea：View 包裹，样式放外层
- Fixed + Flex：使用 inline style（H5 Tailwind fixed+flex 失效）