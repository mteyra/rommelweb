import test from 'node:test';
import assert from 'node:assert/strict';
import { validateInteriorStudies } from '../src/interior-studies.js';

const rectangle = (left, bottom, right, top) => [[left, bottom], [right, bottom], [right, top], [left, top], [left, bottom]];
const campus = {buildings: [{number: '53', levels: 3}, {number: '55', levels: 3}]};
const lod2 = {buildings: [{number: '53', surfaces: []}, {number: '55', surfaces: []}]};
const validate = data => validateInteriorStudies(data, campus, lod2);
const lower = data => data.buildings['53'].levels[0].spaces[0];
const upper = data => data.buildings['53'].levels[1].spaces[0];

// A synthetic service room with an upper stair enclosure, never a published plan.
function fixture() {
  const floor = (index, kind, polygon) => ({
    index, label: `Synthetic floor ${index}`, source: 'Synthetic stair connection fixture',
    notes: 'Geometry exercises the validator only.',
    floorOutline: [{outer: rectangle(0, 0, 12, 8)}],
    spaces: [{
      id: `test-stair-${index}`, label: index ? 'Upper enclosure' : 'Lower service room',
      kind, confidence: 'estimated', polygon,
      stairFlight: rectangle(0.4, 0.4, 1.7, 2.9),
      stairConnection: {
        levelIndex: 1 - index, spaceId: `test-stair-${1 - index}`, direction: index ? 'down' : 'up',
        segment: index ? [[1.05, 0.65], [1.05, 2.65]] : [[1.05, 2.65], [1.05, 0.65]],
      },
    }, {
      id: `test-room-${index}`, label: 'Separate room', kind: 'room', confidence: 'estimated',
      polygon: rectangle(8, 0, 10, 2),
    }],
  });
  return {schemaVersion: 1, buildings: {'53': {
    source: 'Synthetic linked stair fixture',
    levels: [floor(0, 'service', rectangle(0, 0, 6, 7)), floor(1, 'stairs', rectangle(0, 0, 6, 3))],
  }}};
}

function rejectCases(cases) {
  for (const [name, change, pattern] of cases) {
    const data = fixture();
    change(data);
    assert.throws(() => validate(data), pattern, name);
  }
}

function freeze(value) {
  if (value && typeof value === 'object') {
    Object.values(value).forEach(freeze);
    Object.freeze(value);
  }
  return value;
}

test('reciprocal stairs validate without mutating geometry or requiring matching room outlines', () => {
  const data = fixture(), snapshot = structuredClone(data);
  assert.equal(validate(freeze(data)), true);
  assert.deepEqual(data, snapshot);

  const reordered = fixture(), corners = upper(reordered).stairFlight.slice(0, -1);
  const reorderedCorners = [corners[2], corners[1], corners[0], corners[3]];
  upper(reordered).stairFlight = [...reorderedCorners, reorderedCorners[0]];
  assert.equal(validate(reordered), true, 'the same aligned flight may start at another corner and use opposite winding');

  const legacy = fixture();
  delete lower(legacy).stairConnection;
  delete lower(legacy).stairFlight;
  delete upper(legacy).stairConnection;
  assert.equal(validate(legacy), true, 'ordinary main stairs still permit an unlinked schematic flight');
});

test('stair links must resolve to a reciprocal space on another floor of the same house', () => {
  rejectCases([
    ['missing destination floor', data => { lower(data).stairConnection.levelIndex = 2; }, /stairConnection\.levelIndex.*existing study floor/],
    ['missing destination space', data => { lower(data).stairConnection.spaceId = 'missing-stair'; }, /stairConnection\.spaceId.*existing space/],
    ['same-floor target', data => { lower(data).stairConnection.levelIndex = 0; }, /stairConnection\.levelIndex.*different/],
    ['fractional floor', data => { lower(data).stairConnection.levelIndex = 1.5; }, /stairConnection\.levelIndex/],
    ['one-way route', data => { delete upper(data).stairConnection; }, /stairConnection.*reciprocal/],
    ['backlink to another room', data => { upper(data).stairConnection.spaceId = 'test-room-0'; }, /stairConnection.*reciprocal/],
    ['existing room without stairs', data => { lower(data).stairConnection.spaceId = 'test-room-1'; }, /stairConnection.*reciprocal/],
    ['destination present only in another house', data => {
      const level = structuredClone(data.buildings['53'].levels[1]);
      level.spaces = [{id: 'foreign-stair', label: 'Other house stair', kind: 'stairs', confidence: 'estimated', polygon: rectangle(0, 0, 6, 3)}];
      data.buildings['55'] = {source: 'Another synthetic house', levels: [level]};
      lower(data).stairConnection.spaceId = 'foreign-stair';
    }, /stairConnection\.spaceId.*destination floor of this house/],
  ]);
});

