import { lazyPage } from '@/ui/lazyPage';

const Page = () => null;

describe('lazyPage', () => {
  it('ne télécharge la page qu’une fois', async () => {
    const load = vi.fn(async () => ({ default: Page }));
    const page = lazyPage(load);
    await Promise.all([page.preload(), page.preload()]);
    await page.preload();
    expect(load).toHaveBeenCalledTimes(1);
  });

  it('ne télécharge rien tant qu’on ne le demande pas', () => {
    const load = vi.fn(async () => ({ default: Page }));
    lazyPage(load);
    expect(load).not.toHaveBeenCalled();
  });

  it('un préchargement en échec ne lève pas d’erreur et sera retenté', async () => {
    const load = vi
      .fn<() => Promise<{ default: typeof Page }>>()
      .mockRejectedValueOnce(new Error('réseau'))
      .mockResolvedValueOnce({ default: Page });
    const page = lazyPage(load);
    await expect(page.preload()).resolves.toBeUndefined();
    await page.preload();
    expect(load).toHaveBeenCalledTimes(2);
  });
});
