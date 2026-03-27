import { IsUUID, IsString, MinLength, MaxLength } from 'class-validator';

export class SendMessageDto {
  @IsUUID()
  recipientId: string;

  @IsString()
  @MinLength(1)
  @MaxLength(1000)
  content: string;
}
