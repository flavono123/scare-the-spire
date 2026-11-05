import { createApiRouter, type ApiRoute } from "../router";
import { navRoutes } from "./nav";

/** Every /api route this Worker version serves. A group's flag only turns on when its routes are here. */
export const API_ROUTES: readonly ApiRoute[] = [...navRoutes];

export const apiRouter = createApiRouter(API_ROUTES);
