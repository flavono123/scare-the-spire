/**
 * Card-con sticker widths follow the 300×422 card holder.
 *
 * Comment columns are narrow (phone ~320px, Toy Box narrow shell 42rem).
 * A library tile (mini 150 / grid 200) would own the whole line, so the
 * inserted reference stays sticker-sized:
 *   phone 84px (~118 tall), sm 96px (~135), lg 112px (~158).
 * Two phone stickers still sit on one wrapped line.
 *
 * The search grid caps each tile at 120px so a 3-up row stays readable
 * inside the comment sheet and the desktop popup without becoming a
 * compendium library card.
 */
export const CARD_CON_COMMENT_WIDTH_CLASS = "w-[5.25rem] sm:w-24 lg:w-28";
export const CARD_CON_PICKER_TILE_CLASS = "w-full max-w-[7.5rem]";

export const CARD_CON_POPUP_WIDTH = 432;
export const CARD_CON_POPUP_HEIGHT = 520;

export const CARD_CON_BROWSE_LIMIT = 9;
export const CARD_CON_SEARCH_LIMIT = 12;
