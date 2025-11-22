export const PREDEFINED_COLORS = [
  "#4ECDC4", // 青緑
  "#45B7D1", // 水色
  "#96CEB4", // 緑
  "#FFEAA7", // 黄
  "#DDA0DD", // 紫
  "#87CEEB", // スカイブルー
  "#9B59B6", // 濃い紫
  "#3498DB", // 青
];

export const DEFAULT_PARTICIPATION_OPTION = {
  label: "参加",
  color: "#0F82B1", // PRIMARY_RGB と同じ色
};

export function generateDistinctColor(existingColors: string[]): string {
  // 既存の色から最も離れた色を選択
  for (const color of PREDEFINED_COLORS) {
    if (!existingColors.includes(color)) {
      return color;
    }
  }
  // 全て使用済みの場合はランダム生成（赤系を避ける）
  // Hue: 60°～300°（赤を避けるため、0°～60° と 300°～360° を除外）
  const hue = 60 + Math.random() * 240; // 60～300
  const saturation = 50 + Math.random() * 30; // 50～80
  const lightness = 50 + Math.random() * 20; // 50～70
  return hslToHex(hue, saturation, lightness);
}

function hslToHex(h: number, s: number, l: number): string {
  const sNormalized = s / 100;
  const lNormalized = l / 100;
  const c = (1 - Math.abs(2 * lNormalized - 1)) * sNormalized;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = lNormalized - c / 2;
  let r = 0;
  let g = 0;
  let b = 0;

  if (h >= 0 && h < 60) {
    r = c;
    g = x;
    b = 0;
  } else if (h >= 60 && h < 120) {
    r = x;
    g = c;
    b = 0;
  } else if (h >= 120 && h < 180) {
    r = 0;
    g = c;
    b = x;
  } else if (h >= 180 && h < 240) {
    r = 0;
    g = x;
    b = c;
  } else if (h >= 240 && h < 300) {
    r = x;
    g = 0;
    b = c;
  } else if (h >= 300 && h < 360) {
    r = c;
    g = 0;
    b = x;
  }

  const rHex = Math.round((r + m) * 255)
    .toString(16)
    .padStart(2, "0");
  const gHex = Math.round((g + m) * 255)
    .toString(16)
    .padStart(2, "0");
  const bHex = Math.round((b + m) * 255)
    .toString(16)
    .padStart(2, "0");

  return `#${rHex}${gHex}${bHex}`;
}
