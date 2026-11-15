import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {union,intersection,difference} from 'polyclip-ts';
import {createFirstFloorPlan,createFirstFloorStudyLevel} from '../scripts/house55-first-floor-layout.mjs';
import {validateInteriorStudies} from '../src/interior-studies.js';

const read=async path=>JSON.parse(await readFile(new URL(`../${path}`,import.meta.url),'utf8'));
const [top,studies,campus,lod2]=await Promise.all([
  read('public/data/house55-module-layout.json'),read('public/data/interior-studies.json'),
  read('public/data/campus.json'),read('public/data/lod2.json'),
]);
const previous=studies.buildings['55'].levels.find(level=>level.index===1);
const plan=createFirstFloorPlan(top,previous),level=createFirstFloorStudyLevel(plan,previous);
const epsilon=1e-7;
const close=(a,b,message='')=>assert.ok(Math.abs(a-b)<epsilon,`${message}: ${a} differs from ${b}`);
const edges=ring=>ring.slice(1).map((b,i)=>[ring[i],b]);
const distance=(a,b)=>Math.hypot(a[0]-b[0],a[1]-b[1]);
const ringArea=ring=>Math.abs(edges(ring).reduce((sum,[a,b])=>sum+a[0]*b[1]-b[0]*a[1],0))/2;
const geometryArea=polys=>polys.reduce((sum,poly)=>sum+ringArea(poly[0])-poly.slice(1).reduce((s,r)=>s+ringArea(r),0),0);
const polygon=ring=>[ring];
const sideLengths=ring=>edges(ring).map(([a,b])=>distance(a,b)).sort((a,b)=>a-b);
const imagePoint=([u,v])=>[36.1-u,12.4-v];
const boundaryDistance=(p,ring)=>Math.min(...edges(ring).map(([a,b])=>{
  const dx=b[0]-a[0],dy=b[1]-a[1],d=dx*dx+dy*dy;
  const t=d?Math.max(0,Math.min(1,((p[0]-a[0])*dx+(p[1]-a[1])*dy)/d)):0;
  return distance(p,[a[0]+t*dx,a[1]+t*dy]);
}));
const sharedBoundaryLength=(first,second)=>{
  let length=0;
  for(const [a,b]of edges(first))for(const [c,d]of edges(second)){
    const vertical=Math.abs(a[0]-b[0])<epsilon&&Math.abs(c[0]-d[0])<epsilon;
    const horizontal=Math.abs(a[1]-b[1])<epsilon&&Math.abs(c[1]-d[1])<epsilon;
    const fixed=vertical?0:1,along=1-fixed;
    if((!vertical&&!horizontal)||Math.abs(a[fixed]-c[fixed])>=epsilon)continue;
    length+=Math.max(0,Math.min(Math.max(a[along],b[along]),Math.max(c[along],d[along]))
      -Math.max(Math.min(a[along],b[along]),Math.min(c[along],d[along])));
  }
  return length;
};

test('1. OG closes with the resident wings, cutouts and explicit W-return reconciliation',()=>{
  const expected=[
    ['E',7.4],['S',8.1],['E',12],['N',2.9],['E',9.3],['N',4.5],
    ['E',12.4],['S',7.4],['W',5],['S',12.4],['W',7.4],['N',5],
    ['W',12],['S',2.9],['W',9.3],['S',4.5],['W',15.5],['N',7.4],['E',8.1],['N',15.5],
  ];
  const outline=plan.shell.outline.map(imagePoint);
  assert.equal(edges(outline).length,expected.length);
  edges(outline).forEach(([a,b],i)=>{
    const dx=b[0]-a[0],dy=b[1]-a[1];
    assert.ok(Math.abs(dx)<epsilon||Math.abs(dy)<epsilon);
    assert.equal(Math.abs(dx)>epsilon?(dx>0?'E':'W'):(dy>0?'S':'N'),expected[i][0]);
    close(distance(a,b),expected[i][1],`Outline edge ${i}`);
  });
  assert.deepEqual(plan.shell.outline[0],plan.shell.outline.at(-1));
  close(ringArea(plan.shell.outline),624.48);
  assert.equal(plan.reconciliation.annotatedLength,5);
  close(plan.reconciliation.derivedLength,15.5-7.4);
  close(plan.reconciliation.closureDifference,3.1);
});

