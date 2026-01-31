import AppDataSource from './data-source';
import { createApp } from './app';
import { validateRequiredEnvVars } from './config/validate-env';

async function bootstrap() {
  try {
    validateRequiredEnvVars();
    if (!AppDataSource.isInitialized) {
      await AppDataSource.initialize();
    }
    const app = createApp(AppDataSource);
    const port = Number(process.env.PORT ?? 3000);
    app.listen(port, () => {
      console.log(`RBx API listening on port ${port}`);
    });
  } catch (error) {
    console.error('Failed to start server', error);
    process.exit(1);
  }
}

if (require.main === module) {
  void bootstrap();
}
