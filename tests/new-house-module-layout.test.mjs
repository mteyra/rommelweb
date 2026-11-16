import test from 'node:test';
import {historicalExteriorSource} from './historical-exterior-source.mjs';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {difference, intersection, union} from 'polyclip-ts';
import {
  createNewHouseModuleLayouts, protectedExteriorPolygons, polygonArea, auditHallRoutes,
  NEWER_HOUSES, DIMENSIONS,
} from '../scripts/new-house-module-layout.mjs';
import {floorSection} from '../src/sections.js';
import {getLevelElevations} from '../src/interiors.js';
import {validateInteriorStudies, getLevelWindows} from '../src/interior-studies.js';

const read=async path=>JSON.parse(await readFile(new URL(`../${path}`,import.meta.url),'utf8'));
const [studies,campus,lod2,interiors,published,before]=await Promise.all([
  'public/data/interior-studies.json','public/data/campus.json','public/data/lod2.json',
  'public/data/interiors.json','public/data/new-house-module-layouts.json','tests/fixtures/before-newer-house-layout.json',
].map(read));
const hash=value=>createHash('sha256').update(value).digest('hex');
const close=(a,b,label='')=>assert.ok(Math.abs(a-b)<1e-6,`${label}: ${a} vs ${b}`);
const polygon=item=>[item.polygon,...(item.holes||[])];
const multi=polygons=>polygons.map(p=>[p.outer,...(p.holes||[])]);
const rect=(x,y,w,h)=>[[x,y],[x+w,y],[x+w,y+h],[x,y+h],[x,y]];
const distance=(a,b)=>Math.hypot(a[0]-b[0],a[1]-b[1]);
const bounds=ring=>({
  x0:Math.min(...ring.map(p=>p[0])),x1:Math.max(...ring.map(p=>p[0])),
  y0:Math.min(...ring.map(p=>p[1])),y1:Math.max(...ring.map(p=>p[1])),
});
const local=(point,frame)=>[frame.axisU,frame.axisV].map(axis=>
  Math.round(((point[0]-frame.originCampusXZ[0])*axis[0]+(point[1]-frame.originCampusXZ[1])*axis[1])*1e9)/1e9);
const freeze=value=>{
  if(value&&typeof value==='object'){Object.values(value).forEach(freeze);Object.freeze(value);}
  return value;
};

test('newer generator is pure, deterministic and exactly reproduces the saved layer',()=>{
  const inputs=freeze(structuredClone({studies,campus,lod2,interiors}));
  const output=createNewHouseModuleLayouts(inputs);
  assert.deepEqual(output.studies,studies);
  assert.deepEqual(output.metadata,published);
  assert.deepEqual(inputs,{studies,campus,lod2,interiors});
  // A clean source without the new layer produces the same result; regeneration
  // does not compound translations or fit into an earlier estimated outline.
  const original=structuredClone(studies);
  NEWER_HOUSES.forEach(house=>delete original.buildings[house]);
  assert.deepEqual(createNewHouseModuleLayouts({...inputs,studies:original}),output);
});

test('all merged old/newer study records and folded source inputs retain their exact baseline hashes',async()=>{
  for(const [house,digest] of Object.entries(before.oldStudyHashes)){
    assert.equal(hash(JSON.stringify(studies.buildings[house])),digest,`old study ${house}`);
  }
  for(const [house,digest] of Object.entries(before.newerStudyHashes)){
    assert.equal(hash(JSON.stringify(studies.buildings[house])),digest,`preserved newer study ${house}`);
  }
  assert.equal(hash(await readFile(new URL('../public/data/new-house-module-layouts.json',import.meta.url))),
    before.newerCanonicalHash,'preserved newer canonical layout');
  assert.equal(Object.keys(before.oldStudyHashes).length,5);
  assert.equal(Object.keys(before.newerStudyHashes).length,6);
  assert.equal(Object.keys(before.fileHashes).length,25);
  for(const [path,digest] of Object.entries(before.fileHashes)){
    assert.equal(hash(await readFile(new URL(`../${historicalExteriorSource(path)}`,import.meta.url))),digest,path);
  }
});

