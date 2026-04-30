export type ArchiveTab = "all" | "myContribution" | "leaderboard";
export type ContributionSubTab = "show" | "brand" | "store";

export const MAIN_TAB_IDS: ArchiveTab[] = ["all", "myContribution", "leaderboard"];

export const MAIN_TAB_KEYS: Record<ArchiveTab, string> = {
  all: "archive.all",
  myContribution: "archive.myContributions",
  leaderboard: "archive.contributionRank",
};

export const CONTRIBUTION_SUB_TAB_IDS: ContributionSubTab[] = ["show", "brand", "store"];

export const CONTRIBUTION_SUB_TAB_KEYS: Record<ContributionSubTab, string> = {
  show: "archive.showContrib",
  brand: "archive.brandContrib",
  store: "archive.storeContrib",
};

export const STATUS_STYLES: Record<string, { bg: string; color: string; labelKey: string }> = {
  APPROVED: { bg: "#E8F5E9", color: "#2E7D32", labelKey: "archive.approved" },
  REJECTED: { bg: "#FFEBEE", color: "#C62828", labelKey: "archive.rejected" },
  PENDING: { bg: "#FFF3E0", color: "#E65100", labelKey: "archive.pending" },
};

export const PAGE_SIZE = 30;
