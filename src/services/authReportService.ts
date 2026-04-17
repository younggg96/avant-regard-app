/**
 * 登录/注册问题反馈服务（无需登录）
 *
 * 当用户遇到收不到验证码、注册失败、登录失败等问题时，可以通过这个
 * 接口把问题提交给后端，工作人员会通过填写的联系方式回访。
 */

import { Platform } from "react-native";
import Constants from "expo-constants";
import { config } from "../config/env";

const EXPO_PUBLIC_API_BASE_URL = config.EXPO_PUBLIC_API_BASE_URL;

export type AuthIssueType =
  | "OTP_NOT_RECEIVED"
  | "REGISTER_FAILED"
  | "LOGIN_FAILED"
  | "OTHER";

export type AuthContactType = "PHONE" | "EMAIL" | "OTHER";

export interface ReportAuthIssueParams {
  issueType: AuthIssueType;
  contactType: AuthContactType;
  contactValue: string;
  description?: string;
}

export interface AuthIssueReportRecord {
  id: number;
  issueType: AuthIssueType;
  contactType: AuthContactType;
  contactValue: string;
  description: string;
  status: "PENDING" | "CONTACTED" | "RESOLVED" | "DISMISSED";
  createdAt: string;
}

interface ApiResponse<T> {
  code: number;
  message: string;
  data: T;
}

function getAppVersion(): string {
  const expoVersion =
    Constants.expoConfig?.version || (Constants.manifest as any)?.version;
  return expoVersion || "";
}

function getDeviceInfo(): string {
  const parts = [
    `os=${Platform.OS}`,
    `osVersion=${Platform.Version}`,
  ];
  return parts.join("; ");
}

export async function reportAuthIssue(
  params: ReportAuthIssueParams
): Promise<AuthIssueReportRecord> {
  const url = `${EXPO_PUBLIC_API_BASE_URL}/api/auth/report-issue`;

  const body = {
    issueType: params.issueType,
    contactType: params.contactType,
    contactValue: params.contactValue.trim(),
    description: params.description?.trim() || "",
    appVersion: getAppVersion(),
    platform: Platform.OS,
    deviceInfo: getDeviceInfo(),
  };

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "*/*",
    },
    body: JSON.stringify(body),
  });

  const contentType = response.headers.get("content-type");

  if (!response.ok) {
    let message = "提交失败";
    if (contentType?.includes("application/json")) {
      try {
        const err = await response.json();
        message = err.message || err.detail || err.error || message;
      } catch {
        // ignore parse errors and fall through to default message
      }
    } else {
      const text = await response.text();
      if (text) message = text;
    }
    throw new Error(message);
  }

  if (contentType?.includes("application/json")) {
    const json = (await response.json()) as ApiResponse<AuthIssueReportRecord>;
    if (json && typeof json === "object" && "code" in json) {
      if (json.code !== 0) {
        throw new Error(json.message || "提交失败");
      }
      return json.data;
    }
    return json as unknown as AuthIssueReportRecord;
  }

  return {} as AuthIssueReportRecord;
}

export const authReportService = {
  reportAuthIssue,
};

export default authReportService;
