import { createApiRouter, type ApiRoute } from "../router";
import { colorfulPhilosophersRoutes } from "./colorful-philosophers";
import { commentsRoutes } from "./comments";
import { navRoutes } from "./nav";

/** Every /api route this Worker version serves. A group's flag only turns on when its routes are here. */
export const API_ROUTES: readonly ApiRoute[] = [...navRoutes, ...commentsRoutes, ...colorfulPhilosophersRoutes];

export const apiRouter = createApiRouter(API_ROUTES);
