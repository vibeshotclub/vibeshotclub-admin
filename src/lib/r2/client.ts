import { S3Client, PutObjectCommand, DeleteObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3'

const R2 = new S3Client({
  region: 'auto',
  endpoint: process.env.R2_ENDPOINT,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID!,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
  },
})

const BUCKET = process.env.R2_BUCKET_NAME!
const PUBLIC_URL = process.env.R2_PUBLIC_URL!

export async function uploadToR2(
  key: string,
  body: Buffer,
  contentType: string
): Promise<string> {
  await R2.send(
    new PutObjectCommand({
      Bucket: BUCKET,
      Key: key,
      Body: body,
      ContentType: contentType,
    })
  )

  return `${PUBLIC_URL}/${key}`
}

export async function deleteFromR2(key: string): Promise<void> {
  await R2.send(
    new DeleteObjectCommand({
      Bucket: BUCKET,
      Key: key,
    })
  )
}

export function getKeyFromUrl(url: string): string | null {
  if (!url.startsWith(PUBLIC_URL)) return null
  return url.replace(`${PUBLIC_URL}/`, '')
}

export async function getFromR2(key: string): Promise<string> {
  const response = await R2.send(
    new GetObjectCommand({
      Bucket: BUCKET,
      Key: key,
    })
  )

  const body = await response.Body?.transformToString()
  if (!body) throw new Error('Empty response from R2')
  return body
}
