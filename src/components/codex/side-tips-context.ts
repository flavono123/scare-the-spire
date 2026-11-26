"use client";

import { createContext } from "react";

/**
 * True inside an element whose tips already show beside it (CardSideTipsAnchor), as the game shows
 * a relic's or card's tips around it. Gold words inside then open no tip of their own: it would
 * repeat one beside the element and cover the element.
 */
export const SideTipsShownContext = createContext(false);
