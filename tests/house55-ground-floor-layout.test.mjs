import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {union,intersection,difference} from 'polyclip-ts';
import {createGroundFloorPlan,createGroundFloorStudyLevel} from '../scripts/house55-ground-floor-layout.mjs';
import {validateInteriorStudies,studyPlanDirection} from '../src/interior-studies.js';

const read=async path=>JSON.parse(await readFile(new URL(`../${path}`,import.meta.url),'utf8'));
const [first,studies,campus,lod2]=await Promise.all([
  read('public/data/house55-first-floor-layout.json'),read('public/data/interior-studies.json'),
  read('public/data/campus.json'),read('public/data/lod2.json'),
]);
const previous=studies.buildings['55'].levels.find(level=>level.index===0);
const upper=studies.buildings['55'].levels.find(level=>level.index===1);
const plan=createGroundFloorPlan(first),level=createGroundFloorStudyLevel(plan,previous);
const epsilon=1e-7;
const close=(a,b,message='')=>assert.ok(Math.abs(a-b)<epsilon,`${message}: ${a} differs from ${b}`);
const edges=ring=>ring.slice(1).map((b,i)=>[ring[i],b]);
const distance=(a,b)=>Math.hypot(a[0]-b[0],a[1]-b[1]);
const ringArea=ring=>Math.abs(edges(ring).reduce((sum,[a,b])=>sum+a[0]*b[1]-b[0]*a[1],0))/2;
const geometryArea=polys=>polys.reduce((sum,poly)=>sum+ringArea(poly[0])-poly.slice(1).reduce((s,r)=>s+ringArea(r),0),0);
const polygon=ring=>[ring];
const imagePoint=([u,v])=>[36.1-u,12.4-v];
const oldId=id=>id.replace(/^study-55-0-/,'study-55-1-').replace(/^module-55-0-/,'module-55-1-');
const boundaryDistance=(p,ring)=>Math.min(...edges(ring).map(([a,b])=>{
  const dx=b[0]-a[0],dy=b[1]-a[1],d=dx*dx+dy*dy;
  const t=d?Math.max(0,Math.min(1,((p[0]-a[0])*dx+(p[1]-a[1])*dy)/d)):0;
  return distance(p,[a[0]+t*dx,a[1]+t*dy]);
}));

test('EG restores exactly the three blue areas and keeps their use unassigned',()=>{
  assert.equal(plan.restoredAreas.length,3);
  const expected=[
    [19.4,-2.4,28.7,2.1,41.85],[7.4,15.3,16.7,19.8,41.85],[16.7,12.4,19.4,15.3,7.83],
  ];
  for(const [index,item]of plan.restoredAreas.entries()){
    const points=item.polygon.map(imagePoint);
    const bounds=[Math.min(...points.map(p=>p[0])),Math.min(...points.map(p=>p[1])),
      Math.max(...points.map(p=>p[0])),Math.max(...points.map(p=>p[1])),ringArea(item.polygon)];
    bounds.forEach((value,i)=>close(value,expected[index][i],item.label));
    assert.equal(item.status,'unassigned-footprint');
    close(geometryArea(intersection(polygon(item.polygon),polygon(first.shell.outline))),0);
  }
  const restored=union(...plan.restoredAreas.map(item=>polygon(item.polygon)));
  close(geometryArea(restored),91.53);
  close(geometryArea(difference(restored,polygon(plan.shell.outline))),0);
  close(geometryArea(difference(polygon(plan.shell.outline),polygon(first.shell.outline))),91.53);
  close(geometryArea(difference(polygon(first.shell.outline),polygon(plan.shell.outline))),0);
  assert.deepEqual(plan.shell.holes,[]);
});

test('the larger EG outline closes with the retained wings and matching camera orientation',()=>{
  const expected=[
    ['E',7.4],['S',8.1],['E',12],['N',7.4],['E',21.7],['S',7.4],
    ['W',5],['S',12.4],['W',7.4],['N',5],['W',9.3],['S',2.9],
    ['W',2.7],['S',4.5],['W',24.8],['N',7.4],['E',8.1],['N',15.5],
  ];
  const outline=plan.shell.outline.map(imagePoint);
  assert.equal(edges(outline).length,expected.length);
  edges(outline).forEach(([a,b],i)=>{
    const dx=b[0]-a[0],dy=b[1]-a[1];
    assert.ok(Math.abs(dx)<epsilon||Math.abs(dy)<epsilon);
    assert.equal(Math.abs(dx)>epsilon?(dx>0?'E':'W'):(dy>0?'S':'N'),expected[i][0]);
    close(distance(a,b),expected[i][1],`EG exterior run${i}`);
  });
  assert.deepEqual(plan.shell.outline.slice(0,2),first.shell.outline.slice(0,2));
  close(ringArea(plan.shell.outline),716.01);
  for(const portrait of [false,true]){
    studyPlanDirection(level,portrait).forEach((v,i)=>close(v,studyPlanDirection(upper,portrait)[i]));
  }
});

test('every inherited apartment, hall, wall and stair keeps exact first-floor geometry',()=>{
  const snapshot=structuredClone(first),ground=createGroundFloorPlan(first);
  assert.deepEqual(first,snapshot);
  assert.deepEqual(ground.coordinateFrame,first.coordinateFrame);
  assert.deepEqual(ground.stair,first.stair);
  assert.deepEqual(ground.dimensions,first.dimensions);
  assert.deepEqual(ground.reconciliation,first.reconciliation);
  for(const key of ['rooms','sharedApartments','corridors','circulationExtensions','wallBands']){
    assert.deepEqual(ground[key].map(item=>({...item,id:oldId(item.id)})),first[key],key);
  }
  assert.equal(ground.sourceHashes['public/data/house55-first-floor-layout.json'],
    createHash('sha256').update(JSON.stringify(first,null,2)+'\n').digest('hex'));
  assert.deepEqual(createGroundFloorPlan(first),ground);
  assert.equal(ground.rooms.length,20);
  assert.equal(ground.sharedApartments.length,2);
});

