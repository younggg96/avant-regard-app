#!/usr/bin/env python3
"""
导入论坛帖子 Mock Data 到 Supabase

使用方法:
1. 确保 .env 文件中配置了 SUPABASE_URL 和 SUPABASE_SERVICE_KEY
2. 运行: python scripts/import_forum_posts.py

注意: 需要先确保 communities 表中有社区数据
"""

import os
import random
from datetime import datetime, timedelta
from pathlib import Path


# 自动加载 .env 文件
def load_env():
    """从 backend 目录或项目根目录加载 .env 文件"""
    script_dir = Path(__file__).parent
    project_root = script_dir.parent

    # 尝试加载的 .env 文件路径（按优先级，backend/.env 优先）
    env_paths = [
        project_root / "backend" / ".env",
        project_root / ".env",
    ]

    loaded_count = 0
    for env_path in env_paths:
        if env_path.exists():
            print(f"📁 加载环境变量: {env_path}")
            with open(env_path, "r", encoding="utf-8") as f:
                for line in f:
                    line = line.strip()
                    # 跳过空行和注释
                    if not line or line.startswith("#"):
                        continue
                    # 确保有等号分隔
                    if "=" not in line:
                        continue
                    # 分割 key=value
                    key, value = line.split("=", 1)
                    key = key.strip()
                    value = value.strip()
                    # 移除可能的引号
                    if (value.startswith('"') and value.endswith('"')) or (
                        value.startswith("'") and value.endswith("'")
                    ):
                        value = value[1:-1]
                    os.environ[key] = value
                    loaded_count += 1
            print(f"   已加载 {loaded_count} 个环境变量")
            return True
    return False


load_env()

from supabase import create_client, Client

# 从环境变量获取 Supabase 配置（支持多种变量名）
SUPABASE_URL = os.getenv("SUPABASE_URL") or os.getenv("EXPO_PUBLIC_SUPABASE_URL")
SUPABASE_SERVICE_KEY = os.getenv("SUPABASE_SERVICE_KEY") or os.getenv("SUPABASE_KEY")

# 调试：打印找到的变量
if not SUPABASE_URL or not SUPABASE_SERVICE_KEY:
    print("\n🔍 调试信息 - 已加载的 Supabase 相关环境变量:")
    for key, value in os.environ.items():
        if "SUPABASE" in key.upper():
            # 隐藏敏感信息
            masked_value = value[:20] + "..." if len(value) > 20 else value
            print(f"   {key} = {masked_value}")

if not SUPABASE_URL or not SUPABASE_SERVICE_KEY:
    print("错误: 请设置 SUPABASE_URL 和 SUPABASE_SERVICE_KEY 环境变量")
    print("示例:")
    print("  export SUPABASE_URL=https://xxx.supabase.co")
    print("  export SUPABASE_SERVICE_KEY=your-service-key")
    exit(1)


# Mock 用户数据（如果需要创建测试用户）
MOCK_USERS = [
    {"phone": "13800000001", "username": "时尚达人Amy"},
    {"phone": "13800000002", "username": "穿搭小王子"},
    {"phone": "13800000003", "username": "潮流先锋Leo"},
    {"phone": "13800000004", "username": "美妆博主Lily"},
    {"phone": "13800000005", "username": "时装编辑Sarah"},
    {"phone": "13800000006", "username": "买手店主Kevin"},
    {"phone": "13800000007", "username": "设计师小张"},
    {"phone": "13800000008", "username": "时尚插画师"},
]

