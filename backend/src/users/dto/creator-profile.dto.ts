export class CreatorProfileDto {
  bio: string;
  subscription_price: number;
  total_subscribers: number;
  is_active: boolean;

  constructor(partial: Partial<CreatorProfileDto>) {
    Object.assign(this, partial);
  }
}