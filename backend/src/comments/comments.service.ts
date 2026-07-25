import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { plainToInstance } from 'class-transformer';
import { Comment } from './entities/comment.entity';
import { CommentDto, CreateCommentDto, UpdateCommentDto } from './dto';
import { PaginationDto, PaginatedResponseDto } from '../common/dto';

@Injectable()
export class CommentsService {
  constructor(
    @InjectRepository(Comment)
    private readonly commentsRepository: Repository<Comment>,
  ) {}

  private toDto(comment: Comment): CommentDto {
    return plainToInstance(CommentDto, comment, {
      excludeExtraneousValues: true,
    });
  }

  async create(authorId: string, dto: CreateCommentDto): Promise<CommentDto> {
    const comment = this.commentsRepository.create({
      ...dto,
      authorId,
    });
    const saved = await this.commentsRepository.save(comment);
    return this.toDto(saved);
  }

  async findAll(
    pagination: PaginationDto,
  ): Promise<PaginatedResponseDto<CommentDto>> {
    const { page = 1, limit = 20 } = pagination;
    const skip = (page - 1) * limit;

    const [comments, total] = await this.commentsRepository.findAndCount({
      skip,
      take: limit,
      order: { createdAt: 'DESC' },
    });

    return new PaginatedResponseDto(
      comments.map((c) => this.toDto(c)),
      total,
      page,
      limit,
    );
  }

  async findByPost(
    postId: string,
    pagination: PaginationDto,
  ): Promise<PaginatedResponseDto<CommentDto>> {
    const { page = 1, limit = 20 } = pagination;
    const skip = (page - 1) * limit;

    const [comments, total] = await this.commentsRepository.findAndCount({
      where: { postId },
      skip,
      take: limit,
      order: { createdAt: 'DESC' },
    });

    return new PaginatedResponseDto(
      comments.map((c) => this.toDto(c)),
      total,
      page,
      limit,
    );
  }

  async findOne(id: string): Promise<CommentDto> {
    const comment = await this.commentsRepository.findOne({ where: { id } });
    if (!comment) {
      throw new NotFoundException(`Comment with id "${id}" not found`);
    }
    return this.toDto(comment);
  }

  /**
   * Only the comment's author may update it. Moderator/admin takedowns go
   * through the separate `/moderation` flow, not this endpoint.
   */
  async update(
    id: string,
    dto: UpdateCommentDto,
    requesterId: string,
  ): Promise<CommentDto> {
    const comment = await this.commentsRepository.findOne({ where: { id } });
    if (!comment) {
      throw new NotFoundException(`Comment with id "${id}" not found`);
    }
    if (comment.authorId !== requesterId) {
      throw new ForbiddenException(
        'You do not have permission to update this comment',
      );
    }
    Object.assign(comment, dto);
    const updated = await this.commentsRepository.save(comment);
    return this.toDto(updated);
  }

  /** Only the comment's author may delete it; admin takedowns go through `/moderation`. */
  async remove(id: string, requesterId: string): Promise<void> {
    const comment = await this.commentsRepository.findOne({ where: { id } });
    if (!comment) {
      throw new NotFoundException(`Comment with id "${id}" not found`);
    }
    if (comment.authorId !== requesterId) {
      throw new ForbiddenException(
        'You do not have permission to delete this comment',
      );
    }
    await this.commentsRepository.remove(comment);
  }
}
