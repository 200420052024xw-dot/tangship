import { Injectable } from '@nestjs/common';
import { S3Storage } from 'coze-coding-dev-sdk';

@Injectable()
export class StorageService {
  private storage: S3Storage;

  constructor() {
    this.storage = new S3Storage({
      endpointUrl: process.env.COZE_BUCKET_ENDPOINT_URL,
      accessKey: '',
      secretKey: '',
      bucketName: process.env.COZE_BUCKET_NAME,
      region: 'cn-beijing',
    });
  }

  /** 上传文件，返回实际存储的 key */
  async uploadFile(params: { fileContent: Buffer; fileName: string; contentType?: string }) {
    return this.storage.uploadFile(params);
  }

  /** 从 URL 下载并上传，返回 key */
  async uploadFromUrl(params: { url: string; timeout?: number }) {
    return this.storage.uploadFromUrl(params);
  }

  /** 生成签名访问 URL */
  async getSignedUrl(key: string, expireTime = 86400) {
    return this.storage.generatePresignedUrl({ key, expireTime });
  }

  /** 删除文件 */
  async deleteFile(key: string) {
    return this.storage.deleteFile({ fileKey: key });
  }

  /** 检查文件是否存在 */
  async fileExists(key: string) {
    return this.storage.fileExists({ fileKey: key });
  }
}
