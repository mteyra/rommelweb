import {readFile, writeFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {union} from 'polyclip-ts';
import {validateInteriorStudies} from '../src/interior-studies.js';

const read = async path => JSON.parse(await readFile(new URL(`../${path}`, import.meta.url), 'utf8'));
const round = value => Math.round(value * 1e9) / 1e9;
const rect = (x, y, width, height) => [[x,y],[x+width,y],[x+width,y+height],[x,y+height],[x,y]].map(p => p.map(round));
const centre = ring => [0,1].map(axis => round((Math.min(...ring.map(p => p[axis])) + Math.max(...ring.map(p => p[axis]))) / 2));
const dimensions = {
  roomWidth: 2.7, roomDepth: 6, sideWall: 0.2, moduleWidth: 3.1,
  hallwayWidth: 1.4, stairFlightWidth: 1.3, stairWalkwayWidth: 1.4, stairWidth: 2.7,
};
const outline = [
  [0,-1.9],[7.4,-1.9],[7.4,0],[28.7,0],[28.7,-7.4],[41.1,-7.4],
  [41.1,0],[36.1,0],[36.1,12.4],[28.7,12.4],[28.7,7.4],[7.4,7.4],
  [7.4,14.8],[-1.9,14.8],[-1.9,7.4],[0,7.4],[0,-1.9],
];
const bankSpecs = [
  {id:'E', labels:['G','F','E'], x:0, y:-1.9, horizontal:false, hall:[6,-1.9,1.4,9.3], doorSide:'right'},
  {id:'N', labels:['N3','N2','N1'], x:-1.9, y:8.8, horizontal:true, hall:[-1.9,7.4,9.3,1.4], doorSide:'top'},
  {id:'R', labels:['R3','R2','R1'], x:7.4, y:0, horizontal:true, hall:[7.4,6,9.3,1.4], doorSide:'bottom'},
  {id:'L', labels:['L3','L2','L1'], x:19.4, y:1.4, horizontal:true, hall:[19.4,0,9.3,1.4], doorSide:'top'},
  {id:'A', labels:['D','C','B','A'], x:28.7, y:-7.4, horizontal:true, hall:[28.7,-1.4,12.4,1.4], doorSide:'bottom'},
  {id:'W', labels:['W4','W3','W2','W1'], x:30.1, y:0, horizontal:false, hall:[28.7,0,1.4,12.4], doorSide:'left'},
];
const notes = [
  'User-specified House 55 top-floor solution, 15 November 2026, drawn independently of the folded official exterior.',
  'Each clear room is 2.70 x 6.00 m (16.20 square metres). Its two 0.20 m side strips give a 3.10 m module, including 0.40 m between adjacent clear rooms.',
  'Hallways use the requested 1.40 m design width. The stair block uses the requested 1.30 + 1.40 = 2.70 m split.',
  'The 6.00 m room depth plus 1.40 m hallway accounts for the full 7.40 m wing depth. End-wall and hallway-wall thicknesses are not additionally allocated.',
  'The clear width is resident measured. The length, wall allocations, hall width, stair split and outline are the latest user-directed modeling assumptions.',
  'Door widths and positions, relocated window symbols, stair treads and 1.40 m landings are illustrative. No floor elevation or bathroom/kitchen partition is established.',
];

/** Exact centimetre-based plan, in the orientation of the supplied annotation. */
export function createModulePlan(previous, registration) {
  const rooms = [], wallBands = [];
  for (const bank of bankSpecs) for (const [index, label] of bank.labels.entries()) {
    const x = round(bank.x + (bank.horizontal ? index * 3.1 : 0));
    const y = round(bank.y + (bank.horizontal ? 0 : index * 3.1));
    const polygon = bank.horizontal ? rect(x+0.2,y,2.7,6) : rect(x,y+0.2,6,2.7);
    const modulePolygon = bank.horizontal ? rect(x,y,3.1,6) : rect(x,y,6,3.1);
    const sideWalls = bank.horizontal ? [rect(x,y,0.2,6),rect(x+2.9,y,0.2,6)]
      : [rect(x,y,6,0.2),rect(x,y+2.9,6,0.2)];
    sideWalls.forEach((polygon,i) => wallBands.push({id:`module-wall-${label}-${i}`,label:`${label} side wall ${i+1}`,polygon}));
    const [cx,cy] = centre(polygon);
    const doorSegment = bank.doorSide === 'top' ? [[cx-.45,y],[cx+.45,y]]
      : bank.doorSide === 'bottom' ? [[cx-.45,y+6],[cx+.45,y+6]]
        : bank.doorSide === 'left' ? [[x,cy-.45],[x,cy+.45]] : [[x+6,cy-.45],[x+6,cy+.45]];
    const windowSegment = bank.doorSide === 'top' ? [[cx-.525,y+6],[cx+.525,y+6]]
      : bank.doorSide === 'bottom' ? [[cx-.525,y],[cx+.525,y]]
        : bank.doorSide === 'left' ? [[x+6,cy-.525],[x+6,cy+.525]] : [[x,cy-.525],[x,cy+.525]];
    rooms.push({
      id:previous.spaces.find(s => s.shortLabel === label).id, label, bank:bank.id,
      polygon,modulePolygon,sideWalls,width:2.7,depth:6,area:16.2,rotation:bank.horizontal?0:90,
      doorSegment:doorSegment.map(p=>p.map(round)),windowSegment:windowSegment.map(p=>p.map(round)),
    });
  }
  const corridors = bankSpecs.map(bank => ({id:`module-hall-${bank.id}`,label:`${bank.id} bank hallway`,bank:bank.id,
    polygon:rect(...bank.hall),width:1.4}));
  const oldU=registration.localAxesInCampusXZ.x,oldV=registration.localAxesInCampusXZ.y;
  const oldLocal=previous.floorOutline.flatMap(p=>p.outer).map(p=>[oldU,oldV].map(a=>p[0]*a[0]+p[1]*a[1]));
  const oldCentre=centre(oldLocal),newCentre=centre(outline);
  const offsets=oldCentre.map((n,i)=>n+newCentre[i]);
  const coordinateFrame = {
    name:'resident-module-plan',originCampusXZ:oldU.map((v,i)=>round(v*offsets[0]+oldV[i]*offsets[1])),
    axisU:oldU.map(v=>-v),axisV:oldV.map(v=>-v),
    placement:'Rigid orientation and centering only; dimensions are not fitted or rescaled to the LoD2 shell.',
  };
  return {
    schemaVersion:1,house:'55',levelIndex:2,status:'resident-module-layout',units:'metres',
    dimensions:{...dimensions},coordinateFrame,shell:{outline:structuredClone(outline),holes:[]},rooms,corridors,wallBands,
    stair:{
      polygon:rect(16.7,0,2.7,7.4),width:2.7,length:7.4,
      flightPolygon:rect(16.7,1.4,1.3,4.6),walkwayPolygon:rect(18,0,1.4,7.4),
      landings:[{label:'Upper landing',polygon:rect(16.7,0,1.3,1.4)},{label:'Lower landing',polygon:rect(16.7,6,1.3,1.4)}],
      connectionSegments:[[[16.7,6.25],[16.7,7.15]],[[19.4,.25],[19.4,1.15]]],
    },
    outlineDimensions:outline.slice(1).map((b,i)=>({a:outline[i],b,length:round(Math.hypot(b[0]-outline[i][0],b[1]-outline[i][1]))})),
    totals:{roomCount:20,roomArea:324,sideWallArea:48,bankHallArea:86.8,stairArea:19.98,shellArea:478.78},
    notes:[...notes],
  };
}

export function createStudyLevel(plan, previous) {
  const {originCampusXZ:o,axisU:u,axisV:v}=plan.coordinateFrame;
  const point = ([x,y])=>o.map((n,i)=>round(n+x*u[i]+y*v[i]));
  const ring = r=>r.map(point);
  const eastId='study-55-2-potential-corridor-east',westId='study-55-2-potential-corridor',stairId='study-55-2-stairs';
  const eastBanks=new Set(['E','N','R']);
  const hallId=bank=>eastBanks.has(bank)?eastId:westId;
  const hallSpace = (id,label,banks)=>{
    const polygons=union(...plan.corridors.filter(c=>banks.has(c.bank)).map(c=>[c.polygon]));
    if(polygons.length!==1||polygons[0].length!==1)throw Error('Bank hallways must form one connected polygon without holes.');
    return {id,label,shortLabel:label,kind:'corridor',confidence:'estimated',
      note:'Continuous 1.40 m clear hallway in the user-specified layout.',polygon:ring(polygons[0][0])};
  };
  const spaces=plan.rooms.map(room=>({
    id:room.id,label:`Room ${room.label}`,shortLabel:room.label,kind:'room',confidence:'estimated',
    note:'Clear interior 2.70 x 6.00 m = 16.20 square metres. Two 0.20 m side walls are allocated outside it, giving a 3.10 m module. Bathroom and kitchen partitions are not yet drawn.',
    polygon:ring(room.polygon),
  }));
  spaces.push(hallSpace(eastId,'East hall',eastBanks),hallSpace(westId,'West hall',new Set(['L','A','W'])),
    {id:stairId,label:'Stairwell',shortLabel:'Stairs',kind:'stairs',confidence:'estimated',
      note:'Requested 2.70 m split: 1.30 m flight column and 1.40 m walkway. Flight run, treads, 1.40 m landings and doors are illustrative.',
      polygon:ring(plan.stair.polygon),stairFlight:ring(plan.stair.flightPolygon)});
  const doors=plan.rooms.map(room=>({id:`module-door-${room.label}`,label:`Room ${room.label} doorway`,spaceId:room.id,
    toSpaceId:hallId(room.bank),confidence:'estimated',note:'Illustrative 0.90 m doorway centred on the room-to-hall boundary.',
    segment:ring(room.doorSegment)}));
  plan.stair.connectionSegments.forEach((segment,i)=>doors.push({
    id:`module-stair-door-${i}`,label:i?'West hall stair entry':'East hall stair entry',spaceId:stairId,toSpaceId:i?westId:eastId,
    confidence:'estimated',note:'Illustrative 0.90 m doorway connecting the hall to its stair landing.',segment:ring(segment),
  }));
  const layoutWindows=plan.rooms.map(room=>({
    id:`module-window-${room.label}`,label:`Room ${room.label} window`,spaceId:room.id,confidence:'estimated',
    note:'Relocated schematic 1.05 m window in the independent module layout; the folded exterior keeps its separate source placement.',
    segment:ring(room.windowSegment),
  }));
  // Preserve the observed count of four shared openings, while labelling the
  // new drawing positions as assumptions. These never feed the folded façade.
  const sharedSegments=[
    [[6.175,-1.9],[7.225,-1.9]],[[-1.9,7.575],[-1.9,8.625]],
    [[40,0],[41.05,0]],[[28.875,12.4],[29.925,12.4]],
  ];
  sharedSegments.forEach((segment,i)=>layoutWindows.push({id:`module-window-shared-${i}`,label:`Shared window ${i+1}`,
    confidence:'estimated',note:'Schematic shared opening, relocated for this independent floor layout; not a newly measured window.',segment:ring(segment)}));
  return {
    index:2,label:'2. OG · module layout',layoutBasis:'resident-module-layout',
    source:'Resident-measured 2.70 m room width and user-prescribed 6.00 m length, 3.10 m modules, 1.40 m halls and annotated outline, 15 November 2026.',
    notes:notes.join(' '),floorOutline:[{outer:ring(plan.shell.outline)}],spaces,doors,
    windows:structuredClone(previous.windows),windowCoverage:previous.windowCoverage,layoutWindows,
    wallBands:plan.wallBands.map(b=>({...b,polygon:ring(b.polygon),confidence:'estimated',
      note:'One 0.20 m side-wall allocation. Adjacent rooms retain both allocations, totalling 0.40 m.'})),
    dimensionGuides:[],
  };
}

export function createSandbox(plan) {
  const shell=structuredClone(plan.shell);
  const rooms=plan.rooms.map(r=>{
    const [x,y]=centre(r.polygon);
    return {id:r.label,label:r.label,bank:r.bank,x,y,width:2.7,depth:6,rotation:r.rotation};
  });
  return {
    schemaVersion:1,house:'55',levelIndex:2,units:'metres',targetArea:16.2,defaultGap:0.4,
    coordinateFrame:plan.coordinateFrame,
    sourceHashes:{'public/data/house55-module-layout.json':createHash('sha256').update(JSON.stringify(plan,null,2)+'\n').digest('hex')},shell,
    shellHash:createHash('sha256').update(JSON.stringify(shell)).digest('hex'),
    shellHashMethod:'SHA-256 of the independent module shell, without rescaling.',excludedVoids:[],flatRoofGuide:{outline:[],holes:[]},
    rooms,sourcePlacement:Object.fromEntries(plan.rooms.map(r=>[r.label,{sourceId:r.id,polygon:r.polygon,status:'resident-module-layout'}])),
    banks:bankSpecs.map(b=>({id:b.id,roomIds:b.labels,axis:b.horizontal?'x':'y',
      anchor:centre(plan.rooms.find(r=>r.label===b.labels[0]).polygon),anchorStatus:'user-specified-module-centre'})),
    referenceOverlays:{
      defaultVisible:true,positionAssumed:true,status:'user-specified-module-layout',
      corridors:plan.corridors,wallBands:plan.wallBands,
      stair:{polygon:plan.stair.polygon,width:2.7,positionAssumed:true,lengthMeasured:false,
        zones:[{label:'Flight column',width:1.3,polygon:rect(16.7,0,1.3,7.4)},{label:'Level walkway',width:1.4,polygon:plan.stair.walkwayPolygon}]},
    },
    dimensions:plan.outlineDimensions,notes:plan.notes,
  };
}

async function main() {
  const [archive,provenance,studies,campus,lod2] = await Promise.all([
    read('data/source/house55-2og-before-module-layout.json'),read('data/source/house55-2og-study-provenance.json'),
    read('public/data/interior-studies.json'),read('public/data/campus.json'),read('public/data/lod2.json'),
  ]);
  const plan=createModulePlan(archive.level,provenance.registration);
  const level=createStudyLevel(plan,archive.level);
  const building=studies.buildings['55'];
  const groundFloorSource=building.levels.some(l=>l.index===0&&l.layoutBasis==='resident-module-layout')
    ? 'EG reuses the first-floor apartments and retains the blue-marked floor areas within the cinema and laundry enclosures, with an unassigned stair-side spur.'
    : 'EG retains its earlier, unverified extrapolation.';
  const lowerFloorSource=building.levels.some(l=>l.index===1&&l.layoutBasis==='resident-module-layout')
    ? `1. OG extends the same modules with four shared apartment envelopes, two enclosed balconies and the resident-annotated additions and cutouts. ${groundFloorSource}`
    : `1. OG retains its earlier, unverified extrapolation. ${groundFloorSource}`;
  building.source=`House 55 resident studies: 2. OG uses the independent 15 November 2026 module layout (2.70 × 6.00 m clear rooms, 3.10 m modules, 1.40 m hallways and 2.70 m stairwell). ${lowerFloorSource} Folded exterior window evidence is retained separately.`;
  building.levels[building.levels.findIndex(l=>l.index===2)]=level;
  validateInteriorStudies(studies,campus,lod2);
  for(const [path,data] of [
    ['public/data/house55-module-layout.json',plan],['public/data/interior-studies.json',studies],
    ['public/house55-layout/shell.json',createSandbox(plan)],
  ])await writeFile(new URL(`../${path}`,import.meta.url),JSON.stringify(data,null,2)+'\n');
  console.log('Generated House 55: 20 clear 2.70 × 6.00 m rooms, 3.10 m modules, independent 478.78 m² outline.');
}
if(process.argv[1]===fileURLToPath(import.meta.url))await main();
