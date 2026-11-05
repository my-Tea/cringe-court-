// CringeCourt palette — transcribed from the style guide image.
// A few printed hex codes were malformed; corrected to the nearest valid value
// and marked (fix) so nothing silently drifts.
export const PAL = {
  // Royal (burgundy family — the brand colour)
  royal1: '#7A1C2E', royal2: '#A32D3F', royal3: '#CE4A44', royal4: '#E07A3F', royal5: '#FFD79A',
  // Accents (teal family)
  acc1: '#2E5F73', acc2: '#3F8FA8', acc3: '#58B7C6', acc4: '#8ED8C8', acc5: '#F0F8E7',
  // Golds
  gold1: '#8B5E2A', gold2: '#B77D3A', gold3: '#D9A046', gold4: '#F6C75B', gold5: '#FFF2C7',
  // Neutrals (stone, parchment)
  neu1: '#4A3A32', neu2: '#7B645A', neu3: '#A9917D', neu4: '#DCC8B0', neu5: '#FFF9ED',
  // Greens (foliage)
  grn1: '#1F5B3A', grn2: '#3E7F50', grn3: '#6EBF73', grn4: '#A9D98F', grn5: '#DFF3D6',
  // Blues (water, glass)
  blu1: '#2F4F8F', blu2: '#4D7CC5', blu3: '#7FA9E6', blu4: '#BDF5FF', blu5: '#EAF4FF',
};

// Semantic aliases — what meshes actually reference.
export const MAT = {
  marble:      PAL.neu5,  marbleMid:  PAL.neu4,  marbleDark: PAL.neu3,
  stone:       PAL.neu3,  stoneDark:  PAL.neu2,  stoneDeep:  PAL.neu1,
  roof:        PAL.royal3, roofDark:  PAL.royal1, roofLight:  PAL.royal4,
  wood:        PAL.gold1, woodLight:  PAL.gold2,
  gold:        PAL.gold3, goldLight:  PAL.gold4, goldPale:   PAL.gold5,
  velvet:      PAL.royal1, velvetLight: PAL.royal2,
  parchment:   PAL.neu5,
  carpet:      PAL.royal2, carpetTrim: PAL.gold4,
  grass:       PAL.grn3,  grassDark:  PAL.grn2,  grassLight: PAL.grn4,
  leaf:        PAL.grn2,  leafLight:  PAL.grn3,
  water:       PAL.blu3,  waterLight: PAL.blu4,  waterDeep:  PAL.blu2,
  glass:       PAL.blu4,
  ink:         PAL.neu1,
  teal:        PAL.acc2,  tealLight:  PAL.acc3,
  // direct royal aliases (props reference these for cloth fields)
  royal1:      PAL.royal1, royal2:    PAL.royal2, royal3: PAL.royal3,
  royal4:      PAL.royal4, royal5:    PAL.royal5,
};

// One row = a material family, dark→light. Used by the tile generator so every
// surface shares a consistent ramp philosophy.
export const RAMPS = {
  marble:  [PAL.neu3, PAL.neu4, PAL.neu5],
  stone:   [PAL.neu1, PAL.neu2, PAL.neu3, PAL.neu4],
  roof:    [PAL.royal1, PAL.royal2, PAL.royal3, PAL.royal4],
  gold:    [PAL.gold1, PAL.gold3, PAL.gold4, PAL.gold5],
  wood:    [PAL.gold1, PAL.gold2, PAL.gold3],
  grass:   [PAL.grn1, PAL.grn2, PAL.grn3, PAL.grn4],
  leaf:    [PAL.grn1, PAL.grn2, PAL.grn3],
  water:   [PAL.blu1, PAL.blu2, PAL.blu3, PAL.blu4],
  velvet:  [PAL.royal1, PAL.royal2, PAL.royal3],
};
