import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { RegisterDto } from './dto/register.dto';
import { UsersService } from '../users/users.service';
import { PaginationDto } from '../common/dto/pagination.dto';
import { PaginatedResponseDto } from '../common/dto/paginated-response.dto';
import { EventBus } from '../events/event-bus';
import { UserLoggedInEvent } from '../events/domain-events';
import { isStellarAccountAddress } from '../common/utils/stellar-address';

@Injectable()
export class AuthService {
  constructor(
    private readonly usersService: UsersService,
    private readonly eventBus: EventBus,
  ) {}

  validateStellarAddress(address: string): boolean {
    return isStellarAccountAddress(address);
  }

  createSession(stellarAddress: string) {
    if (!this.validateStellarAddress(stellarAddress)) {
      throw new BadRequestException('Invalid Stellar address');
    }
    const session = {
      userId: stellarAddress,
      token: Buffer.from(stellarAddress).toString('base64'),
    };
    this.eventBus.publish(
      new UserLoggedInEvent(session.userId, stellarAddress),
    );
    return session;
  }

  register(registerDto: RegisterDto) {
    void registerDto;
    throw new Error('Method not implemented.');
  }

  async validateUser(userId: string) {
    try {
      return await this.usersService.findOne(userId);
    } catch (e) {
      if (e instanceof NotFoundException) return null;
      throw e;
    }
  }

  async findById(id: string) {
    return this.usersService.findOne(id);
  }

  async findAllUsers(
    pagination: PaginationDto,
  ): Promise<PaginatedResponseDto<any>> {
    const { data, total } = await this.usersService.findAll(pagination);
    const limit = pagination.limit ?? 20;
    const page = pagination.page ?? 1;
    const hasMore = page * limit < total;

    return new PaginatedResponseDto(data, limit, null, hasMore, page);
  }
}
