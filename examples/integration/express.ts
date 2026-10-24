/**
 * The same integration behind Express. Nothing about SG changes; the adapter is the
 * host's own code, and this file exists to show how little of it there is.
 *
 * Express is a devDependency. The published package still has no runtime dependency.
 */
import express, { type Express, type Request, type Response } from 'express';
import { createIntegrationGuard, decide, type Handler, type HostRoute } from './core.ts';

export function createExpressApp(guard: Handler = createIntegrationGuard()): Express {
  const app = express();
  app.use(express.json());

  const handler =
    (route: HostRoute) =>
    async (request: Request, response: Response): Promise<void> => {
      const result = await decide(guard, {
        entity: String(request.header('x-entity') ?? 'anonymous'),
        route,
        raw: {
          body: route === 'login' ? (request.body as Record<string, unknown>) : {},
          headers: { 'x-after-login': request.header('x-after-login') },
        },
      });
      response.status(result.status).set(result.headers).json(result.body);
    };

  app.post('/login', handler('login'));
  app.get('/data', handler('data'));
  return app;
}
