import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
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
