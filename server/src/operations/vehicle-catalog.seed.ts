export const CANONICAL_VEHICLES = [
  {
    "id": "z2",
    "name": "Z2",
    "fullName": "Z2 智能配送车",
    "subtitle": "紧凑型无人配送车,适合短距离高频次配送",
    "description": "小巧灵活,适合社区末端配送与小件高频次运输场景。",
    "images": [],
    "specs": {
      "cargoVolume": "1.5m³",
      "maxLoadKg": 200,
      "cargoDimensionsMm": {
        "length": 1200,
        "width": 1000,
        "height": 1200
      },
      "maxRangeKm": 80,
      "speedKmh": "15-25",
      "chargeTime": "2小时快充"
    },
    "applicableScenes": [
      "城市末端配送",
      "社区快递",
      "生鲜配送",
      "小件货物"
    ],
    "restrictions": [
      "禁运危险化学品",
      "禁运易燃易爆物品",
      "单件尺寸不超过货厢容积"
    ],
    "supportedModes": [
      "single",
      "monthly"
    ],
    "serviceMode": "single",
    "pricingDescription": {
      "description": "起步价含 3 公里以内基础里程费;超出部分按公里数加价。最终费用由服务端根据实际路线核验。",
      "startFrom": 25,
      "breakdown": [
        {
          "label": "起步价(含基础里程)",
          "amount": 25
        },
        {
          "label": "超出起步里程,按公里数加价",
          "amount": "以实际路线为准"
        }
      ]
    },
    "tags": [
      "小型",
      "高频配送"
    ],
    "enabled": true
  },
  {
    "id": "z5-2026",
    "name": "Z5(2026)",
    "fullName": "Z5(2026) 厢式货车",
    "subtitle": "中型厢式无人货车,2026 款升级续航与载重",
    "description": "适合中距离物流、电商配送与商超补货,容量充足。",
    "images": [],
    "specs": {
      "cargoVolume": "3.0m³",
      "maxLoadKg": 500,
      "cargoDimensionsMm": {
        "length": 1800,
        "width": 1400,
        "height": 1400
      },
      "maxRangeKm": 120,
      "speedKmh": "20-30",
      "chargeTime": "3小时快充"
    },
    "applicableScenes": [
      "中距离物流",
      "电商配送",
      "商超补货",
      "批量运输"
    ],
    "restrictions": [
      "禁运危险化学品",
      "禁运易燃易爆物品",
      "液体货物需密封包装"
    ],
    "supportedModes": [
      "single",
      "monthly"
    ],
    "serviceMode": "single",
    "pricingDescription": {
      "description": "起步价含 3 公里以内基础里程费;超出部分按公里数加价。最终费用由服务端根据实际路线核验。",
      "startFrom": 45,
      "breakdown": [
        {
          "label": "起步价(含基础里程)",
          "amount": 45
        },
        {
          "label": "超出起步里程,按公里数加价",
          "amount": "以实际路线为准"
        }
      ]
    },
    "tags": [
      "中型",
      "热门"
    ],
    "enabled": true
  },
  {
    "id": "l5",
    "name": "L5",
    "fullName": "L5 智能物流车",
    "subtitle": "园区级无人物流车,适合封闭场景高效运转",
    "description": "适合园区内部、仓储转运、工厂配送等定点运输场景。",
    "images": [],
    "specs": {
      "cargoVolume": "2.5m³",
      "maxLoadKg": 400,
      "cargoDimensionsMm": {
        "length": 1600,
        "width": 1200,
        "height": 1300
      },
      "maxRangeKm": 100,
      "speedKmh": "18-28",
      "chargeTime": "2.5小时快充"
    },
    "applicableScenes": [
      "园区物流",
      "仓储转运",
      "工厂配送",
      "定点运输"
    ],
    "restrictions": [
      "禁运危险化学品",
      "需明确通行权限"
    ],
    "supportedModes": [
      "single",
      "monthly"
    ],
    "serviceMode": "single",
    "pricingDescription": {
      "description": "起步价含 3 公里以内基础里程费;超出部分按公里数加价。最终费用由服务端根据实际路线核验。",
      "startFrom": 35,
      "breakdown": [
        {
          "label": "起步价(含基础里程)",
          "amount": 35
        },
        {
          "label": "超出起步里程,按公里数加价",
          "amount": "以实际路线为准"
        }
      ]
    },
    "enabled": false
  },
  {
    "id": "l5-max",
    "name": "L5Max",
    "fullName": "L5Max 智能物流车(增强版)",
    "subtitle": "L5 增强版,续航与载重全面提升",
    "description": "适合大型园区物流、长距离转运与多站点配送。",
    "images": [],
    "specs": {
      "cargoVolume": "3.2m³",
      "maxLoadKg": 550,
      "cargoDimensionsMm": {
        "length": 1900,
        "width": 1400,
        "height": 1400
      },
      "maxRangeKm": 140,
      "speedKmh": "18-28",
      "chargeTime": "3小时快充"
    },
    "applicableScenes": [
      "大型园区物流",
      "长距离转运",
      "多站点配送"
    ],
    "restrictions": [
      "禁运危险化学品"
    ],
    "supportedModes": [
      "single",
      "monthly"
    ],
    "serviceMode": "single",
    "pricingDescription": {
      "description": "起步价含 3 公里以内基础里程费;超出部分按公里数加价。最终费用由服务端根据实际路线核验。",
      "startFrom": 40,
      "breakdown": [
        {
          "label": "起步价(含基础里程)",
          "amount": 40
        },
        {
          "label": "超出起步里程,按公里数加价",
          "amount": "以实际路线为准"
        }
      ]
    },
    "tags": [
      "中型",
      "长续航"
    ],
    "enabled": true
  },
  {
    "id": "z8",
    "name": "Z8",
    "fullName": "Z8 常温配送车",
    "subtitle": "大型无人配送车,适合城市干线物流",
    "description": "适合城市干线配送、区域物流与跨区运输。",
    "images": [],
    "specs": {
      "cargoVolume": "5.0m³",
      "maxLoadKg": 800,
      "cargoDimensionsMm": {
        "length": 2400,
        "width": 1600,
        "height": 1500
      },
      "maxRangeKm": 160,
      "speedKmh": "25-35",
      "chargeTime": "4小时快充"
    },
    "applicableScenes": [
      "城市干线配送",
      "区域物流",
      "大宗货物",
      "跨区运输"
    ],
    "restrictions": [
      "禁运危险化学品",
      "行驶路线需提前报备"
    ],
    "supportedModes": [
      "single",
      "monthly"
    ],
    "serviceMode": "single",
    "pricingDescription": {
      "description": "起步价含 3 公里以内基础里程费;超出部分按公里数加价。最终费用由服务端根据实际路线核验。",
      "startFrom": 65,
      "breakdown": [
        {
          "label": "起步价(含基础里程)",
          "amount": 65
        },
        {
          "label": "超出起步里程,按公里数加价",
          "amount": "以实际路线为准"
        }
      ]
    },
    "tags": [
      "大型",
      "干线"
    ],
    "enabled": true
  },
  {
    "id": "z8-max",
    "name": "Z8Max",
    "fullName": "Z8Max 常温配送车(增强版)",
    "subtitle": "Z8 增强版,百公里级续航支持跨城配送",
    "description": "适合城际配送、大型物流中心与远距离运输。",
    "images": [],
    "specs": {
      "cargoVolume": "6.0m³",
      "maxLoadKg": 1000,
      "cargoDimensionsMm": {
        "length": 2600,
        "width": 1700,
        "height": 1600
      },
      "maxRangeKm": 200,
      "speedKmh": "25-35",
      "chargeTime": "4.5小时快充"
    },
    "applicableScenes": [
      "城际配送",
      "大型物流中心",
      "批量货运",
      "远距离运输"
    ],
    "restrictions": [
      "禁运危险化学品",
      "行驶路线需提前报备",
      "超长货物需提前沟通"
    ],
    "supportedModes": [
      "single",
      "monthly"
    ],
    "serviceMode": "single",
    "pricingDescription": {
      "description": "起步价含 3 公里以内基础里程费;超出部分按公里数加价。最终费用由服务端根据实际路线核验。",
      "startFrom": 80,
      "breakdown": [
        {
          "label": "起步价(含基础里程)",
          "amount": 80
        },
        {
          "label": "超出起步里程,按公里数加价",
          "amount": "以实际路线为准"
        }
      ]
    },
    "tags": [
      "大型",
      "城际"
    ],
    "enabled": true
  },
  {
    "id": "z5-c",
    "name": "Z5-C",
    "fullName": "Z5-C 冷藏配送车",
    "subtitle": "冷藏无人配送车,精准温控保障冷链品质",
    "description": "适合生鲜冷链、医药运输与乳品配送。",
    "images": [],
    "specs": {
      "cargoVolume": "2.8m³",
      "maxLoadKg": 450,
      "cargoDimensionsMm": {
        "length": 1800,
        "width": 1400,
        "height": 1300
      },
      "maxRangeKm": 110,
      "speedKmh": "20-30",
      "chargeTime": "3小时快充",
      "supportsRefrigeration": true,
      "temperatureRange": "-18°C ~ +8°C"
    },
    "applicableScenes": [
      "生鲜冷链",
      "医药运输",
      "乳品配送",
      "冷冻食品"
    ],
    "restrictions": [
      "禁运危险化学品",
      "需提前预约冷链资质",
      "需明确装载温度区间"
    ],
    "supportedModes": [
      "single",
      "monthly"
    ],
    "serviceMode": "single",
    "pricingDescription": {
      "description": "起步价含基础里程与冷链附加费;超出部分按公里数加价。最终费用由服务端根据实际路线核验。",
      "startFrom": 55,
      "breakdown": [
        {
          "label": "起步价(含基础里程)",
          "amount": 55
        },
        {
          "label": "冷链附加费",
          "amount": 15
        },
        {
          "label": "超出起步里程,按公里数加价",
          "amount": "以实际路线为准"
        }
      ]
    },
    "tags": [
      "中型",
      "冷藏"
    ],
    "enabled": true,
    "requiresApproval": true
  },
  {
    "id": "z8-max-c",
    "name": "Z8Max 冷藏",
    "fullName": "Z8Max 冷藏配送车",
    "subtitle": "大型冷藏无人车,支持长距离冷链配送",
    "description": "适合大型冷链物流、跨城生鲜与医药干线。",
    "images": [],
    "specs": {
      "cargoVolume": "5.5m³",
      "maxLoadKg": 900,
      "cargoDimensionsMm": {
        "length": 2500,
        "width": 1700,
        "height": 1500
      },
      "maxRangeKm": 180,
      "speedKmh": "25-35",
      "chargeTime": "4.5小时快充",
      "supportsRefrigeration": true,
      "temperatureRange": "-18°C ~ +8°C"
    },
    "applicableScenes": [
      "大型冷链物流",
      "跨城生鲜",
      "医药干线",
      "冷冻大宗"
    ],
    "restrictions": [
      "禁运危险化学品",
      "需提前预约冷链资质",
      "需明确装载温度区间"
    ],
    "supportedModes": [
      "single",
      "monthly"
    ],
    "serviceMode": "single",
    "pricingDescription": {
      "description": "起步价含基础里程与冷链附加费;超出部分按公里数加价。最终费用由服务端根据实际路线核验。",
      "startFrom": 90,
      "breakdown": [
        {
          "label": "起步价(含基础里程)",
          "amount": 90
        },
        {
          "label": "冷链附加费",
          "amount": 15
        },
        {
          "label": "超出起步里程,按公里数加价",
          "amount": "以实际路线为准"
        }
      ]
    },
    "tags": [
      "大型",
      "冷藏"
    ],
    "enabled": true,
    "requiresApproval": true
  },
  {
    "id": "z5-multi",
    "name": "Z5 多格",
    "fullName": "Z5 多格货柜车",
    "subtitle": "多格货柜设计,一车配送多商户高效分拣",
    "description": "适合多商户配送、社区团购与混合货物分拣转运。",
    "images": [],
    "specs": {
      "cargoVolume": "3.0m³ (分 6 格)",
      "maxLoadKg": 480,
      "cargoDimensionsMm": {
        "length": 1800,
        "width": 1400,
        "height": 1400
      },
      "maxRangeKm": 120,
      "speedKmh": "20-30",
      "chargeTime": "3小时快充"
    },
    "applicableScenes": [
      "多商户配送",
      "社区团购",
      "混合货物",
      "分拣转运"
    ],
    "restrictions": [
      "禁运危险化学品",
      "每格独立包装"
    ],
    "supportedModes": [
      "single",
      "monthly"
    ],
    "serviceMode": "single",
    "pricingDescription": {
      "description": "起步价含 3 公里以内基础里程费;超出部分按公里数加价。最终费用由服务端根据实际路线核验。",
      "startFrom": 50,
      "breakdown": [
        {
          "label": "起步价(含基础里程)",
          "amount": 50
        },
        {
          "label": "超出起步里程,按公里数加价",
          "amount": "以实际路线为准"
        }
      ]
    },
    "tags": [
      "中型",
      "多格"
    ],
    "enabled": true
  },
  {
    "id": "z8-chassis",
    "name": "Z8 底盘",
    "fullName": "Z8 二类底盘",
    "subtitle": "支持客户定制改装方案",
    "description": "Z8 二类底盘,支持客户按需改装上装,适配多种专用场景。",
    "images": [],
    "specs": {
      "cargoVolume": "定制",
      "maxLoadKg": 1000,
      "maxRangeKm": 200,
      "speedKmh": "25-35",
      "chargeTime": "4.5小时快充"
    },
    "applicableScenes": [
      "定制改装",
      "特种车辆",
      "专用设备搭载"
    ],
    "restrictions": [
      "禁运危险化学品"
    ],
    "supportedModes": [
      "single",
      "monthly",
      "rental",
      "purchase"
    ],
    "serviceMode": "single",
    "pricingDescription": {
      "description": "起步价含 3 公里以内基础里程费;超出部分按公里数加价。最终费用由服务端根据实际路线核验。",
      "startFrom": 50,
      "breakdown": [
        {
          "label": "起步价(含基础里程)",
          "amount": 50
        },
        {
          "label": "超出起步里程,按公里数加价",
          "amount": "以实际路线为准"
        }
      ]
    },
    "tags": [
      "底盘",
      "可定制"
    ],
    "enabled": false
  },
  {
    "id": "z5-security",
    "name": "Z5 安防",
    "fullName": "Z5 空地安防车",
    "subtitle": "空地协同安防无人车",
    "description": "搭载巡逻装备与监控设备,适合园区安防与应急响应。",
    "images": [],
    "specs": {
      "cargoVolume": "巡逻装备舱",
      "maxLoadKg": 300,
      "maxRangeKm": 120,
      "speedKmh": "20-30",
      "chargeTime": "3小时快充"
    },
    "applicableScenes": [
      "园区安防",
      "巡逻监控",
      "应急响应",
      "无人机协同"
    ],
    "restrictions": [
      "禁运危险化学品"
    ],
    "supportedModes": [
      "single",
      "monthly",
      "rental",
      "purchase"
    ],
    "serviceMode": "single",
    "pricingDescription": {
      "description": "起步价含 3 公里以内基础里程费;超出部分按公里数加价。最终费用由服务端根据实际路线核验。",
      "startFrom": 45,
      "breakdown": [
        {
          "label": "起步价(含基础里程)",
          "amount": 45
        },
        {
          "label": "超出起步里程,按公里数加价",
          "amount": "以实际路线为准"
        }
      ]
    },
    "tags": [
      "安防",
      "特殊"
    ],
    "enabled": false
  },
  {
    "id": "yokee",
    "name": "Yokee",
    "fullName": "Yokee 观光车",
    "subtitle": "智能观光无人车,6 座设计",
    "description": "适合景区观光、园区接驳与展览导览。",
    "images": [],
    "specs": {
      "cargoVolume": "6 座观光舱",
      "maxLoadKg": 600,
      "maxRangeKm": 80,
      "speedKmh": "15-20",
      "chargeTime": "2小时快充"
    },
    "applicableScenes": [
      "景区观光",
      "园区接驳",
      "展览导览",
      "主题公园"
    ],
    "restrictions": [
      "禁运危险化学品",
      "禁运货物"
    ],
    "supportedModes": [
      "single",
      "monthly",
      "rental",
      "purchase"
    ],
    "serviceMode": "single",
    "pricingDescription": {
      "description": "起步价含 3 公里以内基础里程费;超出部分按公里数加价。最终费用由服务端根据实际路线核验。",
      "startFrom": 40,
      "breakdown": [
        {
          "label": "起步价(含基础里程)",
          "amount": 40
        },
        {
          "label": "超出起步里程,按公里数加价",
          "amount": "以实际路线为准"
        }
      ]
    },
    "tags": [
      "观光",
      "载客"
    ],
    "enabled": false
  },
  {
    "id": "l4-kit",
    "name": "L4 套件",
    "fullName": "L4 自动驾驶套件",
    "subtitle": "L4 级自动驾驶套件,可改装传统车辆",
    "description": "支持传统车辆升级自动驾驶,适配多种车型。",
    "images": [],
    "specs": {
      "cargoVolume": "适配多种车型",
      "maxLoadKg": 0,
      "maxRangeKm": 0,
      "speedKmh": "依车型而定",
      "chargeTime": "依车型而定"
    },
    "applicableScenes": [
      "传统车辆升级",
      "自动驾驶改装",
      "智能驾驶测试"
    ],
    "restrictions": [
      "具体参数以安装车型为准"
    ],
    "supportedModes": [
      "single",
      "monthly",
      "rental",
      "purchase"
    ],
    "serviceMode": "single",
    "pricingDescription": {
      "description": "起步价含 3 公里以内基础里程费;超出部分按公里数加价。最终费用由服务端根据实际路线核验。",
      "startFrom": 35,
      "breakdown": [
        {
          "label": "起步价(含基础里程)",
          "amount": 35
        },
        {
          "label": "超出起步里程,按公里数加价",
          "amount": "以实际路线为准"
        }
      ]
    },
    "tags": [
      "套件",
      "改装"
    ],
    "enabled": false
  },
  // ─── Monthly dedicated line vehicles ───
  {
    "id": "z2-monthly",
    "name": "Z2",
    "fullName": "Z2 包月专线车",
    "subtitle": "紧凑型无人配送车,适合短距离高频次包月配送",
    "description": "小巧灵活,适合社区末端配送与小件高频次运输场景,包月专线专用。",
    "images": [],
    "specs": {
      "cargoVolume": "1.5m³",
      "maxLoadKg": 200,
      "maxRangeKm": 80,
      "speedKmh": "15-25",
      "chargeTime": "2小时快充"
    },
    "applicableScenes": ["城市末端配送", "社区快递", "生鲜配送", "小件货物"],
    "restrictions": ["禁运危险化学品", "禁运易燃易爆物品"],
    "supportedModes": ["monthly"],
    "serviceMode": "monthly",
    "pricingDescription": {
      "description": "按月计费,包含基础配送次数,超出次数按单次加收。",
      "startFrom": 2800,
      "breakdown": [{"label": "月费(含基础次数)", "amount": 2800}]
    },
    "tags": ["包月", "紧凑型"],
    "enabled": true
  },
  {
    "id": "z5-2026-monthly",
    "name": "Z5",
    "fullName": "Z5 包月专线车",
    "subtitle": "中型无人配送车,适合中距离常规配送",
    "description": "均衡型配送车,适合园区、校园、商业区等场景的包月专线服务。",
    "images": [],
    "specs": {
      "cargoVolume": "2.5m³",
      "maxLoadKg": 500,
      "maxRangeKm": 120,
      "speedKmh": "15-25",
      "chargeTime": "3小时快充"
    },
    "applicableScenes": ["园区配送", "校园物流", "商超配送", "餐饮外卖"],
    "restrictions": ["禁运危险化学品", "单件重量不超过500kg"],
    "supportedModes": ["monthly"],
    "serviceMode": "monthly",
    "pricingDescription": {
      "description": "按月计费,包含基础配送次数,超出次数按单次加收。",
      "startFrom": 4500,
      "breakdown": [{"label": "月费(含基础次数)", "amount": 4500}]
    },
    "tags": ["包月", "中型"],
    "enabled": true
  },
  {
    "id": "l5-monthly",
    "name": "L5",
    "fullName": "L5 包月专线车",
    "subtitle": "大型无人配送车,适合长距离大运量配送",
    "description": "大容量配送车,适合跨区、干线等大运量包月专线场景。",
    "images": [],
    "specs": {
      "cargoVolume": "5m³",
      "maxLoadKg": 1000,
      "maxRangeKm": 150,
      "speedKmh": "20-30",
      "chargeTime": "4小时快充"
    },
    "applicableScenes": ["跨区配送", "干线物流", "批发配送", "大件货物"],
    "restrictions": ["禁运危险化学品", "单件重量不超过1000kg"],
    "supportedModes": ["monthly"],
    "serviceMode": "monthly",
    "pricingDescription": {
      "description": "按月计费,包含基础配送次数,超出次数按单次加收。",
      "startFrom": 6800,
      "breakdown": [{"label": "月费(含基础次数)", "amount": 6800}]
    },
    "tags": ["包月", "大型"],
    "enabled": false
  }
] as const
