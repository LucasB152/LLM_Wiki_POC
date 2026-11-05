import { NestFactory } from '@nestjs/core';
import { PublicAppModule } from './public-app.module';
import { ValidationPipe } from '@nestjs/common';
import { join } from 'node:path';

async function bootstrap() {
  // Load the .env at the root of the repository (next to docker-compose.yml)
  // before services are instantiated (they read process.env). Variables
  // already set in the environment are not overwritten.
  try {
    process.loadEnvFile(join(__dirname, '..', '..', '.env'));
  } catch {
    // No .env file (e.g. in Docker): keep the environment as is.
  }

  const app = await NestFactory.create(PublicAppModule);

  // Lets the frontend (served from another origin) call the API.
  // CORS_ORIGINS: comma-separated list, e.g. "http://localhost:5173".
  // Not set: every origin is allowed (convenient in development).
  const corsOrigins = process.env.CORS_ORIGINS?.split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);
  app.enableCors({ origin: corsOrigins?.length ? corsOrigins : true });

  // Must be registered BEFORE listen(), otherwise validation is not applied.
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  await app.listen(process.env.PORT ?? 3000);
}
void bootstrap();