# Mock 帖子内容 - 按社区分类
MOCK_POSTS = {
    "fashion-outfit": [
        {
            "title": "今日OOTD｜极简风通勤穿搭",
            "content_text": """今天分享一套适合春季的极简风通勤穿搭！

整体选择了黑白灰的经典配色，既不会出错又很有质感。

上装：Lemaire 白色廓形衬衫
下装：The Row 黑色西装裤
外套：Toteme 灰色羊绒大衣
鞋子：Bottega Veneta 方头穆勒鞋
包包：The Row 腋下包

这套搭配的关键在于廓形的把控，衬衫选择了oversize版型，裤子则是修身直筒，形成对比。""",
            "image_urls": [
                "https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=800",
                "https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?w=800",
            ],
            "post_type": "OUTFIT",
        },
        {
            "title": "秋冬必备｜层次感叠穿技巧",
            "content_text": """秋冬穿搭的精髓就在于叠穿！

今天教大家三个叠穿小技巧：

1. 长短叠穿：短外套+长内搭，或者长外套+短内搭
2. 材质对比：毛呢+丝绒、皮革+针织
3. 色彩呼应：内外单品有一个颜色是相近的

这套我选择了：
- 最里层：白色高领打底
- 第二层：米色羊绒马甲  
- 第三层：深棕色皮夹克
- 最外层：驼色羊毛大衣

层次分明但不臃肿的关键是选择轻薄但保暖的面料！""",
            "image_urls": [
                "https://images.unsplash.com/photo-1539109136881-3be0616acf4b?w=800"
            ],
            "post_type": "OUTFIT",
        },
        {
            "title": "一衣多穿｜基础款白衬衫的5种搭法",
            "content_text": """一件基础款白衬衫到底能有多少种穿法？今天来示范5种！

Look 1：正式通勤
衬衫+西装裤+高跟鞋，袖口挽起更显干练

Look 2：休闲周末  
衬衫敞开当外套+背心+牛仔裤

Look 3：约会甜美
衬衫塞进高腰半裙，解开两颗扣子

Look 4：街头潮流
衬衫下摆打结+工装裤+老爹鞋

Look 5：优雅知性
衬衫+针织马甲+阔腿裤

基础款单品的魅力就在于它的百搭性，关键是要学会用配饰和搭配方式来变换风格。""",
            "image_urls": [
                "https://images.unsplash.com/photo-1594938298603-c8148c4dae35?w=800",
                "https://images.unsplash.com/photo-1485968579580-b6d095142e6e?w=800",
                "https://images.unsplash.com/photo-1509631179647-0177331693ae?w=800",
            ],
            "post_type": "OUTFIT",
        },
        {
            "title": "小个子友好｜155cm的显高穿搭分享",
            "content_text": """作为155cm的小个子，这些年摸索出了一些显高穿搭心得：

✨ 提高腰线是关键
- 高腰裤/裙是必备
- 上衣选择短款或塞进去
- 腰带的使用很重要

✨ 同色系更显高
- 上下装同色延伸视觉
- 鞋子和裤子同色效果更好

✨ 适度露肤
- V领比圆领显脖子长
- 九分裤比长裤显腿长
- 适当露出脚踝

今天这套全身驼色系，加上尖头高跟鞋，视觉上至少显高5cm！""",
            "image_urls": [
                "https://images.unsplash.com/photo-1496747611176-843222e1e57c?w=800"
            ],
            "post_type": "DAILY_SHARE",
        },
    ],
    "brand-talk": [
        {
            "title": "深度分析｜为什么The Row能成为安静奢华的代名词",
            "content_text": """The Row 由 Olsen 姐妹创立，如今已经成为 "安静奢华" 风格的标杆品牌。

品牌成功的几个关键因素：

1️⃣ 极致的品质追求
- 全球搜寻最好的面料供应商
- 意大利工匠手工制作
- 每件单品都经过严格品控

2️⃣ 低调的设计语言  
- 没有明显Logo
- 以廓形和面料取胜
- 色彩克制但高级

3️⃣ 精准的市场定位
- 瞄准真正懂时尚的消费者
- 不追求爆款，追求经典
- 限量生产，保持稀缺性

4️⃣ 创始人的个人魅力
- Olsen姐妹本身就是品牌最好的代言
- 低调内敛的公关策略

你们觉得The Row贵得值不值？""",
            "image_urls": [
                "https://images.unsplash.com/photo-1558171813-4c088753af8f?w=800"
            ],
            "post_type": "ARTICLES",
        },
        {
            "title": "品牌故事｜Maison Margiela的解构美学",
            "content_text": """Martin Margiela 是时尚界最神秘的设计师之一，他从不公开露面，却创造了最具颠覆性的时装语言。

🔸 解构主义的开创者
将完成的衣服拆解重组，内衬外翻，未完成的边缘...这些如今看来习以为常的设计，在90年代是前所未有的。

🔸 标志性的空白标签
Margiela 拒绝署名，用四个白色缝线代替Logo，这本身就是对时尚界盲目崇拜品牌的讽刺。

🔸 Tabi 分趾鞋
灵感来自日本传统足袋，如今已成为品牌最具辨识度的单品。

🔸 后 Margiela 时代
John Galliano 接任后，保留了品牌的先锋精神，同时注入了更多戏剧性。

Margiela 的伟大在于，他不只是创造了衣服，而是重新定义了我们对 "时尚" 的理解。""",
            "image_urls": [
                "https://images.unsplash.com/photo-1445205170230-053b83016050?w=800"
            ],
            "post_type": "ARTICLES",
        },
        {
            "title": "新品速递｜Bottega Veneta 2024春夏系列亮点",
            "content_text": """Matthieu Blazy 执掌下的 Bottega Veneta 又带来了惊喜！

这次2024春夏系列的几个亮点：

🌟 皮革工艺再升级
- 新款编织纹理更加细腻
- 推出了仿牛仔布的皮革面料（太惊艳了！）
- 继续深耕无Logo设计

🌟 色彩选择
- 大量使用了柔和的大地色
- 点缀明亮的橙色和绿色
- 整体氛围轻松度假感

🌟 值得关注的单品
- Andiamo 包的新配色
- 皮革凉鞋
- 针织套装

个人最喜欢的是那件仿牛仔皮夹克，工艺太牛了！""",
            "image_urls": [
                "https://images.unsplash.com/photo-1483985988355-763728e1935b?w=800"
            ],
            "post_type": "DAILY_SHARE",
        },
        {
            "title": "对比测评｜三大品牌基础款T恤横评",
            "content_text": """花了一个月测试了三个品牌的基础款白T，来给大家做个详细对比！

📍 测试品牌：Uniqlo U / COS / The Row

【面料】
Uniqlo U: 厚实棉，略硬
COS: 中等厚度，柔软
The Row: 超细棉，丝滑

【版型】
Uniqlo U: 标准宽松
COS: 微廓形
The Row: 修身但不紧

【领口】
Uniqlo U: 容易变形
COS: 保持较好
The Row: 完全不变形

【价格】
Uniqlo U: ¥99
COS: ¥350
The Row: ¥2500

【性价比之选】COS
【品质之选】The Row
【日常消耗】Uniqlo U

你们日常都穿什么品牌的基础款？""",
            "image_urls": [
                "https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?w=800",
                "https://images.unsplash.com/photo-1576566588028-4147f3842f27?w=800",
            ],
            "post_type": "ITEM_REVIEW",
            "rating": 4,
        },
    ],
    "runway-review": [
        {
            "title": "秀场直击｜Chanel 2024高定的东方韵味",
            "content_text": """这季Chanel高定让我惊喜！

Virginie Viard 这次从东方美学中汲取灵感，呈现了一场优雅与神秘并存的秀。

💫 秀场布置
大皇宫内搭建了一个巨型鸟笼装置，模特们从中缓缓走出，宛如被释放的金丝雀。

💫 设计亮点
- 大量运用了中式立领和盘扣元素
- 刺绣工艺令人叹为观止
- 珍珠和流苏的搭配很新颖

💫 我的TOP 3 Look
Look 15: 黑色天鹅绒礼服配珍珠披肩
Look 28: 白色蕾丝套装
Look 42: 闭场的红色刺绣长裙

整体来说这是近几季最让我满意的Chanel高定！""",
            "image_urls": [
                "https://images.unsplash.com/photo-1509631179647-0177331693ae?w=800"
            ],
            "post_type": "DAILY_SHARE",
        },
        {
            "title": "时装周观察｜米兰时装周的三大趋势",
            "content_text": """刚从米兰时装周回来，总结了这次看秀的三大趋势：

📌 趋势一：超大廓形回归
从 Prada 到 Max Mara，大量oversize单品出现，宽肩、落肩、巨型袖子成为主流。

📌 趋势二：金属质感
金属丝面料、亮片、金属色皮革...在灯光下闪闪发光的材质是这季的宠儿。

📌 趋势三：实用主义美学
口袋越来越多，功能性设计融入高级时装，Prada的尼龙工装系列是最好的例证。

预测这些趋势会在明年春天的高街品牌中大量出现，想要提前入手的可以开始关注了！""",
            "image_urls": [
                "https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=800",
                "https://images.unsplash.com/photo-1469334031218-e382a71b716b?w=800",
            ],
            "post_type": "ARTICLES",
        },
        {
            "title": "秀场幕后｜时装周的真实体验分享",
            "content_text": """第一次参加四大时装周，来分享一些幕后体验！

🎫 关于邀请函
- 座位真的分等级，前排/二排/站票完全不同体验
- 邀请函设计都很精美，很多人会收藏
- 要提前1-2小时到场排队

👗 关于穿搭
- 街拍摄影师会盯着穿得好看的人
- 大家都会穿当季或下一季的单品
- 舒适的鞋子很重要！

📸 关于看秀
- 真的很快，10-15分钟就结束了
- 现场氛围和看视频完全不同
- 手机拍照很难拍好，专注欣赏更重要

🍽 关于行程
- 一天跑4-5场秀是常态
- 几乎没时间好好吃饭
- 但认识了很多有趣的人！""",
            "image_urls": [
                "https://images.unsplash.com/photo-1445205170230-053b83016050?w=800"
            ],
            "post_type": "DAILY_SHARE",
        },
    ],
    "beauty-skincare": [
        {
            "title": "护肤心得｜换季敏感肌急救指南",
            "content_text": """换季期间皮肤又开始作妖了？分享我的急救方案！

🚨 急救第一步：精简护肤
- 暂停所有功效性产品
- 只用清洁+保湿+防晒
- 避免化妆或只用矿物质彩妆

🚨 急救第二步：修复屏障
推荐产品：
- 理肤泉B5修复霜
- 薇诺娜特护霜
- CeraVe 保湿乳

🚨 急救第三步：注意细节
- 用温水洗脸
- 毛巾用一次性的
- 枕套勤换洗

🚨 严重情况
如果泛红刺痛超过3天，建议就医！

分享一下你们换季都用什么急救产品？""",
            "image_urls": [
                "https://images.unsplash.com/photo-1556228720-195a672e8a03?w=800"
            ],
            "post_type": "DAILY_SHARE",
        },
        {
            "title": "彩妆测评｜5款大牌口红实测对比",
            "content_text": """历时一周，终于完成了这期口红测评！

测试了5款人气口红的热门色号：

💄 Chanel 丝绒唇膏 #58
- 质地：丝绒哑光
- 显色度：⭐⭐⭐⭐⭐
- 持久度：⭐⭐⭐⭐
- 滋润度：⭐⭐⭐

💄 YSL 小金条 #1966
- 质地：缎面
- 显色度：⭐⭐⭐⭐
- 持久度：⭐⭐⭐⭐⭐
- 滋润度：⭐⭐⭐⭐

💄 Tom Ford 黑管 #16
- 质地：奶油
- 显色度：⭐⭐⭐⭐⭐
- 持久度：⭐⭐⭐
- 滋润度：⭐⭐⭐⭐⭐

💄 Dior 999
- 质地：缎面
- 显色度：⭐⭐⭐⭐⭐
- 持久度：⭐⭐⭐⭐
- 滋润度：⭐⭐⭐⭐

💄 Hermès 玫瑰木
- 质地：丝绒
- 显色度：⭐⭐⭐⭐
- 持久度：⭐⭐⭐⭐
- 滋润度：⭐⭐⭐

综合之选：YSL小金条
质感之选：Tom Ford黑管""",
            "image_urls": [
                "https://images.unsplash.com/photo-1586495777744-4413f21062fa?w=800",
                "https://images.unsplash.com/photo-1631214540553-ff044a3ff1ea?w=800",
            ],
            "post_type": "ITEM_REVIEW",
            "rating": 5,
        },
    ],
    "lifestyle": [
        {
            "title": "家居美学｜如何打造ins风卧室",
            "content_text": """分享一下我的卧室改造心得！

🏠 色调选择
- 主色调：米白+奶油色
- 点缀色：复古绿/焦糖色
- 避免大面积深色

🏠 软装搭配
- 床品选择纯棉或亚麻材质
- 加入不同材质的抱枕
- 一块毛绒地毯提升温馨感

🏠 氛围感小物
- 香薰蜡烛（推荐Diptyque）
- 干花装饰
- 小型绿植
- 氛围灯/小夜灯

🏠 收纳技巧
- 藤编收纳筐
- 墙面置物架
- 床头小推车

预算有限的话，从床品和灯光开始改造，效果最明显！""",
            "image_urls": [
                "https://images.unsplash.com/photo-1616594039964-ae9021a400a0?w=800"
            ],
            "post_type": "DAILY_SHARE",
        },
        {
            "title": "咖啡探店｜上海小众咖啡馆合集",
            "content_text": """周末探店上海的几家宝藏咖啡馆，分享给大家！

☕ MANNER COFFEE（原始店）
📍 南阳路
- 上海精品咖啡的起点
- 必点：脏脏拿铁
- 人均：25-35元

☕ Seesaw（愚园路店）
📍 愚园路
- 老洋房改造，氛围绝了
- 必点：创意特调
- 人均：40-55元

☕ %Arabica
📍 武康路
- 拍照圣地
- 必点：西班牙拿铁
- 人均：45-60元

☕ Metal Hands
📍 富民路
- 工业风设计
- 必点：手冲单品
- 人均：35-50元

你们还有什么宝藏咖啡馆推荐吗？""",
            "image_urls": [
                "https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?w=800",
                "https://images.unsplash.com/photo-1501339847302-ac426a4a7cbb?w=800",
            ],
            "post_type": "DAILY_SHARE",
        },
        {
            "title": "读书分享｜时尚从业者必读书单",
            "content_text": """作为时尚从业者，这几本书我反复读了很多遍：

📚 《穿Prada的女王》
不只是职场小说，更是对时尚行业运作方式的深刻描写。

📚 《时装的哲学》
从哲学角度分析时尚，理解时尚为什么是一种文化现象。

📚 《奢侈的》
解读奢侈品行业的商业逻辑，必读！

📚 《Coco Chanel》传记
了解Chanel本人的故事，理解品牌精神。

📚 《The Fashion System》- Roland Barthes
符号学视角分析时尚系统，学术但有趣。

📚 《Dior by Dior》
Christian Dior的自传，了解New Look诞生的背景。

你们最近在读什么书？欢迎推荐！""",
            "image_urls": [
                "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=800"
            ],
            "post_type": "DAILY_SHARE",
        },
    ],
}


