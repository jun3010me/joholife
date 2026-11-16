import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  applyFlips2D, applyNoise, countOnes, encode, encode2D, flipKindFor, isParityCell, isValidGrid, judge, oddCols, oddRows,
  parityBit, pickFlip1, pickFlip2, randomData4, type Bit, type Cell, type Mode, type Noise,
} from '../parity.ts';

const seq = (...v: number[]) => { let i = 0; return () => v[i++ % v.length]; };
/** 固定の疑似乱数 */
const lcg = (seed: number) => () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 2 ** 32);
const allData = () => Array.from({ length: 128 }, (_, n) => Array.from({ length: 7 }, (_, i) => ((n >> i) & 1) as Bit));

test('偶数パリティ：1が偶数個なら0、奇数個なら1', () => {
  assert.equal(parityBit([1, 1, 0, 0, 0, 0, 0], 'even'), 0);
  assert.equal(parityBit([1, 1, 1, 0, 0, 0, 0], 'even'), 1);
});
test('奇数パリティは偶数パリティの逆', () => {
  for (const d of allData()) assert.notEqual(parityBit(d, 'even'), parityBit(d, 'odd'));
});
test('送信した8枚は、約束どおりの判定になる', () => {
  for (const mode of ['even', 'odd'] as Mode[]) for (const d of allData()) assert.equal(judge(encode(d, mode), mode), 'ok');
});
test('1枚反転は、どの位置でも必ず誤りあり。2枚反転は必ず正しいと判定される', () => {
  for (const mode of ['even', 'odd'] as Mode[]) for (const d of allData()) {
    const sent = encode(d, mode);
    for (let i = 0; i < 8; i++) {
      const r = sent.map((b, k) => (k === i ? 1 - b : b));
      assert.equal(judge(r, mode), 'error');
      for (let j = i + 1; j < 8; j++) {
        const r2 = r.map((b, k) => (k === j ? 1 - b : b));
        assert.equal(judge(r2, mode), 'ok');
      }
    }
  }
});
test('乱数のノイズ：1枚・2枚は個数どおりで、重ならない', () => {
  const rng = lcg(1);
  for (let n = 0; n < 200; n++) {
    const sent = encode(allData()[n % 128], 'even');
    assert.equal(applyNoise(sent, 'one', rng).flipped.length, 1);
    const two = applyNoise(sent, 'two', rng);
    assert.equal(new Set(two.flipped).size, 2);
    assert.deepEqual(applyNoise(sent, 'none', rng).received, sent);
  }
  assert.deepEqual(applyNoise([0, 0, 0, 0, 0, 0, 0, 0], 'one', seq(0.999)).flipped, [7]);
});
test('全部0が届く：偶数パリティは正しい、奇数パリティは誤りあり', () => {
  const noise: Noise = 'zero';
  const even = applyNoise(encode([1, 0, 1, 1, 0, 0, 0], 'even'), noise);
  assert.equal(countOnes(even.received), 0);
  assert.equal(judge(even.received, 'even'), 'ok');
  for (const d of allData()) assert.equal(judge(applyNoise(encode(d, 'odd'), noise).received, 'odd'), 'error');
});

test('2次元パリティ：作った5×5は行・列とも偶数', () => {
  const rng = lcg(7);
  for (let n = 0; n < 100; n++) assert.ok(isValidGrid(encode2D(randomData4(rng))));
});
test('25マスのどの1枚が反転しても、奇数の行と列がちょうど1本ずつで、その交点が反転したマス', () => {
  const rng = lcg(3);
  for (let n = 0; n < 40; n++) {
    const sent = encode2D(randomData4(rng));
    for (let r = 0; r < 5; r++) for (let c = 0; c < 5; c++) {
      const g = applyFlips2D(sent, [[r, c]]);
      assert.deepEqual(oddRows(g), [r]);
      assert.deepEqual(oddCols(g), [c]);
    }
  }
});
test('4×4のデータ全パターンでも成り立つ（65536通り）', () => {
  for (let n = 0; n < 65536; n++) {
    const data = Array.from({ length: 4 }, (_, r) => Array.from({ length: 4 }, (_, c) => ((n >> (r * 4 + c)) & 1) as Bit));
    const sent = encode2D(data);
    const r = n % 5, c = Math.floor(n / 5) % 5;
    const g = applyFlips2D(sent, [[r, c]]);
    assert.ok(oddRows(g).length === 1 && oddRows(g)[0] === r && oddCols(g).length === 1 && oddCols(g)[0] === c);
  }
});
test('pickFlip1：パリティ指定ならパリティのマス、データ指定ならデータのマス', () => {
  const rng = lcg(5);
  for (let n = 0; n < 200; n++) {
    assert.ok(isParityCell(pickFlip1('parity', rng)));
    assert.ok(!isParityCell(pickFlip1('data', rng)));
  }
  const two = pickFlip2(lcg(9)) as Cell[];
  assert.notDeepEqual(two[0], two[1]);
});
test('flipKindFor：3問のうち1問は、必ずパリティのマスが反転する', () => {
  assert.equal(flipKindFor([]), 'any');
  assert.equal(flipKindFor([false]), 'any');
  assert.equal(flipKindFor([false, false]), 'parity');
  assert.equal(flipKindFor([true, false]), 'any');
  assert.equal(flipKindFor([false, false, false]), 'any');
  assert.equal(flipKindFor([false, false, true, false, false]), 'parity');
});