test('all 34 new floors preserve exact original section objects and unchanged elevations',()=>{
  assert.deepEqual(Object.keys(published.houses).sort(),[...NEWER_HOUSES].sort());
  let total=0;
  for(const house of NEWER_HOUSES){
    const source=lod2.buildings.find(b=>b.number===house),building=studies.buildings[house];
    const count=campus.buildings.find(b=>b.number===house).levels;
    const elevations=getLevelElevations(interiors,house,count,source.height);
    assert.equal(building.levels.length,count,house);
    for(const level of building.levels){
      const fresh=floorSection(source,elevations[level.index]);
      assert.deepEqual(fresh,before.sections[house][level.index],`${house}/${level.index} original section`);
      assert.deepEqual(level.floorOutline,fresh.polygons);
      assert.equal(published.houses[house].levels[level.index].relativeFloorElevation,elevations[level.index]);
      assert.equal(level.layoutBasis,'fitted-newer-module-layout');
      total++;
    }
  }
  assert.equal(total,34);
  assert.equal(validateInteriorStudies(studies,campus,lod2),true);
});

test('each whole apartment has its fixed dimensions, facade contact and one real hall-boundary entry in the study',()=>{
  for(const [house,building] of Object.entries(published.houses))for(const plan of building.levels){
    const level=studies.buildings[house].levels[plan.levelIndex];
    const target=`${house}/${plan.levelIndex}`;
    const actual=level.spaces.filter(s=>s.typology);
    assert.equal(actual.length,plan.rooms.length,target);
    for(const room of plan.rooms){
      const space=actual.find(s=>s.shortLabel===room.label),b=bounds(room.polygon);
      assert.ok(space,`${target}/${room.label}`);
      const dimensions=[b.x1-b.x0,b.y1-b.y0].sort((a,b)=>a-b);
      const expected={
        'newer-single':[2.92,7.2], 'newer-accessible':[5,6],
        'newer-wg3':[8,8.76], 'newer-wg4':[8,11.68],
      }[room.typology];
      dimensions.forEach((v,i)=>close(v,expected[i],`${target}/${room.label} dimension${i}`));
      close(polygonArea([polygon(space)]),expected[0]*expected[1],`${target}/${room.label} envelope area`);
      assert.equal(space.typology,room.typology);
      assert.equal(space.kind,room.capacity>1?'shared':'room');
      assert.match(space.note,/bounding|whole/i);
      if(room.typology==='newer-single'){
        const gross=bounds(room.modulePolygon);
        close((gross.x1-gross.x0)*(gross.y1-gross.y0),DIMENSIONS.modulePitch*DIMENSIONS.singleDepth);
      }
      const doors=level.doors.filter(d=>d.spaceId===space.id);
      assert.equal(doors.length,1,`${target}/${room.label} single whole-envelope entrance`);
      assert.equal(level.spaces.find(s=>s.id===doors[0].toSpaceId).kind,'corridor');
      close(distance(...doors[0].segment),.9);
      const outward={N:[0,-1],S:[0,1],W:[-1,0],E:[1,0]}[room.side];
      const windows=level.layoutWindows.filter(w=>w.spaceId===space.id);
      assert.equal(windows.length,1,'One opening cue must not imply an invented WG bedroom/window inventory.');
      for(const window of windows){
        close(distance(...window.segment),1.1);
        const mid=window.segment[0].map((n,i)=>(n+window.segment[1][i])/2),p=local(mid,building.coordinateFrame);
        const outsidePoint=p.map((n,i)=>n+outward[i]*.6);
        const currentFloor=multi(level.floorOutline).map(p=>p.map(r=>r.map(q=>local(q,building.coordinateFrame))));
        // A half-metre outward ray reaches the real source exterior; rooms
        // cannot migrate into the middle of the plan to bypass a loggia.
        assert.ok(polygonArea(difference([rect(outsidePoint[0]-.005,outsidePoint[1]-.005,.01,.01)],currentFloor))>.00009,
          `${target}/${room.label} remains facade-facing`);
      }
    }
  }
});

