import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';

// The five older houses (51, 53, 55, 57, 59) have final, resident-approved
// floor plans on all 15 floors. These fingerprints lock them: any change to a
// single room, door, window symbol or note fails this test.
// Do not update these values. Old-house floors are not meant to change.

const FLOORS = {
  51: '2e1080f7e1697f611848959a1e58dac214c054ef0fa1ada900d640f4796dc06e',
  53: 'f7c4969b00f6f8932cdfca6d2493b45c48a6e6910a292cfed5829618b10c95d8',
  55: 'b72e644f25c10c42af238f152a97aef33f5e827290de6bef876a82feb0c1ef39',
  57: '0a66c00a65bb0ee4b35d01cef66b95bb843f57f7f7a22530b30bbc397c8b051c',
  59: '98f729819d84dfc02cc7711affba708ef38e2b60c068a2e8f9a4b3913c81bd91',
};

const PLANS = {
  'house51-top-floor-layout.json': 'a82f604f9434048257feb65a56eaee50e50deea2b27cb493c0b72f66afb577b7',
  'house51-first-floor-layout.json': 'd175c78614d04302f6ca12624ee73bae500cf4a3da308b7fd5e60ff94765dbf9',
  'house51-ground-floor-layout.json': '0bec3b412e9c7e1371a28c1dadfdb032f1d16a39a29e8b6f64b34e30a46d6b44',
  'house53-module-layouts.json': 'a681fd6caca3d21c5ef692a8b569b91c3336a46250d9fa33a8f6b2b5f07fa05f',
  'house55-module-layout.json': '62b8bef1ad8288246307dd25a8cbdedbccf063d0b6883e8970673e71a99b9165',
  'house55-first-floor-layout.json': 'bbd171887af144513abf595bd3b2afe2e5aafb3d5fd7fa4866cc700dbffa24d3',
  'house55-ground-floor-layout.json': '5d75a54fd62c30b55dd1a8ff0665a4ace55a27ecc0e38bc983cbed224e7e43ed',
  'house57-module-layouts.json': '5cbcef27ab20cba3b359bddbc077fc05173f167f27907d66d3372349b05797f4',
  'house59-module-layouts.json': '317f884704242e3c38fe54a5f181aabae5f6d68e8b24d1b0c00de318c384714c',
};

const sha = value => createHash('sha256').update(value).digest('hex');
const read = path => readFile(new URL(`../public/data/${path}`, import.meta.url));

test('the 15 older-house floors shown in the app are final and unchanged', async () => {
  const studies = JSON.parse(await read('interior-studies.json'));
  for (const [house, digest] of Object.entries(FLOORS)) {
    const building = studies.buildings[house];
    assert.equal(building.levels.length, 3, `House ${house} has three floors`);
    assert.ok(building.levels.every(level => level.layoutBasis === 'resident-module-layout'),
      `Every House ${house} floor is a resident-approved module layout`);
    assert.equal(sha(JSON.stringify(building)), digest, `House ${house} floors changed`);
  }
});

test('the older-house plan files written by the generators are final and unchanged', async () => {
  for (const [file, digest] of Object.entries(PLANS)) assert.equal(sha(await read(file)), digest, `${file} changed`);
});
