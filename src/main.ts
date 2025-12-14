import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';
import { GLOBAL_CONFIG } from './common/providers/global-config.provider';
import type { GlobalConfig } from 'types/globalConfig';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { cors: true });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
    }),
  );

  const config = app.get<GlobalConfig>(GLOBAL_CONFIG);
  const port = Number(process.env.PORT ?? 3000);

  await app.listen(port);
  // All human-facing text originates from globalConfig metadata
  // to keep branding and messaging centrally managed.
  console.log(`${config.metadata.appName} API listening on port ${port}`);
}

bootstrap();
