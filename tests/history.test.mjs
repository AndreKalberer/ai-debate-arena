import assert from 'node:assert/strict';
import { beforeEach, test } from 'node:test';
import {
  STORAGE_KEYS, saveDebate, getSavedDebates, getDebateById,
  deleteDebate, clearAllDebates, getModelStats, updateStats,
  clearStats, exportAsMarkdown,
} from '../debate-ui/src/utils.ts';

// Only the browser storage boundary is replaced; all application logic is real.
beforeEach(() => {
  const items = new Map();
  globalThis.localStorage = {
    getItem: (key) => items.get(key) ?? null,
    setItem: (key, value) => items.set(key, String(value)),
    removeItem: (key) => items.delete(key),
  };
});

function debate(winners = ['affirmative', 'affirmative', 'negative']) {
  return {
    topic: 'Should cities invest in public transit?',
    affirmativeModel: 'openai', negativeModel: 'anthropic',
    messages: [{ role: 'affirmative', model: 'openai', text: 'Accessible transit matters.', round: 1 }],
    verdicts: winners.map((winner, index) => ({
      judge: ['openai', 'anthropic', 'gemini'][index], winner, reasoning: 'Evidence and responsiveness.',
    })),
  };
}

test('saving a debate makes a retrievable snapshot and updates both models', () => {
  const original = debate();
  const id = saveDebate('debate', original);
  original.messages[0].text = 'Changed after saving';
  const saved = getDebateById(id);
  assert.equal(saved.debateResult.messages[0].text, 'Accessible transit matters.');
  assert.equal(saved.debateResult.id, id);
  assert.equal(saved.debateResult.timestamp, saved.timestamp);
  assert.ok(saved.timestamp > 0);
  assert.deepEqual(getModelStats().openai, { model: 'openai', wins: 1, losses: 0, ties: 0, totalDebates: 1 });
  assert.deepEqual(getModelStats().anthropic, { model: 'anthropic', wins: 0, losses: 1, ties: 0, totalDebates: 1 });
  assert.equal(getModelStats().gemini.totalDebates, 0);
});

test('history keeps the newest 50 entries and evicts the oldest', () => {
  const ids = Array.from({ length: 52 }, () => saveDebate('debate', debate()));
  const saved = getSavedDebates();
  assert.equal(saved.length, 50);
  assert.equal(saved[0].id, ids[51]);
  assert.equal(saved[49].id, ids[2]);
  assert.equal(getDebateById(ids[0]), null);
});

test('deleting one debate preserves the others and clearing history preserves stats', () => {
  const first = saveDebate('debate', debate());
  const second = saveDebate('debate', debate());
  deleteDebate(first);
  assert.deepEqual(getSavedDebates().map((item) => item.id), [second]);
  clearAllDebates();
  assert.deepEqual(getSavedDebates(), []);
  assert.equal(getModelStats().openai.totalDebates, 2);
});

test('corrupted stored JSON falls back to empty history and fresh statistics', () => {
  localStorage.setItem(STORAGE_KEYS.DEBATES, '{broken');
  localStorage.setItem(STORAGE_KEYS.STATS, '{broken');
  assert.deepEqual(getSavedDebates(), []);
  assert.equal(getModelStats().openai.totalDebates, 0);
});

test('negative majorities and tied votes update the correct participants', () => {
  updateStats(debate(['negative', 'negative', 'affirmative']));
  updateStats(debate(['affirmative', 'negative', 'tie']));
  assert.deepEqual(getModelStats().openai, { model: 'openai', wins: 0, losses: 1, ties: 1, totalDebates: 2 });
  assert.deepEqual(getModelStats().anthropic, { model: 'anthropic', wins: 1, losses: 0, ties: 1, totalDebates: 2 });
});

test('self-debates do not inflate model statistics', () => {
  const result = debate();
  result.negativeModel = result.affirmativeModel;
  updateStats(result);
  assert.equal(getModelStats().openai.totalDebates, 0);
  assert.equal(localStorage.getItem(STORAGE_KEYS.STATS), null);
});

test('saving discussions leaves debate rankings unchanged and exports the consensus', () => {
  const id = saveDebate('discussion', {
    topic: 'Transit design',
    messages: [{ model: 'gemini', text: 'Prioritize access.', messageNumber: 1 }],
    consensus: 'Access should guide the design.', requiredJudging: false,
  });
  const saved = getDebateById(id);
  assert.equal(saved.mode, 'discussion');
  assert.equal(saved.debateResult, undefined);
  assert.equal(getModelStats().gemini.totalDebates, 0);
  const markdown = exportAsMarkdown(saved);
  assert.match(markdown, /# Discussion: Transit design/);
  assert.match(markdown, /Prioritize access\./);
  assert.match(markdown, /## Consensus\n\nAccess should guide the design\./);
});

test('debate exports include the transcript and each judge decision', () => {
  const id = saveDebate('debate', debate());
  const markdown = exportAsMarkdown(getDebateById(id));
  assert.match(markdown, /Accessible transit matters\./);
  assert.match(markdown, /## Judge Verdicts/);
  assert.match(markdown, /\*\*openai:\*\* AFFIRMATIVE/);
  assert.match(markdown, /\*\*gemini:\*\* NEGATIVE/);
  clearStats();
  assert.equal(getModelStats().openai.totalDebates, 0);
  assert.equal(getSavedDebates().length, 1);
});
