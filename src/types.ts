/**
 * TypeScript types for Aseprite file format.
 * Based on the official Aseprite file format specification.
 * @module
 */

// =============================================================================
// Constants and Enums
// =============================================================================

/** File magic number for Aseprite files */
export const ASE_FILE_MAGIC = 0xa5e0;

/** Frame magic number */
export const ASE_FRAME_MAGIC = 0xf1fa;

/** Color depth values */
export const ColorDepth = {
  RGBA: 32,
  Grayscale: 16,
  Indexed: 8,
} as const;

export type ColorDepth = (typeof ColorDepth)[keyof typeof ColorDepth];

/** Layer types */
export const LayerType = {
  Normal: 0,
  Group: 1,
  Tilemap: 2,
} as const;

export type LayerType = (typeof LayerType)[keyof typeof LayerType];

/** Layer flags */
export const LayerFlags = {
  Visible: 1,
  Editable: 2,
  LockMovement: 4,
  Background: 8,
  PreferLinkedCels: 16,
  DisplayCollapsed: 32,
  Reference: 64,
} as const;

/** Layer blend modes */
export const BlendMode = {
  Normal: 0,
  Multiply: 1,
  Screen: 2,
  Overlay: 3,
  Darken: 4,
  Lighten: 5,
  ColorDodge: 6,
  ColorBurn: 7,
  HardLight: 8,
  SoftLight: 9,
  Difference: 10,
  Exclusion: 11,
  Hue: 12,
  Saturation: 13,
  Color: 14,
  Luminosity: 15,
  Addition: 16,
  Subtract: 17,
  Divide: 18,
} as const;

export type BlendMode = (typeof BlendMode)[keyof typeof BlendMode];

/** Cel types */
export const CelType = {
  RawImage: 0,
  Linked: 1,
  CompressedImage: 2,
  CompressedTilemap: 3,
} as const;

export type CelType = (typeof CelType)[keyof typeof CelType];

/** Tag animation direction */
export const TagDirection = {
  Forward: 0,
  Reverse: 1,
  PingPong: 2,
  PingPongReverse: 3,
} as const;

export type TagDirection = (typeof TagDirection)[keyof typeof TagDirection];

/** Slice flags */
export const SliceFlags = {
  Has9Patch: 1,
  HasPivot: 2,
} as const;

/** Color profile types */
export const ColorProfileType = {
  None: 0,
  sRGB: 1,
  EmbeddedICC: 2,
} as const;

export type ColorProfileType =
  (typeof ColorProfileType)[keyof typeof ColorProfileType];

/** External file types */
export const ExternalFileType = {
  ExternalPalette: 0,
  ExternalTileset: 1,
  PropertiesExtension: 2,
  TileManagement: 3,
} as const;

export type ExternalFileType =
  (typeof ExternalFileType)[keyof typeof ExternalFileType];

/** User data property types */
export const PropertyType = {
  Null: 0x0000,
  Bool: 0x0001,
  Int8: 0x0002,
  Uint8: 0x0003,
  Int16: 0x0004,
  Uint16: 0x0005,
  Int32: 0x0006,
  Uint32: 0x0007,
  Int64: 0x0008,
  Uint64: 0x0009,
  Fixed: 0x000a,
  Float: 0x000b,
  Double: 0x000c,
  String: 0x000d,
  Point: 0x000e,
  Size: 0x000f,
  Rect: 0x0010,
  Vector: 0x0011,
  PropertiesMap: 0x0012,
  UUID: 0x0013,
} as const;

export type PropertyType = (typeof PropertyType)[keyof typeof PropertyType];

/** Chunk type identifiers */
export const ChunkType = {
  OldPalette1: 0x0004,
  OldPalette2: 0x0011,
  Layer: 0x2004,
  Cel: 0x2005,
  CelExtra: 0x2006,
  ColorProfile: 0x2007,
  ExternalFiles: 0x2008,
  Mask: 0x2016, // Deprecated
  Path: 0x2017, // Never used
  Tags: 0x2018,
  Palette: 0x2019,
  UserData: 0x2020,
  Slice: 0x2022,
  Tileset: 0x2023,
} as const;

export type ChunkType = (typeof ChunkType)[keyof typeof ChunkType];

// =============================================================================
// Header Types
// =============================================================================

