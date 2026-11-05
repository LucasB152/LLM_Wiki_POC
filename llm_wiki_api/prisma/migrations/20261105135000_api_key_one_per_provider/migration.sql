-- DropIndex
DROP INDEX "api_key_provider_id_idx";

-- CreateIndex
CREATE UNIQUE INDEX "api_key_provider_id_key" ON "api_key"("provider_id");

