import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';

async function bootstrap() {
  // Load .env before services are instantiated (they read process.env).
  // Variables already set in the environment are not overwritten.
  try {
    process.loadEnvFile();
  } catch {
    // No .env file (e.g. in production): keep the environment as is.
  }

  const app = await NestFactory.create(AppModule);

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
