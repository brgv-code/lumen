// Stored files behind items. R2 has no cascade, so deleting an item or an account goes through here.
import type { PdfInfo, PdfTextStatus } from "@lumen/core";
import type { SessionUser } from "../env";
import { entitlement } from "./plan";

interface FileRow { r2_key: string | null; pages: number | null; text_status: PdfTextStatus }

export const pdfKey = (userId: string, itemId: string) => `pdf/${userId}/${itemId}`;

export async function pdfInfo(db: D1Database, user: SessionUser, itemId: string): Promise<PdfInfo> {
  const row = await db.prepare("SELECT r2_key, pages, text_status FROM item_files WHERE item_id = ?").bind(itemId).first<FileRow>();
  return { text: row?.text_status ?? "pending", pages: row?.pages ?? null, hasFile: Boolean(row?.r2_key), locked: !entitlement(user).pro };
}

/** Every stored file of a user, for account deletion. */
export async function deleteUserFiles(files: R2Bucket, userId: string) {
  let cursor: string | undefined;
  do {
    const page = await files.list({ prefix: `pdf/${userId}/`, cursor });
    if (page.objects.length) await files.delete(page.objects.map((object) => object.key));
    cursor = page.truncated ? page.cursor : undefined;
  } while (cursor);
}