def get_supabase_client() -> Client:
    """获取 Supabase 客户端"""
    return create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY)


def ensure_test_users(client: Client) -> list:
    """确保测试用户存在，返回用户ID列表"""
    print("📝 检查/创建测试用户...")

    # 首先尝试获取现有用户
    existing_users = client.table("users").select("id").limit(10).execute()
    if existing_users.data and len(existing_users.data) > 0:
        user_ids = [u["id"] for u in existing_users.data]
        print(f"✅ 使用现有的 {len(user_ids)} 个用户")
        return user_ids

    # 如果没有现有用户，创建测试用户
    user_ids = []
    for user in MOCK_USERS:
        try:
            # 检查用户是否存在
            existing = (
                client.table("users").select("id").eq("phone", user["phone"]).execute()
            )

            if existing.data:
                user_ids.append(existing.data[0]["id"])
            else:
                # 创建新用户（添加 password_hash 占位符）
                new_user = (
                    client.table("users")
                    .insert(
                        {
                            "phone": user["phone"],
                            "username": user["username"],
                            "password_hash": "mock_user_placeholder",  # 占位符
                            "user_type": "USER",
                            "status": "ACTIVE",
                        }
                    )
                    .execute()
                )

                if new_user.data:
                    user_id = new_user.data[0]["id"]
                    user_ids.append(user_id)

                    # 创建用户信息
                    client.table("user_info").insert(
                        {
                            "user_id": user_id,
                            "bio": f"热爱时尚的{user['username']}",
                            "avatar_url": f"https://i.pravatar.cc/150?u={user['phone']}",
                        }
                    ).execute()

                    print(f"   ✅ 创建用户: {user['username']}")
        except Exception as e:
            print(f"   ❌ 处理用户 {user['username']} 失败: {e}")

    print(f"✅ 共有 {len(user_ids)} 个测试用户可用")
    return user_ids


