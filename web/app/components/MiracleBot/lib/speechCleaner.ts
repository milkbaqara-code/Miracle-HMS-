// ============================================================
// MiracleBot / lib / speechCleaner.ts
// SOVEREIGN SPEECH CLEANER — Pre-TTS text transformation pipeline.
// Strips markdown, zone codes, protocol tags, and applies the
// Sovereign Lexicon before handing clean text to the TTS engine.
// V9.0 SOVEREIGN EDITION — V4.0 Enterprise Refactor
// ============================================================
import { applyLexicon } from './lexicon';

const ZONE_NUM_WORDS: Record<string, string> = {
  '05': 'Five',    '06': 'Six',       '07': 'Seven',   '08': 'Eight',
  '09': 'Nine',    '10': 'Ten',       '11': 'Eleven',  '12': 'Twelve',
  '14': 'Fourteen','16': 'Sixteen',   '17': 'Seventeen','18': 'Eighteen',
  '19': 'Nineteen','20': 'Twenty',    '21': 'Twenty One','23': 'Twenty Three',
  '25': 'Twenty Five','26': 'Twenty Six','27': 'Twenty Seven','28': 'Twenty Eight',
  '29': 'Twenty Nine','30': 'Thirty',
  '1B': 'One B',  '2B': 'Two B',     '3B': 'Three B',
};

/**
 * Full pre-TTS pipeline: strips markdown and protocol tags, applies zone pronunciation,
 * runs the Sovereign Lexicon, handles ALL-CAPS acronyms, and adds professional pacing.
 */
export const cleanForSpeech = (t: string): string => {
  if (!t) return '';

  // Step 1: Strip markdown, links, and system tags
  let c = t
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')     // [text](url) → text only
    .replace(/\*\*(.*?)\*\*/g, '$1')               // **bold** → text
    .replace(/\*(.*?)\*/g, '$1')                   // *italic* → text
    .replace(/#+\s/g, '')                           // ## heading → text
    .replace(/`.*?`/g, '')                          // `code` → strip
    .replace(/\[[A-Z0-9_]+(:.*?)?\]/gi, '')        // [NAVIGATE:...] system tags → strip
    .replace(/!\[.*?\]\(.*?\)/g, '')               // ![image](...) → strip
    .replace(/\|[-:\s]+\|/g, '')                    // |---|---| table separator → strip entirely
    .replace(/\|/g, ' ')                            // other table pipes → natural pauses
    .trim();

  // Step 2: Zone code pronunciation (BEFORE lexicon — handles Z-3B, Z-GUEST, etc.)
  c = c.replace(/\bZ-([0-9A-Z]+)\b/gi, (_, code) => {
    const upper = code.toUpperCase();
    if (upper === 'GUEST')  return 'Zone Guest';
    if (upper === 'WEB')    return 'Zone Web';
    if (upper === 'OWNER')  return 'Zone Owner';
    if (upper === 'PROP')   return 'Zone Properties';
    if (upper === 'LOGIN')  return 'Zone Login';
    const word = ZONE_NUM_WORDS[upper] || code;
    return `Zone ${word}`;
  });

  // Step 3: Apply Sovereign Lexicon (dictionary-first, enterprise-aware)
  c = applyLexicon(c);

  // Step 4: Heuristic fallback for REMAINING unknown ALL-CAPS terms
  c = c.replace(/\b([A-Z]{5,})\b/g, (m) => m.charAt(0) + m.slice(1).toLowerCase());
  c = c.replace(/\b([A-Z]{2,4})\b/g, (m) => m.split('').join(' '));

  // Step 5: Professional pacing — commas and rhythm
  c = c
    .replace(/\.\.\.+/g, ', ')
    .replace(/—/g, ', ')
    .replace(/:\s/g, ': ')
    .replace(/;\s/g, '; ')
    .replace(/\n+/g, '. ');

  // Step 6: Long number IDs → spaced digits for TTS clarity
  c = c.replace(/\d{6,}/g, (m) => m.split('').join(' '));

  // Step 7: Collapse extra spaces
  c = c.replace(/ +/g, ' ').trim();

  return c;
};
