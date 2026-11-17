import { lazyPage } from '@/ui/routing/lazyPage';
import { pageForPath, pages } from '@/ui/routing/pages';

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

describe('pageForPath', () => {
  it('trouve la page de chaque adresse', () => {
    expect(pageForPath('/')).toBe(pages.dashboard);
    expect(pageForPath('/budget')).toBe(pages.budget);
    expect(pageForPath('/compte')).toBe(pages.compte);
    expect(pageForPath('/patrimoine')).toBe(pages.patrimoine);
    expect(pageForPath('/bilan')).toBe(pages.bilan);
    expect(pageForPath('/objectifs')).toBe(pages.objectifs);
  });

  it('reconnaît les sous-adresses', () => {
    expect(pageForPath('/parametres/sauvegardes')).toBe(pages.parametres);
    expect(pageForPath('/invitation/jeton-exemple')).toBe(pages.invitation);
  });

  it('se rabat sur le tableau de bord pour une adresse inconnue', () => {
    expect(pageForPath('/inconnue')).toBe(pages.dashboard);
    expect(pageForPath('/dashboard')).toBe(pages.dashboard);
    expect(pageForPath('/toString')).toBe(pages.dashboard);
  });
});
