/**
 * Chunk encoders for Aseprite file format.
 * @module
 */

import { BinaryWriter } from "../binary/writer.ts";
import type {
  Cel,
  CelExtra,
  ColorProfile,
  CompressionProvider,
  ExternalFile,
  Layer,
  Palette,
  PropertiesMap,
  PropertyValue,
  Slice,
  Tag,
  Tileset,
  UserData,
} from "../types.ts";
import {
  CelType,
  ColorProfileType,
  LayerType,
  PropertyType,
  SliceFlags,
  TilesetFlags,
  UserDataFlags,
} from "../types.ts";

/**
 * Encode a layer chunk.
 */
export function encodeLayerChunk(layer: Layer): Uint8Array {
  const writer = new BinaryWriter();

  writer.u16(layer.flags);
  writer.u16(layer.type);
  writer.u16(layer.childLevel);
  writer.u16(layer.defaultWidth);
  writer.u16(layer.defaultHeight);
  writer.u16(layer.blendMode);
  writer.u8(layer.opacity);
  writer.zeros(3); // Reserved
  writer.string(layer.name);

  if (layer.type === LayerType.Tilemap && layer.tilesetIndex !== undefined) {
    writer.u32(layer.tilesetIndex);
  }

  return writer.toUint8Array();
}

/**
 * Encode a cel chunk.
 */
export async function encodeCelChunk(
  cel: Cel,
  compression: CompressionProvider,
): Promise<Uint8Array> {
  const writer = new BinaryWriter();

  writer.u16(cel.layerIndex);
  writer.i16(cel.x);
  writer.i16(cel.y);
  writer.u8(cel.opacity);
  writer.u16(cel.type);
  writer.i16(cel.zIndex);
  writer.zeros(5); // Reserved

  switch (cel.type) {
    case CelType.RawImage: {
      writer.u16(cel.width);
      writer.u16(cel.height);
      writer.bytes(cel.data.bytes);
      break;
    }

    case CelType.Linked: {
      writer.u16(cel.linkedFrameIndex);
      break;
    }

    case CelType.CompressedImage: {
      writer.u16(cel.width);
      writer.u16(cel.height);

      // Use already compressed data if available, otherwise compress
      if (cel.data.kind === "zlib") {
        writer.bytes(cel.data.bytes);
      } else if (cel.data.decoded) {
        const compressed = await compression.deflateZlib(cel.data.decoded);
        writer.bytes(compressed);
      } else {
        const compressed = await compression.deflateZlib(cel.data.bytes);
        writer.bytes(compressed);
      }
      break;
    }

    case CelType.CompressedTilemap: {
      writer.u16(cel.width);
      writer.u16(cel.height);
      writer.u16(cel.bitsPerTile);
      writer.u32(cel.masks.tileIdMask);
      writer.u32(cel.masks.xFlipMask);
      writer.u32(cel.masks.yFlipMask);
      writer.u32(cel.masks.rotationMask);
      writer.zeros(10); // Reserved

      // Use already compressed data if available
      if (cel.data.kind === "zlib") {
        writer.bytes(cel.data.bytes);
      } else if (cel.decodedTiles) {
        // Re-encode tiles and compress
        const bytesPerTile = cel.bitsPerTile / 8;
        const tileData = new Uint8Array(cel.decodedTiles.length * bytesPerTile);
        const view = new DataView(tileData.buffer);

        for (let i = 0; i < cel.decodedTiles.length; i++) {
          const offset = i * bytesPerTile;
          switch (bytesPerTile) {
            case 1:
              view.setUint8(offset, cel.decodedTiles[i]);
              break;
            case 2:
              view.setUint16(offset, cel.decodedTiles[i], true);
              break;
            case 4:
              view.setUint32(offset, cel.decodedTiles[i], true);
              break;
          }
        }

        const compressed = await compression.deflateZlib(tileData);
        writer.bytes(compressed);
      }
      break;
    }
  }

  return writer.toUint8Array();
}

/**
 * Encode a cel extra chunk.
 */
export function encodeCelExtraChunk(extra: CelExtra): Uint8Array {
  const writer = new BinaryWriter();

  writer.u32(extra.flags);
  writer.fixed16_16(extra.preciseX);
  writer.fixed16_16(extra.preciseY);
  writer.fixed16_16(extra.celWidth);
  writer.fixed16_16(extra.celHeight);

  return writer.toUint8Array();
}

/**
 * Encode a palette chunk.
 */
export function encodePaletteChunk(palette: Palette): Uint8Array {
  const writer = new BinaryWriter();

  writer.u32(palette.size);
  writer.u32(palette.firstIndex);
  writer.u32(palette.lastIndex);
  writer.zeros(8); // Reserved

  for (const entry of palette.entries) {
    const hasName = entry.name !== undefined && entry.name.length > 0;
    writer.u16(hasName ? 1 : 0);
    writer.u8(entry.r);
    writer.u8(entry.g);
    writer.u8(entry.b);
    writer.u8(entry.a);

    if (hasName) {
      writer.string(entry.name!);
    }
  }

  return writer.toUint8Array();
}

