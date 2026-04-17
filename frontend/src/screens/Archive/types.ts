export type ArchiveTab = "all" | "myContribution" | "leaderboard";
export type ContributionSubTab = "show" | "brand" | "store";

export const MAIN_TABS: { id: ArchiveTab; label: string }[] = [
  { id: "all", label: "全部" },
  { id: "myContribution", label: "我的贡献" },
  { id: "leaderboard", label: "贡献榜" },
];

export const CONTRIBUTION_SUB_TABS: { id: ContributionSubTab; label: string }[] = [
  { id: "show", label: "秀场" },
  { id: "brand", label: "品牌" },
  { id: "store", label: "买手店" },
];

export const STATUS_STYLES: Record<string, { bg: string; color: string; label: string }> = {
  APPROVED: { bg: "#E8F5E9", color: "#2E7D32", label: "已通过" },
  REJECTED: { bg: "#FFEBEE", color: "#C62828", label: "已拒绝" },
  PENDING: { bg: "#FFF3E0", color: "#E65100", label: "审核中" },
};

export const PAGE_SIZE = 30;
