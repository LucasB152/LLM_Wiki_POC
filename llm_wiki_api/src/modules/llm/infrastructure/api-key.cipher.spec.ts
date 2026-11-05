import { randomBytes } from 'node:crypto';
import { ApiKeyCipher } from './api-key.cipher';

describe('ApiKeyCipher', () => {
  const previous = process.env.API_KEY_ENCRYPTION_KEY;
  const useKey = (key: string | undefined) => {
    if (key === undefined) delete process.env.API_KEY_ENCRYPTION_KEY;
    else process.env.API_KEY_ENCRYPTION_KEY = key;
  };
  const randomKey = () => randomBytes(32).toString('base64');

  afterEach(() => useKey(previous));

  it('encrypts and decrypts a key, never storing it in plain text', () => {
    useKey(randomKey());
    const cipher = new ApiKeyCipher();
    const plain = 'sk-ant-api03-abcdefghijklmnopqrstuvwxyz';

    const stored = cipher.encrypt(plain);

    expect(stored).not.toContain(plain);
    expect(stored.startsWith('v1.')).toBe(true);
    expect(cipher.encrypt(plain)).not.toBe(stored); // random IV
    expect(cipher.decrypt(stored)).toBe(plain);
  });

  it('refuses an altered value or one encrypted with another master key', () => {
    useKey(randomKey());
    const stored = new ApiKeyCipher().encrypt('sk-proj-secret');
    const [version, iv, tag, data] = stored.split('.');
    const altered = [
      version,
      iv,
      tag,
      Buffer.from('x' + data).toString('base64'),
    ];

    useKey(randomKey());
    expect(() => new ApiKeyCipher().decrypt(stored)).toThrow();
    expect(() => new ApiKeyCipher().decrypt(altered.join('.'))).toThrow();
    expect(() => new ApiKeyCipher().decrypt('not-encrypted')).toThrow();
  });

  it('requires a 32-byte master key', () => {
    useKey(undefined);
    expect(() => new ApiKeyCipher()).toThrow(/not set/);
    useKey(randomBytes(16).toString('base64'));
    expect(() => new ApiKeyCipher()).toThrow(/32 bytes/);
  });
});