/**
 * Encode a tags chunk.
 */
export function encodeTagsChunk(tags: Tag[]): Uint8Array {
  const writer = new BinaryWriter();

  writer.u16(tags.length);
  writer.zeros(8); // Reserved

  for (const tag of tags) {
    writer.u16(tag.fromFrame);
    writer.u16(tag.toFrame);
    writer.u8(tag.direction);
    writer.u16(tag.repeat);
    writer.zeros(6); // Reserved
    writer.u8(tag.color.r);
    writer.u8(tag.color.g);
    writer.u8(tag.color.b);
    writer.u8(0); // Extra byte
    writer.string(tag.name);
  }

  return writer.toUint8Array();
}

/**
 * Get property type code for a value.
 */
function getPropertyType(value: PropertyValue): number {
  if (value === null) return PropertyType.Null;
  if (typeof value === "boolean") return PropertyType.Bool;
  if (typeof value === "bigint") {
    return value >= 0 ? PropertyType.Uint64 : PropertyType.Int64;
  }
  if (typeof value === "number") {
    if (Number.isInteger(value)) {
      if (value >= 0) {
        if (value <= 255) return PropertyType.Uint8;
        if (value <= 65535) return PropertyType.Uint16;
        return PropertyType.Uint32;
      } else {
        if (value >= -128) return PropertyType.Int8;
        if (value >= -32768) return PropertyType.Int16;
        return PropertyType.Int32;
      }
    }
    return PropertyType.Double;
  }
  if (typeof value === "string") {
    // Check if it's a UUID (36 chars with dashes)
    if (value.length === 36 && value.includes("-")) {
      return PropertyType.UUID;
    }
    return PropertyType.String;
  }
  if (Array.isArray(value)) return PropertyType.Vector;
  if (value instanceof Map) return PropertyType.PropertiesMap;
  if (typeof value === "object") {
    if ("width" in value && "height" in value) {
      if ("x" in value && "y" in value) return PropertyType.Rect;
      return PropertyType.Size;
    }
    if ("x" in value && "y" in value) return PropertyType.Point;
  }
  return PropertyType.Null;
}

/**
 * Encode a property value.
 */
function encodePropertyValue(
  writer: BinaryWriter,
  value: PropertyValue,
  propType: number,
): void {
  switch (propType) {
    case PropertyType.Null:
      break;
    case PropertyType.Bool:
      writer.u8(value ? 1 : 0);
      break;
    case PropertyType.Int8:
      writer.u8((value as number) + 128);
      break;
    case PropertyType.Uint8:
      writer.u8(value as number);
      break;
    case PropertyType.Int16:
      writer.i16(value as number);
      break;
    case PropertyType.Uint16:
      writer.u16(value as number);
      break;
    case PropertyType.Int32:
      writer.i32(value as number);
      break;
    case PropertyType.Uint32:
      writer.u32(value as number);
      break;
    case PropertyType.Int64:
      writer.i64(value as bigint);
      break;
    case PropertyType.Uint64:
      writer.u64(value as bigint);
      break;
    case PropertyType.Fixed:
      writer.fixed16_16(value as number);
      break;
    case PropertyType.Float:
      writer.f32(value as number);
      break;
    case PropertyType.Double:
      writer.f64(value as number);
      break;
    case PropertyType.String:
      writer.string(value as string);
      break;
    case PropertyType.Point: {
      const p = value as { x: number; y: number };
      writer.i32(p.x);
      writer.i32(p.y);
      break;
    }
    case PropertyType.Size: {
      const s = value as { width: number; height: number };
      writer.i32(s.width);
      writer.i32(s.height);
      break;
    }
    case PropertyType.Rect: {
      const r = value as {
        x: number;
        y: number;
        width: number;
        height: number;
      };
      writer.i32(r.x);
      writer.i32(r.y);
      writer.i32(r.width);
      writer.i32(r.height);
      break;
    }
    case PropertyType.Vector: {
      const arr = value as PropertyValue[];
      writer.u32(arr.length);
      if (arr.length > 0) {
        const elementType = getPropertyType(arr[0]);
        writer.u16(elementType);
        for (const elem of arr) {
          encodePropertyValue(writer, elem, elementType);
        }
      } else {
        writer.u16(PropertyType.Null);
      }
      break;
    }
    case PropertyType.PropertiesMap: {
      const map = value as Map<string, PropertyValue>;
      writer.u32(map.size);
      for (const [key, val] of map) {
        writer.string(key);
        const valType = getPropertyType(val);
        writer.u16(valType);
        encodePropertyValue(writer, val, valType);
      }
      break;
    }
    case PropertyType.UUID:
      writer.uuid(value as string);
      break;
  }
}