/** Aseprite file header (128 bytes) */
export interface AseHeader {
  /** File size in bytes */
  fileSize: number;
  /** Magic number (should be 0xA5E0) */
  magic: number;
  /** Number of frames */
  frameCount: number;
  /** Sprite width in pixels */
  width: number;
  /** Sprite height in pixels */
  height: number;
  /** Color depth (8, 16, or 32 bits per pixel) */
  colorDepth: ColorDepth;
  /** Header flags */
  flags: number;
  /** Deprecated speed (use frame duration instead) */
  speed: number;
  /** Transparent color index (for indexed color mode) */
  transparentIndex: number;
  /** Number of colors (0 means 256 for old sprites) */
  colorCount: number;
  /** Pixel width (pixel ratio) */
  pixelWidth: number;
  /** Pixel height (pixel ratio) */
  pixelHeight: number;
  /** Grid X position */
  gridX: number;
  /** Grid Y position */
  gridY: number;
  /** Grid width */
  gridWidth: number;
  /** Grid height */
  gridHeight: number;
}

/** Header flags */
export const HeaderFlags = {
  /** Layer opacity is valid */
  LayerOpacityValid: 1,
} as const;

// =============================================================================
// Frame Types
// =============================================================================

/** Frame header */
export interface FrameHeader {
  /** Frame size in bytes */
  frameSize: number;
  /** Magic number (should be 0xF1FA) */
  magic: number;
  /** Old chunk count (may be 0xFFFF if using new count) */
  oldChunkCount: number;
  /** Frame duration in milliseconds */
  durationMs: number;
  /** New chunk count (0 means use old count) */
  newChunkCount: number;
}

/** A frame in the animation */
export interface Frame {
  /** Frame duration in milliseconds */
  durationMs: number;
  /** Cels in this frame */
  cels: Cel[];
  /** Raw chunks (preserved for round-trip) */
  chunks?: Chunk[];
}

// =============================================================================
// Layer Types
// =============================================================================

/** Layer definition */
export interface Layer {
  /** Layer flags */
  flags: number;
  /** Layer type */
  type: LayerType;
  /** Child level (for hierarchy) */
  childLevel: number;
  /** Default layer width (ignored) */
  defaultWidth: number;
  /** Default layer height (ignored) */
  defaultHeight: number;
  /** Blend mode */
  blendMode: BlendMode;
  /** Layer opacity (0-255) */
  opacity: number;
  /** Layer name */
  name: string;
  /** Tileset index (for tilemap layers) */
  tilesetIndex?: number;
  /** User data attached to this layer */
  userData?: UserData;
}

// =============================================================================
// Cel Types
// =============================================================================

/** Compressed or raw image data */
export interface CelImageData {
  /** Data format */
  kind: "raw" | "zlib";
  /** Raw or compressed bytes */
  bytes: Uint8Array;
  /** Decoded pixel data (if decompressed) */
  decoded?: Uint8Array;
}

/** Base cel properties */
export interface CelBase {
  /** Layer index this cel belongs to */
  layerIndex: number;
  /** X position */
  x: number;
  /** Y position */
  y: number;
  /** Opacity (0-255) */
  opacity: number;
  /** Z-index for render ordering */
  zIndex: number;
  /** User data attached to this cel */
  userData?: UserData;
  /** Extra cel data */
  extra?: CelExtra;
}

/** Raw image cel */
export interface RawImageCel extends CelBase {
  type: typeof CelType.RawImage;
  width: number;
  height: number;
  data: CelImageData;
}

/** Linked cel (references another frame) */
export interface LinkedCel extends CelBase {
  type: typeof CelType.Linked;
  linkedFrameIndex: number;
}

/** Compressed image cel */
export interface CompressedImageCel extends CelBase {
  type: typeof CelType.CompressedImage;
  width: number;
  height: number;
  data: CelImageData;
}

/** Tilemap bitmask configuration */
export interface TilemapMasks {
  /** Bitmask for tile ID */
  tileIdMask: number;
  /** Bitmask for X flip */
  xFlipMask: number;
  /** Bitmask for Y flip */
  yFlipMask: number;
  /** Bitmask for 90CW rotation */
  rotationMask: number;
}

