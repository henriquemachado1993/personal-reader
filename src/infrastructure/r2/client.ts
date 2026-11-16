import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  DeleteObjectCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
function storage() {
  const accountId = process.env.R2_ACCOUNT_ID,
    accessKeyId = process.env.R2_ACCESS_KEY_ID,
    secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;
  if (
    !accountId ||
    !accessKeyId ||
    !secretAccessKey ||
    !process.env.R2_BUCKET_NAME
  )
    throw new Error("O Cloudflare R2 não está configurado.");
  return new S3Client({
    region: "auto",
    endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
    credentials: { accessKeyId, secretAccessKey },
  });
}
export async function signedUploadUrl(
  key: string,
  contentType: string,
  size: number,
) {
  return getSignedUrl(
    storage(),
    new PutObjectCommand({
      Bucket: process.env.R2_BUCKET_NAME,
      Key: key,
      ContentType: contentType,
      ContentLength: size,
      IfNoneMatch: "*",
    }),
    { expiresIn: 300 },
  );
}
export async function signedReadUrl(key: string) {
  return getSignedUrl(
    storage(),
    new GetObjectCommand({ Bucket: process.env.R2_BUCKET_NAME, Key: key }),
    { expiresIn: 300 },
  );
}

export async function originalExists(key: string) {
  try {
    await storage().send(
      new HeadObjectCommand({ Bucket: process.env.R2_BUCKET_NAME, Key: key }),
    );
    return true;
  } catch (error) {
    if (
      (error as { $metadata?: { httpStatusCode?: number } }).$metadata
        ?.httpStatusCode === 404
    )
      return false;
    throw error;
  }
}

export async function writeOriginal(key: string, bytes: Uint8Array) {
  try {
    await storage().send(
      new PutObjectCommand({
        Bucket: process.env.R2_BUCKET_NAME,
        Key: key,
        Body: bytes,
        IfNoneMatch: "*",
      }),
    );
  } catch (error) {
    // Retrying an immutable original is safe after an interrupted response.
    if (
      (error as { $metadata?: { httpStatusCode?: number } }).$metadata
        ?.httpStatusCode !== 412
    )
      throw error;
  }
}
export async function readOriginal(key: string, maxBytes?: number) {
  const result = await storage().send(
    new GetObjectCommand({ Bucket: process.env.R2_BUCKET_NAME, Key: key }),
  );
  if (maxBytes && (result.ContentLength ?? 0) > maxBytes)
    throw new Error("Arquivo excede o limite permitido.");
  const bytes = await result.Body!.transformToByteArray();
  if (maxBytes && bytes.length > maxBytes)
    throw new Error("Arquivo excede o limite permitido.");
  return bytes as Uint8Array<ArrayBuffer>;
}

export async function removeSnapshotTransfer(key: string) {
  if (!key.startsWith("sync-snapshots/"))
    throw new Error("Chave de transferência inválida.");
  await storage().send(
    new DeleteObjectCommand({ Bucket: process.env.R2_BUCKET_NAME, Key: key }),
  );
}
