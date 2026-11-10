/** On a phone the header and the menu fill the first screen: bring the game area up under the site bar. */
export function focusOnPhone(element: HTMLElement | null) {
  if (element && window.matchMedia("(max-width: 639px)").matches) element.scrollIntoView({ block: "start" });
}
