import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {surfaceFrame} from '../src/facade.js';
import {createBuildingWindowStudies,getOldFacadeRowGuides} from '../src/windows.js';
import {createHouse55WindowAlignment,HOUSE55_WINDOW_ALIGNMENT} from '../src/house55-window-alignment.js';

const read=name=>readFile(new URL(`../public/data/${name}.json`,import.meta.url),'utf8').then(JSON.parse);
const [lod2,studies]=await Promise.all(['lod2','interior-studies'].map(read));
const building=lod2.buildings.find(building=>building.number==='55');
const locatedLevels=studies.buildings['55'].levels;
const guides=getOldFacadeRowGuides(building,3);
const options={house:'55',family:'plates',locatedLevels};
const build=extra=>createBuildingWindowStudies(building.surfaces,guides.elevations,
  building.baseY+guides.guideHeight,{...options,...extra});
const center=(patch,frame)=>frame.project(patch.corners[0].map((value,index)=>(value+patch.corners[2][index])/2))[0];
const centers=(result,index,floor)=>result.get(building.surfaces[index]).patches.filter(patch=>patch.floor===floor)
  .map(patch=>center(patch,surfaceFrame(building.surfaces[index]))).sort((a,b)=>a-b);
const close=(a,b)=>Math.abs(a-b)<1e-6;

test('House 55 folded room rows follow the photographed stacks and blank upper return',()=>{
  const before=JSON.stringify({building,locatedLevels});
  const result=build();
  for(const [index,counts] of [[0,[3,3,3]],[4,[4,4,4]],[5,[4,3,3]],[16,[5,5,4]],[28,[1,1,0]],[36,[2,2,3]],[43,[3,3,3]]]){
    assert.deepEqual([0,1,2].map(floor=>centers(result,index,floor).length),counts);
    const ground=centers(result,index,0),middle=centers(result,index,1),upper=centers(result,index,2);
    assert.ok(middle.every(value=>ground.some(candidate=>close(candidate,value))),`wall ${index}: lower windows share vertical columns`);
    if([0,4,5,16,43].includes(index))assert.ok(upper.every(value=>ground.some(candidate=>close(candidate,value))),
      `wall ${index}: upper columns align with the lower rows`);
    if(index===36)assert.ok(ground.every(value=>upper.some(candidate=>close(candidate,value))),
      'entrance-side lower windows line up with the two farther upper columns');
  }
  assert.ok(close(centers(result,16,0)[0],HOUSE55_WINDOW_ALIGNMENT.extraRearLowerCenter));
  assert.ok(close(centers(result,5,0)[0],HOUSE55_WINDOW_ALIGNMENT.retainedEastGroundCenter));
  assert.ok(close(centers(result,28,0)[0],HOUSE55_WINDOW_ALIGNMENT.steppedReturnCenter));
  const displayed=[...result.values()].flatMap(study=>study.patches).filter(patch=>patch.windowId);
  assert.equal(displayed.length,23);
  assert.ok(displayed.every(patch=>patch.windowId!=='study-55-2-window-west-hall'));
  assert.deepEqual([...result.values()].flatMap(study=>study.rejectedLocated||[]),[]);
  assert.equal(locatedLevels.find(level=>level.index===2).windows.length,24);
  assert.equal(JSON.stringify({building,locatedLevels}),before,'appearance overrides cannot edit the source or saved interior/window records');
});

test('photo alignment changes only registered House 55 faces and still respects exclusion masks',()=>{
  const before=JSON.stringify({building,locatedLevels});
  const result=build();
  // House 51 uses the same plates profile and has no House 55 photo override.
  const generic=build({house:'51'});
  const targetIndices=new Set([0,4,5,16,28,36,43]);
  for(const [surface,study] of result){
    if(!targetIndices.has(building.surfaces.indexOf(surface)))assert.deepEqual(study,generic.get(surface),
      'unphotographed faces keep their existing appearance');
  }
  const layouts=createHouse55WindowAlignment(building.surfaces,locatedLevels);
  assert.deepEqual([...layouts.keys()].map(surface=>building.surfaces.indexOf(surface)).sort((a,b)=>a-b),[0,4,5,16,28,36,43]);
  assert.ok(centers(generic,5,0).some(value=>close(value,centers(result,5,0)[0])),
    'the extra ground opening under the eastern roof step stays at its previous position');
  const surface=building.surfaces[16],frame=surfaceFrame(surface);
  const patch=result.get(surface).patches.find(patch=>patch.floor===0);
  const x=center(patch,frame),y=frame.project(patch.corners[0])[1]+0.5;
  const mask=[[x-0.05,y],[x+0.05,y],[x+0.05,y+0.1],[x-0.05,y+0.1],[x-0.05,y]].map(point=>frame.lift(point));
  const masked=build({exclusionsBySurface:new Map([[surface,[mask]]])});
  assert.equal(centers(masked,16,0).length,4);
  assert.ok(!centers(masked,16,0).some(candidate=>close(candidate,x)),'a masked photo target must disappear whole rather than leave a cropped window');
  assert.equal(JSON.stringify({building,locatedLevels}),before);
});
