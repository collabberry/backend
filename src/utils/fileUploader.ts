import { S3Client } from '@aws-sdk/client-s3';
import { Upload } from '@aws-sdk/lib-storage';
import { Readable } from 'stream';
import { config as dotenv_config } from 'dotenv';
dotenv_config();
// Define your S3 client with credentials and region (this can be configured with environment variables)
const s3Client = new S3Client({
    region: process.env.AWS_REGION,
    credentials: {
        accessKeyId: process.env.AWS_S3_ACCESS_KEY_ID!,
        secretAccessKey: process.env.AWS_S3_ACCESS_KEY!
    }
});

interface UploadFileParams {
    Bucket: string;
    Key: string;
    Body: Readable | Buffer | string;
    ContentType?: string;
}

export async function uploadFileToS3(params: UploadFileParams): Promise<string | undefined> {
    try {
        const upload = new Upload({
            client: s3Client,
            params: {
                Bucket: params.Bucket,
                Key: params.Key,
                Body: params.Body,
                ContentType: params.ContentType || 'application/octet-stream'
            }
        });

        const result = await upload.done();
        console.log('File uploaded successfully:', result);
        return result.Key; // Return the file key or path after upload
    } catch (error) {
        console.error('Error uploading file:', error);
        throw new Error(`File upload failed: ${error}`);
    }
}
