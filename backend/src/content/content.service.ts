import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PaginatedResponseDto, PaginationDto } from '../common/dto';
import { CreateContentDto, UpdateContentDto } from './dto/content.dto';
import { ContentMetadata } from './entities/content.entity';

@Injectable()
export class ContentService {
  constructor(
    @InjectRepository(ContentMetadata)
    private readonly contentRepo: Repository<ContentMetadata>,
  ) {}

  async create(creatorId: string, dto: CreateContentDto): Promise<ContentMetadata> {
    const content = this.contentRepo.create({ ...dto, creator_id: creatorId });
    return this.contentRepo.save(content);
  }

  async findAll(pagination: PaginationDto): Promise<PaginatedResponseDto<ContentMetadata>> {
    const { page = 1, limit = 20 } = pagination;
    const [data, total] = await this.contentRepo.findAndCount({
      order: { created_at: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
    });
    return new PaginatedResponseDto(data, total, page, limit);
  }

  async findByCreator(
    creatorId: string,
    pagination: PaginationDto,
  ): Promise<PaginatedResponseDto<ContentMetadata>> {
    const { page = 1, limit = 20 } = pagination;
    const [data, total] = await this.contentRepo.findAndCount({
      where: { creator_id: creatorId },
      order: { created_at: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
    });
    return new PaginatedResponseDto(data, total, page, limit);
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
