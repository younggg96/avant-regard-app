import type { TFunction } from "i18next";

/** Stripe Connect `requirements.currently_due` → 用户可读文案 */
const EXACT_KEYS: Record<string, string> = {
  external_account: "external_account",
  business_type: "business_type",
  "business_profile.url": "business_profile_url",
  "business_profile.mcc": "business_profile_mcc",
  "business_profile.product_description": "business_profile_product_description",
  "business_profile.support_phone": "business_profile_support_phone",
  "individual.id_number": "individual_id_number",
  "individual.ssn_last_4": "individual_ssn_last_4",
  "individual.verification.document": "individual_verification_document",
  "individual.first_name": "individual_name",
  "individual.last_name": "individual_name",
  "individual.email": "individual_email",
  "individual.phone": "individual_phone",
  "individual.dob.day": "individual_dob",
  "individual.dob.month": "individual_dob",
  "individual.dob.year": "individual_dob",
  "individual.address.line1": "individual_address",
  "individual.address.city": "individual_address",
  "individual.address.state": "individual_address",
  "individual.address.postal_code": "individual_address",
  "company.tax_id": "company_tax_id",
  "company.name": "company_name",
  "company.address.line1": "company_address",
  "tos_acceptance.date": "tos_acceptance",
  "tos_acceptance.ip": "tos_acceptance",
};

const PREFIX_KEYS: [prefix: string, i18nSuffix: string][] = [
  ["business_profile.", "business_profile"],
  ["individual.", "individual"],
  ["company.", "company"],
  ["owners.", "owners"],
  ["representative.", "representative"],
  ["directors.", "directors"],
  ["executives.", "executives"],
  ["tos_acceptance.", "tos_acceptance"],
];

function requirementLabel(key: string, t: TFunction): string {
  const base = "trading.payoutAccount.stripeConnect.requirements";
  const exact = EXACT_KEYS[key];
  if (exact) {
    return t(`${base}.${exact}`);
  }
  for (const [prefix, suffix] of PREFIX_KEYS) {
    if (key.startsWith(prefix)) {
      return t(`${base}.${suffix}`);
    }
  }
  return key
    .replace(/\./g, " ")
    .replace(/_/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** 去重后生成简短说明，最多展示 max 项 */
export function summarizeStripeRequirements(
  requirements: string[],
  t: TFunction,
  max = 3,
): string {
  const seen = new Set<string>();
  const labels: string[] = [];
  for (const req of requirements) {
    const label = requirementLabel(req, t);
    if (!seen.has(label)) {
      seen.add(label);
      labels.push(label);
    }
  }
  if (labels.length === 0) return "";
  if (labels.length <= max) {
    return labels.join(t("trading.payoutAccount.stripeConnect.listSeparator"));
  }
  const shown = labels
    .slice(0, max)
    .join(t("trading.payoutAccount.stripeConnect.listSeparator"));
  return t("trading.payoutAccount.stripeConnect.needsMore", {
    items: shown,
    count: labels.length - max,
  });
}