test('up and down labels must match the actual destination floor', () => {
  rejectCases([
    ['upstairs route marked down', data => { lower(data).stairConnection.direction = 'down'; }, /stairConnection\.direction.*higher floor/],
    ['downstairs route marked up', data => { upper(data).stairConnection.direction = 'up'; }, /stairConnection\.direction.*lower floor/],
    ['unknown direction', data => { upper(data).stairConnection.direction = 'sideways'; }, /stairConnection\.direction/],
  ]);
});

test('direction segments stay within the flight and reverse the same route on the other floor', () => {
  rejectCases([
    ['zero length', data => { lower(data).stairConnection.segment[1] = [...lower(data).stairConnection.segment[0]]; }, /stairConnection\.segment.*distinct finite/],
    ['nonfinite endpoint', data => { lower(data).stairConnection.segment[0][0] = Infinity; }, /stairConnection\.segment.*finite/],
    ['malformed endpoint', data => { lower(data).stairConnection.segment[0].push(0); }, /stairConnection\.segment.*finite/],
    ['inside room but outside flight', data => { lower(data).stairConnection.segment = [[4, 1], [4, 2]]; }, /stairConnection\.segment.*within its stairFlight/],
    ['same arrow on both floors', data => { upper(data).stairConnection.segment.reverse(); }, /stairConnection\.segment.*reverse the same route/],
    ['different routes inside the same flight', data => {
      upper(data).stairConnection.segment = upper(data).stairConnection.segment.map(([x, z]) => [x + 0.1, z]);
    }, /stairConnection\.segment.*reverse the same route/],
  ]);
});

test('paired flight footprints must align and remain inside each host space without crossing cutouts', () => {
  rejectCases([
    ['offset upper flight still inside enclosure', data => {
      upper(data).stairFlight = upper(data).stairFlight.map(([x, z]) => [x + 0.1, z]);
      upper(data).stairConnection.segment = upper(data).stairConnection.segment.map(([x, z]) => [x + 0.1, z]);
    }, /stairConnection.*footprints must align/],
    ['different flight width', data => { upper(data).stairFlight = rectangle(0.5, 0.4, 1.7, 2.9); }, /stairConnection.*footprints must align/],
    ['flight extends beyond enclosure', data => { upper(data).stairFlight = rectangle(0.4, 0.4, 1.7, 3.2); }, /stairFlight.*within its stairwell/],
    ['flight covers a service-room cutout', data => { lower(data).holes = [rectangle(0.8, 1.2, 1.2, 1.5)]; }, /stairFlight.*outside its cutouts/],
    ['concave flight', data => { upper(data).stairFlight = [[0.4, 0.4], [1.7, 0.4], [0.9, 1.2], [0.4, 2.9], [0.4, 0.4]]; }, /stairFlight.*convex/],
  ]);
});

test('only stairwells or explicitly linked service spaces may contain flights and connections', () => {
  rejectCases([
    ...['room', 'shared', 'corridor', 'lift'].map(kind => [
      `flight in ${kind}`, data => { lower(data).kind = kind; }, /stairFlight.*stairwell/,
    ]),
    ['service flight without link', data => { delete lower(data).stairConnection; }, /stairFlight.*service space with a stair connection/],
    ['link without flight', data => { delete lower(data).stairFlight; }, /stairConnection.*contained stairFlight/],
    ['room link without flight', data => { lower(data).kind = 'room'; delete lower(data).stairFlight; }, /stairConnection.*stairwell or service/],
    ['connection is not an object', data => { lower(data).stairConnection = null; }, /stairConnection.*must be an object/],
    ['unrecognized connection metadata', data => { lower(data).stairConnection.resident = 'not geometry'; }, /stairConnection\.resident.*not allowed/],
  ]);
});
