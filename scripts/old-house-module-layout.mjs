import {readFile, writeFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {difference, intersection, union} from 'polyclip-ts';
import {createRegistration} from './generate-old-house-studies.mjs';
import {isIndependentLayout, validateInteriorStudies} from '../src/interior-studies.js';

export const TARGET_HOUSES = ['51', '53', '57', '59'];
const BANKS = ['E', 'N', 'R', 'L', 'A', 'W'];
const EAST_BANKS = new Set(['E', 'N', 'R']);
const round = value => Math.round(value * 1e9) / 1e9;
const clone = value => structuredClone(value);
const hash = value => createHash('sha256').update(JSON.stringify(value)).digest('hex');
const rect = (x, y, width, height) => [[x,y],[x+width,y],[x+width,y+height],[x,y+height],[x,y]].map(p=>p.map(round));
const ringArea = ring => Math.abs(ring.slice(1).reduce((sum,b,i)=>sum+ring[i][0]*b[1]-b[0]*ring[i][1],0))/2;
const multiArea = polygons => polygons.reduce((sum,p)=>sum+ringArea(p[0])-p.slice(1).reduce((n,r)=>n+ringArea(r),0),0);
const bounds = rings => {
  const points = rings.flat();
  return {
    minU:round(Math.min(...points.map(p=>p[0]))),minV:round(Math.min(...points.map(p=>p[1]))),
    maxU:round(Math.max(...points.map(p=>p[0]))),maxV:round(Math.max(...points.map(p=>p[1]))),
  };
};
const labelKey = label => label.replaceAll('–','-');

// Every block is translated rigidly in metres. These small facade-aligned
// adjustments fit the accepted room pattern inside the existing source
// floors; they never stretch a room or change the building outline.
export const PLACEMENTS = {
  '51':{core:[0,-0.4],top:{omit:['W1']},lower:{shortBanks:['A','W']}},
  '53':{core:[0,-0.2],top:{omit:['W1'],shifts:{N:[0.4,0],A:[-1.6,0]}},
    lower:{shortBanks:['A','W'],shifts:{N:[1.4,0],A:[-1.2,0]}}},
  '57':{core:[0.2,-1],top:{shifts:{N:[0,0.2]},joinN:0.2},
    lower:{shortBanks:['W'],shifts:{E:[0,0.86],N:[1.4,0.86]}}},
  '59':{core:[0,1.8],top:{},
    lower:{shortBanks:['A'],shifts:{E:[0,0.9],N:[0,0.9]}}},
};

function coordinateFrame(topPlan, source, target) {
  const mapping = createRegistration(source, target);
  const [a,b,c,d] = mapping.manifest.rigid;
  const rotate = ([x,y]) => [a*x+b*y,c*x+d*y];
  // The existing audited mapping provides only an anchor. Its local affine
  // deformation is deliberately not applied to room, hall, or stair shapes.
  const originCampusXZ = mapping.mapPoint(topPlan.coordinateFrame.originCampusXZ);
  const axisU = rotate(topPlan.coordinateFrame.axisU);
  const axisV = rotate(topPlan.coordinateFrame.axisV);
  if(Math.abs(Math.hypot(...axisU)-1)>1e-8||Math.abs(Math.hypot(...axisV)-1)>1e-8
    ||Math.abs(axisU[0]*axisV[0]+axisU[1]*axisV[1])>1e-8)throw Error('Module registration must remain orthonormal.');
  return {originCampusXZ,axisU,axisV,
    basis:'Existing source registration anchor and rigid orientation; all layout distances remain unscaled metres.'};
}

function transformItem(source, translation, id) {
  const move = ring => ring.map(([u,v])=>[round(u+translation[0]),round(v+translation[1])]);
  const item = {...clone(source),id};
  for(const key of ['polygon','modulePolygon','doorSegment','flightPolygon','walkwayPolygon'])
    if(item[key])item[key]=move(item[key]);
  for(const key of ['sideWalls','connectionSegments'])if(item[key])item[key]=item[key].map(move);
  if(item.landings)item.landings=item.landings.map(landing=>({...landing,polygon:move(landing.polygon)}));
  // Facade openings remain source evidence. House 55's illustrative windows
  // cannot establish window positions for another house.
  delete item.windowSegment;
  delete item.windowSegments;
  return item;
}

function createLocalPlan(house, previous, template, frame) {
  const levelIndex=previous.index,top=levelIndex===2;
  const placement=PLACEMENTS[house],config=placement[top?'top':'lower'];
  const omittedModules=[],omitted=new Set(config.omit||[]);
  const shortBanks=new Set(config.shortBanks||[]);
  if(shortBanks.has('A'))omitted.add('B');
  if(shortBanks.has('W'))omitted.add('W2');
  for(const label of omitted)omittedModules.push({
    label,reason:'The full House 55 bank would cross the retained source floor. One complete single module is omitted; the remaining rooms keep their original dimensions.',
  });
  const shiftFor = bank => placement.core.map((v,i)=>round(v+(config.shifts?.[bank]?.[i]||0)));
  const prefix=`fitted-${house}-${levelIndex}`;
  const rooms=template.rooms.filter(room=>!omitted.has(room.label)).map(room=>
    transformItem(room,shiftFor(room.bank),`${prefix}-room-${labelKey(room.label)}`));
  const sharedApartments=(template.sharedApartments||[]).map(room=>{
    const translation=shiftFor(room.bank);
    // A shorter bank keeps the shared end apartment as one full envelope.
    // Move that envelope inward by exactly one pitch, following the removed
    // single apartment, and shorten its approach hallway by the same pitch.
    if(shortBanks.has(room.bank))translation[room.bank==='A'?0:1]=round(translation[room.bank==='A'?0:1]-3.1);
    return transformItem(room,translation,`${prefix}-shared-${labelKey(room.label)}`);
  });
  const corridors=template.corridors.map(source=>{
    const corridor=clone(source);
    if(top&&omitted.has('W1')&&corridor.bank==='W')corridor.polygon=rect(28.7,0,1.4,9.3);
    if(shortBanks.has('A')&&corridor.bank==='A')corridor.polygon=rect(28.7,-1.4,6.2,1.4);
    if(shortBanks.has('W')&&corridor.bank==='W')corridor.polygon=rect(28.7,0,1.4,6.2);
    return transformItem(corridor,shiftFor(corridor.bank),`${prefix}-hall-piece-${corridor.bank}`);
  });
  if(config.joinN){
    // House 57's top N bank sits 20 cm farther down its facade. Extend only
    // the existing 1.40 m E hallway across that small gap.
    corridors.push(transformItem({bank:'E',label:'E to N hallway join',width:1.4,
      polygon:rect(6,7.4,1.4,config.joinN)},placement.core,`${prefix}-hall-join-N`));
  }
  const stair=transformItem(template.stair,placement.core,`${prefix}-stairs`);
  const wallBands=rooms.flatMap(room=>room.sideWalls.map((polygon,index)=>({
    id:`${prefix}-wall-${labelKey(room.label)}-${index}`,label:`${room.label} side wall ${index+1}`,
    polygon:clone(polygon),width:0.2,
  })));
  const {originCampusXZ:o,axisU:u,axisV:v}=frame;
  const local=point=>[(point[0]-o[0])*u[0]+(point[1]-o[1])*u[1],(point[0]-o[0])*v[0]+(point[1]-o[1])*v[1]];
  const floor=previous.floorOutline.map(piece=>[piece.outer.map(local),...(piece.holes||[]).map(ring=>ring.map(local))]);
  const occupiedPieces=[
    ...rooms.map(room=>({label:room.label,polygon:room.modulePolygon})),
    ...sharedApartments,...corridors,{label:'Stairs',polygon:stair.polygon},
  ];
  for(const piece of occupiedPieces){
    const outside=multiArea(difference([piece.polygon],floor));
    if(outside>1e-6)throw Error(`House ${house}/${levelIndex} ${piece.label} exceeds the preserved floor by ${outside.toFixed(6)} m².`);
  }
  const privatePieces=[...rooms.map(room=>({label:room.label,polygon:room.modulePolygon})),...sharedApartments,
    {label:'Stairs',polygon:stair.polygon}];
  for(let i=0;i<privatePieces.length;i++){
    for(let j=i+1;j<privatePieces.length;j++){
      if(multiArea(intersection([privatePieces[i].polygon],[privatePieces[j].polygon]))>1e-6)
        throw Error(`House ${house}/${levelIndex}: ${privatePieces[i].label} overlaps ${privatePieces[j].label}.`);
    }
    for(const hall of corridors)if(multiArea(intersection([privatePieces[i].polygon],[hall.polygon]))>1e-6)
      throw Error(`House ${house}/${levelIndex}: ${privatePieces[i].label} overlaps ${hall.label}.`);
  }
  const occupied=union(...occupiedPieces.map(piece=>[piece.polygon]));
  const unassigned=difference(floor,occupied);
  const bankPlacements=BANKS.map(bank=>{
    const singles=rooms.filter(room=>room.bank===bank),shared=sharedApartments.filter(room=>room.bank===bank);
    const pieces=[...singles.map(room=>room.modulePolygon),...shared.map(room=>room.polygon),
      ...corridors.filter(hall=>hall.bank===bank).map(hall=>hall.polygon)];
    return {bank,translation:shiftFor(bank),singleLabels:singles.map(room=>room.label),
      sharedLabels:shared.map(room=>room.label),moduleCount:singles.length+shared.length*2,
      rectangularBounds:bounds(pieces)};
  });
  return {
    levelIndex,sourceTemplate:top?'house55-module-layout.json':levelIndex===1?'house55-first-floor-layout.json':'house55-ground-floor-layout.json',
    status:'provisional-fit-for-site-check',floorOutlineHash:hash(previous.floorOutline),bankPlacements,
    rooms,sharedApartments,corridors,stair,wallBands,
    unassignedPolygons:unassigned.map(p=>({outer:p[0].map(point=>point.map(round)),holes:p.slice(1).map(r=>r.map(point=>point.map(round)))})),
    totals:{
      singleCount:rooms.length,sharedApartmentCount:sharedApartments.length,apartmentCount:rooms.length+sharedApartments.length,
      moduleCount:rooms.length+sharedApartments.length*2,singleClearArea:round(rooms.length*16.2),
      sharedEnvelopeArea:round(sharedApartments.length*45.88),sideWallArea:round(rooms.length*2.4),
      hallArea:round(multiArea(union(...corridors.map(hall=>[hall.polygon])))),
      stairArea:round(ringArea(stair.polygon)),shellArea:round(multiArea(floor)),
      assignedArea:round(multiArea(occupied)),unassignedArea:round(multiArea(unassigned)),
    },omittedModules,
  };
}

function createStudyLevel(house, previous, plan, frame) {
  const prefix=`fitted-${house}-${previous.index}`;
  const {originCampusXZ:o,axisU:u,axisV:v}=frame;
  const point=([x,y])=>o.map((n,i)=>round(n+x*u[i]+y*v[i]));
  const ring=polygon=>polygon.map(point);
  const hallId=bank=>`${prefix}-hall-${EAST_BANKS.has(bank)?'east':'west'}`;
  const apartments=[...plan.rooms,...plan.sharedApartments];
  const spaces=apartments.map(room=>({
    id:room.id,label:`${room.kind==='shared'?'Shared apartment':'Room'} ${room.label}`,shortLabel:room.label,
    kind:room.kind==='shared'?'shared':'room',confidence:'estimated',
    note:room.kind==='shared'
      ? 'Provisional 6.20 x 7.40 m shared envelope, using the accepted House 55 pattern. The internal partitions, actual occupancy and net area require a site check.'
      : 'Provisional 2.70 x 6.00 m clear interior; two 0.20 m side allocations give a 3.10 m module. Placement, internal partitions and actual room identity require a site check.',
    polygon:ring(room.polygon),
  }));
  for(const east of [true,false]){
    const halls=plan.corridors.filter(hall=>EAST_BANKS.has(hall.bank)===east);
    const polygons=union(...halls.map(hall=>[hall.polygon]));
    if(polygons.length!==1||polygons[0].length!==1)throw Error(`House ${house}/${previous.index} ${east?'east':'west'} halls must be continuous without holes.`);
    const label=east?'East hall':'West hall';
    spaces.push({id:`${prefix}-hall-${east?'east':'west'}`,label,shortLabel:label,kind:'corridor',confidence:'estimated',
      note:'Provisional connected 1.40 m bank hallways. Each proposed apartment has one entrance to this hall.',
      polygon:ring(polygons[0][0])});
  }
  spaces.push({id:plan.stair.id,label:'Stairwell',shortLabel:'Stairs',kind:'stairs',confidence:'estimated',
    note:'Provisional 2.70 x 7.40 m stair enclosure, retained at the same position on all floors. The 1.30 m flight, 1.40 m walkway and openings follow House 55 and require verification.',
    polygon:ring(plan.stair.polygon),stairFlight:ring(plan.stair.flightPolygon)});
  const doors=apartments.map(room=>({
    id:`${prefix}-door-${labelKey(room.label)}`,label:`${room.label} doorway`,
    spaceId:room.id,toSpaceId:hallId(room.bank),confidence:'estimated',
    note:'One illustrative 0.90 m entrance on the apartment-to-hall boundary.',segment:ring(room.doorSegment),
  }));
  plan.stair.connectionSegments.forEach((segment,index)=>doors.push({
    id:`${prefix}-stair-door-${index}`,label:`${index?'West':'East'} hall stair entry`,
    spaceId:plan.stair.id,toSpaceId:`${prefix}-hall-${index?'west':'east'}`,confidence:'estimated',
    note:'Illustrative 0.90 m stair entry on the shared hall boundary.',segment:ring(segment),
  }));
  const preservedEvidence={};
  // Old facade evidence stays at the original source position. Remove the
  // former speculative room association so it cannot imply a new match.
  if(previous.windows)preservedEvidence.windows=previous.windows.map(({spaceId,...window})=>clone(window));
  if(previous.windowCoverage!==undefined)preservedEvidence.windowCoverage=previous.windowCoverage;
  return {
    index:previous.index,label:`${previous.index===0?'EG':`${previous.index}. OG`} · provisional module fit`,
    layoutBasis:'fitted-module-layout',
    source:'Provisional use of the resident-accepted House 55 module pattern inside this house’s unchanged existing floor outline, 15 November 2026.',
    notes:`Single interiors are 2.70 x 6.00 m with 3.10 m pitch and 1.40 m halls. ${plan.totals.sharedApartmentCount} shared apartments use unpartitioned 6.20 x 7.40 m assumed gross envelopes. `
      +`All room blocks are rigid placements; the source outline and folded exterior are preserved. ${plan.totals.unassignedArea.toFixed(2)} m² remains gray and unassigned. `
      +'Room labels identify proposed positions only. Occupancy, window alignment, service uses, internal layouts and residual-space uses await the resident’s in-person check.',
    floorOutline:clone(previous.floorOutline),spaces,doors,...preservedEvidence,layoutWindows:[],
    wallBands:plan.wallBands.map(band=>({
      id:band.id,label:band.label,polygon:ring(band.polygon),confidence:'estimated',
      note:'Provisional 0.20 m side allocation. Adjacent single apartments retain both allocations, totaling 0.40 m.',
    })),dimensionGuides:[],
  };
}

/** Fit fixed modules without editing any existing floor outline or House 55. */
export function createOldHouseModuleLayouts({studies,lod2,topPlan,firstFloorPlan,groundFloorPlan}) {
  if(topPlan.levelIndex!==2||firstFloorPlan.levelIndex!==1||groundFloorPlan.levelIndex!==0)
    throw Error('Expected the accepted House 55 templates for all three floors.');
  const result=clone(studies),source=lod2.buildings.find(building=>building.number==='55');
  // A resident-confirmed independent plan supersedes its earlier shell fit.
  // Keep it intact when regenerating the remaining provisional houses.
  const activeHouses=TARGET_HOUSES.filter(house=>
    !studies.buildings[house]?.levels.some(isIndependentLayout));
  const metadata={
    schemaVersion:1,status:'provisional-fit-for-site-check',units:'metres',
    sourceHashes:{topPlan:hash(topPlan),firstFloorPlan:hash(firstFloorPlan),groundFloorPlan:hash(groundFloorPlan)},
    dimensions:{singleWidth:2.7,singleDepth:6,sideWallAllocation:0.2,modulePitch:3.1,hallWidth:1.4,sharedWidth:6.2,sharedDepth:7.4},
    notes:[
      `Only the existing provisional interior studies for Houses ${activeHouses.join(', ')} are replaced. Resident-confirmed independent houses are retained verbatim.`,
      'All previous floor outlines and folded LoD2 exterior surfaces remain unchanged. No room or shared envelope is stretched, warped or cropped.',
      'Gray residual floor is deliberately unassigned. House 55 cinema, laundry, balcony and window placements do not establish uses or openings in another house.',
      'The layout is a provisional fit to support an in-person check, not a survey, confirmed room inventory or internal furnishing plan.',
    ],houses:{},
  };
  for(const house of activeHouses){
    const previous=studies.buildings[house];
    if(!previous)throw Error(`Missing House ${house} study.`);
    const target=lod2.buildings.find(building=>building.number===house),frame=coordinateFrame(topPlan,source,target);
    const plans=previous.levels.map(level=>createLocalPlan(house,level,level.index===2?topPlan:level.index===1?firstFloorPlan:groundFloorPlan,frame));
    result.buildings[house]={
      ...clone(previous),sourceDate:'2026-11-15',
      source:'Provisional House 55 room modules fitted rigidly inside each unchanged existing source floor. Gray remainder is unassigned for resident verification; folded exterior evidence is preserved.',
      levels:previous.levels.map((level,index)=>createStudyLevel(house,level,plans[index],frame)),
    };
    metadata.houses[house]={coordinateFrame:frame,coreTranslation:clone(PLACEMENTS[house].core),levels:plans};
  }
  return {studies:result,metadata};
}

async function main() {
  const read=async path=>JSON.parse(await readFile(new URL(`../${path}`,import.meta.url),'utf8'));
  const [studies,lod2,topPlan,firstFloorPlan,groundFloorPlan,campus]=await Promise.all([
    read('public/data/interior-studies.json'),read('public/data/lod2.json'),read('public/data/house55-module-layout.json'),
    read('public/data/house55-first-floor-layout.json'),read('public/data/house55-ground-floor-layout.json'),read('public/data/campus.json'),
  ]);
  const result=createOldHouseModuleLayouts({studies,lod2,topPlan,firstFloorPlan,groundFloorPlan});
  validateInteriorStudies(result.studies,campus,lod2);
  await writeFile(new URL('../public/data/old-house-module-layouts.json',import.meta.url),JSON.stringify(result.metadata,null,2)+'\n');
  await writeFile(new URL('../public/data/interior-studies.json',import.meta.url),JSON.stringify(result.studies,null,2)+'\n');
  console.log(JSON.stringify(Object.fromEntries(Object.keys(result.metadata.houses).map(house=>[house,result.metadata.houses[house].levels.map(plan=>({
    floor:plan.levelIndex,singles:plan.totals.singleCount,shared:plan.totals.sharedApartmentCount,unassignedArea:plan.totals.unassignedArea,
  }))])),null,2));
}
if(process.argv[1]===fileURLToPath(import.meta.url))await main();
