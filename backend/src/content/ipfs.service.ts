import { Injectable, InternalServerErrorException, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export interface IpfsUploadResult {
  cid: string;
  url: string;
}

@Injectable()
export class IpfsService {
  private readonly logger = new Logger(IpfsService.name);
  private readonly pinataJwt: string;
  private readonly gateway: string;
  private readonly pinataUrl = 'https://api.pinata.cloud/pinning/pinJSONToIPFS';

  constructor(private readonly config: ConfigService) {
    this.pinataJwt = this.config.get<string>('IPFS_PINATA_JWT', '');
    this.gateway = this.config.get<string>(
      'IPFS_GATEWAY_URL',
      'https://gateway.pinata.cloud/ipfs',
    );
  }

  async uploadMetadata(metadata: Record<string, unknown>): Promise<IpfsUploadResult> {
    if (!this.pinataJwt) {
      throw new InternalServerErrorException(
        'IPFS_PINATA_JWT is not configured. Set it in your environment.',
      );
    }

    const body = JSON.stringify({
      pinataContent: metadata,
      pinataOptions: { cidVersion: 1 },
    });

    let res: Response;
    try {
      res = await fetch(this.pinataUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.pinataJwt}`,
        },
        body,
      });
    } catch (err) {
      this.logger.error('IPFS upload network error', err);
      throw new InternalServerErrorException('Failed to reach IPFS pinning service.');
    }

    if (!res.ok) {
      const text = await res.text().catch(() => '');
      this.logger.error(`IPFS pin failed: ${res.status} ${text}`);
      throw new InternalServerErrorException(`IPFS pinning failed (HTTP ${res.status}).`);
    }

    const json = (await res.json()) as { IpfsHash: string };
    const cid = json.IpfsHash;
    return { cid, url: `${this.gateway}/${cid}` };
  }
}
