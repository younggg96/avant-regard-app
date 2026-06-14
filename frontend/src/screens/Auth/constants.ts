import { Dimensions } from "react-native";
import i18n from "@/i18n";
import { IS_NA } from "@/config/env";
import { AuthMode } from "./types";

export const { width: SCREEN_WIDTH } = Dimensions.get("window");

// 中国省份列表
const CN_PROVINCES = [
  "北京",
  "上海",
  "天津",
  "重庆",
  "河北",
  "山西",
  "辽宁",
  "吉林",
  "黑龙江",
  "江苏",
  "浙江",
  "安徽",
  "福建",
  "江西",
  "山东",
  "河南",
  "湖北",
  "湖南",
  "广东",
  "海南",
  "四川",
  "贵州",
  "云南",
  "陕西",
  "甘肃",
  "青海",
  "台湾",
  "内蒙古",
  "广西",
  "西藏",
  "宁夏",
  "新疆",
  "香港",
  "澳门",
  "海外",
];

const US_STATES = [
  "Alabama", "Alaska", "Arizona", "Arkansas", "California",
  "Colorado", "Connecticut", "Delaware", "Florida", "Georgia",
  "Hawaii", "Idaho", "Illinois", "Indiana", "Iowa",
  "Kansas", "Kentucky", "Louisiana", "Maine", "Maryland",
  "Massachusetts", "Michigan", "Minnesota", "Mississippi", "Missouri",
  "Montana", "Nebraska", "Nevada", "New Hampshire", "New Jersey",
  "New Mexico", "New York", "North Carolina", "North Dakota", "Ohio",
  "Oklahoma", "Oregon", "Pennsylvania", "Rhode Island", "South Carolina",
  "South Dakota", "Tennessee", "Texas", "Utah", "Vermont",
  "Virginia", "Washington", "West Virginia", "Wisconsin", "Wyoming",
  "District of Columbia",
];

export const PROVINCES = IS_NA ? US_STATES : CN_PROVINCES;

// 年龄段选项
export const AGE_RANGES = [
  "18-24",
  "25-30",
  "31-35",
  "36-40",
  "41-45",
  "46-50",
  "50+",
];

// 页面标题配置
const AUTH_TITLE_KEYS: Record<AuthMode, string> = {
  login: "auth.login",
  register: "auth.register",
  forgotPassword: "auth.forgotPasswordTitle",
  verification: "auth.verificationLogin",
  completeProfile: "auth.completeProfile",
};

const AUTH_SUBTITLE_KEYS: Record<AuthMode, string> = {
  login: "auth.loginTitle",
  register: "auth.registerSubtitle",
  forgotPassword: "auth.forgotPasswordSubtitle",
  verification: "auth.verificationSubtitle",
  completeProfile: "auth.completeProfileSubtitle",
};

export const getAuthTitle = (mode: AuthMode): string => i18n.t(AUTH_TITLE_KEYS[mode]);
export const getAuthSubtitle = (mode: AuthMode): string => i18n.t(AUTH_SUBTITLE_KEYS[mode]);

// 默认国家区号：北美版默认 +1（美国），中国版默认 +86（中国）。
const CN_COUNTRY_CODE = {
  code: "CN",
  name: "中国",
  flag: "🇨🇳",
  dialCode: "+86",
  get localizedName() {
    return i18n.t("countries.CN");
  },
};

const US_COUNTRY_CODE = {
  code: "US",
  name: "United States",
  flag: "🇺🇸",
  dialCode: "+1",
  get localizedName() {
    return i18n.t("countries.US");
  },
};

export const DEFAULT_COUNTRY_CODE = IS_NA ? US_COUNTRY_CODE : CN_COUNTRY_CODE;

// 初始表单数据
export const INITIAL_FORM_DATA = {
  phone: "",
  email: "",
  countryCode: DEFAULT_COUNTRY_CODE,
  username: "",
  password: "",
  confirmPassword: "",
  verificationCode: "",
  agreement: false,
  location: "",
  gender: "" as const,
  age: "",
  preference: "",
  bio: "",
  followedBrandIds: [] as number[],
};
