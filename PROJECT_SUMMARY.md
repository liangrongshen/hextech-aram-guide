# 项目交接总结：海克斯大乱斗出装助手

> 本文档供模型/开发者交接使用，覆盖项目全貌、架构、技术要点与当前状态。

## 一、项目总览

LOL **海克斯大乱斗**辅助出装 APP（纯静态网页，零依赖），数据抓取自 `arammayhem.com`，图标来自 Riot Data Dragon。

**线上地址（已部署）**：https://liangrongshen.github.io/hextech-aram-guide/

| 数据规模 | 内容 |
|---|---|
| 英雄 | 172 位（版本 26.15，更新 2026-08-01） |
| 攻略 | 172 份（技能加点 / 核心出装 / 出门装 / 鞋子 / 三档符文） |
| 符文 | 255 个（198 个当前可用，含胜率/登场率/排名） |

## 二、已完成功能

1. **首页**：英雄列表 + 搜索 / 位置（战士/坦克/法师/刺客/射手/辅助 6 类）/ 强度等级（S+/S/A/B）筛选
2. **详情页**：`#/champion/:id`，完整攻略渲染
3. **对局模式**（核心新增）：`#/match` → ① 选英雄 → 出装速览 → ② 勾选对局中随机到的符文（支持搜索/稀有度筛选）→ ③ 按胜率推荐最优，显示"比第二名高 X%"理由 + 本英雄热榜徽章 → "确定选择"记入本局（4 次机会，localStorage 持久化）
4. **数据管线**：Python 定时抓取自动生成 `data.js`

## 三、项目结构

```
hextech-aram-guide/
├── index.html          # 入口（topbar + #view 容器 + footer）
├── css/style.css       # 海克斯深色主题（--hextech:#22d3c5、--gold:#f0b429）
├── js/
│   ├── data.js         # 数据（由管线生成，勿手改）：APP/IMG/ROLES/TIERS/HEROES/BUILDS/AUGMENTS
│   └── app.js          # hash 路由 + 三个视图（home/detail/match）
├── tools/
│   ├── scraper.py      # 抓取管线（核心）
│   ├── update.sh       # 本地更新脚本（./update.sh 全量 / ./update.sh quick 快速）
│   └── requirements.txt
├── .github/workflows/update-data.yml  # 每日 03:30 UTC 自动抓取并提交
└── README.md
```

## 四、关键技术要点

### 1. 数据管线 `tools/scraper.py`

- 命令：`python3 scraper.py`（全量约 5 分钟）/ `--list-only`（仅列表）/ `--augments-only`（仅符文表，秒级）/ `--limit N`（测试）
- **编码陷阱（核心）**：站点响应头无 charset，`requests` 误判 ISO-8859-1 致中文乱码 → 必须 `resp.content.decode("utf-8", errors="replace")`
- 抓取礼仪：0.4s 间隔、3 次重试、UA 头
- 解析对象：
  - 列表页：`<a data-haystacks>`（排名/胜率/登场率/tier/别名）
  - 详情页：技能加点、出门装、鞋子、核心出装、三档符文
  - 符文索引页 `arammayhem.com/zh-cn/augments/`：卡片 `a.augment-rank-row`，列 = 排名/名称/胜率/登场率，`data-rarity` 分稀有度，`data-availability` 区分可用/退役

### 2. 符文解析坑

页面"最佳强化符文"标题是"英雄名+标题"合并文本节点，精确匹配会失败 → 用 `"最佳强化符文" in s` 模糊匹配；三档（棱彩/金色/银色）子标题精确匹配定位分组容器（含 ≥3 个符文卡）。

### 3. 数据语义

详情页符文 `wr` = **全局胜率**（与索引页一致，非英雄专属），所以对局模式推荐以全局胜率为准 + "本英雄热榜"徽章提示英雄相关性。

### 4. 前端架构

纯原生 JS，无框架。`renderMatchPicker` / `renderMatch` / `updateMatchUI` / `getRecommendation`（胜率降序排序）构成对局模式。符文匹配用 `AUGMENTS.find(name)`。

### 5. AUGMENTS 合并

`--augments-only` 通过正则替换 `const AUGMENTS = \[.*?\n\];` 合并，判断"是否已有"用 `"const AUGMENTS = [" not in src`（**不能用 `new == src`**，数据未变化时会误判重复插入）。

## 五、当前运行状态

- 本地服务器：`python3 -m http.server 8080`（仅沙箱内可访问）
- **预览面板限制**：用户浏览器访问 `localhost:8080` 会报 "no healthy upstream"（面板代理连不到沙箱内网），**不是 APP 问题**，直接用线上地址即可
- GitHub 仓库：`liangrongshen/hextech-aram-guide`（公开，main 分支）

## 六、待办 / 注意事项

1. **安全**：曾使用两个 GitHub Token 完成推送与 Pages 部署，均已用完即弃，如仍有效建议撤销（GitHub → Settings → Developer settings → Tokens）
2. **可选项**：对局模式推荐目前用全局胜率，如需英雄专属符文胜率需抓详情页符文对应英雄组合数据（站点未提供，暂不可行）
3. **可能的增强**：PWA 离线支持、移动端真机优化、多语言
4. 定时更新已就绪（GitHub Actions + 本地 cron 两种方案，见 README），无需额外配置

## 七、快速操作备忘

```bash
# 本地预览（仅沙箱内）
cd hextech-aram-guide && python3 -m http.server 8080

# 手动更新数据（cd tools 后）
python3 scraper.py                 # 全量（约 5 分钟）
python3 scraper.py --augments-only # 仅符文表（秒级）
./update.sh quick                  # 列表 + 符文表
```

---

**一句话交接**：APP 已完成并线上部署（https://liangrongshen.github.io/hextech-aram-guide/），数据管线每天自动更新，后续开发聚焦对局模式体验优化即可。
