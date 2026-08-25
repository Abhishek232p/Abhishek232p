import { describe, expect, it } from "vitest";

describe("managed EazyservX branding configuration", () => {
  it("exposes the approved title and transparent logo asset configuration", () => {
    expect(process.env.VITE_APP_TITLE).toBe("EazyservX Drive");
    expect(process.env.VITE_APP_LOGO).toBe("/manus-storage/eazyservx-logo-transparent-cropped_7b209dc9.png");
  });
});
