import {readFile, writeFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {union} from 'polyclip-ts';
import {validateInteriorStudies} from '../src/interior-studies.js';

const read = async path => JSON.parse(await readFile(new URL(`../${path}`, import.meta.url), 'utf8'));
const round = value => Math.round(value * 1e9) / 1e9;
const rect = (x, y, width, height) => [[x,y],[x+width,y],[x+width,y+height],[x,y+height],[x,y]].map(p=>p.map(round));
// The first-floor annotation faces the opposite way to the accepted top plan.
// Keep the top plan's campus registration; never recenter the larger floor.
const toTop = ([x,y]) => [round(36.1-x),round(12.4-y)];
const fromAnnotation = ring => ring.map(toTop);
const annotationRect = (...values) => fromAnnotation(rect(...values));
const area = ring => round(Math.abs(ring.slice(1).reduce((sum,b,i)=>
  sum+ring[i][0]*b[1]-b[0]*ring[i][1],0))/2);
const hash = value => createHash('sha256').update(JSON.stringify(value,null,2)+'\n').digest('hex');
const levelId = id => id.replace(/^study-55-2-/, 'study-55-1-');
const openingKey = label => label.replaceAll('–','-');
const outline = [
  [0,-3.1],[7.4,-3.1],[7.4,5],[19.4,5],[19.4,2.1],[28.7,2.1],
  [28.7,-2.4],[41.1,-2.4],[41.1,5],[36.1,5],[36.1,17.4],[28.7,17.4],
  [28.7,12.4],[16.7,12.4],[16.7,15.3],[7.4,15.3],[7.4,19.8],
  [-8.1,19.8],[-8.1,12.4],[0,12.4],[0,-3.1],
];
const notes = [
  'House 55 / 1. OG uses the accepted 2. OG module plan at the same campus position, with the resident first-floor additions and cutouts from 15 November 2026.',
  'Sixteen single apartments retain 2.70 x 6.00 m clear interiors and two 0.20 m side strips, giving a 3.10 m module.',
  'Shared apartments W1, A, N3-N4 and G-H each combine two 3.10 m module widths with the perpendicular 6.00 m room plus 1.40 m hallway depth: a 6.20 x 7.40 m assumed gross envelope. The joined pairs have one entrance and no intervening room or hallway divider. Their internal partitions and net areas are not established.',
  'Both 9.30 x 2.90 m strips are separate balcony enclosures, each reached through one door near the stair end of its hallway-facing wall. The blue 4.50 m deep portions and the earlier stair-side spur remain outside this floor outline.',
  'The W wing is 15.50 m long. The resident confirmed an 8.10 m inner return instead of the annotated 5.00 m, preserving the 7.40 m top-floor core and all other final dimensions.',
  'Hallways are 1.40 m wide. The unchanged stair block has the requested 1.30 m flight column plus 1.40 m walkway. Door and window symbols and stair treads remain illustrative.',
];

function translatedRoom(source, label, id, du, dv) {
  const move = ring => ring.map(([u,v])=>[round(u+du),round(v+dv)]);
  return {...structuredClone(source),id,label,
    polygon:move(source.polygon),modulePolygon:move(source.modulePolygon),
    sideWalls:source.sideWalls.map(move),doorSegment:move(source.doorSegment),windowSegment:move(source.windowSegment)};
}

/** Build only 1. OG, retaining the accepted top plan's coordinates verbatim. */
export function createFirstFloorPlan(topPlan, previous1OG) {
  if(topPlan.levelIndex!==2||previous1OG.index!==1)throw Error('Expected the accepted 2. OG plan and the previous 1. OG study.');
  const previousId = label => previous1OG.spaces.find(space=>space.shortLabel===label)?.id;
  const inheritedId = room => previousId(room.label)||levelId(room.id);
  const allModules = [...topPlan.rooms,
    translatedRoom(topPlan.rooms.find(room=>room.label==='G'),'H','study-55-1-east-4',0,-3.1),
    translatedRoom(topPlan.rooms.find(room=>room.label==='N3'),'N4','study-55-1-upper-right-4',-3.1,0),
  ];
  const module = label => allModules.find(room=>room.label===label);
  const rooms = allModules.filter(room=>!['W1','A','N3','N4','G','H'].includes(room.label))
    .map(room=>({...structuredClone(room),id:inheritedId(room)}));
  const sharedSpecs = [
    {label:'W1',sourceLabel:'W1',bank:'W',bounds:[0,-3.1,7.4,6.2],door:[[6.25,3.1],[7.15,3.1]],
      windows:[[[0,-2.075],[0,-1.025]],[[0,1.025],[0,2.075]]]},
    {label:'A',sourceLabel:'A',bank:'A',bounds:[-8.1,12.4,6.2,7.4],door:[[-1.9,12.65],[-1.9,13.55]],
      windows:[[[-7.075,19.8],[-6.025,19.8]],[[-3.975,19.8],[-2.925,19.8]]]},
    {label:'N3–N4',sourceLabel:'N3',bank:'N',bounds:[34.9,-2.4,6.2,7.4],door:[[34.9,3.85],[34.9,4.75]],
      moduleWindows:['N3','N4']},
    {label:'G–H',sourceLabel:'G',bank:'E',bounds:[28.7,11.2,7.4,6.2],door:[[28.95,11.2],[29.85,11.2]],
      moduleWindows:['G','H']},
  ];
  const sharedApartments = sharedSpecs.map(spec=>({
    id:previousId(spec.label)||inheritedId(module(spec.sourceLabel)),label:spec.label,bank:spec.bank,
    kind:'shared',polygon:annotationRect(...spec.bounds),width:6.2,depth:7.4,area:45.88,
    areaBasis:'assumed-gross-envelope',moduleCount:2,
    doorSegment:fromAnnotation(spec.door),
    windowSegments:spec.moduleWindows
      ? spec.moduleWindows.map(label=>structuredClone(module(label).windowSegment))
      : spec.windows.map(fromAnnotation),
  }));
  const hallSpecs = [
    ['E',28.7,5,1.4,6.2],['N',28.7,3.6,6.2,1.4],['R',19.4,5,9.3,1.4],
    ['L',7.4,11,9.3,1.4],['A',-1.9,12.4,9.3,1.4],['W',6,3.1,1.4,9.3],
  ];
  const corridors = hallSpecs.map(([bank,...bounds])=>({
    id:`module-55-1-hall-${bank}`,label:`${bank} bank hallway`,bank,polygon:annotationRect(...bounds),width:1.4,
  }));
  const commonAreas = [
    {bank:'R',label:'East balcony',bounds:[19.4,2.1,9.3,2.9],door:[[19.65,5],[20.55,5]]},
    {bank:'L',label:'West balcony',bounds:[7.4,12.4,9.3,2.9],door:[[15.55,12.4],[16.45,12.4]]},
  ].map(({bank,label,bounds,door})=>({
    id:`study-55-1-common-${bank}`,label,bank,kind:'service',use:'balcony',
    polygon:annotationRect(...bounds),width:9.3,depth:2.9,area:26.97,doorSegment:fromAnnotation(door),
    note:'Resident-marked 9.30 x 2.90 m balcony, separated from the hallway by a continuous wall with one entrance near the stairs. The 0.90 m doorway width and exact offset are illustrative.',
  }));
  const wallBands=rooms.flatMap(room=>room.sideWalls.map((polygon,index)=>({
    id:`module-55-1-wall-${room.label}-${index}`,label:`${room.label} side wall ${index+1}`,polygon:structuredClone(polygon),
  })));
  const shell={outline:fromAnnotation(outline),holes:[]};
  return {
    schemaVersion:1,house:'55',levelIndex:1,status:'resident-module-layout',units:'metres',
    dimensions:{...structuredClone(topPlan.dimensions),sharedWidth:6.2,sharedDepth:7.4,circulationExtensionDepth:2.9},
    coordinateFrame:structuredClone(topPlan.coordinateFrame),
    sourceHashes:{'public/data/house55-module-layout.json':hash(topPlan)},
    derivedFromLevelIndex:2,
    reconciliation:{
      segment:'W wing inner return',annotatedLength:5,derivedLength:8.1,closureDifference:3.1,
      basis:'15.50 m W wing minus the unchanged 7.40 m top-floor core equals 8.10 m.',
      status:'resident-confirmed',
    },
    shell,rooms,sharedApartments,corridors,circulationExtensions:[],commonAreas,wallBands,stair:structuredClone(topPlan.stair),
    outlineDimensions:shell.outline.slice(1).map((b,i)=>({
      a:shell.outline[i],b,length:round(Math.hypot(b[0]-shell.outline[i][0],b[1]-shell.outline[i][1])),
    })),
    totals:{
      singleCount:16,sharedApartmentCount:4,apartmentCount:20,moduleCount:24,
      singleClearArea:259.2,sharedEnvelopeArea:183.52,sideWallArea:38.4,bankHallArea:69.44,
      openCirculationArea:0,commonArea:53.94,stairArea:area(topPlan.stair.polygon),shellArea:area(shell.outline),
    },
    notes:[...notes],
  };
}

/** Register the new first-floor model without changing folded window evidence. */
export function createFirstFloorStudyLevel(plan, previous) {
  const {originCampusXZ:o,axisU:u,axisV:v}=plan.coordinateFrame;
  const point=([x,y])=>o.map((n,i)=>round(n+x*u[i]+y*v[i]));
  const ring=polygon=>polygon.map(point);
  const westId='study-55-1-potential-corridor',eastId='study-55-1-potential-corridor-east',stairId='study-55-1-stairs';
  const eastBanks=new Set(['E','N','R']);
  const hallId=bank=>eastBanks.has(bank)?eastId:westId;
  const hallSpace=(id,label,banks)=>{
    const polygons=union(...plan.corridors
      .filter(piece=>banks.has(piece.bank)).map(piece=>[piece.polygon]));
    if(polygons.length!==1||polygons[0].length!==1)throw Error(`${label} must be continuous, without holes.`);
    return {id,label,shortLabel:label,kind:'corridor',confidence:'estimated',
      note:'Connected 1.40 m bank hallways. Shared apartments and common areas are separate enclosures with individual entrances.',
      polygon:ring(polygons[0][0])};
  };
  const spaces=plan.rooms.map(room=>({
    id:room.id,label:`Room ${room.label}`,shortLabel:room.label,kind:'room',confidence:'estimated',
    note:'Clear interior 2.70 x 6.00 m = 16.20 square metres. Two 0.20 m side-wall allocations give a 3.10 m module. Bathroom and kitchen partitions are not drawn.',
    polygon:ring(room.polygon),
  }));
  spaces.push(...plan.sharedApartments.map(room=>({
    id:room.id,label:`Shared apartment ${room.label}`,shortLabel:room.label,kind:'shared',confidence:'estimated',
    note:'Assumed shared-apartment envelope: two 3.10 m widths by 6.00 m plus 1.40 m perpendicular hallway = 6.20 x 7.40 m, 45.88 square metres gross. Internal partitions and net area are not established.',
    polygon:ring(room.polygon),
  })),...plan.commonAreas.map(space=>({
    id:space.id,label:space.label,shortLabel:space.label,kind:'service',confidence:'estimated',
    note:space.note,polygon:ring(space.polygon),
  })),hallSpace(eastId,'East hall',eastBanks),hallSpace(westId,'West hall',new Set(['W','A','L'])),{
    id:stairId,label:'Stairwell',shortLabel:'Stairs',kind:'stairs',confidence:'estimated',
    note:'The accepted top-floor stair footprint is retained exactly: 2.70 m split into a 1.30 m flight column and 1.40 m walkway. Treads, landings and door positions remain illustrative.',
    polygon:ring(plan.stair.polygon),stairFlight:ring(plan.stair.flightPolygon),
  });
  const apartments=[...plan.rooms,...plan.sharedApartments];
  const doors=apartments.map(room=>({
    id:`module-55-1-door-${openingKey(room.label)}`,label:`${room.kind==='shared'?'Shared apartment':'Room'} ${room.label} doorway`,
    spaceId:room.id,toSpaceId:hallId(room.bank),confidence:'estimated',
    note:'Illustrative 0.90 m entrance on the apartment-to-hall boundary.',segment:ring(room.doorSegment),
  }));
  doors.push(...plan.commonAreas.map(space=>({
    id:`module-55-1-common-door-${space.bank}`,label:`${space.label} doorway`,
    spaceId:space.id,toSpaceId:hallId(space.bank),confidence:'estimated',
    note:'One illustrative 0.90 m entrance near the stair end of the hallway-facing enclosure wall.',
    segment:ring(space.doorSegment),
  })));
  plan.stair.connectionSegments.forEach((segment,index)=>doors.push({
    id:`module-55-1-stair-door-${index}`,label:index?'West hall stair entry':'East hall stair entry',
    spaceId:stairId,toSpaceId:index?westId:eastId,confidence:'estimated',
    note:'The top-floor illustrative 0.90 m stair doorway is retained at the same position.',segment:ring(segment),
  }));
  const layoutWindows=apartments.flatMap(room=>(room.windowSegments||[room.windowSegment]).map((segment,index)=>({
    id:`module-55-1-window-${openingKey(room.label)}-${index}`,label:`${room.label} window ${index+1}`,spaceId:room.id,confidence:'estimated',
    note:'Illustrative 1.05 m window on the independent first-floor outline; this is not a new measured façade opening.',
    segment:ring(segment),
  })));
  const preservedEvidence={};
  for(const key of ['windows','windowCoverage'])if(previous[key]!==undefined)preservedEvidence[key]=structuredClone(previous[key]);
  return {
    index:1,label:'1. OG · module layout',layoutBasis:'resident-module-layout',
    source:'Resident first-floor annotations and the accepted 2. OG module plan, 15 November 2026; sixteen 2.70 x 6.00 m singles, four 6.20 x 7.40 m assumed shared envelopes, two enclosed balconies and 1.40 m halls.',
    notes:plan.notes.join(' '),floorOutline:[{outer:ring(plan.shell.outline)}],spaces,doors,
    ...preservedEvidence,layoutWindows,
    wallBands:plan.wallBands.map(band=>({...structuredClone(band),polygon:ring(band.polygon),confidence:'estimated',
      note:'One 0.20 m side-wall allocation. Adjacent single apartments retain both allocations, totalling 0.40 m.'})),
    dimensionGuides:[],
  };
}

async function main() {
  const [topPlan,studies,campus,lod2]=await Promise.all([
    read('public/data/house55-module-layout.json'),read('public/data/interior-studies.json'),
    read('public/data/campus.json'),read('public/data/lod2.json'),
  ]);
  const building=studies.buildings['55'],index=building.levels.findIndex(level=>level.index===1);
  if(index<0)throw Error('House 55 has no previous 1. OG study.');
  const plan=createFirstFloorPlan(topPlan,building.levels[index]);
  building.levels[index]=createFirstFloorStudyLevel(plan,building.levels[index]);
  const groundFloorSource=building.levels.some(level=>level.index===0&&level.layoutBasis==='resident-module-layout')
    ? 'EG reuses the apartment arrangement, retaining the blue-marked floor areas for the enclosed cinema and laundry and an unassigned stair-side spur.'
    : 'EG remains an earlier unverified extrapolation.';
  building.source=`House 55 resident studies: 2. OG retains the accepted independent module plan. 1. OG derives its fixed core from that plan and applies the first-floor shared apartments, enclosed balconies and annotated cutouts. ${groundFloorSource} Folded exterior evidence is retained separately.`;
  validateInteriorStudies(studies,campus,lod2);
  await writeFile(new URL('../public/data/house55-first-floor-layout.json',import.meta.url),JSON.stringify(plan,null,2)+'\n');
  await writeFile(new URL('../public/data/interior-studies.json',import.meta.url),JSON.stringify(studies,null,2)+'\n');
  console.log('Generated House 55 / 1. OG: 16 singles, 4 shared apartments, 2 enclosed balconies and the unchanged 624.48 m² outline. The accepted 2. OG is unchanged.');
}
if(process.argv[1]===fileURLToPath(import.meta.url))await main();
