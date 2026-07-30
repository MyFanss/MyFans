import {
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PaginatedResponseDto, PaginationDto } from '../common/dto';
import { CreateContentDto, UpdateContentDto } from './dto/content.dto';
import { ContentMetadata } from './entities/content.entity';
import { IpfsService } from './ipfs.service';

@Injectable()
export class ContentService {
  private readonly logger = new Logger(ContentService.name);

  constructor(
    @InjectRepository(ContentMetadata)
    private readonly contentRepo: Repository<ContentMetadata>,
    private readonly ipfsService: IpfsService,
  ) {}

  async create(creatorId: string, dto: CreateContentDto): Promise<ContentMetadata> {
    let ipfs_cid = dto.ipfs_cid;
    let ipfs_url = dto.ipfs_url ?? null;

    if (!ipfs_cid) {
      const metadata: Record<string, unknown> = {
        title: dto.title,
        description: dto.description ?? null,
        content_type: dto.content_type,
        creator_id: creatorId,
      };
      try {
        const uploaded = await this.ipfsService.uploadMetadata(metadata);
        ipfs_cid = uploaded.cid;
        ipfs_url = uploaded.url;
      } catch (err) {
        this.logger.warn('IPFS upload failed, proceeding without CID', err);
        ipfs_cid = '';
      }
    }

    const content = this.contentRepo.create({
      ...dto,
      ipfs_cid,
      ipfs_url,
      creator_id: creatorId,
    });
    return this.contentRepo.save(content);
  }

  async findAll(pagination: PaginationDto): Promise<PaginatedResponseDto<ContentMetadata>> {
    const { cursor, limit = 20 } = pagination;

    const qb = this.contentRepo
      .createQueryBuilder('content')
      .orderBy('content.id', 'ASC')
      .take(limit + 1);

    if (cursor) {
      const cursorId = parseInt(cursor, 10);
      if (!isNaN(cursorId)) {
        qb.andWhere('content.id > :cursorId', { cursorId });
      }
    }

    const data = await qb.getMany();
    const hasMore = data.length > limit;
    if (hasMore) {
      data.pop();
    }

    let nextCursor: string | null = null;
    if (data.length > 0) {
      nextCursor = String(data[data.length - 1].id);
    }

    return new PaginatedResponseDto(data, limit, nextCursor, hasMore);
  }

  async findByCreator(
    creatorId: string,
    pagination: PaginationDto,
  ): Promise<PaginatedResponseDto<ContentMetadata>> {
    const { cursor, limit = 20 } = pagination;

    const qb = this.contentRepo
      .createQueryBuilder('content')
      .where('content.creator_id = :creatorId', { creatorId })
      .orderBy('content.id', 'ASC')
      .take(limit + 1);

    if (cursor) {
      const cursorId = parseInt(cursor, 10);
      if (!isNaN(cursorId)) {
        qb.andWhere('content.id > :cursorId', { cursorId });
      }
    }

    const data = await qb.getMany();
    const hasMore = data.length > limit;
    if (hasMore) {
      data.pop();
    }

    let nextCursor: string | null = null;
    if (data.length > 0) {
      nextCursor = String(data[data.length - 1].id);
    }

    return new PaginatedResponseDto(data, limit, nextCursor, hasMore);
  }

  async findOne(id: string): Promise<ContentMetadata> {
    const content = await this.contentRepo.findOne({ where: { id } });
    if (!content) throw new NotFoundException(`Content ${id} not found`);
    return content;
  }

  async update(
    id: string,
    requesterId: string,
    dto: UpdateContentDto,
  ): Promise<ContentMetadata> {
    const content = await this.findOne(id);
    this.assertOwnership(content, requesterId);
    Object.assign(content, dto);
    return this.contentRepo.save(content);
  }

  async remove(id: string, requesterId: string): Promise<void> {
    const content = await this.findOne(id);
    this.assertOwnership(content, requesterId);
    await this.contentRepo.remove(content);
  }

  private assertOwnership(content: ContentMetadata, requesterId: string): void {
    if (content.creator_id !== requesterId) {
      throw new ForbiddenException('You do not own this content');
    }
  }
}
