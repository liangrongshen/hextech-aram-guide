#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
海克斯出装助手 · 数据抓取管线
抓取 arammayhem.com（zh-cn）的英雄列表与详情页，生成 data.js

用法:
  python3 scraper.py                # 全量抓取（列表 + 全部英雄详情）
  python3 scraper.py --list-only    # 只更新列表数据（快）
  python3 scraper.py --limit 10     # 只抓前 10 位英雄详情（测试用）
  python3 scraper.py --out PATH     # 指定输出文件

输出:
  与现有 js/data.js 格式完全一致的 data.js（覆盖写入）
"""
import argparse
import json
import re
import sys
import time
import html as html_lib
from datetime import datetime, timezone

import requests
from bs4 import BeautifulSoup

BASE = "https://arammayhem.com"
LIST_URL = f"{BASE}/zh-cn/build/"
AUGMENTS_URL = f"{BASE}/zh-cn/augments/"
# Data Dragon 静态资源版本与英雄图片名索引
DD_VERSION = "16.10.1"
DD_CHAMPION_URL = f"https://ddragon.leagueoflegends.com/cdn/{DD_VERSION}/data/en_US/champion.json"
HEADERS = {
    "User-Agent": ("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
                   "(KHTML, like Gecko) Chrome/126.0 Safari/537.36"),
    "Accept-Language": "zh-CN,zh;q=0.9,en;q=0.8",
}
REQUEST_DELAY = 0.4        # 每次请求间隔（秒），礼貌抓取
MAX_RETRY = 3

ROLE_MAP = {
    "marksman": "射手", "assassin": "刺客", "fighter": "战士",
    "tank": "坦克", "mage": "法师", "support": "辅助",
}
RARITY_ORDER = {"silver": "silver", "gold": "gold", "prismatic": "prismatic"}

session = requests.Session()
session.headers.update(HEADERS)


def fetch(url, retry=MAX_RETRY):
    """带重试的 GET，返回 HTML 文本（强制 UTF-8 解码）。"""
    for attempt in range(1, retry + 1):
        try:
            resp = session.get(url, timeout=20)
            resp.raise_for_status()
            # 站点 Content-Type 不带 charset，requests 会误判为 ISO-8859-1
            return resp.content.decode("utf-8", errors="replace")
        except Exception as e:
            print(f"  [!] 请求失败 {url} (第{attempt}次): {e}", file=sys.stderr)
            if attempt < retry:
                time.sleep(REQUEST_DELAY * 2 * attempt)
    return None


def fetch_champion_img_keys():
    """从 Data Dragon champion.json 构建 {小写id: 正式图片名} 映射。

    站点英雄 slug 是 Data Dragon 英雄 id 的小写形式（如 "drmundo"），
    而 Data Dragon 图片文件名要求正确大小写（"DrMundo"），否则 403。
    """
    try:
        resp = session.get(DD_CHAMPION_URL, timeout=20)
        resp.raise_for_status()
        data = resp.json()["data"]
        return {c["id"].lower(): c["id"] for c in data.values()}
    except Exception as e:
        print(f"  [!] 获取 Data Dragon champion.json 失败: {e}", file=sys.stderr)
        return {}


def parse_rank_from_title(title):
    """从 title 属性解析 排名/胜率/登场率。
    title="暗夜猎手\n排名：#1\n胜率：57.32%\n登场率：13.88%" """
    rank = None
    wr = None
    pr = None
    if title:
        m = re.search(r"排名：?#?(\d+)", title)
        if m:
            rank = int(m.group(1))
        m = re.search(r"胜率：(\d+\.\d+)%", title)
        if m:
            wr = float(m.group(1))
        m = re.search(r"登场率：(\d+\.\d+)%", title)
        if m:
            pr = float(m.group(1))
    return rank, wr, pr


def tier_from_class(classes):
    """从卡片 class 中识别 tier（border-tier-s / border-tier-splus 等）。"""
    for cls in classes:
        m = re.search(r"border-tier-(splus|s|a|b|c|d)", cls)
        if m:
            return m.group(1).upper().replace("SPLUS", "S+")
    return None


def extract_alias(haystacks_json):
    """从 data-haystacks JSON 中找中文常用名（短的、非称号的）。
    例如 Vayne 的 haystacks 含 ['暗夜猎手','薇恩',...]，取“薇恩”。"""
    try:
        names = json.loads(html_lib.unescape(haystacks_json))
    except Exception:
        return None
    cn_names = [n for n in names if re.fullmatch(r"[\u4e00-\u9fff]{2,4}", n or "")]
    if not cn_names:
        return None
    # 优先选与称号不同且最短的（常用名通常更短）
    cn_names.sort(key=len)
    return cn_names[0]


def parse_list(html_text):
    """解析列表页，返回 (heroes, patch, updated)。
    heroes: [{id,name,alias,roles,tier,wr,pr,rank,hasBuild}] 按排名排序 """
    soup = BeautifulSoup(html_text, "html.parser")
    heroes = []

    # 版本号与更新时间
    patch = None
    updated = None
    m = re.search(r"补丁\s*[:：]?\s*([\d.]+)", html_text)
    if m:
        patch = m.group(1)
    m = re.search(r"更新[时间日]*：([\d-]+)", html_text)
    if m:
        updated = m.group(1)

    # JSON-LD 提供每个等级的 ordered 英雄 id（比 DOM 顺序可靠）
    tier_by_slug = {}
    for script in soup.find_all("script", type="application/ld+json"):
        try:
            data = json.loads(script.string or "")
        except Exception:
            continue
        if not isinstance(data, dict) or data.get("@type") != "ItemList":
            continue
        tier = (data.get("about") or "").upper().replace("SPLUS", "S+")
        for item in data.get("itemListElement", []):
            url = item.get("url", "")
            slug = url.rstrip("/").rsplit("/", 1)[-1]
            tier_by_slug[slug] = tier

    # 英雄卡片
    for a in soup.select("a[data-haystacks]"):
        href = a.get("href", "")
        slug = href.rstrip("/").rsplit("/", 1)[-1]
        if not slug or slug == "build":
            continue

        # 称号
        name = a.get("title", "").split("\n")[0].strip() or (a.get("aria-label") or "")
        # 位置
        tags = a.get("data-tags", "").split(",")
        roles = [ROLE_MAP[t.strip()] for t in tags if t.strip() in ROLE_MAP]
        # 排名/胜率/登场率
        rank, wr, pr = parse_rank_from_title(a.get("title"))
        # 等级
        tier = tier_by_slug.get(slug) or tier_from_class(a.get("class", []))
        # 常用名
        alias = extract_alias(a.get("data-haystacks", ""))

        heroes.append({
            "id": slug,
            "name": name,
            "alias": alias or name,
            "roles": roles,
            "tier": tier or "C",
            "wr": wr if wr is not None else 50.0,
            "pr": pr if pr is not None else 0.0,
            "rank": rank,
            "hasBuild": False,
        })

    # 按 rank 排序（rank 缺失的放最后）
    heroes.sort(key=lambda h: h["rank"] if h["rank"] else 9999)
    return heroes, patch, updated


# ---------------- 符文索引页解析 ----------------

def parse_augments(html_text):
    """解析全量符文索引页，返回 [{name, rarity, wr, pr, rank, live}]（按胜率降序）。
    卡片 a.augment-rank-row：
      列0=排名  列1=名称+稀有度+登场率(mobile)  列2=胜率  列3=登场率(desktop)  列4=推荐英雄头像
    data-availability: live / retired
    """
    soup = BeautifulSoup(html_text, "html.parser")
    augs = []
    for a in soup.select("a.augment-rank-row"):
        name = (a.get("data-name", "") or "").split()[0].strip()
        rarity = a.get("data-rarity", "")
        if not name or rarity not in RARITY_ORDER:
            continue
        cols = a.find_all("div", recursive=False)
        wr = None
        pr = None
        if len(cols) >= 4:
            m = re.search(r"([\d.]+)%", cols[2].get_text(" ", strip=True))
            if m:
                wr = float(m.group(1))
            m = re.search(r"([\d.]+)%", cols[3].get_text(" ", strip=True))
            if m:
                pr = float(m.group(1))
        if wr is None:
            # 兜底：全文本提取（文本顺序：登场率, 胜率, 登场率）
            nums = re.findall(r"([\d.]+)%", a.get_text(" ", strip=True))
            if len(nums) >= 2:
                wr, pr = float(nums[1]), float(nums[0])
        rank = None
        try:
            rank = int(a.get("data-all-rank"))
        except (TypeError, ValueError):
            pass
        augs.append({
            "name": name,
            "rarity": rarity,
            "wr": wr if wr is not None else 50.0,
            "pr": pr if pr is not None else 0.0,
            "rank": rank,
            "live": a.get("data-availability") == "live",
        })
    augs.sort(key=lambda x: x["wr"], reverse=True)
    return augs


# ---------------- 详情页解析 ----------------

def parse_skill_order(block):
    """技能主升顺序块。
    返回 {main, alternates}
    main = {order:[Q,W,E], wr, pr, label}
    """
    main = None
    alternates = []
    for box in block.select("div.rounded-lg"):
        order_el = box.select_one("span.text-primary, span.font-semibold")
        if not order_el:
            continue
        order = [c.strip() for c in re.findall(r"[QWER]", order_el.get_text())]
        if not order:
            continue
        pr_el = box.find(string=re.compile("登场率"))
        wr_el = box.find(string=re.compile("胜率"))
        pr = float(re.search(r"([\d.]+)%", pr_el.parent.get_text()).group(1)) if pr_el else None
        wr = float(re.search(r"([\d.]+)%", wr_el.parent.get_text()).group(1)) if wr_el else None
        entry = {"order": order, "wr": wr, "pr": pr}
        if main is None:
            main = entry
            main["label"] = "最常见加点"
        else:
            alternates.append(entry)
        if len(alternates) >= 3:
            break
    return {"main": main or {"order": ["Q", "W", "E"], "wr": 50.0, "pr": 0.0, "label": ""},
            "alternates": alternates[:2]}


def parse_items_block(soup, heading):
    """按标题名找出装块，返回 [{id,name,pr,wr}]（取前 5）。"""
    h = soup.find(string=lambda s: s and s.strip() == heading)
    if not h:
        return []
    section = h.find_parent("section") or h.find_parent("div")
    if not section:
        return []
    items = []
    for link in section.select("a[title]"):
        title = link.get("title", "").strip()
        img = link.select_one("img")
        item_id = None
        if img:
            m = re.search(r"/(\d+)\.png", img.get("src", ""))
            if m:
                item_id = int(m.group(1))
        if not item_id:
            continue
        # 该装备的登场率/胜率：在所属卡片盒子内找
        box = link.find_parent("div", recursive=True)
        container = box if box else section
        pr = None
        wr = None
        txt = container.get_text(" ", strip=True)
        m = re.search(r"登场率:\s*([\d.]+)%", txt)
        if m:
            pr = float(m.group(1))
        m = re.search(r"胜率:\s*([\d.]+)%", txt)
        if m:
            wr = float(m.group(1))
        items.append({"id": item_id, "name": title, "pr": pr, "wr": wr})
        if len(items) >= 5:
            break
    return items


def parse_core_combos(soup):
    """核心出装组合块，返回 [{items:[{id,name}], pr, wr}]（取前 3）。"""
    h = soup.find(string=lambda s: s and s.strip() == "核心出装")
    if not h:
        return []
    section = h.find_parent("section") or h.find_parent("div")
    if not section:
        return []
    combos = []
    for box in section.select("div.rounded-md"):
        links = box.select("a[title]")
        if len(links) < 2:
            continue
        items = []
        for link in links:
            img = link.select_one("img")
            m = re.search(r"/(\d+)\.png", img.get("src", "")) if img else None
            if not m:
                continue
            items.append({"id": int(m.group(1)), "name": link.get("title", "").strip()})
        if not items:
            continue
        txt = box.get_text(" ", strip=True)
        pr = float(re.search(r"登场率:\s*([\d.]+)%", txt).group(1)) if re.search(r"登场率:\s*([\d.]+)%", txt) else None
        wr = float(re.search(r"胜率:\s*([\d.]+)%", txt).group(1)) if re.search(r"胜率:\s*([\d.]+)%", txt) else None
        combos.append({"items": items, "pr": pr, "wr": wr})
        if len(combos) >= 3:
            break
    return combos


def parse_runes(soup):
    """三档强化符文，返回 {prismatic, gold, silver}。
    每项 {name, wr, desc}（取前 6）
    注意：区块标题实际是“英雄名 + 最佳强化符文”合并文本节点，
    因此用模糊匹配判断区块存在，精确匹配三档子标题定位分组。"""
    result = {"prismatic": [], "gold": [], "silver": []}
    h = soup.find(string=lambda s: s and "最佳强化符文" in s)
    if not h:
        return result

    # 三档区块标题：棱彩 / 金色 / 银色
    rarity_map = {"棱彩": "prismatic", "金色": "gold", "银色": "silver"}
    for label, key in rarity_map.items():
        head = soup.find(string=lambda s: s and s.strip() == label)
        if not head:
            continue
        # 向上找包含 >=3 个符文卡的分组容器（标题 → 标题行 → 卡片列表）
        group = head.find_parent("div")
        if not group:
            continue
        for _ in range(4):
            cards = group.select("a[href*='/zh-cn/augments/']")
            if len(cards) >= 3:
                break
            if group.parent:
                group = group.parent
            else:
                break
        for card in group.select("a[href*='/zh-cn/augments/']")[:6]:
            name_el = card.select_one("span.font-medium")
            name = name_el.get_text(strip=True) if name_el else ""
            txt = card.get_text(" ", strip=True)
            m = re.search(r"胜率:\s*([\d.]+)%", txt)
            wr = float(m.group(1)) if m else None
            # 描述 = 全文本 - 胜率前缀 - 名字
            desc = txt
            if m:
                desc = desc.replace("胜率: %s%%" % m.group(1), "", 1)
            if name and desc.startswith(name):
                desc = desc[len(name):]
            # 清理站点模板占位符（@XXX@）与连续空格
            desc = re.sub(r"@[^@]*@", "", desc)
            desc = re.sub(r"\s{2,}", " ", desc)
            desc = re.sub(r"^[\s:：·|,，]+", "", desc).strip()
            if not name:
                continue
            result[key].append({"name": name, "wr": wr if wr is not None else 50.0, "desc": desc})
    return result


def parse_detail(html_text, slug):
    """解析详情页，返回 build dict。"""
    soup = BeautifulSoup(html_text, "html.parser")

    skill_sec = soup.find(string=lambda s: s and s.strip() == "技能主升顺序")
    skill = {"main": {"order": ["Q", "W", "E"], "wr": 50.0, "pr": 0.0, "label": ""}, "alternates": []}
    if skill_sec:
        skill = parse_skill_order(skill_sec.find_parent("section") or skill_sec.find_parent("div"))

    starting = parse_items_block(soup, "出门装")
    boots = parse_items_block(soup, "鞋子")
    core = parse_core_combos(soup)
    runes = parse_runes(soup)

    if not (starting or boots or core or runes["prismatic"] or runes["gold"] or runes["silver"]):
        return None

    return {
        "skill": skill,
        "starting": starting,
        "boots": boots,
        "core": core,
        "runes": runes,
    }


# ---------------- data.js 生成 ----------------

def js_str(s):
    return json.dumps(str(s), ensure_ascii=False)


def build_champion_img_block(keys):
    """生成 const CHAMPION_IMG = { 小写id: 正式图片名 }; 文本。"""
    lines = ["const CHAMPION_IMG = {"]
    for k in sorted(keys):
        lines.append("  %s: %s," % (js_str(k), js_str(keys[k])))
    lines.append("};")
    return "\n".join(lines)


def build_augments_block(augments):
    """生成 const AUGMENTS = [...]; 文本（只含 live 符文，按胜率降序）。"""
    lines = ["const AUGMENTS = ["]
    for a in augments:
        if not a.get("live"):
            continue
        lines.append("  { name: %s, rarity: %s, wr: %s, pr: %s, rank: %s }," % (
            js_str(a["name"]), js_str(a["rarity"]),
            json.dumps(a["wr"]), json.dumps(a["pr"]),
            "null" if a.get("rank") is None else json.dumps(a["rank"])))
    lines.append("];")
    return "\n".join(lines)


def merge_augments_into(js_path, augments):
    """不重爬详情页，把 AUGMENTS 常量替换/插入到现有 data.js。"""
    try:
        with open(js_path, encoding="utf-8") as f:
            src = f.read()
    except FileNotFoundError:
        print(f"[✗] {js_path} 不存在。--augments-only 需要先运行一次全量抓取生成 data.js。",
              file=sys.stderr)
        sys.exit(1)
    block = build_augments_block(augments)
    new = re.sub(r"const AUGMENTS = \[.*?\n\];", block, src, count=1, flags=re.S)
    if "const AUGMENTS = [" not in src:
        # 尚无 AUGMENTS：插入到 const ROLES 之前
        marker = "const ROLES"
        if marker in new:
            new = new.replace(marker, block + "\n\n" + marker, 1)
        else:
            new = block + "\n\n" + new
    with open(js_path, "w", encoding="utf-8") as f:
        f.write(new)
    live = sum(1 for a in augments if a.get("live"))
    print(f"[✓] 已合并 AUGMENTS 到 {js_path}（{live} 个可用符文）")


def generate_data_js(heroes, builds, augments, patch, updated, out_path, champion_img_keys=None):
    """生成与现有 data.js 一致的 JS 文件。"""
    now = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M UTC")
    lines = []
    lines.append("/* ============================================================")
    lines.append("   海克斯出装助手 · 自动生成数据（请勿手动编辑）")
    lines.append(f"   生成时间：{now}")
    lines.append(f"   数据来源：arammayhem.com（版本 {patch}，更新于 {updated}）")
    lines.append("   图标来源：Riot Games Data Dragon")
    lines.append("   ============================================================ */")
    lines.append("")
    lines.append("const APP = {")
    lines.append(f"  patch: {js_str(patch)},")
    lines.append(f"  updated: {js_str(updated)},")
    lines.append(f"  ddVersion: {js_str(DD_VERSION)},")
    lines.append(f"  total: {len(heroes)},")
    lines.append(f"  heroCount: {len(heroes)},")
    lines.append("};")
    lines.append("")
    if champion_img_keys:
        lines.append(build_champion_img_block(champion_img_keys))
        lines.append("")
    lines.append("const IMG = {")
    lines.append("  champion: (id) => `https://ddragon.leagueoflegends.com/cdn/${APP.ddVersion}/img/champion/${CHAMPION_IMG[id] || id}.png`,")
    lines.append("  item: (id) => `https://ddragon.leagueoflegends.com/cdn/${APP.ddVersion}/img/item/${id}.png`,")
    lines.append("};")
    lines.append("")
    lines.append("const ROLES = ['全部', '战士', '坦克', '法师', '刺客', '射手', '辅助'];")
    lines.append("const TIERS = ['全部', 'S+', 'S', 'A', 'B'];")
    lines.append("")
    lines.append(build_augments_block(augments))
    lines.append("")

    # HEROES
    lines.append("const HEROES = [")
    for h in heroes:
        roles = ",".join(f"{js_str(r)}" for r in h["roles"])
        lines.append(
            "  { id: %s, name: %s, alias: %s, roles: [%s], tier: %s, wr: %s, pr: %s, hasBuild: %s%s }," % (
                js_str(h["id"]), js_str(h["name"]), js_str(h["alias"]), roles,
                js_str(h["tier"]), json.dumps(h["wr"]), json.dumps(h["pr"]),
                "true" if h["id"] in builds else "false",
                ", rank: %d" % h["rank"] if h["rank"] else "",
            )
        )
    lines.append("];")
    lines.append("")

    # BUILDS
    lines.append("const BUILDS = {")
    for slug, b in builds.items():
        lines.append("")
        lines.append(f"  /* ---------- {slug} ---------- */")
        lines.append(f"  {js_str(slug)}: {{")
        # skill
        main = b["skill"]["main"]
        lines.append("    skill: {")
        lines.append("      main: { order: [%s], wr: %s, pr: %s, label: %s }," % (
            ",".join(js_str(k) for k in main["order"]), json.dumps(main["wr"]),
            json.dumps(main["pr"]), js_str(main.get("label", ""))))
        alts = b["skill"]["alternates"]
        lines.append("      alternates: [")
        for alt in alts:
            lines.append("        { order: [%s], wr: %s, pr: %s }," % (
                ",".join(js_str(k) for k in alt["order"]), json.dumps(alt["wr"]), json.dumps(alt["pr"])))
        lines.append("      ],")
        lines.append("    },")
        # starting / boots
        lines.append("    starting: [")
        for it in b["starting"]:
            lines.append("      { id: %d, name: %s, pr: %s, wr: %s }," % (
                it["id"], js_str(it["name"]), json.dumps(it["pr"]), json.dumps(it["wr"])))
        lines.append("    ],")
        lines.append("    boots: [")
        for it in b["boots"]:
            lines.append("      { id: %d, name: %s, pr: %s, wr: %s }," % (
                it["id"], js_str(it["name"]), json.dumps(it["pr"]), json.dumps(it["wr"])))
        lines.append("    ],")
        # core
        lines.append("    core: [")
        for c in b["core"]:
            items = ",".join("{ id: %d, name: %s }" % (i["id"], js_str(i["name"])) for i in c["items"])
            lines.append("      { items: [%s], pr: %s, wr: %s }," % (items, json.dumps(c["pr"]), json.dumps(c["wr"])))
        lines.append("    ],")
        # runes
        lines.append("    runes: {")
        for key in ("prismatic", "gold", "silver"):
            lines.append(f"      {key}: [")
            for r in b["runes"].get(key, []):
                lines.append("        { name: %s, wr: %s, desc: %s }," % (
                    js_str(r["name"]), json.dumps(r["wr"]), js_str(r["desc"])))
            lines.append("      ],")
        lines.append("    },")
        lines.append("  },")
    lines.append("};")
    lines.append("")

    with open(out_path, "w", encoding="utf-8") as f:
        f.write("\n".join(lines))
    print(f"[✓] 已生成 {out_path}（{len(heroes)} 英雄，{len(builds)} 攻略）")


# ---------------- 主流程 ----------------

def main():
    ap = argparse.ArgumentParser(description="抓取 arammayhem 生成 data.js")
    ap.add_argument("--list-only", action="store_true", help="只更新列表")
    ap.add_argument("--augments-only", action="store_true", help="只更新全量符文表（不重爬详情）")
    ap.add_argument("--limit", type=int, default=0, help="限制详情抓取数量（测试用）")
    ap.add_argument("--out", default="/workspace/hextech-aram-guide/js/data.js")
    args = ap.parse_args()

    print("[1/4] 抓取列表页 ...")
    list_html = fetch(LIST_URL)
    if not list_html:
        print("[✗] 列表页抓取失败", file=sys.stderr)
        sys.exit(1)
    heroes, patch, updated = parse_list(list_html)
    print(f"     英雄 {len(heroes)} 位，版本 {patch}，更新 {updated}")
    time.sleep(REQUEST_DELAY)

    print("[2/4] 抓取符文索引页 ...")
    aug_html = fetch(AUGMENTS_URL)
    augments = parse_augments(aug_html) if aug_html else []
    live = sum(1 for a in augments if a.get("live"))
    print(f"     符文 {len(augments)} 个（可用 {live}）")
    time.sleep(REQUEST_DELAY)

    if args.augments_only:
        print("[3/4] 跳过详情（--augments-only）")
        print("[4/4] 合并 AUGMENTS ...")
        merge_augments_into(args.out, augments)
        print("完成。")
        return

    builds = {}
    if not args.list_only:
        targets = heroes
        if args.limit:
            targets = heroes[: args.limit]
        print(f"[3/4] 抓取 {len(targets)} 个英雄详情 ...")
        for i, h in enumerate(targets, 1):
            url = f"{BASE}/zh-cn/build/{h['id']}/"
            detail_html = fetch(url)
            if detail_html:
                b = parse_detail(detail_html, h["id"])
                if b:
                    builds[h["id"]] = b
                    h["hasBuild"] = True
            print(f"     [{i}/{len(targets)}] {h['name']} ({h['id']}) "
                  f"{'✓' if h['id'] in builds else '— 无完整数据'}")
            time.sleep(REQUEST_DELAY)
    else:
        print("[3/4] 跳过详情（--list-only）")

    print("[4/4] 生成 data.js ...")
    champion_img_keys = fetch_champion_img_keys()
    generate_data_js(heroes, builds, augments, patch, updated, args.out, champion_img_keys)
    print("完成。")


if __name__ == "__main__":
    main()
