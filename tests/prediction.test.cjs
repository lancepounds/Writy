const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

// Exercise the shipped prediction handlers, with textarea selection semantics.
const html = fs.readFileSync(path.join(__dirname, '..', 'writy.html'), 'utf8');
const functions = ['ctxOf', 'sentStart', 'curState', 'accept', 'takeTree'].map(name => {
  const match = html.match(new RegExp('function ' + name + '\\([^)]*\\)\\{[\\s\\S]*?\\n\\}'));
  assert.ok(match, 'Missing production function: ' + name);
  return match[0];
}).join('\n');

function editor(value, start = value.length, end = start, place = 'menu') {
  const events = { edits: 0, saves: 0, history: 0, refreshes: 0, learned: [], spoken: [], tally: [] };
  const ta = {
    value, selectionStart: start, selectionEnd: end,
    setRangeText(text, s, e, mode) {
      assert.equal(mode, 'end');
      events.edits++;
      this.value = this.value.slice(0, s) + text + this.value.slice(e);
      this.selectionStart = this.selectionEnd = s + text.length;
    },
    focus() {}
  };
  const panel = { hidden: true, querySelector: () => null };
  const context = vm.createContext({
    ta, cfg: { place, speakWords: true, keys: false }, richOn: false, fine: false,
    curSug: ['would'], tree: { kids: [['like']] }, autoSpaceIdx: -1,
    mbox: panel, tbox: panel, dbox: panel,
    learnWord(word, ctx, weight) { events.learned.push([word, Array.from(ctx), weight]); },
    tally(...args) { events.tally.push(args); },
    speakNow(text) { events.spoken.push(text); },
    pushHist() { events.history++; },
    refresh() { events.refreshes++; },
    schedSave() { events.saves++; },
    keepCaretVisible() {},
    richAccept() { throw new Error('Unexpected rich editor'); }
  });
  vm.runInContext(functions, context);
  return { ta, events, context, choose: (i = 0, j = 0) => context.takeTree(i, j) };
}

test('submenu at the end inserts both words once and saves one undo step', () => {
  const e = editor('I ');
  e.choose();
  assert.equal(e.ta.value, 'I would like ');
  assert.equal(e.events.edits, 1);
  assert.equal(e.events.saves, 1);
  assert.equal(e.events.history, 1);
  assert.equal(e.events.refreshes, 1);
  assert.deepEqual(e.events.spoken, ['would like']);
  assert.deepEqual(e.events.tally, [[1, 'would like '.length]]);
  assert.deepEqual(e.events.learned, [
    ['would', ['<s>', 'i'], 2], ['like', ['i', 'would'], 2]
  ]);
});

test('submenu before an existing space keeps the parent and following text', () => {
  const e = editor('I w coffee.', 3);
  e.choose();
  assert.equal(e.ta.value, 'I would like coffee.');
  assert.equal(e.ta.selectionStart, 'I would like'.length);
});

test('submenu replaces the entire partial word at the caret', () => {
  const e = editor('I wou coffee.', 3);
  e.choose();
  assert.equal(e.ta.value, 'I would like coffee.');
});

test('submenu replaces selected text with the pair and preserves punctuation', () => {
  const e = editor('I need, please.', 2, 6);
  e.choose();
  assert.equal(e.ta.value, 'I would like, please.');
});

for (const place of ['menu', 'tree', 'dial']) {
  test(place + ' secondary prediction keeps both words before a newline', () => {
    const e = editor('I w\nAnother line.', 3, 3, place);
    e.choose();
    assert.equal(e.ta.value, 'I would like\nAnother line.');
    assert.equal(e.events.edits, 1);
  });
}

test('main-menu choice still inserts only the first word', () => {
  const e = editor('I w coffee.', 3);
  e.choose(0, -1);
  assert.equal(e.ta.value, 'I would coffee.');
  assert.deepEqual(e.events.spoken, ['would']);
  assert.equal(e.events.edits, 1);
});

test('missing submenu choice leaves the document unchanged', () => {
  const e = editor('I ');
  e.choose(0, 99);
  assert.equal(e.ta.value, 'I ');
  assert.equal(e.events.edits, 0);
  assert.equal(e.events.saves, 0);
});