def get_communities(client: Client) -> dict:
    """获取社区列表，返回 slug -> id 的映射"""
    print("📂 获取社区列表...")

    result = client.table("communities").select("id, slug, name").execute()

    if not result.data:
        print("❌ 没有找到社区数据，请先运行 012_add_communities.sql")
        return {}

    communities = {item["slug"]: item["id"] for item in result.data}
    print(
        f"✅ 找到 {len(communities)} 个社区: {', '.join([item['name'] for item in result.data])}"
    )
    return communities


def import_forum_posts(client: Client, user_ids: list, communities: dict):
    """导入论坛帖子"""
    print("\n📮 开始导入论坛帖子...")

    imported = 0
    errors = 0

    for community_slug, posts in MOCK_POSTS.items():
        community_id = communities.get(community_slug)

        if not community_id:
            print(f"   ⚠️ 找不到社区: {community_slug}，跳过该社区的帖子")
            continue

        print(f"\n   📁 处理社区: {community_slug}")

        for post in posts:
            try:
                # 随机选择一个用户
                user_id = random.choice(user_ids)

                # 随机生成一些统计数据
                like_count = random.randint(10, 500)
                favorite_count = random.randint(5, 200)
                comment_count = random.randint(0, 50)

                # 随机生成创建时间（最近30天内）
                days_ago = random.randint(0, 30)
                created_at = (datetime.now() - timedelta(days=days_ago)).isoformat()

                # 准备插入数据
                insert_data = {
                    "user_id": user_id,
                    "community_id": community_id,
                    "post_type": post.get("post_type", "DAILY_SHARE"),
                    "status": "PUBLISHED",
                    "audit_status": "APPROVED",
                    "title": post["title"],
                    "content_text": post["content_text"],
                    "image_urls": post.get("image_urls", []),
                    "like_count": like_count,
                    "favorite_count": favorite_count,
                    "comment_count": comment_count,
                    "created_at": created_at,
                }

                # 如果是商品评价，添加评分
                if post.get("rating"):
                    insert_data["rating"] = post["rating"]

                client.table("posts").insert(insert_data).execute()
                imported += 1
                print(f"      ✅ {post['title'][:30]}...")

            except Exception as e:
                errors += 1
                print(f"      ❌ 导入失败: {post['title'][:30]}... - {e}")

    print(f"\n✅ 论坛帖子导入完成: 成功 {imported}, 失败 {errors}")
    return imported


