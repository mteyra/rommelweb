import test from 'node:test';
import assert from 'node:assert/strict';
import {
  AREA, setRoomDimension, normalizeRoom, normalizeRotation, rectangleBounds,
  rectangleVertices, roomShellIntersectionArea, roomContainedInShell,
  roomIntersectionArea, rectangleUnionArea, analyzeLayout, snapRoom,
  packRooms, packBankRows, validateRoom,
} from '../public/house55-layout/geometry.js';

const close = (actual, expected, epsilon = 1e-8) =>
  assert.ok(Math.abs(actual-expected) <= epsilon, `${actual} ≠ ${expected}`);
const room = (id, x = 5, y = 5, width = 2.8, rotation = 0, bank = 'A') =>
  ({ id, bank, x, y, width, depth: AREA/width, rotation });
const bigShell = { outline: [[-100,-100],[100,-100],[100,100],[-100,100]], holes: [] };

test('repeated reciprocal width/depth edits retain16.4m² and do not mutate the input', () => {
  const original = room('A');
  let result = original;
  for (let i = 0; i < 500; i++) {
    result = setRoomDimension(result, 'width', 1.2 + (i % 80)/10);
    close(result.width*result.depth, AREA, 1e-12);
    result = setRoomDimension(result, 'depth', 2 + (i % 60)/10);
    close(result.width*result.depth, AREA, 1e-12);
  }
  assert.notEqual(result, original);
  close(original.width, 2.8);
  close(setRoomDimension(original, 'width', 100).width, 10);
  close(setRoomDimension(original, 'depth', 100).width, 1.64);
  close(setRoomDimension(original, 'width', .01).depth, 10);
  assert.throws(() => setRoomDimension(original, 'width', NaN), RangeError);
  assert.throws(() => setRoomDimension(original, 'depth', 0), RangeError);
});

test('right angle rotations keep local dimensions and produce exact world bounds', () => {
  const r = room('A', 0, 0, 4.1, 90);
  assert.deepEqual(rectangleVertices(r), [[-2,-2.05],[2,-2.05],[2,2.05],[-2,2.05]]);
  assert.equal(normalizeRotation(-90), 90);
  assert.equal(normalizeRotation(360), 0);
  assert.throws(() => normalizeRotation(45), RangeError);
  close(normalizeRoom({ ...r, depth: 7 }).depth, 4);
});

test('concave shell rejects a room whose four corners all fit but whose edges bridge a notch', () => {
  const shell = { outline: [[0,0],[10,0],[10,10],[7,10],[7,3],[3,3],[3,10],[0,10]] };
  const r = room('bridge', 5, 8, 8.2);
  // The four corners are in the arms, but the middle8m² lies in the notch.
  close(roomShellIntersectionArea(r, shell), AREA-8);
  assert.equal(roomContainedInShell(r, shell), false);
  close(analyzeLayout([r], shell).rooms[0].outsideArea, 8);
});

test('a fully enclosed courtyard is detected even without any room-edge intersection', () => {
  const shell = { outline: [[0,0],[10,0],[10,10],[0,10]],
    holes: [[[4,4],[6,4],[6,6],[4,6]]] };
  const r = room('hole', 5, 5, 4.1);
  close(roomShellIntersectionArea(r, shell), AREA-4);
  assert.equal(roomContainedInShell(r, shell), false);
  assert.deepEqual(analyzeLayout([r], shell).outOfBounds, ['hole']);
});

test('skewed boundaries, reversed rings and disconnected shell components preserve exact intersection areas', () => {
  const r = { ...room('triangle', 8, 3), width: 2, depth: 2 };
  const triangle = [[0,0],[10,0],[0,10]];
  close(roomShellIntersectionArea(r, triangle), .5);
  close(roomShellIntersectionArea(r, [...triangle].reverse()), .5);
  const components = [{ outline: [[0,0],[3,0],[3,10],[0,10]] },
    { outer: [[7,0],[10,0],[10,10],[7,10]] }];
  close(roomShellIntersectionArea(room('bridge', 5, 8, 8.2), components), AREA-8);
});

test('touching is legal, positive overlaps are measured, and triple overlaps do not inflate union area', () => {
  const a = room('A', 0, 0, 4.1);
  const b = room('B', 4.1, 0, 4.1);
  close(roomIntersectionArea(a, b), 0);
  assert.equal(analyzeLayout([a,b], bigShell).overlaps.length, 0);
  const c = room('C', 0, 0, 4.1);
  close(rectangleUnionArea([a,c,{ ...c, id: 'D' }]), AREA);
  const analysis = analyzeLayout([a,c,{ ...c, id: 'D' }], bigShell);
  close(analysis.duplicateOccupiedArea, 2*AREA);
  assert.equal(analysis.overlaps.length, 3);
  close(analysis.totalArea, 3*AREA);
});

