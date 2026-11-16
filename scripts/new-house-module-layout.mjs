import {readFile, writeFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {difference, intersection, union} from 'polyclip-ts';
import {floorSection} from '../src/sections.js';
import {getLevelElevations} from '../src/interiors.js';
import frozenExteriorReservations from '../data/source/newer-layout-exterior-reservations.json' with {type:'json'};
import {validateInteriorStudies} from '../src/interior-studies.js';

export const NEWER_HOUSES = ['49', '51a', '53a', '55a', '57a', '59a'];
export const DIMENSIONS = Object.freeze({
  singleWidth:2.92, singleDepth:7.2, sideAllocation:0.1, modulePitch:3.12,
  hallWidth:1.4, wg3Width:8.76, wg4Width:11.68, wgDepth:8,
  accessibleWidth:5, accessibleDepth:6, usableSquare:22.3, doorWidth:0.9, windowWidth:1.1,
});
const S=DIMENSIONS.usableSquare, P=DIMENSIONS.modulePitch, D=DIMENSIONS.singleDepth;
const round=n=>Math.round(n*1e9)/1e9;
const clone=value=>structuredClone(value);
const hash=value=>createHash('sha256').update(JSON.stringify(value)).digest('hex');
const rect=(x,y,w,h)=>[[x,y],[x+w,y],[x+w,y+h],[x,y+h],[x,y]].map(p=>p.map(round));
const areaRing=ring=>Math.abs(ring.slice(1).reduce((s,b,i)=>s+ring[i][0]*b[1]-b[0]*ring[i][1],0))/2;
export const polygonArea=polygons=>polygons.reduce((s,p)=>s+areaRing(p[0])-p.slice(1).reduce((a,r)=>a+areaRing(r),0),0);
const multi=polygons=>polygons.map(p=>[p.outer,...(p.holes||[])]);
const objects=polygons=>polygons.map(p=>({outer:p[0].map(q=>q.map(round)),holes:p.slice(1).map(r=>r.map(q=>q.map(round)))}));
const merged=pieces=>pieces.length?union(...pieces):[];
const outside=(ring,floor)=>polygonArea(difference([ring],floor));
const overlap=(a,b)=>b.length?polygonArea(intersection([a],b)):0;
const segment=(x,y,vertical,width=.9)=>vertical?[[x,y-width/2],[x,y+width/2]]:[[x-width/2,y],[x+width/2,y]];
const core=()=>({
  stairs:{label:'Stairs',polygon:rect(9.7,1.8,3,5.4),flightPolygon:rect(9.9,2,1.2,4.9),doorSegment:segment(11.2,7.2,false)},
  lift:{label:'Lift / risers',polygon:rect(9.7,8.6,2.2,2.2),doorSegment:segment(10.8,8.6,false)},
});

// These are existing source-ring corner indexes, not dimensions inferred from
// room numbers. The selected edge faces the split stair-elevation band. For
// Purple and Gray this band is also identified by the photographic model.
const FRONT_CORNERS={'49':[0,4],'51a':[0,3],'53a':[3,7],'55a':[0,4],'57a':[1,5],'59a':[0,4]};
export function createNewerHouseFrame(building) {
  const ground=building.groundPolygons[0],indexes=FRONT_CORNERS[building.number];
  const a=ground[indexes[0]],b=ground[indexes[1]],length=Math.hypot(b[0]-a[0],b[1]-a[1]);
  const u=[(b[0]-a[0])/length,(b[1]-a[1])/length];
  let v=[-u[1],u[0]];
  const center=ground.slice(0,-1).reduce((s,p,_,all)=>s.map((n,i)=>n+p[i]/all.length),[0,0]);
  if((center[0]-a[0])*v[0]+(center[1]-a[1])*v[1]<0)v=v.map(n=>-n);
  const project=p=>[(p[0]-a[0])*u[0]+(p[1]-a[1])*u[1],(p[0]-a[0])*v[0]+(p[1]-a[1])*v[1]];
  const projected=ground.map(project),minimum=[0,1].map(i=>Math.min(...projected.map(p=>p[i])));
  const maximum=[0,1].map(i=>Math.max(...projected.map(p=>p[i])));
  const shift=minimum.map((n,i)=>(n+maximum[i]-S)/2);
  return {
    originCampusXZ:a.map((n,i)=>n+shift[0]*u[i]+shift[1]*v[i]),axisU:u,axisV:v,
    sourceFrontCornerIndexes:indexes,sourceFrontEndpoints:clone([a,b]),
    basis:'Rigid orthonormal metre frame, centered within the retained source footprint. U follows the selected stair-side source facade; V points inward. The 22.30 m fitting square is a conservative planning frame, not a replacement outline.',
  };
}
const mapping=frame=>({
  world:p=>frame.originCampusXZ.map((n,i)=>round(n+p[0]*frame.axisU[i]+p[1]*frame.axisV[i])),
  local:p=>[frame.axisU,frame.axisV].map(a=>round((p[0]-frame.originCampusXZ[0])*a[0]+(p[1]-frame.originCampusXZ[1])*a[1])),
});

/** Preserve the exact exterior reservations used by the saved layout.
 * Later facade appearance changes must never feed back into room placement. */
export function protectedExteriorPolygons(building,levelIndex,elevations) {
  if(frozenExteriorReservations.schemaVersion!==1)throw Error('Unsupported frozen exterior reservation archive.');
  const entry=NEWER_HOUSES.includes(building?.number)&&frozenExteriorReservations.houses[building.number];
  if(!entry)throw Error(`No frozen exterior reservations for house ${building?.number}.`);
  if(hash(building)!==entry.sourceBuildingHash)throw Error(`House ${building.number}: source building differs from the saved layout reservation baseline.`);
  if(!Array.isArray(elevations)||!elevations.every(Number.isFinite)
    ||JSON.stringify(elevations)!==JSON.stringify(entry.relativeFloorElevations)){
    throw Error(`House ${building.number}: floor elevations differ from the saved layout reservation baseline.`);
  }
  if(!Number.isInteger(levelIndex)||levelIndex<0||levelIndex>=elevations.length)throw Error(`Unsupported frozen exterior reservation floor ${building.number}/${levelIndex}.`);
  if(!Array.isArray(entry.levels)||entry.levels.length!==elevations.length||hash(entry.levels)!==entry.reservationsHash){
    throw Error(`House ${building.number}: frozen exterior reservation archive is incomplete or modified.`);
  }
  return clone(entry.levels[levelIndex]);
}

function apartment({label,bank,x,y,width,depth,typology='newer-single',side}) {
  const isSingle=typology==='newer-single';
  const vertical=side==='W'||side==='E',padding=isSingle?.1:0;
  const polygon=rect(x+(vertical?0:padding),y+(vertical?padding:0),width-(vertical?0:2*padding),depth-(vertical?2*padding:0));
  const middle=[x+width/2,y+depth/2];
  const door=side==='W'?[x+width,middle[1]]:side==='E'?[x,middle[1]]:side==='N'?[middle[0],y+depth]:[middle[0],y];
  // The front end of a side hall begins behind the reserved external stair
  // frontage. Its first room has an offset entry within the same room edge.
  if(vertical&&door[1]<2.5)door[1]=2.5;
  const window=side==='W'?[x,middle[1]]:side==='E'?[x+width,middle[1]]:side==='N'?[middle[0],y]:[middle[0],y+depth];
  const count=typology==='newer-wg4'?4:typology==='newer-wg3'?3:1;
  return {label,bank,side,typology,kind:count>1?'shared':'room',capacity:count,polygon,modulePolygon:rect(x,y,width,depth),
    doorSegment:segment(...door,vertical),windowSegments:[segment(...window,vertical,1.1)],
    boundingDimensions:vertical?[round(depth-2*padding),width]:[round(width-2*padding),depth]};
}

function ordinaryCandidates() {
  const result=[];
  const single=(bank,n,x,y,side)=>apartment({label:`${bank}${n}`,bank,x,y,
    width:side==='W'||side==='E'?D:P,depth:side==='W'||side==='E'?P:D,side});
  // Complete rigid room blocks may move along their facade only. No candidate
  // slides inward away from its window edge to manufacture more capacity.
  for(const longShift of [0,.46])for(const shortShift of [0,1.56,3.12,4.34])for(const rearShift of [0,1.22]){
    const rooms=[
      ...Array.from({length:7},(_,i)=>single('E',i+1,S-D,longShift+i*P,'E')),
      ...Array.from({length:3},(_,i)=>single('W',i+1,0,shortShift+i*P,'W')),
      ...Array.from({length:4},(_,i)=>single('S',i+1,rearShift+i*P,S-D,'S')),
    ];
    const corridors=[rect(D,1.8,1.4,13.3),rect(S-D-1.4,1.8,1.4,S-1.8),rect(0,S-D-1.4,S-D,1.4),rect(D,7.2,S-2*D,1.4)];
    result.push({name:'7+4+3 perimeter banks',rooms,corridors,shiftCost:longShift+shortShift+rearShift});
  }
  for(const longShift of [0,.46])for(const rearShift of [0,1.22,3.12,4.34]){
    result.push({
      name:'7+3+4 perimeter banks',shiftCost:longShift+rearShift+.005,
      rooms:[
        ...Array.from({length:7},(_,i)=>single('W',i+1,0,longShift+i*P,'W')),
        ...Array.from({length:4},(_,i)=>single('E',i+1,S-D,i*P,'E')),
        ...Array.from({length:3},(_,i)=>single('S',i+1,8.6+rearShift+i*P,S-D,'S')),
      ],
      corridors:[rect(D,1.8,1.4,S-1.8),rect(S-D-1.4,1.8,1.4,13.3),
        rect(D,13.7,S-D,1.4),rect(D,7.2,S-2*D,1.4)],
    });
  }
  result.push({
    name:'4+4+4+2 perimeter banks',shiftCost:.01,
    rooms:[
      ...Array.from({length:4},(_,i)=>single('W',i+1,0,i*P,'W')),
      ...Array.from({length:4},(_,i)=>single('S',i+1,i*P,S-D,'S')),
      ...Array.from({length:4},(_,i)=>single('E',i+1,S-D,S-4*P+i*P,'E')),
      ...Array.from({length:2},(_,i)=>single('N',i+1,S-D+i*P,0,'N')),
    ],
    corridors:[rect(D,1.8,1.4,13.3),rect(S-D-1.4,7.2,1.4,S-7.2),
      rect(0,S-D-1.4,S-D,1.4),rect(D,7.2,S-D,1.4)],
  });
  const mirrorItem=item=>{
    const result=clone(item);
    for(const name of ['polygon','modulePolygon','doorSegment'])result[name]=item[name].map(([x,y])=>[round(S-x),y]);
    result.windowSegments=item.windowSegments.map(r=>r.map(([x,y])=>[round(S-x),y]));
    result.side=item.side==='W'?'E':item.side==='E'?'W':item.side;
    result.bank=item.bank==='W'?'E':item.bank==='E'?'W':item.bank;
    result.label=result.bank+item.label.slice(1);
    return result;
  };
  return result.flatMap(item=>[item,{...item,name:`Mirrored ${item.name}`,rooms:item.rooms.map(mirrorItem),
    corridors:item.corridors.map(r=>r.map(([x,y])=>[round(S-x),y]))}]);
}

function lowerProgram(house,index) {
  const service=(label,bank,x,y,w,h,side)=>({...apartment({label,bank,x,y,width:w,depth:h,typology:'service',side}),kind:'service',capacity:0});
  const wg=(label,side,count)=>apartment({label:label.replace('WG-',`WG${count}-`),bank:side,x:side==='E'?S-8:0,
    y:side==='S'?S-8:index===0?1.8:0,
    width:side==='S'?11.68:8,depth:side==='S'?8:count===3?8.76:11.68,typology:`newer-wg${count}`,side});
  const corridors=[rect(8,1.8,1.4,13.3),rect(S-8-1.4,1.8,1.4,13.3),rect(8,7.2,S-16,1.4),rect(0,13.7,S-8,1.4)];
  let rooms=[],name;
  if(house==='51a'&&index>0){
    rooms=[wg('WG-W','W',4),wg('WG-E','E',4),wg('WG-S','S',4)];
    name='Three whole WG4 apartments around a branching hall';
    corridors[3]=rect(0,12.9,S-8,1.4);
    corridors[0]=rect(8,1.8,1.4,12.5);corridors[1]=rect(12.9,1.8,1.4,12.5);
  }else if(house==='51a'||house==='59a'){
    name='Communal ground-floor placeholders and unassigned reserve';
    rooms=[service('Community','W',0,2.4,8,9.4,'W'),service('Service / bikes','S',0,15.1,11.68,7.2,'S')];
  }else{
    const accessible=['55a','57a'].includes(house);
    name=accessible?'Ground-floor WG3, single and accessible allowance':'Ground-floor WG4 and two singles';
    rooms=[wg('WG-W','W',accessible?3:4),apartment({label:'S1',bank:'S',x:0,y:15.1,width:P,depth:D,side:'S'})];
    if(accessible){
      rooms.push(apartment({label:'Accessible',bank:'S',x:4,y:S-6,width:5,depth:6,side:'S',typology:'newer-accessible'}));
      corridors.push(rect(5.8,15.1,1.4,1.2));
    }else rooms.push(apartment({label:'S2',bank:'S',x:P,y:15.1,width:P,depth:D,side:'S'}));
  }
  return [{name,rooms,corridors,shiftCost:0}];
}

function selectPlan(house,index,floor,reserved) {
  const elements=core(),corePolygons=Object.values(elements).map(p=>[p.polygon]);
  const prototypes=index>0&&house!=='51a'?ordinaryCandidates():lowerProgram(house,index);
  const variants=prototypes.map(prototype=>{
    const omitted=[];
    const rooms=prototype.rooms.filter(room=>{
      let reason;
      if(outside(room.modulePolygon,floor)>1e-6)reason='The entire fixed module would cross the retained source outline.';
      else if(overlap(room.modulePolygon,reserved)>1e-6)reason='The entire fixed module would overlap a protected photographed loggia, stair recess or ground frontage.';
      else if(corePolygons.some(p=>overlap(room.modulePolygon,[p])>1e-6))reason='The entire fixed module would overlap the vertically aligned core.';
      if(reason)omitted.push({label:room.label,typology:room.typology,reason});
      return !reason;
    });
    // A single continuous hallway is required. It is clipped only by existing
    // outdoor recesses; apartments are never clipped or resized.
    const hall= difference(merged(prototype.corridors.map(r=>[r])),...reserved.map(p=>[p]));
    if(hall.length!==1)return null;
    return {...prototype,rooms,omitted,hall,score:rooms.filter(r=>r.capacity).length*100-prototype.shiftCost};
  }).filter(Boolean).sort((a,b)=>b.score-a.score);
  if(!variants.length)throw Error(`No connected hall prototype for ${house}/${index}.`);
  const selected=variants[0],occupied=[...selected.rooms.map(r=>[r.modulePolygon]),...corePolygons, ...selected.hall.map(p=>p)];
  for(const [i,a] of occupied.entries()){
    if(polygonArea(difference(a,floor))>1e-6)throw Error(`${house}/${index}: occupied piece ${i} exceeds original floor.`);
    if(reserved.length&&polygonArea(intersection(a,reserved))>1e-6)throw Error(`${house}/${index}: occupied piece ${i} crosses protected exterior.`);
    for(let j=0;j<i;j++)if(polygonArea(intersection(a,occupied[j]))>1e-6)throw Error(`${house}/${index}: occupied pieces ${i} and ${j} overlap.`);
  }
  const assigned=merged(occupied),unassigned=difference(floor,assigned);
  const residences=selected.rooms.filter(r=>r.capacity),single=residences.filter(r=>r.capacity===1);
  const totals={
    singleCount:single.length,accessibleCount:single.filter(r=>r.typology==='newer-accessible').length,
    wg3Count:residences.filter(r=>r.capacity===3).length,wg4Count:residences.filter(r=>r.capacity===4).length,
    apartmentCount:residences.length,capacity:residences.reduce((n,r)=>n+r.capacity,0),
    shellArea:round(polygonArea(floor)),assignedArea:round(polygonArea(assigned)),unassignedArea:round(polygonArea(unassigned)),
    residentialBoundingArea:round(residences.reduce((n,r)=>n+areaRing(r.polygon),0)),
    hallArea:round(polygonArea(selected.hall)),protectedExteriorArea:round(polygonArea(reserved)),
  };
  return {
    levelIndex:index,status:'provisional-fit-for-site-check',prototype:selected.name,
    rooms:selected.rooms.filter(r=>r.kind!=='service'),commonAreas:selected.rooms.filter(r=>r.kind==='service'),
    core:elements,corridorStrips:selected.corridors,corridorPolygons:objects(selected.hall),omittedModules:selected.omitted,
    unassignedPolygons:objects(unassigned),protectedExteriorPolygons:objects(reserved),totals,
  };
}

/** A rectangle swept along each proposed hall centerline proves a continuous
 * 1.40 m strip from every envelope entry to the core, including after photo
 * recess clipping. This is geometric QA, not an accessibility/egress approval. */
export function auditHallRoutes(plan) {
  const hall=multi(plan.corridorPolygons),radius=.7;
  const lines=plan.corridorStrips.map(r=>{
    const xs=r.map(p=>p[0]),ys=r.map(p=>p[1]),x0=Math.min(...xs),x1=Math.max(...xs),y0=Math.min(...ys),y1=Math.max(...ys);
    const vertical=Math.abs(x1-x0-1.4)<1e-7;
    return {vertical,fixed:round(vertical?(x0+x1)/2:(y0+y1)/2),
      start:round((vertical?y0:x0)-radius),end:round((vertical?y1:x1)+radius),points:[]};
  });
  const key=p=>p.map(round).join(',');
  const nodes=new Map();
  const add=p=>{
    p=p.map(round);
    if(polygonArea(difference([rect(p[0]-.7,p[1]-.7,1.4,1.4)],hall))>1e-6)return;
    const k=key(p);
    if(!nodes.has(k))nodes.set(k,{point:p,neighbors:new Set()});
    for(const line of lines){
      const axis=line.vertical?1:0;
      if(Math.abs(p[1-axis]-line.fixed)<1e-7&&p[axis]>=line.start-1e-7&&p[axis]<=line.end+1e-7)line.points.push(p);
    }
  };
  for(const line of lines)for(const t of [line.start,line.end])add(line.vertical?[line.fixed,t]:[t,line.fixed]);
  for(const a of lines)for(const b of lines)if(a.vertical&&!b.vertical
    &&b.fixed>=a.start&&b.fixed<=a.end&&a.fixed>=b.start&&a.fixed<=b.end)add([a.fixed,b.fixed]);
  const targets=[...plan.rooms,...plan.commonAreas].map(room=>{
    const midpoint=room.doorSegment[0].map((n,i)=>(n+room.doorSegment[1][i])/2);
    const normal={W:[1,0],E:[-1,0],N:[0,1],S:[0,-1]}[room.side];
    return {label:room.label,point:midpoint.map((n,i)=>round(n+normal[i]*radius))};
  });
  targets.push({label:'Stairs',point:[11.2,7.9]},{label:'Lift / risers',point:[10.8,7.9]});
  targets.forEach(t=>add(t.point));
  for(const line of lines){
    const axis=line.vertical?1:0,points=[...new Map(line.points.map(p=>[key(p),p])).values()].sort((a,b)=>a[axis]-b[axis]);
    for(let i=1;i<points.length;i++){
      const a=points[i-1],b=points[i];
      const swept=rect(Math.min(a[0],b[0])-radius,Math.min(a[1],b[1])-radius,
        Math.abs(b[0]-a[0])+2*radius,Math.abs(b[1]-a[1])+2*radius);
      if(polygonArea(difference([swept],hall))>1e-6)continue;
      nodes.get(key(a)).neighbors.add(key(b));nodes.get(key(b)).neighbors.add(key(a));
    }
  }
  const visited=new Set(),queue=[key([11.2,7.9])];
  while(queue.length){
    const k=queue.shift();if(visited.has(k))continue;visited.add(k);
    for(const next of nodes.get(k)?.neighbors||[])if(!visited.has(next))queue.push(next);
  }
  const inaccessible=targets.filter(t=>!visited.has(key(t.point))).map(t=>t.label);
  if(inaccessible.length)throw Error(`Floor ${plan.levelIndex}: no continuous 1.40 m hall strip to ${inaccessible.join(', ')}.`);
  return {testedWidth:1.4,connectedEntrances:targets.length,status:'continuous-provisional-hall-strips',
    note:'Swept rectangular hall-clearance check only; actual doors, turns, lifts, accessibility and evacuation remain unverified.'};
}

const SPACE_NOTES={
  'newer-single':'Estimated 2.92 x 7.20 m apartment bounding rectangle from the resident room sketch; it includes internal partitions and is not surveyed net or rented area. The 0.10 m allowance on each side and all floor positions are planning assumptions.',
  'newer-accessible':'Estimated 5.00 x 6.00 m bounding allowance for an accessible single. Neither this position nor its geometry is measured, and no accessible turning space, door clearance or route is certified.',
  'newer-wg3':'Estimated whole 3-person WG apartment, 8.76 x 8.00 m. Dimensions, position and aspect ratio are planning assumptions informed by category area budgets. Bedrooms, bathrooms and kitchen are intentionally not invented.',
  'newer-wg4':'Estimated whole 4-person WG apartment, 11.68 x 8.00 m. Dimensions, position and aspect ratio are planning assumptions informed by category area budgets. Bedrooms, bathrooms and kitchen are intentionally not invented.',
  service:'Illustrative communal or service envelope. Ground-floor mixed uses are documented, but this particular use, position, size and partition are unverified. Remaining source-floor space stays gray.',
};
function studyLevel(house,index,section,plan,frame) {
  const prefix=`newer-${house}-${index}`,{world}=mapping(frame),ring=r=>r.map(world);
  const privateItems=[...plan.rooms,...plan.commonAreas];
  const spaces=privateItems.map(item=>({
    id:`${prefix}-${item.label.replaceAll(' / ','-').replaceAll(' ','-')}`,label:item.kind==='service'?item.label:item.kind==='shared'?`Whole apartment ${item.label}`:`Apartment ${item.label}`,
    shortLabel:item.label,kind:item.kind,...(item.kind!=='service'?{typology:item.typology}:{}),
    confidence:'estimated',note:SPACE_NOTES[item.typology],polygon:ring(item.polygon),
  }));
  const hallId=`${prefix}-hall`;
  spaces.push({id:hallId,label:'Branching hall',shortLabel:'Hall',kind:'corridor',confidence:'estimated',
    note:'Connected provisional circulation branches based on 1.40 m strips. Existing photographic outdoor recesses remain reserved. No as-built access or evacuation route is established.',
    polygon:ring(plan.corridorPolygons[0].outer),holes:plan.corridorPolygons[0].holes.map(ring)});
  for(const [kind,item] of Object.entries(plan.core))spaces.push({
    id:`${prefix}-${kind}`,label:item.label,shortLabel:kind==='stairs'?'Stairs':'Lift / risers',kind,confidence:'estimated',
    note:'Unmeasured core allowance, kept at identical coordinates on every floor of this house behind its selected stair-side facade. Shaft dimensions and internal connection to the external stair require inspection.',
    polygon:ring(item.polygon),...(kind==='stairs'?{stairFlight:ring(item.flightPolygon)}:{}),
  });
  const doors=privateItems.map((item,i)=>({
    id:`${prefix}-door-${i}`,label:`${item.label} estimated entry`,spaceId:spaces[i].id,toSpaceId:hallId,confidence:'estimated',
    note:'One schematic 0.90 m entrance for this whole envelope on the proposed hall boundary; no real room number or occupant association.',
    segment:ring(item.doorSegment),
  }));
  for(const [kind,item] of Object.entries(plan.core))doors.push({
    id:`${prefix}-door-${kind}`,label:`${item.label} estimated entry`,spaceId:`${prefix}-${kind}`,toSpaceId:hallId,confidence:'estimated',
    note:'Schematic 0.90 m connection to the vertically aligned core allowance.',segment:ring(item.doorSegment),
  });
  const layoutWindows=privateItems.flatMap((item,i)=>item.windowSegments.map((segment,j)=>({
    id:`${prefix}-window-${i}-${j}`,label:`${item.label} facade opening cue`,spaceId:spaces[i].id,confidence:'estimated',
    note:'Schematic 1.10 m facade-facing opening cue only. The physical folded facade retains its independent source and photograph-based window model; this is not a measured opening schedule.',
    segment:ring(segment),
  })));
  const wallBands=plan.rooms.filter(r=>r.typology==='newer-single').flatMap((room,i)=>
    difference([room.modulePolygon],[room.polygon]).map((p,j)=>({
      id:`${prefix}-wall-${i}-${j}`,label:`${room.label} side allowance`,confidence:'estimated',
      note:'Estimated 0.10 m side allocation; adjacent module allowances total 0.20 m. This is not a measured partition thickness.',
      polygon:ring(p[0]),holes:p.slice(1).map(ring),
    })));
  return {
    index,label:`${index===0?'EG':`${index}. OG`} · provisional newer modules`,layoutBasis:'fitted-newer-module-layout',
    source:'Resident new-room bounding sketch, public apartment categories, aggregate orientation counts and architect circulation principles; provisional packing on 16 November 2026.',
    notes:`Estimated ${plan.prototype.toLowerCase()}. ${plan.totals.singleCount} single and ${plan.totals.wg3Count+plan.totals.wg4Count} whole WG candidates are fitted. `
      +`${plan.totals.unassignedArea.toFixed(2)} m² of the original source floor remains gray, including protected exterior recesses. `
      +'Every per-house use and position is a field-check hypothesis. The overall capacity scenario is not a verified room inventory; missing aggregate marker coverage never establishes an empty floor. Apartment areas are bounding envelopes, not rented or net areas.',
    floorOutline:clone(section.polygons),spaces,doors,layoutWindows,wallBands,dimensionGuides:[],
  };
}

/** Build only the newer provisional layer; source sections and all old studies
 * are retained verbatim and no resident/room-marker records are read here. */
export function createNewHouseModuleLayouts({studies,lod2,campus,interiors}) {
  const result=clone(studies),metadata={
    schemaVersion:1,status:'provisional-fit-for-site-check',sourceDate:'2026-11-16',units:'metres',
    dimensions:clone(DIMENSIONS),sourceHashes:{lod2:hash(lod2),campus:hash(campus),interiors:hash(interiors)},
    scenarioTarget:{singlesIncludingAccessible:372,accessibleSingles:2,wg3Count:2,wg4Count:8,wgPlaces:38,totalPlaces:410},
    notes:[
      'The resident sketch establishes only a 2.92 x 7.20 m full apartment bounding rectangle, including internal partitions; its living zone is 2.92 x 3.50 m. Rented category areas are not equivalent.',
      'Every placement, circulation dimension, side allocation, WG rectangle and accessible allowance is an estimate. WG shapes are whole apartments without invented bedroom plans.',
      'The nominal capacity scenario distributes public totals across buildings as an explicit field-check hypothesis, never a confirmed per-house mapping. Full candidates conflicting with retained outlines or existing photographic recesses are omitted, so actual fitted capacity may be lower.',
      'All source floor sections, folded surfaces, photographic details, source window patterns, floor elevations and old-house study objects remain unchanged. Residual area stays gray.',
      'The 51a communal ground floor and its proposed upper WG grouping, and all lower-floor room allocations, require inspection. Absent room-marker coverage does not imply no dwellings.',
    ],houses:{},
  };
  for(const house of NEWER_HOUSES){
    const building=lod2.buildings.find(b=>b.number===house),count=campus.buildings.find(b=>b.number===house)?.levels;
    if(!building||!count)throw Error(`Missing newer source building ${house}.`);
    const frame=createNewerHouseFrame(building),{local}=mapping(frame);
    const elevations=getLevelElevations(interiors,house,count,building.height);
    const plans=[],levels=[];
    for(let index=0;index<count;index++){
      const section=floorSection(building,elevations[index]);
      const floor=multi(section.polygons).map(p=>p.map(r=>r.map(local)));
      if(outside(rect(0,0,S,S),floor)>1e-6)throw Error(`The conservative planning frame exceeds House ${house}.`);
      const protectedExterior=protectedExteriorPolygons(building,index,elevations);
      const reserved=protectedExterior.polygons.map(p=>p.map(r=>r.map(local)));
      const plan=selectPlan(house,index,floor,reserved);
      plan.hallRouteAudit=auditHallRoutes(plan);
      plan.floorOutlineHash=hash(section.polygons);
      plan.relativeFloorElevation=elevations[index];
      plan.protectedExteriorFeatures=protectedExterior.features;
      plans.push(plan);levels.push(studyLevel(house,index,section,plan,frame));
    }
    result.buildings[house]={
      sourceDate:'2026-11-16',
      source:'Provisional newer-house apartment envelopes fitted inside unchanged source floor sections. Public program totals inform an illustrative allocation only; gray remainder, all room identities, exact partitions and service uses await an in-person check.',
      levels,
    };
    metadata.houses[house]={coordinateFrame:frame,levels:plans};
  }
  const totals=Object.values(metadata.houses).flatMap(h=>h.levels).map(p=>p.totals);
  metadata.fittedTotals=Object.fromEntries(['singleCount','accessibleCount','wg3Count','wg4Count','apartmentCount','capacity'].map(key=>[key,totals.reduce((n,t)=>n+t[key],0)]));
  metadata.fittedTotals.wgPlaces=metadata.fittedTotals.wg3Count*3+metadata.fittedTotals.wg4Count*4;
  metadata.fittedTotals.omittedSingleCandidates=metadata.scenarioTarget.singlesIncludingAccessible-metadata.fittedTotals.singleCount;
  return {studies:result,metadata};
}

async function main(){
  const read=async p=>JSON.parse(await readFile(new URL(`../public/data/${p}.json`,import.meta.url),'utf8'));
  const [studies,lod2,campus,interiors]=await Promise.all(['interior-studies','lod2','campus','interiors'].map(read));
  const result=createNewHouseModuleLayouts({studies,lod2,campus,interiors});
  validateInteriorStudies(result.studies,campus,lod2);
  await writeFile(new URL('../public/data/new-house-module-layouts.json',import.meta.url),JSON.stringify(result.metadata,null,2)+'\n');
  await writeFile(new URL('../public/data/interior-studies.json',import.meta.url),JSON.stringify(result.studies,null,2)+'\n');
  console.log(JSON.stringify({totals:result.metadata.fittedTotals,houses:Object.fromEntries(Object.entries(result.metadata.houses).map(([n,h])=>[n,h.levels.map(p=>({
    floor:p.levelIndex,prototype:p.prototype,...p.totals,omitted:p.omittedModules.map(r=>r.label),
  }))]))},null,2));
}
if(process.argv[1]===fileURLToPath(import.meta.url))await main();
