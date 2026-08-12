# 海克斯出装助手

LOL 海克斯大乱斗辅助出装工具（纯静态网页，零依赖）。数据来自 arammayhem.com，图标来自 Riot Data Dragon。

## 功能

- **全英雄攻略**：172 位英雄的出装 / 技能加点 / 强化符文 / 胜率查询
- **对局模式**：选英雄 → 出装速览 → 勾选看到的随机符文 → 推荐最优选择（含本局 4 次记录）
- **搜索筛选**：按名称 / 位置 / 强度等级筛选

## 目录结构

```
hextech-aram-guide/
├── index.html               # 入口
├── css/style.css            # 样式
├── js/
│   ├── data.js              # 数据（由 scraper 自动生成，勿手改）
│   └── app.js               # 应用逻辑
└── tools/
    ├── scraper.py           # 数据抓取管线
    ├── requirements.txt     # Python 依赖
    └── update.sh            # 本地定时更新脚本
```

## 本地运行

```bash
cd hextech-aram-guide
python3 -m http.server 8080
# 浏览器打开 http://localhost:8080
```

## 数据更新

### 方式一：本地 cron（推荐）

```bash
crontab -e
# 每天 03:30 全量更新：
30 3 * * * /workspace/hextech-aram-guide/tools/update.sh >> /workspace/hextech-aram-guide/tools/update.log 2>&1
# 或每小时快速更新列表与符文表：
0 * * * * /workspace/hextech-aram-guide/tools/update.sh quick >> /workspace/hextech-aram-guide/tools/update.log 2>&1
```

### 方式二：GitHub Actions（免服务器）

推送到 GitHub 仓库后，` .github/workflows/update-data.yml` 每天 03:30 UTC 自动抓取并提交新的 `data.js`，再用 GitHub Pages 部署即可。

### 手动更新

```bash
cd hextech-aram-guide/tools
python3 scraper.py                 # 全量（约 5 分钟）
python3 scraper.py --list-only     # 仅列表
python3 scraper.py --augments-only # 仅符文表（快速）
python3 scraper.py --limit 3       # 测试前 3 位
```

## 数据说明

- 版本 26.15（更新于 2026-08-01），共 172 位英雄
- 符文胜率为全局统计（携带该符文时的对局胜率），对局模式同时标注"本英雄热榜"作参考
- 非官方工具，数据仅供参考

## 免责声明

英雄联盟相关素材版权归 Riot Games 所有。本工具数据来自 arammayhem.com，仅供学习交流。