test('protected photographic recesses remain empty and full modules never overlap or cross any shell',()=>{
  for(const [house,building] of Object.entries(published.houses)){
    const source=lod2.buildings.find(b=>b.number===house);
    const elevations=getLevelElevations(interiors,house,building.levels.length,source.height);
    for(const plan of building.levels){
      const level=studies.buildings[house].levels[plan.levelIndex],frame=building.coordinateFrame;
      const floor=multi(level.floorOutline).map(p=>p.map(r=>r.map(q=>local(q,frame))));
      const reserved=protectedExteriorPolygons(source,plan.levelIndex,elevations).polygons.map(p=>p.map(r=>r.map(q=>local(q,frame))));
      close(polygonArea(difference(reserved,multi(plan.protectedExteriorPolygons))),0);
      close(polygonArea(difference(multi(plan.protectedExteriorPolygons),reserved)),0);
      const pieces=[...plan.rooms,...plan.commonAreas].map(r=>[r.modulePolygon]);
      pieces.push(...Object.values(plan.core).map(r=>[r.polygon]),...multi(plan.corridorPolygons));
      for(let i=0;i<pieces.length;i++){
        close(polygonArea(difference(pieces[i],floor)),0,`${house}/${plan.levelIndex} contained piece${i}`);
        if(reserved.length)close(polygonArea(intersection(pieces[i],reserved)),0,`${house}/${plan.levelIndex} protected piece${i}`);
        for(let j=0;j<i;j++)close(polygonArea(intersection(pieces[i],pieces[j])),0,`${house}/${plan.levelIndex} pieces${i}/${j}`);
      }
      const assigned=union(...pieces),remainder=multi(plan.unassignedPolygons);
      close(polygonArea(intersection(assigned,remainder)),0);
      close(polygonArea(difference(floor,union(assigned,remainder))),0);
      close(polygonArea(remainder),plan.totals.unassignedArea);
      close(plan.totals.shellArea,plan.totals.assignedArea+plan.totals.unassignedArea);
      assert.ok(plan.totals.unassignedArea>100,`${house}/${plan.levelIndex} visible gray remainder retained`);
    }
  }
});

test('the core is vertically aligned and every entry has a continuous 1.40 m hall route after clipping',()=>{
  for(const [house,building] of Object.entries(published.houses)){
    const first=building.levels[0].core;
    for(const plan of building.levels){
      assert.deepEqual(plan.core,first,`${house}/${plan.levelIndex} local core`);
      const audit=auditHallRoutes(plan);
      assert.deepEqual(audit,plan.hallRouteAudit);
      assert.equal(audit.testedWidth,1.4);
      assert.equal(audit.connectedEntrances,plan.rooms.length+plan.commonAreas.length+2);
    }
  }
  const broken=structuredClone(published.houses['49'].levels[1]);
  // Keep a single connected polygon but narrow the cross-hall to 0.60 m.
  // A connectivity-only check could miss this bottleneck; the sweep must fail.
  broken.corridorPolygons=[{outer:rect(7.2,7.6,7.9,.6),holes:[]}];
  assert.throws(()=>auditHallRoutes(broken),/1.40 m hall strip/);
});

test('the fitted capacity remains an explicit hypothesis, with two full single omissions instead of altered outlines',()=>{
  assert.deepEqual(published.scenarioTarget,{
    singlesIncludingAccessible:372,accessibleSingles:2,wg3Count:2,wg4Count:8,wgPlaces:38,totalPlaces:410,
  });
  assert.deepEqual(published.fittedTotals,{
    singleCount:370,accessibleCount:2,wg3Count:2,wg4Count:8,apartmentCount:380,capacity:408,wgPlaces:38,omittedSingleCandidates:2,
  });
  const omissions=Object.entries(published.houses).flatMap(([h,b])=>b.levels.flatMap(p=>p.omittedModules.map(r=>({house:h,floor:p.levelIndex,...r}))));
  assert.equal(omissions.length,2);
  assert.deepEqual(omissions.map(r=>[r.house,r.floor]),[['55a',2],['55a',5]]);
  assert.ok(omissions.every(r=>r.typology==='newer-single'&&/protected photographed/.test(r.reason)));
  for(const house of NEWER_HOUSES)for(const level of studies.buildings[house].levels){
    assert.match(level.notes,/field-check hypothesis/);
    assert.match(level.notes,/not a verified room inventory/);
    assert.equal(level.windows,undefined,'Folded-source windows must not be replaced by the proposed room cues.');
    assert.strictEqual(getLevelWindows(level),level.layoutWindows);
    assert.ok(level.spaces.every(s=>s.confidence==='estimated'));
    assert.ok(level.layoutWindows.every(w=>w.confidence==='estimated'));
  }
  const blue=studies.buildings['51a'].levels;
  assert.equal(blue[0].spaces.filter(s=>s.typology).length,0);
  for(const index of [1,2])assert.equal(blue[index].spaces.filter(s=>s.typology==='newer-wg4').length,3);
});
