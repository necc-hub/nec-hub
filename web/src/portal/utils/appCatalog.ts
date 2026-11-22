const LOCAL_COVERS: Record<string, string> = {
  k1: "/apps/k1/dashboard-preview.jpg",
  "mech-review-6014": "/apps/mech-review-6014/sketch.png",
  "ress-solution": "/assets/starcharge-ress/ress-scene-poster.png",
};

export function catalogNumber(index: number): string {
  return String(index + 1).padStart(2, "0");
}

export function appCover(name: string): string {
  return LOCAL_COVERS[name] ?? "";
}

export function appMonogram(title: string): string {
  return Array.from(title.trim())[0] ?? "N";
}