/**
 * Encode properties map.
 */
function encodePropertiesMap(
  writer: BinaryWriter,
  properties: PropertiesMap,
): void {
  writer.u32(properties.size);

  for (const [extKey, props] of properties) {
    // Parse extension ID from key (format: "ext_123")
    const extId = parseInt(extKey.replace("ext_", ""), 10) || 0;
    writer.u32(extId);
    writer.u32(props.size);

    for (const [propName, propValue] of props) {
      writer.string(propName);
      const propType = getPropertyType(propValue);
      writer.u16(propType);
      encodePropertyValue(writer, propValue, propType);
    }
  }
}

/**
 * Encode a user data chunk.
 */
export function encodeUserDataChunk(userData: UserData): Uint8Array {
  const writer = new BinaryWriter();

  let flags = 0;
  if (userData.text) flags |= UserDataFlags.HasText;
  if (userData.color) flags |= UserDataFlags.HasColor;
  if (userData.properties) flags |= UserDataFlags.HasProperties;

  writer.u32(flags);

  if (userData.text) {
    writer.string(userData.text);
  }

  if (userData.color) {
    writer.u8(userData.color.r);
    writer.u8(userData.color.g);
    writer.u8(userData.color.b);
    writer.u8(userData.color.a);
  }

  if (userData.properties) {
    encodePropertiesMap(writer, userData.properties);
  }

  return writer.toUint8Array();
}

/**
 * Encode a slice chunk.
 */
export function encodeSliceChunk(slice: Slice): Uint8Array {
  const writer = new BinaryWriter();

  writer.u32(slice.keys.length);
  writer.u32(slice.flags);
  writer.zeros(4); // Reserved
  writer.string(slice.name);

  for (const key of slice.keys) {
    writer.u32(key.frameIndex);
    writer.i32(key.x);
    writer.i32(key.y);
    writer.u32(key.width);
    writer.u32(key.height);

    if (slice.flags & SliceFlags.Has9Patch && key.center) {
      writer.i32(key.center.x);
      writer.i32(key.center.y);
      writer.u32(key.center.width);
      writer.u32(key.center.height);
    }

    if (slice.flags & SliceFlags.HasPivot && key.pivot) {
      writer.i32(key.pivot.x);
      writer.i32(key.pivot.y);
    }
  }

  return writer.toUint8Array();
}

/**
 * Encode a tileset chunk.
 */
export function encodeTilesetChunk(tileset: Tileset): Uint8Array {
  const writer = new BinaryWriter();

  writer.u32(tileset.id);
  writer.u32(tileset.flags);
  writer.u32(tileset.tileCount);
  writer.u16(tileset.tileWidth);
  writer.u16(tileset.tileHeight);
  writer.i16(tileset.baseIndex);
  writer.zeros(14); // Reserved
  writer.string(tileset.name);

  if (tileset.flags & TilesetFlags.IncludeLinkToExternal) {
    writer.u32(tileset.externalFileId ?? 0);
    writer.u32(tileset.externalTilesetId ?? 0);
  }

  if (
    tileset.flags & TilesetFlags.IncludeTilesInFile && tileset.compressedData
  ) {
    writer.u32(tileset.compressedData.length);
    writer.bytes(tileset.compressedData);
  }

  return writer.toUint8Array();
}

/**
 * Encode a color profile chunk.
 */
export function encodeColorProfileChunk(profile: ColorProfile): Uint8Array {
  const writer = new BinaryWriter();

  writer.u16(profile.type);
  writer.u16(profile.flags);
  writer.fixed16_16(profile.gamma ?? 0);
  writer.zeros(8); // Reserved

  if (profile.type === ColorProfileType.EmbeddedICC && profile.iccData) {
    writer.u32(profile.iccData.length);
    writer.bytes(profile.iccData);
  }

  return writer.toUint8Array();
}

/**
 * Encode an external files chunk.
 */
export function encodeExternalFilesChunk(files: ExternalFile[]): Uint8Array {
  const writer = new BinaryWriter();

  writer.u32(files.length);
  writer.zeros(8); // Reserved

  for (const file of files) {
    writer.u32(file.id);
    writer.u8(file.type);
    writer.zeros(7); // Reserved
    writer.string(file.fileName);
  }

  return writer.toUint8Array();
}

/**
 * Wrap chunk data with size and type header.
 */
export function wrapChunk(chunkType: number, data: Uint8Array): Uint8Array {
  const writer = new BinaryWriter(data.length + 6);
  writer.u32(data.length + 6); // Size includes header
  writer.u16(chunkType);
  writer.bytes(data);
  return writer.toUint8Array();
}
