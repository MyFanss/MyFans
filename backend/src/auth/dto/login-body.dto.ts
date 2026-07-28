import { ApiProperty } from '@nestjs/swagger';

export class LoginBodyDto {
  @ApiProperty({
    description: 'Stellar public key (G-strkey, 56 chars)',
    example: 'GAAZI4TCR3TY5OJHCTJC2A4QSY6CJWJH5IAJTGKIN2ER7LBNVKOCCWN',
  })
  address: string;
}
