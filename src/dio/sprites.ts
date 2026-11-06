// Pixel-art sprite library for the surface dioramas (side view, every sprite faces RIGHT).
// Pure data: one char per pixel, '.' = transparent; all frames of a sprite have the same size.
// Light comes from the upper left; outlines are a dark, slightly coloured shade, never pure black.
// Preview / check: node scripts/sprite-preview.mjs  ->  .snaps/sprites-sheet.png

export interface SpriteDef {
  pal: Record<string, string>;   // char -> '#rrggbb'. '.' (and ' ') are always transparent and must not be in pal
  frames: string[][];            // each frame = array of rows (strings), all rows same length, all frames same size
  ax?: number; ay?: number;      // anchor in pixels (default: bottom-centre = feet / belly on the ground)
  fps?: number;                  // animation speed (default 4)
}

export const SPRITES: Record<string, SpriteDef> = {
  // ---------------------------------------------------------------- sea life
  trilobite: {
    pal: { o: '#1e1628', d: '#4a3044', m: '#7e5244', l: '#b07c56', h: '#dcae7c' },
    frames: [
      [
        '.oooooooooooo...',
        '......ooolhhhoo.',
        '....oolmlmlhhhlo',
        '..oolhlhlhlhohlo',
        '.ohmdmdmdmdlllmo',
        '..oodmdmdmdmmmmo',
        '....oooddddmmmo.',
        '.oooooooooooo...',
      ],
    ],
  },
  hallucigenia: {
    pal: { o: '#2a1a2e', d: '#7a4a5a', m: '#b77a74', l: '#e0aa94', h: '#f4d0b0' },
    frames: [
      [
        '..o.o.o.o.o...',
        '..o.o.o.o.o...',
        '.oooooooooooo.',
        'ohllllllllllho',
        'oddddmmmmmmmlo',
        '.ooooooooooooo',
        '..d.d.d.d.d.d.',
        '.d..d.d..d..d.',
      ],
    ],
  },
  jellyfish: {
    pal: { o: '#2a2448', d: '#6a6ab0', m: '#9a9ae0', l: '#c8c4f4', h: '#f0eaff', p: '#e8a0c8' },
    frames: [
      [
        '..ooooo..',
        '.ohhlllo.',
        'ohhlllmmo',
        'olllmmmdo',
        'odddddddo',
        '.m.pdp.m.',
        '.m.dpp.m.',
        '..mpdp.m.',
        '.m.ppd..m',
        '.m..pd.m.',
        '..m.p..m.',
        '..m......',
      ],
      [
        '...ooo...',
        '..ohhlo..',
        '.ohhllmo.',
        '.ollllmo.',
        '.olllmdo.',
        '.odddddo.',
        '..m.p.m..',
        '..mpd.m..',
        '..mdp.m..',
        '..mpd.m..',
        '..m.p..m.',
        '...m.p.m.',
      ],
    ],
  },
  dickinsonia: {
    pal: { o: '#2c1c24', d: '#7a4a3c', m: '#b07050', l: '#d49a6a', h: '#ecc490' },
    frames: [
      [
        '...oooooooo...',
        '.oohlhlhlhloo.',
        'olmlmlmlmlmlmo',
        'odmdmdmdmdmdmo',
        '.oodmdmdmdmoo.',
        '...oooooooo...',
      ],
    ],
  },
  fish: {
    pal: { o: '#1a1e30', d: '#2e4a6a', m: '#5a86a8', l: '#9cc4d8', h: '#e0f0f0' },
    frames: [
      [
        '.o..oooo..',
        'omoommllo.',
        '.ommmllloo',
        'omoohhhho.',
        '.o..oooo..',
      ],
      [
        '....oooo..',
        'oo.ommllo.',
        'ommmmllloo',
        'oo.ohhhho.',
        '....oooo..',
      ],
    ],
  },
  // ---------------------------------------------------------------- variants (scratch)
  trilobite_b: {
    pal: { o: '#1e1628', d: '#4a3044', m: '#7e5244', l: '#b07c56', h: '#dcae7c', e: '#120c18' },
    frames: [
      [
        '.....ooooooo....',
        '...oohlhlhooeo..',
        '..olhlhlhlhlllo.',
        '.olmlmlmlmllllho',
        'oldmdmdmdmmlllmo',
        'odddddddddmmmmmo',
        '.oooooollllloooo',
        '..o.o.o.oooooo..',
      ],
    ],
  },
};
