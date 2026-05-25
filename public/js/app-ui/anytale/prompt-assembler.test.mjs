import { describe, test, expect } from 'vitest';
import { assemblePrompt, expandPageTags } from './prompt-assembler.mjs';

// ── helpers ──────────────────────────────────────────────────────────────────

function makePart(uid, baseline, types = ['body'], enabled = true, attrValues = {}) {
  return {
    config: { uid, name: uid, baseline, type: types },
    data: { enabled, attributeValues: attrValues },
  };
}

// ── assemblePrompt — baseline collection ─────────────────────────────────────

describe('assemblePrompt', () => {
  test('includes baseline from enabled parts', () => {
    const parts = [makePart('a', 'tag-a')];
    expect(assemblePrompt(parts)).toBe('tag-a');
  });

  test('excludes disabled parts', () => {
    const parts = [makePart('a', 'tag-a', ['body'], false)];
    expect(assemblePrompt(parts)).toBe('');
  });

  test('deduplicates case-insensitively', () => {
    const parts = [makePart('a', 'Tag-A'), makePart('b', 'tag-a')];
    expect(assemblePrompt(parts)).toBe('Tag-A');
  });

  test('excludes baseline when attribute value references part name', () => {
    const parts = [makePart('mypart', 'baseline-tag', ['body'], true, { 0: 'mypart wearing hat' })];
    const result = assemblePrompt(parts);
    expect(result).not.toContain('baseline-tag');
    expect(result).toContain('mypart wearing hat');
  });

  // ── hiddenParts filter ────────────────────────────────────────────────────

  test('excludes part whose uid is in activePage.hiddenParts', () => {
    const parts = [makePart('visible', 'visible-tag'), makePart('hidden-uid', 'hidden-tag')];
    const page = { hiddenParts: ['hidden-uid'] };
    const result = assemblePrompt(parts, page);
    expect(result).toContain('visible-tag');
    expect(result).not.toContain('hidden-tag');
  });

  test('hidden part excluded even when slotVisibility would show its slot', () => {
    const parts = [makePart('hidden-uid', 'hidden-tag', ['torso'])];
    const page = { hiddenParts: ['hidden-uid'] };
    const slotVis = new Map([['torso', true]]);
    expect(assemblePrompt(parts, page, slotVis)).toBe('');
  });

  test('part with uid not in hiddenParts is still included', () => {
    const parts = [makePart('kept', 'kept-tag'), makePart('gone', 'gone-tag')];
    const page = { hiddenParts: ['gone'] };
    const result = assemblePrompt(parts, page);
    expect(result).toContain('kept-tag');
    expect(result).not.toContain('gone-tag');
  });

  test('hiddenParts defaults gracefully when activePage has no hiddenParts field', () => {
    const parts = [makePart('a', 'tag-a')];
    expect(assemblePrompt(parts, {})).toBe('tag-a');
    expect(assemblePrompt(parts, { hiddenParts: null })).toBe('tag-a');
  });

  test('hidden part uid missing from config.uid does not crash', () => {
    const part = { config: { name: 'x', baseline: 'x-tag', type: ['body'] }, data: { enabled: true } };
    const page = { hiddenParts: ['some-uid'] };
    expect(() => assemblePrompt([part], page)).not.toThrow();
    expect(assemblePrompt([part], page)).toBe('x-tag');
  });

  // ── slotVisibility filter ─────────────────────────────────────────────────

  test('excludes part whose slot is not visible', () => {
    const parts = [makePart('a', 'a-tag', ['hidden-slot']), makePart('b', 'b-tag', ['shown-slot'])];
    const slotVis = new Map([['hidden-slot', false], ['shown-slot', true]]);
    const result = assemblePrompt(parts, undefined, slotVis);
    expect(result).not.toContain('a-tag');
    expect(result).toContain('b-tag');
  });

  // ── page tags ─────────────────────────────────────────────────────────────

  test('includes plain page tags', () => {
    const result = assemblePrompt([], { tags: 'extra-tag', hiddenParts: [] });
    expect(result).toBe('extra-tag');
  });

  test('page tag {{type}} token expands to matching part name', () => {
    const parts = [makePart('MyPart', '', ['outfit'])];
    const page = { tags: '{{outfit}} smiling', hiddenParts: [] };
    const result = assemblePrompt(parts, page);
    expect(result).toContain('MyPart smiling');
  });

  test('page tag segment dropped when hidden part was the only match for {{type}}', () => {
    const parts = [makePart('gone', '', ['outfit'])];
    const page = { tags: '{{outfit}} smiling', hiddenParts: ['gone'] };
    const result = assemblePrompt(parts, page);
    expect(result).not.toContain('smiling');
  });
});

// ── expandPageTags ────────────────────────────────────────────────────────────

describe('expandPageTags', () => {
  test('returns empty array for empty input', () => {
    expect(expandPageTags('', [])).toEqual([]);
    expect(expandPageTags(null, [])).toEqual([]);
  });

  test('includes plain segments verbatim', () => {
    expect(expandPageTags('foo, bar', [])).toEqual(['foo', 'bar']);
  });

  test('drops segment when token has no matches', () => {
    expect(expandPageTags('{{outfit}} pose', [])).toEqual([]);
  });

  test('expands single token to matching part names', () => {
    const parts = [makePart('PartA', '', ['outfit']), makePart('PartB', '', ['outfit'])];
    const result = expandPageTags('{{outfit}} pose', parts);
    expect(result).toContain('PartA pose');
    expect(result).toContain('PartB pose');
  });
});
