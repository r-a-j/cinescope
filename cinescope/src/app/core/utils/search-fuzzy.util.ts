/**
 * Multi-language Fuzzy, Typo & Phonetic Search Utilities for CineScope.
 * Supports:
 * - English dropped-vowel restoration (e.g. "crwlers" -> "crawlers", "incption" -> "inception")
 * - Adjacent character transposition recovery (e.g. "carwlers" -> "crawlers")
 * - Hinglish / Romanized Hindi transliteration normalization (e.g. "bahubali" <-> "baahubali", "munjya" <-> "munjiya")
 * - German umlaut, Eszett & phonetic normalization (e.g. "große" <-> "grosse", "finsternis")
 * - Damerau-Levenshtein edit distance & token-aware fuzzy matching for local library/franchise shelves
 */

const VOWELS = new Set(['a', 'e', 'i', 'o', 'u', 'y']);

/**
 * Computes Optimal String Alignment (Damerau-Levenshtein) distance between two strings.
 * Handles insertions, deletions, substitutions, and adjacent transpositions in O(N*M) time.
 */
export function damerauLevenshteinDistance(source: string, target: string): number {
  const a = source.toLowerCase().trim();
  const b = target.toLowerCase().trim();
  if (a === b) return 0;
  const lenA = a.length;
  const lenB = b.length;
  if (lenA === 0) return lenB;
  if (lenB === 0) return lenA;

  const dp: number[][] = Array.from({ length: lenA + 1 }, () => new Array<number>(lenB + 1).fill(0));

  for (let i = 0; i <= lenA; i++) dp[i][0] = i;
  for (let j = 0; j <= lenB; j++) dp[0][j] = j;

  for (let i = 1; i <= lenA; i++) {
    for (let j = 1; j <= lenB; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      dp[i][j] = Math.min(
        dp[i - 1][j] + 1, // deletion
        dp[i][j - 1] + 1, // insertion
        dp[i - 1][j - 1] + cost // substitution
      );

      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) {
        dp[i][j] = Math.min(dp[i][j], dp[i - 2][j - 2] + 1); // transposition
      }
    }
  }

  return dp[lenA][lenB];
}

/**
 * Normalizes a word or title into a language-agnostic phonetic skeleton across
 * English, Hinglish (Romanized Hindi), and German.
 */
export function normalizePhoneticKey(input: string): string {
  if (!input) return '';
  let s = input
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // Strip diacritics / umlauts (ä->a, ö->o, ü->u)
    .replace(/ß/g, 'ss')
    .trim();

  // German & English digraph folding
  s = s
    .replace(/sch/g, 'sh')
    .replace(/ae/g, 'a')
    .replace(/oe/g, 'o')
    .replace(/ue/g, 'u')
    .replace(/ph/g, 'f')
    .replace(/ck/g, 'k')
    .replace(/tz/g, 'z')
    .replace(/dt/g, 't')
    .replace(/qu/g, 'kw');

  // Hinglish / Indian transliteration normalization
  s = s
    .replace(/jya/g, 'jia')
    .replace(/jiya/g, 'jia')
    .replace(/ksh/g, 'x')
    .replace(/chh/g, 'ch')
    .replace(/([bcdfghjklmnpqrstvwxz])h/g, '$1') // Fold aspirated consonants (bh->b, dh->d, kh->k, th->t, gh->g)
    .replace(/w/g, 'v')
    .replace(/z/g, 'j')
    .replace(/aa+/g, 'a')
    .replace(/ee+/g, 'i')
    .replace(/oo+/g, 'u')
    .replace(/([a-z])\1+/g, '$1'); // Collapse doubled letters ("thamma" -> "thama", "crawllers" -> "crawlers")

  return s;
}

/**
 * Returns true if `query` matches `targetTitle` either by substring, phonetic skeleton,
 * or token-level Damerau-Levenshtein fuzzy distance.
 */
