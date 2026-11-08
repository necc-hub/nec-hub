import { describe, expect, it } from "vitest";
import { normalizeVideoUrl } from "../../web/src/apps/ress-solution/video-source";

describe("RESS 视频地址校验", () => {
  it.each(["not-a-url", "/preview.mp4", "../preview.mp4"])("拒绝相对地址 %s", (value) => {
    expect(() => normalizeVideoUrl(value)).toThrow("视频地址无效，请输入 HTTP(S) 直链");
  });

  it.each(["ftp://example.com/preview.mp4", "javascript:alert(1)"])("拒绝非 HTTP(S) 地址 %s", (value) => {
    expect(() => normalizeVideoUrl(value)).toThrow("视频地址无效，请输入 HTTP(S) 直链");
  });

  it("接受并规范化绝对 HTTP(S) 视频直链", () => {
    expect(normalizeVideoUrl("  https://cdn.example.com/ress-preview.mp4?signature=abc  "))
      .toBe("https://cdn.example.com/ress-preview.mp4?signature=abc");
    expect(normalizeVideoUrl("http://localhost:8787/assets/preview.webm"))
      .toBe("http://localhost:8787/assets/preview.webm");
  });
});