test('the exact top-floor frame, retained singles and staircase are reused without mutation',()=>{
  const frozenTop=structuredClone(top),frozenPrevious=structuredClone(previous);
  const generated=createFirstFloorPlan(top,previous);
  assert.deepEqual(top,frozenTop);
  assert.deepEqual(previous,frozenPrevious);
  assert.deepEqual(generated.coordinateFrame,top.coordinateFrame);
  assert.deepEqual(generated.stair,top.stair);
  for(const source of top.rooms.filter(room=>!['A','W1'].includes(room.label))){
    const target=generated.rooms.find(room=>room.label===source.label);
    for(const field of ['polygon','modulePolygon','sideWalls','doorSegment','windowSegment']){
      assert.deepEqual(target[field],source[field],`${source.label} ${field} keeps its exact top-floor location`);
    }
  }
  const sourceHash=createHash('sha256').update(JSON.stringify(top,null,2)+'\n').digest('hex');
  assert.equal(generated.sourceHashes['public/data/house55-module-layout.json'],sourceHash);
  assert.deepEqual(createFirstFloorPlan(top,previous),generated);
});

test('twenty singles and two gross shared envelopes implement the extra module at each end',()=>{
  assert.deepEqual(plan.rooms.map(room=>room.label).sort(),[
    'B','C','D','E','F','G','H','L1','L2','L3','N1','N2','N3','N4','R1','R2','R3','W2','W3','W4',
  ]);
  assert.deepEqual(plan.sharedApartments.map(room=>room.label).sort(),['A','W1']);
  for(const room of plan.rooms){
    sideLengths(room.polygon).forEach((n,i)=>close(n,[2.7,2.7,6,6][i],`${room.label} clear side`));
    sideLengths(room.modulePolygon).forEach((n,i)=>close(n,[3.1,3.1,6,6][i],`${room.label} module side`));
    close(ringArea(room.polygon),16.2);
  }
  for(const room of plan.sharedApartments){
    sideLengths(room.polygon).forEach((n,i)=>close(n,[6.2,6.2,7.4,7.4][i],`${room.label} gross side`));
    close(ringArea(room.polygon),45.88);
    assert.equal(room.areaBasis,'assumed-gross-envelope');
  }
  const bounds=room=>{
    const points=room.polygon.map(imagePoint);
    return [Math.min(...points.map(p=>p[0])),Math.min(...points.map(p=>p[1])),
      Math.max(...points.map(p=>p[0])),Math.max(...points.map(p=>p[1]))];
  };
  const expected={W1:[0,-3.1,7.4,3.1],A:[-8.1,12.4,-1.9,19.8],H:[30.1,14.5,36.1,17.2],N4:[38.2,-2.4,40.9,3.6]};
  for(const room of [...plan.sharedApartments,...plan.rooms.filter(room=>['H','N4'].includes(room.label))]){
    bounds(room).forEach((n,i)=>close(n,expected[room.label][i],`${room.label} bounds`));
  }
});

test('apartments, wall strips, circulation and stair cover precisely the new floor',()=>{
  const groups=[
    [plan.rooms,324],[plan.sharedApartments,91.76],[plan.wallBands,48],
    [plan.corridors,86.8],[plan.circulationExtensions,53.94],[[plan.stair],19.98],
  ];
  for(const [items,expected]of groups)close(items.reduce((sum,item)=>sum+ringArea(item.polygon),0),expected);
  const pieces=groups.flatMap(([items])=>items.map(item=>polygon(item.polygon)));
  const occupied=union(...pieces);
  close(geometryArea(occupied),pieces.reduce((sum,piece)=>sum+geometryArea([piece]),0),'No positive-area overlaps');
  close(geometryArea(difference(polygon(plan.shell.outline),occupied)),0,'No uncovered floor');
  close(geometryArea(difference(occupied,polygon(plan.shell.outline))),0,'No space beyond outline');
  const apartments=[...plan.rooms,...plan.sharedApartments];
  for(let i=0;i<apartments.length;i++)for(let j=i+1;j<apartments.length;j++){
    close(geometryArea(intersection(polygon(apartments[i].polygon),polygon(apartments[j].polygon))),0,
      `${apartments[i].label}/${apartments[j].label} disjoint`);
  }
});

test('full-width hallway junctions connect the open strips and unchanged stair',()=>{
  for(const hall of plan.corridors)close(sideLengths(hall.polygon)[0],1.4,`${hall.bank} clear width`);
  const circulation=[...plan.corridors.map(hall=>({name:hall.bank,polygon:hall.polygon})),
    {name:'Stair',polygon:plan.stair.polygon}];
  const connections=[];
  for(let i=0;i<circulation.length;i++)for(let j=i+1;j<circulation.length;j++){
    const length=sharedBoundaryLength(circulation[i].polygon,circulation[j].polygon);
    if(length>epsilon){
      close(length,1.4,`${circulation[i].name}/${circulation[j].name} junction`);
      connections.push([circulation[i].name,circulation[j].name].sort().join('-'));
    }
  }
  assert.deepEqual(connections.sort(),['A-W','E-N','E-R','L-Stair','L-W','R-Stair']);
  for(const extension of plan.circulationExtensions){
    const hall=plan.corridors.find(item=>item.bank===extension.bank);
    close(sharedBoundaryLength(extension.polygon,hall.polygon),9.3,'Strip opens fully to its bank hallway');
  }
  const registeredHalls=level.spaces.filter(space=>space.kind==='corridor');
  assert.equal(registeredHalls.length,2,'Each strip is part of its hall, without an artificial room boundary');
  close(registeredHalls.reduce((sum,hall)=>sum+ringArea(hall.polygon),0),140.74);
});

