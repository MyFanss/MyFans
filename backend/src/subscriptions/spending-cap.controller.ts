import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  NotFoundException,
  Put,
  Req,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { FanBearerGuard, RequestWithFan } from '../guards/fan-bearer.guard';
import { SpendingCapService } from '../services/spending-cap.service';
import { SetSpendingCapDto, SpendingCapResponseDto } from '../dto/spending-cap.dto';

@ApiTags('subscriptions')
@Controller({ path: 'subscriptions/me/spending-cap', version: '1' })
@UseGuards(FanBearerGuard)
@ApiBearerAuth()
export class SpendingCapController {
  constructor(private readonly caps: SpendingCapService) {}

  @Get()
  @ApiOperation({ summary: 'Get the authenticated fan\'s spending cap' })
  @ApiResponse({ status: 200, type: SpendingCapResponseDto })
  @ApiResponse({ status: 404, description: 'No cap set' })
  async getCap(@Req() req: RequestWithFan): Promise<SpendingCapResponseDto> {
    const cap = await this.caps.getCap(req.fanAddress);
    if (!cap) throw new NotFoundException('No spending cap configured');
    return cap;
  }

  @Put()
  @ApiOperation({ summary: 'Set or update the authenticated fan\'s spending cap' })
  @ApiResponse({ status: 200, type: SpendingCapResponseDto })
  async setCap(
    @Req() req: RequestWithFan,
    @Body() dto: SetSpendingCapDto,
  ): Promise<SpendingCapResponseDto> {
    return this.caps.setCap(req.fanAddress, dto);
  }

  @Delete()
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Remove the authenticated fan\'s spending cap' })
  @ApiResponse({ status: 204, description: 'Cap removed' })
  async removeCap(@Req() req: RequestWithFan): Promise<void> {
    return this.caps.removeCap(req.fanAddress);
  }
}
