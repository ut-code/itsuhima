import { customAlphabet } from "nanoid";

const ID_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
const ID_LENGTH = 21;

/**
 * ハイフン・アンダースコアを含まない Nano ID 形式。
 */
export const nanoid = customAlphabet(ID_ALPHABET, ID_LENGTH);

/** `nanoid` で作った ID の形 */
export const ID_PATTERN = new RegExp(`^[${ID_ALPHABET}]{${ID_LENGTH}}$`);
