/**
 * 买手店国家 / 城市中英文映射 — 对齐 iOS BuyerMapScreen.tsx。
 *
 * 单独抽文件是因为表较长且在多个组件（芯片、筛选 sheet、详情 sheet）复用，
 * 避免在同一页面里维护两份。
 */

export const COUNTRY_TRANSLATIONS: Record<string, string> = {
  中国: "China",
  以色列: "Israel",
  俄罗斯: "Russia",
  加拿大: "Canada",
  南非: "South Africa",
  台湾: "Taiwan",
  奥地利: "Austria",
  希腊: "Greece",
  德国: "Germany",
  意大利: "Italy",
  挪威: "Norway",
  新加坡: "Singapore",
  日本: "Japan",
  法国: "France",
  澳大利亚: "Australia",
  瑞典: "Sweden",
  瑞士: "Switzerland",
  罗马尼亚: "Romania",
  美国: "USA",
  芬兰: "Finland",
  英国: "UK",
  荷兰: "Netherlands",
  西班牙: "Spain",
  越南: "Vietnam",
  阿联酋: "UAE",
};

export const CITY_TRANSLATIONS: Record<string, string> = {
  Barcelona: "巴塞罗那",
  Berlin: "柏林",
  Birmingham: "伯明翰",
  Bucharest: "布加勒斯特",
  "Cape Town": "开普敦",
  Carpi: "卡尔皮",
  Chicago: "芝加哥",
  Dubai: "迪拜",
  Frankfurt: "法兰克福",
  Gothenburg: "哥德堡",
  Graz: "格拉茨",
  "Ha Noi": "河内",
  Hamburg: "汉堡",
  Helsinki: "赫尔辛基",
  Ibiza: "伊比萨",
  Kobe: "神户",
  Kyoto: "京都",
  Leeds: "利兹",
  Leicester: "莱斯特",
  Leipzig: "莱比锡",
  London: "伦敦",
  "Los Angeles": "洛杉矶",
  Lugano: "卢加诺",
  Madrid: "马德里",
  Mallorca: "马略卡",
  Milan: "米兰",
  Montréal: "蒙特利尔",
  Monza: "蒙扎",
  Moscow: "莫斯科",
  Munich: "慕尼黑",
  Mykonos: "米科诺斯",
  Nagoya: "名古屋",
  "New York": "纽约",
  Osaka: "大阪",
  Oslo: "奥斯陆",
  Padua: "帕多瓦",
  Paris: "巴黎",
  Rome: "罗马",
  Rotterdam: "鹿特丹",
  "San Francisco": "旧金山",
  Singapore: "新加坡",
  Sittard: "锡塔德",
  Sydney: "悉尼",
  Taipei: "台北",
  "Tel Aviv": "特拉维夫",
  Tokyo: "东京",
  Torino: "都灵",
  Toulouse: "图卢兹",
  Vienna: "维也纳",
  上海: "Shanghai",
  北京: "Beijing",
  广州: "Guangzhou",
  杭州: "Hangzhou",
  深圳: "Shenzhen",
  香港: "Hong Kong",
};

export function getCountryDisplayName(country: string): string {
  const translation = COUNTRY_TRANSLATIONS[country];
  return translation ? `${country} ${translation}` : country;
}

export function getCityDisplayName(city: string): string {
  const translation = CITY_TRANSLATIONS[city];
  return translation ? `${city} ${translation}` : city;
}

// 热门品牌 — 与 iOS POPULAR_BRANDS 保持一致
export const POPULAR_BRANDS = [
  "Rick Owens",
  "Yohji Yamamoto",
  "COMME des GARÇONS",
  "Ann Demeulemeester",
  "Guidi",
  "Jean Paul Gaultier",
  "Vivienne Westwood",
  "Undercover",
  "Dries Van Noten",
  "Maison Margiela",
];

// 风格分类 — 与 iOS STYLE_CATEGORIES 保持一致
export const STYLE_CATEGORIES: Record<string, string[]> = {
  设计师风格: ["先锋", "暗黑", "工匠", "极简"],
  复古潮流: ["vintage", "archive", "中古", "美式复古", "美式vintage"],
  特色风格: ["日系", "女装", "哥特", "视觉系", "亚文化", "银饰"],
  集合店: ["设计师品牌", "设计师品牌集合店", "集合店"],
};
