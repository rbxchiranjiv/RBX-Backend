import 'reflect-metadata';
import express, { Express, NextFunction, Request, Response } from 'express';
import type { DataSource } from 'typeorm';
import { createServiceContainer } from './services/service-factory';
import { createApiRouter } from './routes';
import { buildOpenApiDocument } from './docs/openapi';
import { mapDomainError } from './controllers/http-utils';

export function createApp(dataSource: DataSource): Express {
  const app = express();
  app.use(express.json());

  const services = createServiceContainer(dataSource);
  const apiRouter = createApiRouter(services, dataSource);

  app.get('/api/v1/openapi.json', (_req: Request, res: Response) => {
    res.json(buildOpenApiDocument());
  });
  app.get('/api/v1/health', (_req: Request, res: Response) => {
    res.json({ success: true, data: { status: 'ok' } });
  });
  app.use('/api/v1', apiRouter);

  app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
    const { status, body } = mapDomainError(err);
    if (status === 500) {
      console.error('Unhandled error', err);
    }
    res.status(status).json(body);
  });

  return app;
}
