import { DesignerOption } from "../../services/designerService";
import { Gender } from "../../services/userInfoService";

export type AuthMode =
  | "login"
  | "register"
  | "forgotPassword"
  | "verification"
  | "completeProfile";

export interface CountryCode {
  code: string;
  name: string;
  flag: string;
  dialCode: string;
}

export interface FormData {
  phone: string;
  countryCode: CountryCode;
  username: string;
  password: string;
  confirmPassword: string;
  verificationCode: string;
  agreement: boolean;
  // 用户资料字段
  location: string;
  gender: Gender | "";
  age: string;
  preference: string;
  selectedDesigners: DesignerOption[];
}

export interface RegisteredTokens {
  accessToken: string;
  refreshToken: string;
}
