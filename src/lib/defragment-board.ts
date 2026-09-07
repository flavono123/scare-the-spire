/**
 * Dense mixed board layout for 조각모음.
 *
 * Below `@xl` container width (~576px) the row stacks so the title can wrap
 * two lines. Author and date move to a quieter second line instead of taking
 * fixed columns beside the title. Likes and comments stay on the first row.
 *
 * `@xl` is a container query. Put `DEFRAGMENT_BOARD_CONTAINER_CLASS` on the
 * list so a 390px lab frame stacks even on a desktop window.
 */
export const DEFRAGMENT_BOARD_CONTAINER_CLASS = "@container";
export const DEFRAGMENT_TYPE_COL_CLASS =
  "w-5 min-w-0 shrink-0 overflow-hidden @xl:w-[4.75rem]";
export const DEFRAGMENT_AUTHOR_COL_CLASS =
  "hidden min-w-0 w-[6.5rem] shrink-0 @xl:block";
export const DEFRAGMENT_DATE_COL_CLASS =
  "hidden w-[5.5rem] shrink-0 @xl:block";
export const DEFRAGMENT_COUNT_COL_CLASS = "w-10 shrink-0 @xl:w-11";
export const DEFRAGMENT_TITLE_CLASS =
  "min-w-0 flex-1 line-clamp-2 break-words text-sm font-medium leading-snug text-foreground transition-colors group-hover:text-primary @xl:truncate @xl:leading-snug";
