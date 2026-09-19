import { describe, expect, it } from "vitest";

import { createMobileClientHeaders } from "./versioning";
import { createWebNativeInfo, unavailableCapabilities } from "./web-adapter";

describe("mobile version metadata", () => {
  it("builds future API headers without inventing web app versions", () => {
    const webInfo = createWebNativeInfo({
      displayModeStandalone: false,
      iosStandalone: false,
    });

    expect(createMobileClientHeaders(webInfo)).toEqual({
      "X-OWNLEVEL-Bridge-Version": "1",
      "X-OWNLEVEL-Platform": "web",
    });
  });

  it("includes native app and build diagnostics when present", () => {
    expect(
      createMobileClientHeaders({
        platform: "ios",
        runtime: "capacitor",
        appVersion: "1.2.3",
        buildNumber: "42",
        bridgeVersion: 1,
        capabilities: unavailableCapabilities(),
      }),
    ).toEqual({
      "X-OWNLEVEL-App-Version": "1.2.3",
      "X-OWNLEVEL-Build": "42",
      "X-OWNLEVEL-Bridge-Version": "1",
      "X-OWNLEVEL-Platform": "ios",
    });
  });
});
