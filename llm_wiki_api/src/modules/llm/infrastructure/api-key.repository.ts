import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma';
import { AiProvider } from '../domain/ai-provider.enum';
import { ApiKeyCipher } from './api-key.cipher';

/** Stores the API keys in the database, encrypted (one key per provider). */
@Injectable()
export class ApiKeyRepository {
  private readonly logger = new Logger(ApiKeyRepository.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly cipher: ApiKeyCipher,
  ) {}

  /** Saves the provider's key, replacing the previous one. */
  async save(provider: AiProvider, plainKey: string): Promise<void> {
    const key = this.cipher.encrypt(plainKey);
    const { id: providerId } = await this.prisma.provider.upsert({
      where: { providerName: provider },
      create: { providerName: provider },
      update: {},
    });
    await this.prisma.apiKey.upsert({
      where: { providerId },
      create: { providerId, key },
      update: { key },
    });
  }

  /** Plain-text key of the provider, or null if none is stored. */
  async find(provider: AiProvider): Promise<string | null> {
    const row = await this.prisma.apiKey.findFirst({
      where: { provider: { providerName: provider } },
    });
    return row ? this.decrypt(provider, row.key) : null;
  }

  /** All stored keys, in plain text. */
  async findAll(): Promise<{ provider: AiProvider; key: string }[]> {
    const rows = await this.prisma.apiKey.findMany({
      include: { provider: true },
      orderBy: { provider: { providerName: 'asc' } },
    });
    return rows.flatMap(({ provider, key }) => {
      const name = provider.providerName as AiProvider;
      const plain = this.decrypt(name, key);
      return plain === null ? [] : [{ provider: name, key: plain }];
    });
  }

  /** Deletes the provider's key. Returns false if there was none. */
  async delete(provider: AiProvider): Promise<boolean> {
    const { count } = await this.prisma.apiKey.deleteMany({
      where: { provider: { providerName: provider } },
    });
    return count > 0;
  }

  /**
   * A key that cannot be decrypted (API_KEY_ENCRYPTION_KEY changed) is
   * treated as missing: the user just has to send it again.
   */
  private decrypt(provider: AiProvider, stored: string): string | null {
    try {
      return this.cipher.decrypt(stored);
    } catch {
      this.logger.warn(
        `The stored ${provider} API key cannot be decrypted (API_KEY_ENCRYPTION_KEY changed?): send it again`,
      );
      return null;
    }
  }
}