def update_community_post_counts(client: Client):
    """更新社区帖子统计"""
    print("\n📊 更新社区帖子统计...")

    try:
        # 获取每个社区的帖子数量
        communities = client.table("communities").select("id, slug").execute()

        for community in communities.data:
            # 计算该社区的帖子数量
            count_result = (
                client.table("posts")
                .select("id", count="exact")
                .eq("community_id", community["id"])
                .execute()
            )
            post_count = count_result.count or 0

            # 更新社区的帖子数量
            client.table("communities").update({"post_count": post_count}).eq(
                "id", community["id"]
            ).execute()

            print(f"   {community['slug']}: {post_count} 篇帖子")

        print("✅ 社区统计更新完成")
    except Exception as e:
        print(f"❌ 更新社区统计失败: {e}")


def main():
    """主函数"""
    print("=" * 60)
    print("🎨 Avant Regard 论坛帖子导入工具")
    print("=" * 60)

    # 获取 Supabase 客户端
    try:
        client = get_supabase_client()
        print("✅ 已连接到 Supabase")
    except Exception as e:
        print(f"❌ 连接 Supabase 失败: {e}")
        return

    # 确保测试用户存在
    print()
    user_ids = ensure_test_users(client)
    if not user_ids:
        print("❌ 没有可用的用户，无法导入帖子")
        return

    # 获取社区列表
    print()
    communities = get_communities(client)
    if not communities:
        print("❌ 没有可用的社区，请先创建社区")
        return

    # 导入论坛帖子
    import_forum_posts(client, user_ids, communities)

    # 更新社区帖子统计
    update_community_post_counts(client)

    print()
    print("=" * 60)
    print("🎉 数据导入完成！")
    print("=" * 60)


if __name__ == "__main__":
    main()
