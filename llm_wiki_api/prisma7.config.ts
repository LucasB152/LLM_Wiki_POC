// Prisma CLI configuration (migrate, generate, studio).
// DATABASE_URL comes from the .env at the root of the repository (next to
// docker-compose.yml), or from the environment (Docker).
import { config } from "dotenv";
config({ path: "../.env", quiet: true });
import { defineConfig } from "prisma/config";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    url: process.env["DATABASE_URL"],
  },
});
