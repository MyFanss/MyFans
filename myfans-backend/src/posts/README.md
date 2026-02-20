# Post Entity

Creator content with free or paid type. Supports drafts (published_at null) and published posts.

## Fields

| Field       | Type     | Description                        |
|------------|----------|------------------------------------|
| id         | uuid     | Primary key                        |
| creator_id | uuid     | FK to Creator                      |
| title      | string   | Post title                         |
| body       | text     | Post content                       |
| type       | enum     | free \| paid                       |
| price      | decimal  | Nullable; required when type=paid  |
| media_urls | json     | Array of URL strings               |
| published_at | datetime | Null = draft; set = published    |
| created_at | datetime |                                    |
| updated_at | datetime |                                    |

## Validation

- **type=free**: price must be null
- **type=paid**: price must be >= 0

## Indexes

- (creator_id, published_at) - list creator posts
- (type) - filter by post type
