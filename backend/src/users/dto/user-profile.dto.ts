import { Exclude, Expose } from 'class-transformer';
import { CreatorProfileDto } from './creator-profile.dto';

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

  email_notifications: boolean;
  push_notifications: boolean;
  marketing_emails: boolean;

  creator?: CreatorProfileDto; 

  @Expose()
  created_at: Date;
}
