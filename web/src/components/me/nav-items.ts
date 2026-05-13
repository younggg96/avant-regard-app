import type { MeNavItem } from "@/components/me/MeNav";

/**
 * Shared nav between `/me/*` and `/settings/*` sidebars.
 * Keep a single source of truth so adding a new sub-page only touches one file.
 *
 * `labelKey` is an i18n translation key; `label` is used as fallback.
 */
export const ME_NAV_ITEMS: MeNavItem[] = [
  { href: "/me", label: "个人主页", labelKey: "meNav.home", group: "我的", groupKey: "meNav.groupMe" },
  { href: "/me/level", label: "我的等级", labelKey: "meNav.level", group: "我的", groupKey: "meNav.groupMe" },
  { href: "/me/likes", label: "点赞", labelKey: "meNav.likes", group: "我的", groupKey: "meNav.groupMe" },
  { href: "/me/favorites", label: "收藏", labelKey: "meNav.favorites", group: "我的", groupKey: "meNav.groupMe" },
  { href: "/me/wants", label: "愿望单", labelKey: "meNav.wants", group: "我的", groupKey: "meNav.groupMe" },
  { href: "/me/follows", label: "关注与粉丝", labelKey: "meNav.follows", group: "我的", groupKey: "meNav.groupMe" },
  { href: "/me/merchant", label: "我的店铺", labelKey: "meNav.merchant", group: "商家中心", groupKey: "meNav.groupMerchant" },
  { href: "/me/chats", label: "私信", labelKey: "meNav.chats", group: "消息", groupKey: "meNav.groupMessages" },
  { href: "/me/notifications", label: "通知", labelKey: "meNav.notifications", group: "消息", groupKey: "meNav.groupMessages" },
  { href: "/settings/profile", label: "编辑资料", labelKey: "meNav.editProfile", group: "设置", groupKey: "meNav.groupSettings" },
  { href: "/settings/appearance", label: "外观", labelKey: "meNav.appearance", group: "设置", groupKey: "meNav.groupSettings" },
  { href: "/settings/password", label: "修改密码", labelKey: "meNav.password", group: "设置", groupKey: "meNav.groupSettings" },
  { href: "/settings/language", label: "语言", labelKey: "meNav.language", group: "设置", groupKey: "meNav.groupSettings" },
  { href: "/settings/blocked", label: "屏蔽用户", labelKey: "meNav.blocked", group: "设置", groupKey: "meNav.groupSettings" },
  { href: "/settings/reports", label: "我的举报", labelKey: "meNav.reports", group: "设置", groupKey: "meNav.groupSettings" },
];
