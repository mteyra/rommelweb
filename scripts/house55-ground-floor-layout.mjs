import {readFile, writeFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {createFirstFloorStudyLevel} from './house55-first-floor-layout.mjs';
import {validateInteriorStudies} from '../src/interior-studies.js';

const read=async path=>JSON.parse(await readFile(new URL(`../${path}`,import.meta.url),'utf8'));
const round=value=>Math.round(value*1e9)/1e9;
const hash=value=>createHash('sha256').update(JSON.stringify(value,null,2)+'\n').digest('hex');
const toTop=([x,y])=>[round(36.1-x),round(12.4-y)];
const annotationRect=(x,y,width,height)=>[
  [x,y],[x+width,y],[x+width,y+height],[x,y+height],[x,y],
].map(toTop);
const groundId=id=>id.replace(/^study-55-1-/,'study-55-0-').replace(/^module-55-1-/,'module-55-0-');
const area=ring=>round(Math.abs(ring.slice(1).reduce((sum,b,i)=>
  sum+ring[i][0]*b[1]-b[0]*ring[i][1],0))/2);
// Start with the same W upper-left-to-right edge as 1. OG so the viewer keeps
// the resident's drawing orientation. The blue areas are restored on EG only.
const outline=[
  [0,-3.1],[7.4,-3.1],[7.4,5],[19.4,5],[19.4,-2.4],[41.1,-2.4],
  [41.1,5],[36.1,5],[36.1,17.4],[28.7,17.4],[28.7,12.4],
  [19.4,12.4],[19.4,15.3],[16.7,15.3],[16.7,19.8],
  [-8.1,19.8],[-8.1,12.4],[0,12.4],[0,-3.1],
];
const notes=[
  'House 55 / EG repeats the completed 1. OG layout at the same campus position, including its twenty single apartments and two shared-apartment envelopes.',
  'The three blue-marked areas removed from 1. OG are retained on EG: two 9.30 x 4.50 m outer strips and the 2.70 x 2.90 m stair-side spur.',
  'Those 91.53 square metres are restored footprint only. Their use, partitions, entrances and connection details remain unassigned; no additional apartment, corridor, stair flight or doorway is inferred.',
  'Single apartments retain 2.70 x 6.00 m clear interiors and 3.10 m modules. Shared apartments A and W1 retain their 6.20 x 7.40 m gross envelopes, including the perpendicular hall allowance.',
  'The existing 1.40 m hall runs, 9.30 x 2.90 m open circulation strips and 2.70 m stair enclosure keep the exact first-floor geometry. The confirmed 8.10 m W return is retained.',
  'Shared-apartment internal divisions, restored-area uses, real openings and floor heights remain unresolved. The ground-floor footprint is independent of the folded source exterior.',
];

/** Extend the finished first floor without changing any of its internal geometry. */
export function createGroundFloorPlan(firstFloorPlan) {
  if(firstFloorPlan.levelIndex!==1||firstFloorPlan.status!=='resident-module-layout'){
    throw Error('Expected the completed House 55 / 1. OG independent module plan.');
  }
  const plan=structuredClone(firstFloorPlan);
  plan.levelIndex=0;
  plan.derivedFromLevelIndex=1;
  plan.sourceHashes={'public/data/house55-first-floor-layout.json':hash(firstFloorPlan)};
  for(const key of ['rooms','sharedApartments','corridors','circulationExtensions','wallBands']){
    plan[key]=plan[key].map(item=>({...item,id:groundId(item.id)}));
  }
  plan.restoredAreas=[
    {id:'module-55-0-restored-east',label:'Restored east outer strip',bounds:[19.4,-2.4,9.3,4.5]},
    {id:'module-55-0-restored-west',label:'Restored west outer strip',bounds:[7.4,15.3,9.3,4.5]},
    {id:'module-55-0-restored-stair-spur',label:'Restored stair-side spur',bounds:[16.7,12.4,2.7,2.9]},
  ].map(({bounds,...item})=>({
    ...item,polygon:annotationRect(...bounds),width:bounds[2],depth:bounds[3],
    area:round(bounds[2]*bounds[3]),status:'unassigned-footprint',
    note:'Retained blue-marked ground-floor area. Use, partitions and access are not yet assigned.',
  }));
  plan.shell={outline:outline.map(toTop),holes:[]};
  plan.outlineDimensions=plan.shell.outline.slice(1).map((b,i)=>({
    a:plan.shell.outline[i],b,length:round(Math.hypot(b[0]-plan.shell.outline[i][0],b[1]-plan.shell.outline[i][1])),
  }));
  plan.totals={...plan.totals,restoredUnassignedArea:91.53,shellArea:area(plan.shell.outline)};
  plan.notes=[...notes];
  return plan;
}

/** Keep the first-floor room arrangement and ground-floor source evidence separate. */
export function createGroundFloorStudyLevel(plan, previousGround) {
  if(plan.levelIndex!==0||previousGround.index!==0)throw Error('Expected the EG plan and the previous EG study.');
  const level=createFirstFloorStudyLevel(plan,previousGround);
  level.index=0;
  level.label='EG · module layout';
  level.source='Resident-requested ground-floor continuation of the completed 1. OG module layout, 15 November 2026, retaining the three blue-marked footprint areas.';
  level.notes=plan.notes.join(' ');
  level.spaces=level.spaces.map(space=>({...space,id:groundId(space.id)}));
  level.doors=level.doors.map(door=>({
    ...door,id:groundId(door.id),spaceId:groundId(door.spaceId),toSpaceId:groundId(door.toSpaceId),
  }));
  level.layoutWindows=level.layoutWindows.map(window=>({
    ...window,id:groundId(window.id),spaceId:groundId(window.spaceId),
    note:'Illustrative 1.05 m window inherited at the same position from 1. OG; this is not a measured ground-floor façade opening.',
  }));
  level.wallBands=level.wallBands.map(band=>({...band,id:groundId(band.id)}));
  return level;
}

async function main() {
  const [firstFloorPlan,studies,campus,lod2]=await Promise.all([
    read('public/data/house55-first-floor-layout.json'),read('public/data/interior-studies.json'),
    read('public/data/campus.json'),read('public/data/lod2.json'),
  ]);
  const building=studies.buildings['55'],index=building.levels.findIndex(level=>level.index===0);
  if(index<0)throw Error('House 55 has no previous EG study.');
  const plan=createGroundFloorPlan(firstFloorPlan);
  building.levels[index]=createGroundFloorStudyLevel(plan,building.levels[index]);
  building.source='House 55 resident studies: 2. OG retains its accepted module plan. 1. OG applies the confirmed shared apartments, added singles and cutouts to that core. EG repeats the completed first-floor layout and retains the three blue-marked footprint areas with their uses unassigned. Folded exterior evidence is retained separately.';
  validateInteriorStudies(studies,campus,lod2);
  await writeFile(new URL('../public/data/house55-ground-floor-layout.json',import.meta.url),JSON.stringify(plan,null,2)+'\n');
  await writeFile(new URL('../public/data/interior-studies.json',import.meta.url),JSON.stringify(studies,null,2)+'\n');
  console.log('Generated House 55 / EG: 20 singles, 2 shared apartments and a 716.01 m² outline including 91.53 m² of restored unassigned footprint. Both upper floors are unchanged.');
}
if(process.argv[1]===fileURLToPath(import.meta.url))await main();
