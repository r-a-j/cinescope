import {
  damerauLevenshteinDistance,
  generateSearchTitleVariations,
  isFuzzyTitleMatch,
  normalizePhoneticKey,
} from './search-fuzzy.util';

describe('search-fuzzy.util', () => {
  describe('damerauLevenshteinDistance', () => {
    it('computes 0 for identical strings', () => {
      expect(damerauLevenshteinDistance('crawlers', 'crawlers')).toBe(0);
    });

    it('computes 1 for dropped vowel ("crwlers" -> "crawlers")', () => {
      expect(damerauLevenshteinDistance('crwlers', 'crawlers')).toBe(1);
    });

    it('computes 1 for adjacent transposition ("carwlers" -> "crawlers")', () => {
      expect(damerauLevenshteinDistance('carwlers', 'crawlers')).toBe(1);
    });
  });

  describe('normalizePhoneticKey', () => {
    it('folds German umlauts, Eszett, and Hinglish aspirates', () => {
      expect(normalizePhoneticKey('Große')).toBe(normalizePhoneticKey('Grosse'));
      expect(normalizePhoneticKey('Baahubali')).toBe(normalizePhoneticKey('Bahubali'));
      expect(normalizePhoneticKey('Thamma')).toBe(normalizePhoneticKey('Thama'));
    });
  });

  describe('isFuzzyTitleMatch', () => {
    it('matches exact and substring queries', () => {
      expect(isFuzzyTitleMatch('crawl', 'Crawlers')).toBeTrue();
    });

    it('matches dropped-vowel typo "crwlers" against "Crawlers"', () => {
      expect(isFuzzyTitleMatch('crwlers', 'Crawlers')).toBeTrue();
    });

    it('matches Hinglish phonetic variants', () => {
      expect(isFuzzyTitleMatch('bahubali', 'Baahubali: The Beginning')).toBeTrue();
    });

    it('rejects unrelated titles', () => {
      expect(isFuzzyTitleMatch('crwlers', 'Inception')).toBeFalse();
    });
  });

  describe('generateSearchTitleVariations', () => {
    it('places "crawlers" first for dropped-vowel typo "crwlers"', () => {
      const variations = generateSearchTitleVariations('crwlers');
      expect(variations[0]).toBe('crawlers');
    });

    it('recovers adjacent transposition "carwlers" -> "crawlers"', () => {
      const variations = generateSearchTitleVariations('carwlers');
      expect(variations).toContain('crawlers');
    });

    it('generates Hinglish & Hindi transliteration variants', () => {
      expect(generateSearchTitleVariations('thama')).toContain('thamma');
      expect(generateSearchTitleVariations('thamma')).toContain('thama');
      expect(generateSearchTitleVariations('munjya')).toContain('munjiya');
      expect(generateSearchTitleVariations('bahubali')).toContain('baahubali');
      expect(generateSearchTitleVariations('stree')).toContain('stri');
    });

    it('generates German orthographic variants', () => {
      expect(generateSearchTitleVariations('große')).toContain('grosse');
      expect(generateSearchTitleVariations('muenchen')).toContain('munchen');
    });
  });
});
