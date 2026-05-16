/**
 * Mongoose Document Serialization Utility
 *
 * CRITICAL: Prevents React Error #300 ("Objects are not valid as a React child")
 * by ensuring all MongoDB documents are converted to plain serializable objects
 * before being sent as API responses.
 *
 * Raw Mongoose documents (even with .lean()) can contain:
 * - ObjectId objects (not strings)
 * - Date objects (not ISO strings)
 * - Nested sub-documents with their own _id/__v
 * - Buffer objects
 *
 * When these are spread into API responses via `{ ...doc, id: doc._id.toString() }`,
 * the non-serializable fields leak through and cause React to crash when
 * attempting to render them in JSX.
 *
 * Usage:
 *   import { serializeDoc } from '@/lib/mongoose/serialize';
 *   const cleanData = serializeDoc(rawMongooseDoc);
 *   return Response.json({ success: true, data: cleanData });
 */

// Minimal type check for ObjectId — avoids importing mongoose at the top level
// which can cause issues in edge runtime
function isObjectId(value: any): boolean {
  if (!value) return false;
  // Check for Mongoose ObjectId instance
  if (typeof value.constructor === 'function' && value.constructor.name === 'ObjectId') return true;
  // Check for BSON ObjectId (has toString() and _bsontype)
  if (value._bsontype === 'ObjectId') return true;
  // Check if it looks like an ObjectId (24-char hex string wrapper)
  if (typeof value.toString === 'function') {
    const str = value.toString();
    if (/^[0-9a-fA-F]{24}$/.test(str) && value.constructor !== String) return true;
  }
  return false;
}

export function serializeDoc<T extends Record<string, any> | null | undefined>(doc: T): Record<string, any> | null {
  if (doc === null || doc === undefined) return null;
  if (Array.isArray(doc)) return doc.map(item => serializeDoc(item));
  if (typeof doc !== 'object') return doc;

  // Date → ISO string
  if (doc instanceof Date) return doc.toISOString();

  // ObjectId → string
  if (isObjectId(doc)) return doc.toString();

  const result: Record<string, any> = {};

  for (const [key, value] of Object.entries(doc)) {
    // Skip internal Mongoose fields
    if (key === '__v') continue;
    if (key === '_id') {
      // Convert _id to 'id' string
      result.id = value?.toString?.() || String(value);
      continue;
    }

    if (value === null || value === undefined) {
      result[key] = value;
    } else if (value instanceof Date) {
      result[key] = value.toISOString();
    } else if (isObjectId(value)) {
      result[key] = value.toString();
    } else if (Array.isArray(value)) {
      result[key] = value.map(item => {
        if (item === null || item === undefined) return item;
        if (item instanceof Date) return item.toISOString();
        if (isObjectId(item)) return item.toString();
        if (typeof item === 'object') return serializeDoc(item);
        return item;
      });
    } else if (typeof value === 'object' && value.constructor?.name === 'Object') {
      // Plain object — recurse
      result[key] = serializeDoc(value);
    } else if (value && typeof value === 'object' && value.type === 'Buffer') {
      // Buffer → skip or convert to empty string
      result[key] = null;
    } else {
      // Primitives (string, number, boolean)
      result[key] = value;
    }
  }

  return result;
}

/**
 * Serialize an array of Mongoose documents
 */
export function serializeDocs<T extends Record<string, any>>(docs: T[]): Record<string, any>[] {
  if (!Array.isArray(docs)) return [];
  return docs.map(doc => serializeDoc(doc));
}

/**
 * Safe JSON response wrapper that ensures all values are serializable
 * Uses a custom replacer to handle any remaining ObjectId/Date objects
 */
export function safeJsonResponse(data: any, status = 200, headers?: Record<string, string>): Response {
  const body = JSON.stringify(data, (key, value) => {
    if (value instanceof Date) return value.toISOString();
    if (value && typeof value === 'object' && value._bsontype === 'ObjectId') return value.toString();
    if (value && typeof value === 'object' && value.constructor?.name === 'ObjectId') return value.toString();
    if (value && typeof value === 'object' && value.type === 'Buffer') return null;
    // Catch any 24-char hex objects that might be ObjectId
    if (value && typeof value === 'object' && typeof value.toString === 'function') {
      const str = value.toString();
      if (/^[0-9a-fA-F]{24}$/.test(str) && value.constructor !== String && value.constructor !== Object) {
        return str;
      }
    }
    return value;
  });

  return new Response(body, {
    status,
    headers: {
      'Content-Type': 'application/json',
      ...headers,
    },
  });
}
