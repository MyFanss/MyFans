import { Exclude, Expose } from 'class-transformer';

@Exclude()
export class UserProfileDto {
  @Expose()
  id: string;

  @Expose()
  username: string;

  @Expose()
  display_name: string;

  @Expose()
  avatar_url: string;

  @Expose()
  is_creator: boolean;

  @Expose()
  wallet_address: string;

  @Expose()
  created_at: Date;
}
