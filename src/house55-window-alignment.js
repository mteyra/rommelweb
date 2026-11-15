import {surfaceFrame} from './facade.js';

/**
 * Display-only refinements from the resident's November 2026 photographs.
 * Indices identify retained LoD2 wall records. None of these row targets edits
 * the saved window inventory, interior plans, floor heights or source shell.
 */
export const HOUSE55_WINDOW_ALIGNMENT = Object.freeze({
  rearRoomWall: 16,
  steppedReturnWall: 28,
  courtyardRoomWall: 4,
  entranceRoomWall: 36,
  alignedRoomWalls: Object.freeze([0,5,43]),
  extraRearLowerCenter: 1.60,
  retainedEastGroundCenter: 2.2699939290986775,
  steppedReturnCenter: 4.80,
  evidence: 'Backside photograph: four upper openings over five aligned lower openings, with one lower window stack on the stepped return. Entrance photographs: aligned room stacks, with the nearest entrance-side column present only upstairs. The remaining ordinary room faces reuse their saved top-row centers for lower-row alignment; their counts and extra ground opening are retained. Centers on previously located columns retain the saved top-row alignment; additional photographed offsets are visual estimates in source-wall metres.',
});

// Fallbacks retain the previous top-row centers when study records are not
// loaded. Values are local to each unchanged source wall's surfaceFrame.
const REFERENCES = Object.freeze({
  0: Object.freeze([
    ['study-55-2-window-L1', 9.81208446946058],
    ['study-55-2-window-L2', 6.871252141956906],
    ['study-55-2-window-L3', 3.9304194768215526],
  ]),
  4: Object.freeze([
    ['study-55-2-window-A', -19.25367009499973],
    ['study-55-2-window-B', -16.417519380125164],
    ['study-55-2-window-C', -13.302402359645223],
    ['study-55-2-window-D', -10.233780250620148],
  ]),
  16: Object.freeze([
    ['study-55-2-window-W1', 4.2719754351243875],
    ['study-55-2-window-W2', 7.453596135164709],
    ['study-55-2-window-W3', 10.545593785704938],
    ['study-55-2-window-W4', 13.279098531769469],
  ]),
  5: Object.freeze([
    ['study-55-2-window-E', 12.494777343336393],
    ['study-55-2-window-F', 9.806084154411984],
    ['study-55-2-window-G', 6.8485216864054035],
  ]),
  36: Object.freeze([
    ['study-55-2-window-R1', -6.941154133148644],
    ['study-55-2-window-R2', -4.1979924961082435],
    ['study-55-2-window-R3', -1.826785633528261],
  ]),
  43: Object.freeze([
    ['study-55-2-window-N1', 10.35373648737525],
    ['study-55-2-window-N2', 7.424593054156316],
    ['study-55-2-window-N3', 4.35596773310642],
  ]),
});

/** Build appearance rows without changing any supplied geometry or records. */
export function createHouse55WindowAlignment(surfaces, locatedLevels = []) {
  const layouts = new Map();
  const top = locatedLevels.find(level=>level.index===2);
  const referenceCenters = index => {
    const frame=surfaceFrame(surfaces[index]);
    return REFERENCES[index].map(([id,fallback])=>{
      const window=top?.windows?.find(window=>window.id===id&&window.sourceSurfaceIndex===index);
      const center = window
        ? window.segment.reduce((sum,[x,z])=>sum+((x-frame.origin[0])*frame.u[0]+(z-frame.origin[2])*frame.u[2])/2,0)
        : fallback;
      return Math.round(center*1e9)/1e9;
    });
  };
  for(const index of [0,4,5,16,28,36,43]){
    const surface=surfaces[index];
    if(!surface||surface.type!=='WallSurface'||!surfaceFrame(surface))
      throw Error(`House 55 photographic alignment requires retained wall ${index}.`);
    let rows;
    if(index===28){
      rows=[0,1].map(floor=>({floor,centers:[HOUSE55_WINDOW_ALIGNMENT.steppedReturnCenter]}));
      // The high portion of this photographed stepped return is blank. Keep
      // its historical west-hall record in data, while suppressing that one
      // opening only in the folded appearance.
      rows.push({floor:2,centers:[],disabled:true});
    }else{
      const upper=referenceCenters(index);
      const lower=index===16?[HOUSE55_WINDOW_ALIGNMENT.extraRearLowerCenter,...upper]
        :index===36?upper.slice(1):upper;
      // The eastern wing already has one additional ground opening beneath
      // its low roof step. Retain it at its existing position while aligning
      // the three ordinary room columns above and beside it.
      const ground=index===5?[HOUSE55_WINDOW_ALIGNMENT.retainedEastGroundCenter,...lower]:lower;
      rows=[{floor:0,centers:[...ground]},{floor:1,centers:[...lower]},{floor:2,centers:[...upper]}];
    }
    layouts.set(surface,{
      replace:false,rows,replaceLocatedFloors:index===28?[2]:[],
      evidence:HOUSE55_WINDOW_ALIGNMENT.evidence,
    });
  }
  return layouts;
}