/** Compressed tilemap cel */
export interface CompressedTilemapCel extends CelBase {
  type: typeof CelType.CompressedTilemap;
  /** Width in tiles */
  width: number;
  /** Height in tiles */
  height: number;
  /** Bits per tile */
  bitsPerTile: number;
  /** Tilemap masks */
  masks: TilemapMasks;
  /** Compressed tile data */
  data: CelImageData;
  /** Decoded tile array */
  decodedTiles?: Uint32Array;
}

/** Union of all cel types */
export type Cel =
  | RawImageCel
  | LinkedCel
  | CompressedImageCel
  | CompressedTilemapCel;

/** Extra cel information */
export interface CelExtra {
  /** Flags */
  flags: number;
  /** Precise X position */
  preciseX: number;
  /** Precise Y position */
  preciseY: number;
  /** Width of cel in sprite */
  celWidth: number;
  /** Height of cel in sprite */
  celHeight: number;
}

// =============================================================================
// Palette Types
// =============================================================================

/** A single color entry */
export interface PaletteEntry {
  /** Red component (0-255) */
  r: number;
  /** Green component (0-255) */
  g: number;
  /** Blue component (0-255) */
  b: number;
  /** Alpha component (0-255) */
  a: number;
  /** Color name (optional) */
  name?: string;
}

/** Palette data */
export interface Palette {
  /** Palette size */
  size: number;
  /** First color index to change */
  firstIndex: number;
  /** Last color index to change */
  lastIndex: number;
  /** Color entries */
  entries: PaletteEntry[];
}

// =============================================================================
// Tag Types
// =============================================================================

/** Animation tag */
export interface Tag {
  /** First frame index */
  fromFrame: number;
  /** Last frame index */
  toFrame: number;
  /** Animation direction */
  direction: TagDirection;
  /** Repeat count (0 = infinite) */
  repeat: number;
  /** Tag color (RGB) */
  color: { r: number; g: number; b: number };
  /** Tag name */
  name: string;
  /** User data attached to this tag */
  userData?: UserData;
}

// =============================================================================
// Slice Types
// =============================================================================

/** Slice key (bounds at a specific frame) */
export interface SliceKey {
  /** Frame index */
  frameIndex: number;
  /** X origin */
  x: number;
  /** Y origin */
  y: number;
  /** Width */
  width: number;
  /** Height */
  height: number;
  /** 9-patch center bounds (if has9Patch) */
  center?: { x: number; y: number; width: number; height: number };
  /** Pivot point (if hasPivot) */
  pivot?: { x: number; y: number };
}

/** Slice definition */
export interface Slice {
  /** Slice name */
  name: string;
  /** Slice flags */
  flags: number;
  /** Slice keys */
  keys: SliceKey[];
  /** User data attached to this slice */
  userData?: UserData;
}

// =============================================================================
// Tileset Types
// =============================================================================

/** Tileset flags */
export const TilesetFlags = {
  IncludeLinkToExternal: 1,
  IncludeTilesInFile: 2,
  TileHeightMatchesCelHeight: 4,
  ZeroIsEmptyTile: 8,
} as const;

/** Tileset definition */
export interface Tileset {
  /** Tileset ID */
  id: number;
  /** Tileset flags */
  flags: number;
  /** Number of tiles */
  tileCount: number;
  /** Tile width */
  tileWidth: number;
  /** Tile height */
  tileHeight: number;
  /** Base index (usually 1) */
  baseIndex: number;
  /** Tileset name */
  name: string;
  /** External file ID (if linked) */
  externalFileId?: number;
  /** External tileset ID (if linked) */
  externalTilesetId?: number;
  /** Compressed tile data */
  compressedData?: Uint8Array;
  /** Decompressed tile pixels */
  decodedPixels?: Uint8Array;
  /** User data for the tileset */
  userData?: UserData;
  /** User data for individual tiles */
  tileUserData?: UserData[];
}

// =============================================================================
// Color Profile Types
// =============================================================================

/** Color profile */
export interface ColorProfile {
  /** Profile type */
  type: ColorProfileType;
  /** Flags */
  flags: number;
  /** Fixed gamma (if flags & 1) */
  gamma?: number;
  /** ICC profile data (if type is EmbeddedICC) */
  iccData?: Uint8Array;
}

// =============================================================================
// External Files Types
// =============================================================================

/** External file entry */
export interface ExternalFile {
  /** Entry ID */
  id: number;
  /** File type */
  type: ExternalFileType;
  /** File name or extension ID */
  fileName: string;
}

