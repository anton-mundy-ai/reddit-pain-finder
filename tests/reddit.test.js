import { describe, it, expect } from 'vitest';
import { isRelevantContent, isLikelyEnglish, hasAustralianContext } from '../src/utils/reddit.js';

describe('Reddit Utils', () => {
  describe('isRelevantContent', () => {
    it('rejects short content', () => {
      expect(isRelevantContent('too short')).toBe(false);
    });

    it('rejects deleted content', () => {
      expect(isRelevantContent('[removed]')).toBe(false);
      expect(isRelevantContent('[deleted]')).toBe(false);
    });

    it('rejects low-effort responses', () => {
      expect(isRelevantContent('lol')).toBe(false);
      expect(isRelevantContent('nice')).toBe(false);
    });

    it('accepts substantive content', () => {
      const text = 'I have been struggling with finding good invoicing software for my small business. Nothing seems to work well with Australian banks.';
      expect(isRelevantContent(text)).toBe(true);
    });
  });

  describe('isLikelyEnglish', () => {
    it('detects English text', () => {
      const text = 'The quick brown fox jumps over the lazy dog. This is a common English sentence.';
      expect(isLikelyEnglish(text)).toBe(true);
    });

    it('rejects non-English text', () => {
      const text = '这是中文文本，不应该被检测为英文。我们正在测试语言检测功能。';
      expect(isLikelyEnglish(text)).toBe(false);
    });
  });

  describe('hasAustralianContext', () => {
    it('detects Australian subreddits', () => {
      expect(hasAustralianContext('some random text', 'australia')).toBe(true);
      expect(hasAustralianContext('some random text', 'melbourne')).toBe(true);
      expect(hasAustralianContext('some random text', 'AusFinance')).toBe(true);
    });

    it('detects Australian terms in text', () => {
      expect(hasAustralianContext('I need to deal with the ATO for my business', 'Entrepreneur')).toBe(true);
      expect(hasAustralianContext('Running a business in Melbourne is tough', 'startups')).toBe(true);
      expect(hasAustralianContext('Centrelink and Medicare are confusing', 'other')).toBe(true);
    });

    it('returns false for non-Australian content', () => {
      expect(hasAustralianContext('Running a business in California', 'Entrepreneur')).toBe(false);
    });
  });
});
