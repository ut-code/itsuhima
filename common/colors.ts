export const PREDEFINED_COLORS = [
  "#FF6B6B", // 赤
  "#4ECDC4", // 青緑
  "#45B7D1", // 水色
  "#96CEB4", // 緑
  "#FFEAA7", // 黄
  "#DDA0DD", // 紫
  "#FFB347", // オレンジ
  "#87CEEB", // スカイブルー
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
  // 全て使用済みの場合はランダム生成
  return `#${Math.floor(Math.random() * 16777215)
    .toString(16)
    .padStart(6, "0")}`;
}