test('all apartments reach the stair through twenty-four actual doorway connections',()=>{
  assert.equal(level.doors.length,24);
  assert.equal(level.spaces.filter(space=>space.kind==='room').length,20);
  assert.equal(level.spaces.filter(space=>space.kind==='shared').length,2);
  const adjacency=new Map(level.spaces.map(space=>[space.id,new Set()]));
  for(const door of level.doors){
    const [a,b]=door.segment,samples=[a,b,[(a[0]+b[0])/2,(a[1]+b[1])/2]];
    const neighbors=level.spaces.filter(space=>samples.every(p=>boundaryDistance(p,space.polygon)<epsilon)).map(space=>space.id);
    assert.deepEqual(neighbors.sort(),[door.spaceId,door.toSpaceId].sort(),`${door.id} actual shared boundary`);
    close(distance(a,b),.9,`${door.id} symbol width`);
    adjacency.get(neighbors[0]).add(neighbors[1]);
    adjacency.get(neighbors[1]).add(neighbors[0]);
  }
  const stair=level.spaces.find(space=>space.kind==='stairs');
  const visited=new Set([stair.id]),queue=[stair.id];
  while(queue.length)for(const neighbor of adjacency.get(queue.shift())){
    if(!visited.has(neighbor)){visited.add(neighbor);queue.push(neighbor);}
  }
  assert.equal(visited.size,level.spaces.length,'Every apartment connects to the same stair');
  assert.ok(level.spaces.every(space=>space.id.startsWith('study-55-1-')));
  assert.ok([...level.doors,...level.layoutWindows,...level.wallBands].every(item=>item.id.startsWith('module-55-1-')));
});

test('schematic windows stay on the new exterior and folded source evidence is retained independently',()=>{
  assert.equal(level.layoutWindows.length,24);
  for(const window of level.layoutWindows){
    const [a,b]=window.segment;
    for(const point of [a,b,[(a[0]+b[0])/2,(a[1]+b[1])/2]]){
      close(boundaryDistance(point,level.floorOutline[0].outer),0,`${window.id} exterior placement`);
    }
  }
  assert.deepEqual(level.windows,previous.windows);
  assert.equal(level.windowCoverage,previous.windowCoverage);
  const source={...structuredClone(previous),windows:[{
    id:'source-first-floor-window',label:'Source façade observation',confidence:'estimated',
    note:'Existing source metadata',sourceSurfaceIndex:42,segment:[[1,2],[2,2]],
  }],windowCoverage:'complete-floor'};
  const snapshot=structuredClone(source),preserved=createFirstFloorStudyLevel(plan,source);
  assert.deepEqual(preserved.windows,snapshot.windows);
  assert.equal(preserved.windowCoverage,snapshot.windowCoverage);
  assert.deepEqual(source,snapshot);
  assert.notEqual(preserved.windows,source.windows);
});

test('the generated first floor passes site validation while every other floor is unchanged',()=>{
  const generated=structuredClone(studies),building=generated.buildings['55'];
  building.levels[building.levels.findIndex(item=>item.index===1)]=level;
  validateInteriorStudies(generated,campus,lod2);
  for(const oldLevel of studies.buildings['55'].levels.filter(item=>item.index!==1)){
    assert.deepEqual(building.levels.find(item=>item.index===oldLevel.index),oldLevel);
  }
  assert.deepEqual(generated.buildings['55'].levels.find(item=>item.index===2),studies.buildings['55'].levels.find(item=>item.index===2));
});

test('published first-floor data reproduces the archived input and confirmed reconciliation',async()=>{
  const [published,archive]=await Promise.all([
    read('public/data/house55-first-floor-layout.json'),
    read('data/source/house55-1og-before-module-layout.json'),
  ]);
  const regenerated=createFirstFloorPlan(top,archive.level);
  assert.deepEqual(regenerated,published);
  assert.deepEqual(createFirstFloorStudyLevel(regenerated,archive.level),previous);
  assert.equal(published.reconciliation.status,'resident-confirmed');
  assert.equal(previous.extrapolatedFrom,undefined);
  assert.deepEqual(previous.windows,archive.level.windows);
  assert.equal(previous.windowCoverage,archive.level.windowCoverage);
});
