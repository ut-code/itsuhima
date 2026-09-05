import { customAlphabet } from "nanoid";

/**
 * ハイフン・アンダースコアを含まない Nano ID 形式。
 */
export const nanoid = customAlphabet("ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789", 21);
