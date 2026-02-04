/**
 * User data chunk parser (0x2020)
 * @module
 */

import type { BinaryReader } from "../binary/reader.ts";
import type {
  PropertiesMap,
  PropertyValue,
  UserData,
  UserDataChunk,
} from "../types.ts";
import { ChunkType, PropertyType, UserDataFlags } from "../types.ts";

/**
 * Parse a property value based on its type.
 */
function parsePropertyValue(
  reader: BinaryReader,
  propType: number,
): PropertyValue {
  switch (propType) {
    case PropertyType.Null:
      return null;

    case PropertyType.Bool:
      return reader.u8() !== 0;

    case PropertyType.Int8:
      return reader.u8() - 128; // Signed conversion

    case PropertyType.Uint8:
      return reader.u8();

    case PropertyType.Int16:
      return reader.i16();

    case PropertyType.Uint16:
      return reader.u16();

    case PropertyType.Int32:
      return reader.i32();

    case PropertyType.Uint32:
      return reader.u32();

    case PropertyType.Int64:
      return reader.i64();

    case PropertyType.Uint64:
      return reader.u64();

    case PropertyType.Fixed:
      return reader.fixed16_16();

    case PropertyType.Float:
      return reader.f32();

    case PropertyType.Double:
      return reader.f64();

    case PropertyType.String:
      return reader.string();

    case PropertyType.Point:
      return { x: reader.i32(), y: reader.i32() };

    case PropertyType.Size:
      return { width: reader.i32(), height: reader.i32() };

    case PropertyType.Rect:
      return {
        x: reader.i32(),
        y: reader.i32(),
        width: reader.i32(),
        height: reader.i32(),
      };

    case PropertyType.Vector: {
      const elementCount = reader.u32();
      const elementType = reader.u16();
      const elements: PropertyValue[] = [];
      for (let i = 0; i < elementCount; i++) {
        elements.push(parsePropertyValue(reader, elementType));
      }
      return elements;
    }

    case PropertyType.PropertiesMap: {
      const mapSize = reader.u32();
      const map = new Map<string, PropertyValue>();
      for (let i = 0; i < mapSize; i++) {
        const key = reader.string();
        const valueType = reader.u16();
        const value = parsePropertyValue(reader, valueType);
        map.set(key, value);
      }
      return map;
    }

    case PropertyType.UUID:
      return reader.uuid();

    default:
      // Unknown property type - return raw type info for forward compatibility
      return { unknownType: propType };
  }
}

/**
 * Parse properties map from user data.
 */
function parsePropertiesMap(reader: BinaryReader): PropertiesMap {
  const propertiesMapSize = reader.u32();
  const propertiesMap: PropertiesMap = new Map();

  for (let i = 0; i < propertiesMapSize; i++) {
    const extensionId = reader.u32();
    const extensionKey = `ext_${extensionId}`;

    const propertyCount = reader.u32();
    const properties = new Map<string, PropertyValue>();

    for (let j = 0; j < propertyCount; j++) {
      const propertyName = reader.string();
      const propertyType = reader.u16();
      const propertyValue = parsePropertyValue(reader, propertyType);
      properties.set(propertyName, propertyValue);
    }

    propertiesMap.set(extensionKey, properties);
  }

  return propertiesMap;
}

/**
 * Parse a user data chunk.
 * @param reader - Binary reader positioned at start of chunk data
 * @returns Parsed user data chunk
 */
export function parseUserDataChunk(reader: BinaryReader): UserDataChunk {
  const flags = reader.u32();
  const userData: UserData = {};

  if (flags & UserDataFlags.HasText) {
    userData.text = reader.string();
  }

  if (flags & UserDataFlags.HasColor) {
    const r = reader.u8();
    const g = reader.u8();
    const b = reader.u8();
    const a = reader.u8();
    userData.color = { r, g, b, a };
  }

  if (flags & UserDataFlags.HasProperties) {
    userData.properties = parsePropertiesMap(reader);
  }

  return {
    type: ChunkType.UserData,
    userData,
  };
}
