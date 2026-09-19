import type { NativeInfo } from "./types";

export type MobileClientHeaders = {
  "X-OWNLEVEL-App-Version"?: string;
  "X-OWNLEVEL-Build"?: string;
  "X-OWNLEVEL-Bridge-Version": string;
  "X-OWNLEVEL-Platform": NativeInfo["platform"];
};

export function createMobileClientHeaders(
  info: NativeInfo,
): MobileClientHeaders {
  return {
    ...(info.appVersion
      ? { "X-OWNLEVEL-App-Version": info.appVersion }
      : {}),
    ...(info.buildNumber ? { "X-OWNLEVEL-Build": info.buildNumber } : {}),
    "X-OWNLEVEL-Bridge-Version": String(info.bridgeVersion),
    "X-OWNLEVEL-Platform": info.platform,
  };
}
