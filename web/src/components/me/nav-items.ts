import type { MeNavItem } from "@/components/me/MeNav";

/**
 * Shared nav between `/me/*` and `/settings/*` sidebars.
 * Keep a single source of truth so adding a new sub-page only touches one file.
 */
export const ME_NAV_ITEMS: MeNavItem[] = [
  { href: "/me", label: "个人主页", group: "我的" },
  { href: "/me/level", label: "我的等级", group: "我的" },
  { href: "/me/likes", label: "点赞", group: "我的" },
  { href: "/me/favorites", label: "收藏", group: "我的" },
  { href: "/me/wants", label: "愿望单", group: "我的" },
  { href: "/me/follows", label: "关注与粉丝", group: "我的" },
  { href: "/me/merchant", label: "我的店铺", group: "商家中心" },
  { href: "/me/chats", label: "私信", group: "消息" },
  { href: "/me/notifications", label: "通知", group: "消息" },
  { href: "/settings/profile", label: "编辑资料", group: "设置" },
  { href: "/settings/password", label: "修改密码", group: "设置" },
  { href: "/settings/blocked", label: "屏蔽用户", group: "设置" },
  { href: "/settings/reports", label: "我的举报", group: "设置" },
];
