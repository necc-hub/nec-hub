const INVALID_VIDEO_URL_MESSAGE = "视频地址无效，请输入 HTTP(S) 直链";

export function normalizeVideoUrl(value: string): string {
  let parsed: URL;
  try {
    parsed = new URL(value.trim());
  } catch {
    throw new Error(INVALID_VIDEO_URL_MESSAGE);
  }
  if (!["http:", "https:"].includes(parsed.protocol)) {
    throw new Error(INVALID_VIDEO_URL_MESSAGE);
  }
  return parsed.href;
}