test('known spaces and restored unassigned areas cover EG without positive overlaps',()=>{
  const known=[...plan.rooms,...plan.sharedApartments,...plan.wallBands,
    ...plan.corridors,...plan.circulationExtensions,plan.stair];
  const pieces=[...known,...plan.restoredAreas].map(item=>polygon(item.polygon));
  const occupied=union(...pieces);
  close(geometryArea(occupied),716.01);
  close(geometryArea(occupied),pieces.reduce((sum,p)=>sum+geometryArea([p]),0),'No positive-area overlap');
  close(geometryArea(difference(polygon(plan.shell.outline),occupied)),0,'No missing footprint');
  close(geometryArea(difference(occupied,polygon(plan.shell.outline))),0,'No geometry outside footprint');
  const knownArea=union(...known.map(item=>polygon(item.polygon)));
  close(geometryArea(knownArea),624.48,'First-floor arrangement unchanged');
  close(geometryArea(difference(polygon(plan.shell.outline),knownArea)),91.53,'Restorations remain unassigned');
});

test('EG preserves twenty-four apartment and stair doors without assigning extra restored-area access',()=>{
  assert.equal(level.spaces.length,25);
  assert.equal(level.doors.length,24);
  assert.equal(level.spaces.filter(space=>space.kind==='room').length,20);
  assert.equal(level.spaces.filter(space=>space.kind==='shared').length,2);
  const graph=new Map(level.spaces.map(space=>[space.id,new Set()]));
  for(const door of level.doors){
    const [a,b]=door.segment,samples=[a,b,[(a[0]+b[0])/2,(a[1]+b[1])/2]];
    const neighbors=level.spaces.filter(space=>samples.every(p=>boundaryDistance(p,space.polygon)<epsilon)).map(space=>space.id);
    assert.deepEqual(neighbors.sort(),[door.spaceId,door.toSpaceId].sort());
    graph.get(neighbors[0]).add(neighbors[1]);
    graph.get(neighbors[1]).add(neighbors[0]);
    const source=upper.doors.find(item=>item.id===oldId(door.id));
    assert.deepEqual(door.segment,source.segment);
  }
  const stair=level.spaces.find(space=>space.kind==='stairs'),seen=new Set([stair.id]),queue=[stair.id];
  while(queue.length)for(const neighbor of graph.get(queue.shift())){
    if(!seen.has(neighbor)){seen.add(neighbor);queue.push(neighbor);}
  }
  assert.equal(seen.size,level.spaces.length);
  assert.ok(level.spaces.every(space=>space.id.startsWith('study-55-0-')));
  assert.ok([...level.doors,...level.layoutWindows,...level.wallBands].every(item=>item.id.startsWith('module-55-0-')));
  for(const space of level.spaces){
    assert.deepEqual(space.polygon,upper.spaces.find(item=>item.id===oldId(space.id)).polygon);
  }
});

test('layout windows keep their first-floor positions and never replace ground-floor source evidence',()=>{
  assert.equal(level.layoutWindows.length,24);
  for(const window of level.layoutWindows){
    const source=upper.layoutWindows.find(item=>item.id===oldId(window.id));
    assert.deepEqual(window.segment,source.segment);
    const [a,b]=window.segment;
    for(const p of [a,b,[(a[0]+b[0])/2,(a[1]+b[1])/2]]){
      close(boundaryDistance(p,level.floorOutline[0].outer),0,`${window.id} remains exterior`);
    }
  }
  assert.deepEqual(level.windows,previous.windows);
  assert.equal(level.windowCoverage,previous.windowCoverage);
  const evidence={...structuredClone(previous),windows:[{
    id:'source-eg-observation',label:'Ground-floor source opening',confidence:'estimated',
    note:'Existing source metadata',sourceSurfaceIndex:42,segment:[[1,2],[2,2]],
  }],windowCoverage:'complete-floor'};
  const preserved=createGroundFloorStudyLevel(plan,evidence);
  assert.deepEqual(preserved.windows,evidence.windows);
  assert.notEqual(preserved.windows,evidence.windows);
  assert.equal(preserved.windowCoverage,evidence.windowCoverage);
});

test('generated EG validates while every other floor record remains unchanged',()=>{
  const generated=structuredClone(studies),building=generated.buildings['55'];
  building.levels[building.levels.findIndex(item=>item.index===0)]=level;
  assert.equal(validateInteriorStudies(generated,campus,lod2),true);
  for(const [number,oldBuilding]of Object.entries(studies.buildings)){
    for(const oldLevel of oldBuilding.levels.filter(item=>number!=='55'||item.index!==0)){
      assert.deepEqual(generated.buildings[number].levels.find(item=>item.index===oldLevel.index),oldLevel);
    }
  }
});

test('published ground-floor data reproduces the archived EG and finished first-floor source',async()=>{
  const [published,archive]=await Promise.all([
    read('public/data/house55-ground-floor-layout.json'),
    read('data/source/house55-eg-before-module-layout.json'),
  ]);
  const regenerated=createGroundFloorPlan(first);
  assert.deepEqual(regenerated,published);
  assert.deepEqual(createGroundFloorStudyLevel(regenerated,archive.level),previous);
  assert.equal(previous.extrapolatedFrom,undefined);
  assert.deepEqual(previous.windows,archive.level.windows);
  assert.equal(previous.windowCoverage,archive.level.windowCoverage);
});