export function isFuzzyTitleMatch(query: string, targetTitle: string): boolean {
  const q = query.toLowerCase().trim();
  const t = targetTitle.toLowerCase().trim();
  if (!q || !t) return false;

  // 1. Direct substring match
  if (t.includes(q)) return true;

  // 2. Phonetic skeleton match (handles Hinglish, German umlauts, doubled letters)
  const qPhonetic = normalizePhoneticKey(q);
  const tPhonetic = normalizePhoneticKey(t);
  if (qPhonetic.length >= 3 && tPhonetic.includes(qPhonetic)) {
    return true;
  }

  // 3. Token-level Damerau-Levenshtein edit distance (handles "crwlers" -> "Crawlers")
  if (q.length < 4) return false;
  const maxDist = q.length >= 7 ? 2 : 1;

  const queryTokens = q.split(/\s+/).filter((tok) => tok.length >= 3);
  const titleTokens = t.split(/[\s:,\-–—.!?'"]+/).filter(Boolean);

  if (queryTokens.length === 0 || titleTokens.length === 0) return false;

  return queryTokens.every((qTok) => {
    const allowed = qTok.length >= 7 ? maxDist : 1;
    return titleTokens.some((tTok) => {
      if (tTok.includes(qTok)) return true;
      if (Math.abs(tTok.length - qTok.length) > allowed) return false;
      return damerauLevenshteinDistance(qTok, tTok) <= allowed;
    });
  });
}

/**
 * Valid initial 2-consonant onsets in English/German/Hinglish where a vowel usually follows the 2nd consonant
 * rather than splitting the 1st and 2nd consonant (e.g., "crwlers" -> "cr" + vowel + "wlers" => "crawlers").
 */
const NATURAL_ONSET_PAIRS = new Set([
  'bl', 'br', 'ch', 'cl', 'cr', 'dr', 'fl', 'fr', 'gh', 'gl', 'gr',
  'kh', 'kl', 'kr', 'ph', 'pl', 'pr', 'sc', 'sh', 'sk', 'sl', 'sm',
  'sn', 'sp', 'st', 'sw', 'th', 'tr', 'tw', 'wh', 'wr', 'sch', 'str', 'spr', 'scr', 'thr', 'shr'
]);

/**
 * Generates ranked search query variations to recover from:
 * 1. Dropped vowels in consonant clusters (e.g., "crwlers" -> "crawlers", "incption" -> "inception")
 * 2. Adjacent character transpositions (e.g., "carwlers" -> "crawlers")
 * 3. Hinglish / Hindi transliteration variants ("thama" <-> "thamma", "munjya" <-> "munjiya", "bahubali" <-> "baahubali")
 * 4. German umlaut / Eszett variants ("große" <-> "grosse", "ae" <-> "ä")
 * 5. Roman <-> Arabic sequel numerals ("part 2" <-> "part ii")
 */
export function generateSearchTitleVariations(query: string): string[] {
  const trimmed = query.trim().toLowerCase();
  if (!trimmed || trimmed.length < 3) return [];

  const variations = new Set<string>();
  const addCandidate = (candidate: string): void => {
    const clean = candidate.replace(/\s+/g, ' ').trim();
    if (clean && clean !== trimmed && clean.length >= 3) {
      variations.add(clean);
    }
  };

  const words = trimmed.split(/\s+/);

  // ---------------------------------------------------------------------------
  // 1. DROPPED VOWEL RESTORATION IN CONSONANT CLUSTERS
  //    e.g., "crwlers" has cluster "crw" -> "cr" is a natural onset -> insert 'a','e','o','i','u' after "cr"
  //    producing "crawlers", "crews...", etc.
  // ---------------------------------------------------------------------------
  const candidateVowels = ['a', 'e', 'i', 'o', 'u'];
  for (let wIdx = 0; wIdx < words.length; wIdx++) {
    const word = words[wIdx];
    if (word.length < 4) continue;

    // Find runs of 3+ consecutive consonants
    const clusterRegex = /([bcdfghjklmnpqrstvwxz]{3,})/gi;
    const validTripleClusters = new Set([
      'nch', 'tch', 'sch', 'nth', 'rth', 'lch', 'rch', 'mpt',
      'str', 'scr', 'spl', 'spr', 'thr', 'chr', 'shr', 'rst',
      'nst', 'lst', 'ngl', 'ngr', 'ntr', 'ndl', 'ndr', 'mbl',
      'mbr', 'mpf', 'ckl', 'ckr', 'ght', 'dge', 'phr', 'phl',
    ]);
    let match: RegExpExecArray | null;
    while ((match = clusterRegex.exec(word)) !== null) {
      const cluster = match[1].toLowerCase();
      if (cluster.length === 3 && validTripleClusters.has(cluster)) {
        continue;
      }
      const startIdx = match.index;

      // Determine best split point inside the consonant cluster:
      // If first 2 chars form a natural onset (like 'cr' in 'crw'), insert vowel after index 2 first!
      const splitOffsets: number[] = [];
      const firstTwo = cluster.slice(0, 2);
      const firstThree = cluster.slice(0, 3);

      if (cluster.length >= 4 && NATURAL_ONSET_PAIRS.has(firstThree)) {
        splitOffsets.push(3, 2, 1);
      } else if (NATURAL_ONSET_PAIRS.has(firstTwo)) {
        splitOffsets.push(2, 1);
      } else {
        splitOffsets.push(1, 2);
      }

      // Prioritize vowels that pair naturally with following consonants (e.g., before 'w' or 'l', 'a'/'e'/'o' are most common)
      const nextConsonant = cluster[splitOffsets[0]] || '';
      const orderedVowels =
        nextConsonant === 'w' || nextConsonant === 'l'
          ? ['a', 'e', 'o', 'i', 'u']
          : ['e', 'a', 'i', 'o', 'u'];

      for (const offset of splitOffsets) {
        if (offset <= 0 || offset >= cluster.length) continue;
        const insertPos = startIdx + offset;
        for (const v of orderedVowels) {
          const rebuiltWord = word.slice(0, insertPos) + v + word.slice(insertPos);
          const rebuiltQuery = [...words];
          rebuiltQuery[wIdx] = rebuiltWord;
          addCandidate(rebuiltQuery.join(' '));
        }
      }
    }

    // Also handle word-initial 2-consonant cluster that is NOT a valid onset (e.g. "cwlers" -> "cawlers" or "crwlers")
    if (word.length >= 5 && !VOWELS.has(word[0]) && !VOWELS.has(word[1])) {
      const firstTwo = word.slice(0, 2);
      if (!NATURAL_ONSET_PAIRS.has(firstTwo)) {
        for (const v of candidateVowels) {
          const rebuiltWord = word[0] + v + word.slice(1);
          const rebuiltQuery = [...words];
          rebuiltQuery[wIdx] = rebuiltWord;
          addCandidate(rebuiltQuery.join(' '));
        }
      }
    }
  }

  // ---------------------------------------------------------------------------
  // 2. HINGLISH / INDIAN & MULTILINGUAL PHONETIC VARIATIONS
  // ---------------------------------------------------------------------------
  // Double consonant: e.g. "thama" -> "thamma", "tumbad" -> "tumbbad"
  const doubledMatch = trimmed.match(/^(.*[aeiou])([bcdfghjklmnprstvwz])([aeiou]+)$/i);
  if (doubledMatch && doubledMatch[1] && doubledMatch[2] && doubledMatch[3]) {
    addCandidate(`${doubledMatch[1]}${doubledMatch[2]}${doubledMatch[2]}${doubledMatch[3]}`);
  }

  // Single consonant collapse: e.g. "thamma" -> "thama", "crawllers" -> "crawlers"
  const singleMatch = trimmed.replace(/([bcdfghjklmnprstvwz])\1/gi, '$1');
  if (singleMatch !== trimmed) {
    addCandidate(singleMatch);
  }

  // Indian vowel transliteration: "munjya" <-> "munjiya"
  if (/jya/i.test(trimmed)) {
    addCandidate(trimmed.replace(/jya/gi, 'jiya'));
  } else if (/jiya/i.test(trimmed)) {
    addCandidate(trimmed.replace(/jiya/gi, 'jya'));
  }

  // Long/short Hinglish vowel swaps: "bahubali" <-> "baahubali", "stree" <-> "stri", "bhool" <-> "bhul"
  if (/aa/i.test(trimmed)) {
    addCandidate(trimmed.replace(/aa/gi, 'a'));
  } else if (/^([bcdfghjklmnpqrstvwxz]+)a([bcdfghjklmnpqrstvwxz].*)$/i.test(trimmed)) {
    addCandidate(trimmed.replace(/^([bcdfghjklmnpqrstvwxz]+)a/i, '$1aa'));
  }

  if (/ee/i.test(trimmed)) {
    addCandidate(trimmed.replace(/ee/gi, 'i'));
  }
  if (/oo/i.test(trimmed)) {
    addCandidate(trimmed.replace(/oo/gi, 'u'));
  }

  // German orthographic variations: ß <-> ss, ä <-> ae/a, ö <-> oe/o, ü <-> ue/u
  if (/ß/.test(trimmed)) addCandidate(trimmed.replace(/ß/g, 'ss'));
  if (/ä/.test(trimmed)) {
    addCandidate(trimmed.replace(/ä/g, 'ae'));
    addCandidate(trimmed.replace(/ä/g, 'a'));
  }
  if (/ö/.test(trimmed)) {
    addCandidate(trimmed.replace(/ö/g, 'oe'));
    addCandidate(trimmed.replace(/ö/g, 'o'));
  }
  if (/ü/.test(trimmed)) {
    addCandidate(trimmed.replace(/ü/g, 'ue'));
    addCandidate(trimmed.replace(/ü/g, 'u'));
  }
  if (/ue/i.test(trimmed)) {
    addCandidate(trimmed.replace(/ue/gi, 'u'));
    addCandidate(trimmed.replace(/ue/gi, 'ü'));
  }
  if (/oe/i.test(trimmed)) {
    addCandidate(trimmed.replace(/oe/gi, 'o'));
    addCandidate(trimmed.replace(/oe/gi, 'ö'));
  }
  if (/ae/i.test(trimmed)) {
    addCandidate(trimmed.replace(/ae/gi, 'a'));
    addCandidate(trimmed.replace(/ae/gi, 'ä'));
  }

  // Common numerals: "part 2" <-> "part ii", "part 3" <-> "part iii"
  if (/\b2\b/.test(trimmed)) addCandidate(trimmed.replace(/\b2\b/g, 'ii'));
  if (/\bii\b/i.test(trimmed)) addCandidate(trimmed.replace(/\bii\b/gi, '2'));
  if (/\b3\b/.test(trimmed)) addCandidate(trimmed.replace(/\b3\b/g, 'iii'));
  if (/\biii\b/i.test(trimmed)) addCandidate(trimmed.replace(/\biii\b/gi, '3'));

  // ---------------------------------------------------------------------------
  // 3. ADJACENT CHARACTER TRANSPOSITION (SWAP) VARIATIONS
  //    e.g., "carwlers" -> "crawlers", "incepiton" -> "inception"
  // ---------------------------------------------------------------------------
  for (let wIdx = 0; wIdx < words.length; wIdx++) {
    const word = words[wIdx];
    if (word.length < 4 || word.length > 14) continue;
    for (let i = 1; i < word.length - 1; i++) {
      if (word[i] === word[i + 1]) continue;
      // Prioritize swapping a vowel+consonant or consonant+vowel near a consonant cluster
      const swapped = word.slice(0, i) + word[i + 1] + word[i] + word.slice(i + 2);
      const rebuiltQuery = [...words];
      rebuiltQuery[wIdx] = swapped;
      addCandidate(rebuiltQuery.join(' '));
    }
  }

  return Array.from(variations).slice(0, 12);
}
