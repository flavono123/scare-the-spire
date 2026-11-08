import { D1_WRITE_ROUTES } from "../d1-write";
import { createApiRouter, type ApiRoute } from "../router";
import { shadowOnResponse } from "../shadow/shadow";
import { colorfulPhilosophersRoutes } from "./colorful-philosophers";
import { commentsRoutes } from "./comments";
import { contactRoutes } from "./contact";
import { historyRunsRoutes } from "./history-runs";
import { navRoutes } from "./nav";
import { profileRoutes } from "./profile";
import { puzzleboxRoutes } from "./puzzlebox";
import { storiesRoutes } from "./stories";
import { toyboxRoutes } from "./toybox";

/** Every /api route this Worker version serves. A group's flag only turns on when its routes are here. */
export const API_ROUTES: readonly ApiRoute[] = [...navRoutes, ...commentsRoutes, ...colorfulPhilosophersRoutes, ...contactRoutes, ...profileRoutes, ...puzzleboxRoutes, ...historyRunsRoutes, ...storiesRoutes, ...toyboxRoutes, ...D1_WRITE_ROUTES];

// Step 2 shadow reads ride on every GET response; inert until a shadow.<group> rate is above 0.
export const apiRouter = createApiRouter(API_ROUTES, { onResponse: shadowOnResponse });