// =============================================================================
// User Data Types
// =============================================================================

/** User data flags */
export const UserDataFlags = {
  HasText: 1,
  HasColor: 2,
  HasProperties: 4,
} as const;

/** Property value types */
export type PropertyValue =
  | null
  | boolean
  | number
  | bigint
  | string
  | { x: number; y: number }
  | { width: number; height: number }
  | { x: number; y: number; width: number; height: number }
  | PropertyValue[]
  | Map<string, PropertyValue>
  | string // UUID as string
  | { unknownType: number }; // Unknown property type for forward compatibility

/** Properties map keyed by extension ID */
export type PropertiesMap = Map<string, Map<string, PropertyValue>>;

/** User data attached to various elements */
export interface UserData {
  /** Text content */
  text?: string;
  /** Color (RGBA) */
  color?: { r: number; g: number; b: number; a: number };
  /** Properties map */
  properties?: PropertiesMap;
}

// =============================================================================
// Chunk Types
// =============================================================================

/** Base chunk interface */
export interface ChunkBase {
  /** Chunk type identifier */
  type: number;
  /** Raw chunk data (for unknown or preserved chunks) */
  rawData?: Uint8Array;
}

/** Layer chunk */
export interface LayerChunk extends ChunkBase {
  type: typeof ChunkType.Layer;
  layer: Layer;
}

/** Cel chunk */
export interface CelChunk extends ChunkBase {
  type: typeof ChunkType.Cel;
  cel: Cel;
}

/** Cel extra chunk */
export interface CelExtraChunk extends ChunkBase {
  type: typeof ChunkType.CelExtra;
  extra: CelExtra;
}

/** Palette chunk */
export interface PaletteChunk extends ChunkBase {
  type: typeof ChunkType.Palette;
  palette: Palette;
}

/** Old palette chunk */
export interface OldPaletteChunk extends ChunkBase {
  type: typeof ChunkType.OldPalette1 | typeof ChunkType.OldPalette2;
  packets: Array<{
    skipCount: number;
    colors: Array<{ r: number; g: number; b: number }>;
  }>;
}

/** Tags chunk */
export interface TagsChunk extends ChunkBase {
  type: typeof ChunkType.Tags;
  tags: Tag[];
}

/** User data chunk */
export interface UserDataChunk extends ChunkBase {
  type: typeof ChunkType.UserData;
  userData: UserData;
}

/** Slice chunk */
export interface SliceChunk extends ChunkBase {
  type: typeof ChunkType.Slice;
  slice: Slice;
}

/** Tileset chunk */
export interface TilesetChunk extends ChunkBase {
  type: typeof ChunkType.Tileset;
  tileset: Tileset;
}

/** Color profile chunk */
export interface ColorProfileChunk extends ChunkBase {
  type: typeof ChunkType.ColorProfile;
  profile: ColorProfile;
}

/** External files chunk */
export interface ExternalFilesChunk extends ChunkBase {
  type: typeof ChunkType.ExternalFiles;
  files: ExternalFile[];
}

/** Unknown chunk (for forward compatibility) */
export interface UnknownChunk extends ChunkBase {
  type: number;
  rawData: Uint8Array;
}

/** Union of all chunk types */
export type Chunk =
  | LayerChunk
  | CelChunk
  | CelExtraChunk
  | PaletteChunk
  | OldPaletteChunk
  | TagsChunk
  | UserDataChunk
  | SliceChunk
  | TilesetChunk
  | ColorProfileChunk
  | ExternalFilesChunk
  | UnknownChunk;

// =============================================================================
// Main File Type
// =============================================================================

/** Complete Aseprite file structure */
export interface AsepriteFile {
  /** File header */
  header: AseHeader;
  /** Animation frames */
  frames: Frame[];
  /** All layers (extracted index) */
  layers: Layer[];
  /** Animation tags */
  tags?: Tag[];
  /** Slices */
  slices?: Slice[];
  /** Color palette */
  palette?: Palette;
  /** Tilesets */
  tilesets?: Tileset[];
  /** Color profile */
  colorProfile?: ColorProfile;
  /** External files */
  externalFiles?: ExternalFile[];
  /** Sprite-level user data */
  userData?: UserData;
  /** Unknown chunks (for forward compatibility) */
  unknownChunks?: UnknownChunk[];
}

