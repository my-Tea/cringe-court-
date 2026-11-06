// Minimal types for the cc-art voxel character modules the roam cast export reads.
declare module '*/cc-art/vox-chars.mjs' {
  export interface VoxBox {
    f: [number, number, number];
    t: [number, number, number];
    m: string;
    /** Rig group: body (default), head, armR, armL, legR/legL, shinR/shinL. */
    g?: string;
    /** 3x4 affine pose matrix (row-major), present on posed boxes. */
    M?: number[];
  }
  export interface VoxCharacter {
    id: string;
    label: string;
    parts: (pose?: string, expr?: string) => VoxBox[];
  }
  export const CHARS: Readonly<Record<string, VoxCharacter>>;
  export const JUROR_VARIANTS: Readonly<Record<string, VoxCharacter>>;
}