test('analysis reports malformed areas and geometry instead of silently resizing the layout', () => {
  const badArea = { ...room('badArea'), depth: 2 };
  const badGeometry = { ...room('badGeometry'), x: Infinity };
  const analysis = analyzeLayout([badArea,badGeometry], bigShell);
  assert.deepEqual(analysis.invalidArea, ['badArea']);
  assert.deepEqual(analysis.invalidGeometry, ['badGeometry']);
  assert.equal(analysis.valid, false);
  assert.ok(validateRoom(badArea).length);
});

test('neighbor snap aligns clear edges with the configured wall gap and keeps area fixed', () => {
  const fixed = room('fixed', 0, 0, 4.1);
  const moving = room('moving', 4.38, .03, 4.1);
  const result = snapRoom(moving, [fixed], null, { tolerance: .10, gap: .20 });
  assert.equal(result.snapped, true);
  close(result.room.x, 4.3);
  close(result.room.y, 0);
  close(result.room.width*result.room.depth, AREA);
  close(rectangleBounds(result.room).minX-rectangleBounds(fixed).maxX, .20);
});

test('shell snapping handles a skewed source edge and remains advisory for invalid placements', () => {
  const shell = { outline: [[0,0],[10,0],[10,10],[0,8]] };
  const r = room('skew', 5, 6.65, 4.1);
  const result = snapRoom(r, [], shell, { tolerance: .15 });
  assert.ok(result.snaps.some(s => s.type === 'shell-edge'));
  const edge = result.snaps.find(s => s.type === 'shell-edge');
  const values = rectangleVertices(result.room).map(p => p[0]*edge.normal[0]+p[1]*edge.normal[1]);
  const target = edge.edge[0][0]*edge.normal[0]+edge.edge[0][1]*edge.normal[1];
  close(Math.min(...values.map(v => Math.abs(v-target))), 0);
  close(result.room.width*result.room.depth, AREA);
  const outside = snapRoom(room('outside', 100, 100), [], shell, { tolerance: .1 });
  assert.equal(outside.snapped, false);
  assert.equal(roomContainedInShell(outside.room, shell), false);
});

test('packing preserves selection scope, chosen anchor, rotations, fixed areas and exact gaps', () => {
  const input = [room('A', 0, 0, 2.8), room('B', 8, 2, 3, 90),
    room('C', 30, 4, 2.6), room('untouched', 50, 50)];
  const low = Math.min(...input.slice(0,3).map(r => rectangleBounds(r).minX));
  const output = packRooms(input, ['A','B','C'], { axis: 'x', gap: .20, anchor: 'start' });
  assert.equal(output[3], input[3]);
  close(rectangleBounds(output[0]).minX, low);
  for (let i = 0; i < 3; i++) close(output[i].width*output[i].depth, AREA);
  for (let i = 1; i < 3; i++) {
    close(rectangleBounds(output[i]).minX-rectangleBounds(output[i-1]).maxX, .20);
    close(output[i].y, output[i-1].y);
  }
  const center = (low+Math.max(...input.slice(0,3).map(r => rectangleBounds(r).maxX)))/2;
  const zeroGap = packRooms(input, ['A','B','C'], { axis: 'x', gap: 0, anchor: 'center' });
  close((rectangleBounds(zeroGap[0]).minX+rectangleBounds(zeroGap[2]).maxX)/2, center);
  close(rectangleBounds(zeroGap[1]).minX, rectangleBounds(zeroGap[0]).maxX);
});

test('packing all banks keeps each independent row axis and does not claim containment', () => {
  const input = [room('A', 0, 0, 2.8, 0, 'A'), room('B', 8, 2, 3, 0, 'A'),
    room('W1', 40, 0, 2.8, 90, 'W'), room('W2', 42, 8, 3, 90, 'W')];
  const packed = packBankRows(input, { gap: .20 });
  close(packed[0].y, packed[1].y);
  close(packed[2].x, packed[3].x);
  close(rectangleBounds(packed[3]).minY-rectangleBounds(packed[2]).maxY, .20);
  assert.equal(packed.length, input.length);
  assert.ok(packed.every(r => Math.abs(r.width*r.depth-AREA)<1e-12));
});