// =============================================================================
// Options Types
// =============================================================================

/** Parse options */
export interface ParseOptions {
  /** Keep each frame's raw chunk list (including unknown chunks). Default: true */
  preserveChunks?: boolean;
  /** Keep compressed payload bytes for lazy decode. Default: true */
  preserveCompressed?: boolean;
  /** Eagerly decode compressed payloads. Default: false */
  decodeImages?: false | "metadata" | "pixels";
  /** Strict validation (magic numbers, bounds). Default: true */
  strict?: boolean;
}

/** Compression provider interface */
export interface CompressionProvider {
  /** Inflate zlib-compressed data */
  inflateZlib(data: Uint8Array): Promise<Uint8Array>;
  /** Deflate data using zlib */
  deflateZlib(data: Uint8Array): Promise<Uint8Array>;
}

/** Encode options */
export interface EncodeOptions {
  /**
   * Encoding mode:
   * - "chunks": serialize from preserved chunk lists
   * - "canonical": emit normalized chunk ordering
   * - "chunks-if-present": use chunks if available, otherwise canonical
   * Default: "chunks-if-present"
   */
  mode?: "chunks" | "canonical" | "chunks-if-present";
  /** Emit legacy palette chunks as well as new palette chunk. Default: false */
  writeLegacyPaletteChunks?: boolean;
  /** Compression backend injection (for environments without CompressionStream) */
  compression?: CompressionProvider;
}

/** Decode options for cel pixels */
export interface DecodeOptions {
  /** Compression provider (optional, uses Web Compression Streams by default) */
  compression?: CompressionProvider;
}

/** Decoded cel pixels result */
export interface DecodedCelPixels {
  /** Pixel width */
  width: number;
  /** Pixel height */
  height: number;
  /** Color depth of the source file */
  colorDepth: ColorDepth;
  /** Raw pixel data */
  pixels: Uint8Array;
}

// =============================================================================
// Error Types
// =============================================================================

/** Error codes for Aseprite format errors */
export const AseErrorCode = {
  BAD_MAGIC: "BAD_MAGIC",
  OUT_OF_BOUNDS: "OUT_OF_BOUNDS",
  BAD_CHUNK_SIZE: "BAD_CHUNK_SIZE",
  UNSUPPORTED_COLOR_DEPTH: "UNSUPPORTED_COLOR_DEPTH",
  INVALID_CEL_TYPE: "INVALID_CEL_TYPE",
  INVALID_LAYER_TYPE: "INVALID_LAYER_TYPE",
  DECOMPRESSION_FAILED: "DECOMPRESSION_FAILED",
  COMPRESSION_FAILED: "COMPRESSION_FAILED",
  INVALID_LINKED_CEL: "INVALID_LINKED_CEL",
  MISSING_TILESET: "MISSING_TILESET",
} as const;

export type AseErrorCode = (typeof AseErrorCode)[keyof typeof AseErrorCode];

/** Custom error class for Aseprite format errors */
export class AseFormatError extends Error {
  /** Error code */
  readonly code: AseErrorCode;
  /** Byte offset in file where error occurred */
  readonly offset?: number;
  /** Frame index where error occurred */
  readonly frameIndex?: number;
  /** Chunk type where error occurred */
  readonly chunkType?: number;

  constructor(
    message: string,
    code: AseErrorCode,
    options?: {
      offset?: number;
      frameIndex?: number;
      chunkType?: number;
    },
  ) {
    super(message);
    this.name = "AseFormatError";
    this.code = code;
    this.offset = options?.offset;
    this.frameIndex = options?.frameIndex;
    this.chunkType = options?.chunkType;
  }
}

// =============================================================================
// Validation Types
// =============================================================================

/** Validation issue severity */
export const ValidationSeverity = {
  Error: "error",
  Warning: "warning",
  Info: "info",
} as const;

export type ValidationSeverity =
  (typeof ValidationSeverity)[keyof typeof ValidationSeverity];

/** Validation issue */
export interface ValidationIssue {
  /** Issue severity */
  severity: ValidationSeverity;
  /** Issue code */
  code: string;
  /** Human-readable message */
  message: string;
  /** Location in file */
  location?: {
    offset?: number;
    frameIndex?: number;
    layerIndex?: number;
    chunkType?: number;
  };
}
