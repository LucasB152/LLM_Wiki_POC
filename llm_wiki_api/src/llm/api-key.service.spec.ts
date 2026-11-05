import {
  BadGatewayException,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { ApiKeyService } from './api-key.service';
import { AiProvider } from './ai-provider.enum';

const ANTHROPIC_KEY = 'sk-ant-api03-abcdefghijklmnopqrstuvwxyz';
const OPENAI_KEY = 'sk-proj-abcdefghijklmnopqrstuvwxyz';
const GEMINI_KEY = 'AIzaSyAbcdefghijklmnopqrstuvwxyz0123456';
const GEMINI_AQ_KEY = 'AQ.Ab8RN6Kabcdefghijklmnopqrstuvwxyz_0123-456';

describe('ApiKeyService', () => {
  let apiKeyService: ApiKeyService;
  let fetchMock: jest.SpiedFunction<typeof fetch>;

  const providerAnswers = (status: number) =>
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ data: [] }), { status }),
    );

  beforeEach(() => {
    apiKeyService = new ApiKeyService();
    fetchMock = jest.spyOn(globalThis, 'fetch');
  });

  afterEach(() => fetchMock.mockRestore());

  it.each([
    [AiProvider.ANTHROPIC, ANTHROPIC_KEY],
    [AiProvider.OPENAI, OPENAI_KEY],
    [AiProvider.GEMINI, GEMINI_KEY],
    [AiProvider.GEMINI, GEMINI_AQ_KEY],
  ])(
    'stores a valid %s key and only returns it masked',
    async (provider, key) => {
      providerAnswers(200);

      const result = await apiKeyService.create({ provider, key: ` ${key}\n` });

      expect(result).toEqual({
        provider,
        key: `${key.slice(0, 4)}****${key.slice(-4)}`,
        verified: true,
      });
      expect(apiKeyService.getKey(provider)).toBe(key); // trimmed
      expect(fetchMock).toHaveBeenCalledTimes(1);
    },
  );

  it.each([
    [AiProvider.ANTHROPIC, OPENAI_KEY],
    [AiProvider.OPENAI, ANTHROPIC_KEY],
    [AiProvider.GEMINI, 'not-a-key'],
    [AiProvider.GEMINI, OPENAI_KEY],
  ])(
    'rejects a %s key with a wrong format without calling the provider',
    async (provider, key) => {
      await expect(apiKeyService.create({ provider, key })).rejects.toThrow(
        BadRequestException,
      );
      expect(fetchMock).not.toHaveBeenCalled();
      expect(() => apiKeyService.getKey(provider)).toThrow(NotFoundException);
    },
  );

  it.each([400, 401, 403])(
    'rejects a key refused by the provider (HTTP %i)',
    async (status) => {
      providerAnswers(status);

      await expect(
        apiKeyService.create({ provider: AiProvider.OPENAI, key: OPENAI_KEY }),
      ).rejects.toThrow(BadRequestException);
      expect(apiKeyService.findAll()).toEqual([]);
    },
  );

  it('returns 502 and stores nothing when the key cannot be verified', async () => {
    providerAnswers(503);
    await expect(
      apiKeyService.create({ provider: AiProvider.OPENAI, key: OPENAI_KEY }),
    ).rejects.toThrow(BadGatewayException);

    fetchMock.mockRejectedValue(new TypeError('fetch failed'));
    await expect(
      apiKeyService.create({ provider: AiProvider.OPENAI, key: OPENAI_KEY }),
    ).rejects.toThrow(BadGatewayException);

    expect(apiKeyService.findAll()).toEqual([]);
  });

  it('keeps the previous key when the new one is rejected', async () => {
    providerAnswers(200);
    await apiKeyService.create({
      provider: AiProvider.OPENAI,
      key: OPENAI_KEY,
    });

    providerAnswers(401);
    await expect(
      apiKeyService.create({
        provider: AiProvider.OPENAI,
        key: 'sk-proj-revokedrevokedrevokedrevoked',
      }),
    ).rejects.toThrow(BadRequestException);

    expect(apiKeyService.getKey(AiProvider.OPENAI)).toBe(OPENAI_KEY);
  });

  it('removes a key, then throws 404', async () => {
    providerAnswers(200);
    await apiKeyService.create({
      provider: AiProvider.GEMINI,
      key: GEMINI_KEY,
    });

    expect(apiKeyService.remove(AiProvider.GEMINI)).toEqual({
      provider: AiProvider.GEMINI,
      deleted: true,
    });
    expect(() => apiKeyService.remove(AiProvider.GEMINI)).toThrow(
      NotFoundException,
    );
  });
});
