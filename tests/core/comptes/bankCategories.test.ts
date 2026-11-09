import { categoryFromBankLabel } from '@/core/comptes/bankCategories';
import { COMMON_CATEGORIES, DEFAULT_CATEGORIES } from '@/core/shared/seed';

describe('categoryFromBankLabel', () => {
  it('traduit les catégories BoursoBank vers celles du commun', () => {
    expect(categoryFromBankLabel('Alimentation', COMMON_CATEGORIES)).toBe('cat-courses');
    expect(categoryFromBankLabel('Restaurants, bars, discothèques…', COMMON_CATEGORIES)).toBe('cat-restaurants');
    expect(categoryFromBankLabel('Energie (électricité, gaz, fuel, chauffage…)', COMMON_CATEGORIES)).toBe('cat-energie');
    expect(categoryFromBankLabel('Multimedia à domicile (TV, internet, téléphonie…)', COMMON_CATEGORIES)).toBe('cat-internet');
    expect(categoryFromBankLabel('Pharmacie et laboratoire', COMMON_CATEGORIES)).toBe('cat-sante');
    expect(categoryFromBankLabel('Mobilier, électroménager, décoration…', COMMON_CATEGORIES)).toBe('cat-maison');
    expect(categoryFromBankLabel('Transports longue distance (avions, trains…)', COMMON_CATEGORIES)).toBe('cat-transports');
    expect(categoryFromBankLabel('Hébergement (hôtels, camping…)', COMMON_CATEGORIES)).toBe('cat-voyages');
  });

  it('se rabat sur une catégorie existante de l’espace', () => {
    expect(categoryFromBankLabel('Mobilier, électroménager, décoration…', DEFAULT_CATEGORIES)).toBe('cat-shopping');
    expect(categoryFromBankLabel('Energie (électricité, gaz, fuel, chauffage…)', DEFAULT_CATEGORIES)).toBe('cat-logement');
  });

  it('reprend une catégorie du même nom', () => {
    expect(categoryFromBankLabel('Santé', COMMON_CATEGORIES)).toBe('cat-sante');
  });

  it('laisse à classer ce que la banque n’a pas classé', () => {
    expect(categoryFromBankLabel('Non catégorisé', COMMON_CATEGORIES)).toBeNull();
    expect(categoryFromBankLabel('Virements émis', COMMON_CATEGORIES)).toBeNull();
    expect(categoryFromBankLabel('Vie Quotidienne - Autres', COMMON_CATEGORIES)).toBeNull();
    expect(categoryFromBankLabel('', COMMON_CATEGORIES)).toBeNull();
  });
});
