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
  // Cambrian trilobite seen from above (head right): glabella, crescent eyes, genal spines, segmented thorax
  trilobite: {
    pal: { o: '#1e1628', d: '#4a3044', m: '#7e5244', l: '#b07c56', h: '#dcae7c', e: '#120c18' },
    frames: [
      [
        '....oooooooooo....',
        '..d...omlmldlhoo..',
        '..oooolmlmldleelo.',
        '.olmlmlmlmldhhhhlo',
        'olhlhlhlhlhdhhlllo',
        'omlmlmlmlmldlllmmo',
        '.omdmdmdmdmdmmmmdo',
        '..oooomdmdmdmeemo.',
        '.d....odmdmdmdoo..',
        '....oooooooooo....',
      ],
      [
        '....oooooooooo....',
        '.d....omlmldlhoo..',
        '..oooolmlmldleelo.',
        '.olmlmlmlmldhhhhlo',
        'olhlhlhlhlhdhhlllo',
        'omlmlmlmlmldlllmmo',
        '.omdmdmdmdmdmmmmdo',
        '..oooomdmdmdmeemo.',
        '..d...odmdmdmdoo..',
        '....oooooooooo....',
      ],
    ],
  },
  // Anomalocaris: frontal grasping appendages, stalked eyes, lateral swimming flaps, tail fan
  anomalocaris: {
    pal: { o: '#2c1024', d: '#702440', m: '#b0403e', l: '#e0704a', h: '#f6b07a', e: '#141018', w: '#f8e8c8' },
    fps: 4,
    frames: [
      [
        '........................ooo.......',
        '.oo......oooooooo.ooooooeeeo......',
        'omloo...ommmmmmmmommmmmmeeeo......',
        '.omllo.odddddddddmdddddddmmoo.....',
        '..odlloooddhhhhhhhhhhhhhhllhho....',
        '.ooommhhhhhlllllllllllhlllllllo...',
        'ommlmmmmmlllmmmmmmmlllllllmmmmoo..',
        '.oommmmdddmmmmmmmmmmmmmmmmmmoollo.',
        '..ommddoooooooooooooooooooddommmlo',
        '.olmdoommmmmmmmmmmmmmmmmmdoooooomo',
        'olmmo..odddmmdddmmddddmmdo....olmo',
        'omoo....oooddoooddooooddo....ollmo',
        '.o.........oo...oo....oo....olmmo.',
        '.............................ooo..',
      ],
      [
        '........................ooo.......',
        '.oo.....oooooooooo.oooooeeeo......',
        'omloo..ommmmmmmmmmommmmmeeeo......',
        '.omllo.oddddddddddmddddddmmoo.....',
        '..odllooooohhhhhhhhhhhhhhllhho....',
        '.ooommhhhhhlllllllllllhlllllllo...',
        'ommlmmmmmlllmmmmmmmlllllllmmmmoo..',
        '.oommmmdddmmmmmmmmmmmmmmmmmmoollo.',
        '..ommddoooooooooooooooooooddommmlo',
        '.olmdooommmmmmmmmmmmmmmmmooooooomo',
        'olmmo.ommmddddmddddmmddddo....olmo',
        'omoo...oddoooodooooddoooo....ollmo',
        '.o......oo....o....oo.......olmmo.',
        '.............................ooo..',
      ],
    ],
  },
  hallucigenia: {
    pal: { o: '#2a1a2e', d: '#7a4a5a', m: '#b77a74', l: '#e0aa94', h: '#f4d0b0', s: '#c4646a', e: '#120c18' },
    frames: [
      [
        '..h.h.h.h.h...',
        '..s.s.s.s.s...',
        '.ooooooooooo..',
        'olhhllllllllo.',
        'ommmmmmmmmmleo',
        '.oooooooooommo',
        '..d.d.d.d.doo.',
        '.d.d.d.d.d....',
      ],
      [
        '..h.h.h.h.h...',
        '..s.s.s.s.s...',
        '.ooooooooooo..',
        'olhhllllllllo.',
        'ommmmmmmmmmleo',
        '.oooooooooommo',
        '..d.d.d.d.doo.',
        '...d.d.d.d.d..',
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
};
