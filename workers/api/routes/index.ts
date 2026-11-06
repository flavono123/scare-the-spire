import { createApiRouter, type ApiRoute } from "../router";
import { colorfulPhilosophersRoutes } from "./colorful-philosophers";
import { commentsRoutes } from "./comments";
import { contactRoutes } from "./contact";
import { historyRunsRoutes } from "./history-runs";
import { navRoutes } from "./nav";
import { profileRoutes } from "./profile";
import { puzzleboxRoutes } from "./puzzlebox";

/** Every /api route this Worker version serves. A group's flag only turns on when its routes are here. */
export const API_ROUTES: readonly ApiRoute[] = [...navRoutes, ...commentsRoutes, ...colorfulPhilosophersRoutes, ...contactRoutes, ...profileRoutes, ...puzzleboxRoutes, ...historyRunsRoutes];

export const apiRouter = createApiRouter(API_ROUTES);
