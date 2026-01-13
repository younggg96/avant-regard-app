import { Dimensions } from "react-native";
import { AuthMode } from "./types";

export const { width: SCREEN_WIDTH } = Dimensions.get("window");

// 中国省份列表
export const PROVINCES = [
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
export const AUTH_TITLES: Record<AuthMode, string> = {
  login: "登录",
  register: "注册",
  forgotPassword: "忘记密码",
  verification: "验证码登录",
  completeProfile: "完善资料",
};

export const AUTH_SUBTITLES: Record<AuthMode, string> = {
  login: "欢迎回来",
  register: "创建您的账户",
  forgotPassword: "重置您的密码",
  verification: "输入验证码",
  completeProfile: "让我们更好地了解您",
};

// 默认国家区号（中国）
export const DEFAULT_COUNTRY_CODE = {
  code: "CN",
  name: "中国",
  flag: "🇨🇳",
  dialCode: "+86",
};

// 初始表单数据
export const INITIAL_FORM_DATA = {
  phone: "",
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
  selectedDesigners: [],
};
