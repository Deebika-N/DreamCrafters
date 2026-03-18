# Dream Crafters — Module 2: Content, Career & Video Platform
## Implementation Prompt

---

## Your Task
Implement the **Content, Career & Video Platform** backend module for the Dream Crafters platform using the stack and spec below. Implement all routes, business logic, and database queries exactly as described.

---

## Tech Stack
- **Runtime**: Node.js with Express.js
- **Database**: PostgreSQL using `node-postgres` (`pg` package)
- **Auth**: JWT middleware (the `authenticate` function is already implemented in `middleware/auth.js` — it verifies the Bearer token and attaches `req.user = { id, role }` to the request)
- **Role check helper**: `req.user.role` is one of `student | mentor | admin`
- **Validation**: `express-validator` on all POST/PUT/PATCH routes
- **File structure**:
  ```
  routes/content.js
  routes/careerPaths.js
  routes/webinars.js
  controllers/contentController.js
  controllers/careerPathController.js
  controllers/webinarController.js
  middleware/auth.js        ← already exists, just import it
  db/index.js               ← already exports a pg Pool instance
  ```

---

## Standard Response Format
All routes must return JSON in this shape:

**Success:**
```json
{ "success": true, "data": { ... } }
```

**Error:**
```json
{ "success": false, "error": "Descriptive error message" }
```

**Paginated:**
```json
{
  "success": true,
  "data": [...],
  "pagination": { "page": 1, "limit": 20, "total": 100 }
}
```

**HTTP status codes:**
- `200` — OK
- `201` — Created
- `400` — Validation error / bad input
- `401` — Not authenticated
- `403` — Forbidden (wrong role)
- `404` — Not found
- `409` — Conflict (duplicate)
- `500` — Internal server error

---

## Database Tables for This Module

### `categories`
```sql
CREATE TABLE categories (
  id          SERIAL PRIMARY KEY,
  name        VARCHAR(100) NOT NULL,
  description TEXT,
  parent_id   INTEGER REFERENCES categories(id) ON DELETE SET NULL
);
```

### `content`
```sql
CREATE TABLE content (
  id                   SERIAL PRIMARY KEY,
  title                VARCHAR(255) NOT NULL,
  description          TEXT,
  type                 VARCHAR(50) NOT NULL,       -- video | article | quiz | ebook
  url                  TEXT,
  thumbnail_url        TEXT,
  category_id          INTEGER REFERENCES categories(id) ON DELETE SET NULL,
  difficulty           VARCHAR(20) DEFAULT 'beginner',  -- beginner | intermediate | advanced
  duration_minutes     INTEGER,
  is_offline_available BOOLEAN DEFAULT false,
  language             VARCHAR(50) DEFAULT 'English',
  created_by           INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at           TIMESTAMP DEFAULT NOW()
);
```

### `career_paths`
```sql
CREATE TABLE career_paths (
  id               SERIAL PRIMARY KEY,
  title            VARCHAR(255) NOT NULL,
  description      TEXT,
  field            VARCHAR(100),
  required_skills  TEXT[],
  avg_salary_range VARCHAR(100),
  created_at       TIMESTAMP DEFAULT NOW()
);
```

### `career_path_content`
```sql
CREATE TABLE career_path_content (
  career_path_id  INTEGER NOT NULL REFERENCES career_paths(id) ON DELETE CASCADE,
  content_id      INTEGER NOT NULL REFERENCES content(id) ON DELETE CASCADE,
  order_index     INTEGER DEFAULT 0,
  PRIMARY KEY (career_path_id, content_id)
);
```

### `bookmarks`
```sql
CREATE TABLE bookmarks (
  id          SERIAL PRIMARY KEY,
  user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  content_id  INTEGER NOT NULL REFERENCES content(id) ON DELETE CASCADE,
  created_at  TIMESTAMP DEFAULT NOW(),
  UNIQUE (user_id, content_id)
);
```

### `user_content_progress`
```sql
CREATE TABLE user_content_progress (
  id                SERIAL PRIMARY KEY,
  user_id           INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  content_id        INTEGER NOT NULL REFERENCES content(id) ON DELETE CASCADE,
  status            VARCHAR(20) DEFAULT 'not_started',  -- not_started | in_progress | completed
  progress_percent  INTEGER DEFAULT 0,
  last_accessed_at  TIMESTAMP,
  completed_at      TIMESTAMP,
  UNIQUE (user_id, content_id)
);
```

### `webinars`
```sql
CREATE TABLE webinars (
  id                SERIAL PRIMARY KEY,
  title             VARCHAR(255) NOT NULL,
  description       TEXT,
  host_id           INTEGER REFERENCES users(id) ON DELETE SET NULL,
  scheduled_at      TIMESTAMP NOT NULL,
  duration_minutes  INTEGER,
  join_link         TEXT,
  topic             VARCHAR(100),
  max_participants  INTEGER,
  created_at        TIMESTAMP DEFAULT NOW()
);
```

### `webinar_registrations`
```sql
CREATE TABLE webinar_registrations (
  id            SERIAL PRIMARY KEY,
  webinar_id    INTEGER NOT NULL REFERENCES webinars(id) ON DELETE CASCADE,
  user_id       INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  registered_at TIMESTAMP DEFAULT NOW(),
  UNIQUE (webinar_id, user_id)
);
```

---

## Routes to Implement

### `routes/content.js`
```
GET    /api/content                    → List content with filters (public)
GET    /api/content/recommended        → AI-matched content for user (auth required)
GET    /api/content/bookmarks          → User's bookmarked content (auth required)
GET    /api/content/:id                → Single content item details (public)
POST   /api/content                    → Create content (admin only)
PUT    /api/content/:id                → Update content (admin only)
DELETE /api/content/:id                → Delete content (admin only)
PUT    /api/content/:id/progress       → Upsert user's progress (auth required)
POST   /api/content/:id/bookmark       → Bookmark content (auth required)
DELETE /api/content/:id/bookmark       → Remove bookmark (auth required)
```

> **IMPORTANT:** Register `/api/content/recommended` and `/api/content/bookmarks` BEFORE `/api/content/:id` in the router to prevent Express treating "recommended" and "bookmarks" as an `:id` param.

### `routes/careerPaths.js`
```
GET    /api/categories                       → All categories with hierarchy (public)
GET    /api/career-paths                     → List career paths (public)
GET    /api/career-paths/:id                 → Career path + linked content (public)
POST   /api/career-paths                     → Create career path (admin only)
PUT    /api/career-paths/:id                 → Update career path (admin only)
DELETE /api/career-paths/:id                 → Delete career path (admin only)
POST   /api/career-paths/:id/content         → Link content to career path (admin only)
DELETE /api/career-paths/:id/content/:contentId → Unlink content (admin only)
```

### `routes/webinars.js`
```
GET    /api/webinars                         → List upcoming webinars (public)
GET    /api/webinars/my-registrations        → User's registered webinars (auth required)
GET    /api/webinars/:id                     → Single webinar details (public)
POST   /api/webinars                         → Create webinar (admin or mentor)
PUT    /api/webinars/:id                     → Update webinar (admin or host mentor)
DELETE /api/webinars/:id                     → Delete webinar (admin only)
POST   /api/webinars/:id/register            → Register for webinar (auth required)
DELETE /api/webinars/:id/register            → Cancel registration (auth required)
```

> **IMPORTANT:** Register `/api/webinars/my-registrations` BEFORE `/api/webinars/:id`.

---

## Detailed Route Specifications

---

## SECTION A: Content Routes

---

### GET /api/content
**Public.** List content items with optional filters. Supports pagination.

**Query params:**
- `type` — video | article | quiz | ebook
- `category_id` — integer
- `difficulty` — beginner | intermediate | advanced
- `language` — string (e.g. "Tamil", "English")
- `search` — partial match on `title` (case-insensitive, ILIKE)
- `page` — integer, default 1
- `limit` — integer, default 20, max 100

**Logic:**
1. Build dynamic WHERE clause based on provided query params
2. JOIN `content` with `categories` to include category name
3. Use `COUNT(*) OVER()` window function for total count in same query
4. Apply `LIMIT` and `OFFSET` for pagination

**SQL pattern:**
```sql
SELECT
  c.*,
  cat.name AS category_name,
  COUNT(*) OVER() AS total_count
FROM content c
LEFT JOIN categories cat ON c.category_id = cat.id
WHERE
  ($1::text IS NULL OR c.type = $1)
  AND ($2::int IS NULL OR c.category_id = $2)
  AND ($3::text IS NULL OR c.difficulty = $3)
  AND ($4::text IS NULL OR c.language ILIKE $4)
  AND ($5::text IS NULL OR c.title ILIKE '%' || $5 || '%')
ORDER BY c.created_at DESC
LIMIT $6 OFFSET $7
```

**Response 200:**
```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "title": "Intro to Machine Learning",
      "type": "video",
      "difficulty": "beginner",
      "duration_minutes": 45,
      "thumbnail_url": "https://...",
      "language": "English",
      "is_offline_available": false,
      "category": { "id": 2, "name": "Technology" },
      "created_at": "2025-01-01T10:00:00Z"
    }
  ],
  "pagination": { "page": 1, "limit": 20, "total": 87 }
}
```

---

### GET /api/content/recommended
**Auth required.**

Return content matched to the current user's interests. Must be registered BEFORE `GET /api/content/:id`.

**Logic:**
1. Fetch the user's interests from `user_interests` WHERE `user_id = req.user.id`
2. Fetch the user's completed content IDs from `user_content_progress` WHERE `user_id = req.user.id` AND `status = 'completed'`
3. Fetch the user's `difficulty_preference` from `user_learning_preferences`
4. SELECT content WHERE:
   - `category_id` is in any category whose `name ILIKE ANY(user_interests)` (match category name against interest keywords)
   - `id NOT IN (completed_content_ids)` — exclude already-completed content
   - `difficulty = difficulty_preference` (if preference is set, otherwise no filter)
5. ORDER BY `created_at DESC` LIMIT 20
6. If user has no interests set, fall back to returning latest 20 content items

**Response 200:**
```json
{
  "success": true,
  "data": [
    {
      "id": 3,
      "title": "Python for Beginners",
      "type": "video",
      "difficulty": "beginner",
      "duration_minutes": 30,
      "category": { "id": 2, "name": "Technology" },
      "match_reason": "Matches your interest in technology"
    }
  ]
}
```

---

### GET /api/content/bookmarks
**Auth required.**

Get all content bookmarked by the current user.

**Logic:**
```sql
SELECT c.*, cat.name AS category_name, b.created_at AS bookmarked_at
FROM bookmarks b
JOIN content c ON b.content_id = c.id
LEFT JOIN categories cat ON c.category_id = cat.id
WHERE b.user_id = $1
ORDER BY b.created_at DESC
```

**Response 200:**
```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "title": "Intro to ML",
      "type": "video",
      "category": { "id": 2, "name": "Technology" },
      "bookmarked_at": "2025-01-05T10:00:00Z"
    }
  ]
}
```

---

### GET /api/content/:id
**Public.** Get full details of one content item.

**Logic:**
1. SELECT content JOIN categories WHERE `content.id = :id` → 404 if not found
2. If request has a valid auth token (check but don't require), also fetch the user's `user_content_progress` row for this item and include it in the response
3. Also include whether the item is bookmarked by the user (if authenticated)

**Response 200:**
```json
{
  "success": true,
  "data": {
    "id": 1,
    "title": "Intro to Machine Learning",
    "description": "A complete beginner's guide to ML concepts",
    "type": "video",
    "url": "https://youtube.com/watch?v=abc123",
    "thumbnail_url": "https://...",
    "difficulty": "beginner",
    "duration_minutes": 45,
    "is_offline_available": false,
    "language": "English",
    "category": { "id": 2, "name": "Technology" },
    "created_at": "2025-01-01T10:00:00Z",
    "userProgress": {
      "status": "in_progress",
      "progress_percent": 40,
      "last_accessed_at": "2025-01-10T09:00:00Z"
    },
    "isBookmarked": true
  }
}
```

If user is not authenticated, `userProgress` and `isBookmarked` should be `null`.

---

### POST /api/content
**Auth required. Admin only.**

Create a new content item.

**Request body:**
```json
{
  "title": "string (required)",
  "description": "string (optional)",
  "type": "video | article | quiz | ebook (required)",
  "url": "string (optional)",
  "thumbnail_url": "string (optional)",
  "category_id": "integer (required)",
  "difficulty": "beginner | intermediate | advanced (default: beginner)",
  "duration_minutes": "integer (optional)",
  "is_offline_available": "boolean (default: false)",
  "language": "string (default: English)"
}
```

**Validation:**
- `title` — required, non-empty string
- `type` — required, must be one of: video, article, quiz, ebook
- `category_id` — required, must be an integer
- `difficulty` — if provided, must be one of: beginner, intermediate, advanced
- `duration_minutes` — if provided, must be a positive integer

**Logic:**
1. Verify `req.user.role === 'admin'` → 403 if not
2. Verify `category_id` exists in `categories` table → 400 if not
3. INSERT into `content` setting `created_by = req.user.id`

**Response 201:** Return the created content item with category name joined.

---

### PUT /api/content/:id
**Auth required. Admin only.**

Update any field of a content item. All fields are optional (partial update).

**Request body (all optional):**
```json
{
  "title": "string",
  "description": "string",
  "type": "video | article | quiz | ebook",
  "url": "string",
  "thumbnail_url": "string",
  "category_id": "integer",
  "difficulty": "beginner | intermediate | advanced",
  "duration_minutes": "integer",
  "is_offline_available": "boolean",
  "language": "string"
}
```

**Logic:**
1. Verify `req.user.role === 'admin'` → 403
2. Check content exists → 404 if not
3. Build partial UPDATE query — only include fields present in request body
4. Return updated content item

**Response 200:** Updated content object.

---

### DELETE /api/content/:id
**Auth required. Admin only.**

Delete a content item. Child rows in `bookmarks`, `user_content_progress`, `career_path_content`, and `study_sessions` will be handled by DB CASCADE / SET NULL.

**Logic:**
1. Verify `req.user.role === 'admin'` → 403
2. Check content exists → 404 if not
3. DELETE FROM `content` WHERE `id = :id`

**Response 200:**
```json
{ "success": true, "data": { "message": "Content deleted successfully" } }
```

---

### PUT /api/content/:id/progress
**Auth required.**

Upsert the current user's progress on a content item.

**Request body:**
```json
{
  "progress_percent": "integer 0-100 (required)",
  "status": "not_started | in_progress | completed (optional)"
}
```

**Validation:**
- `progress_percent` — required, integer between 0 and 100
- `status` — optional, must be one of the allowed values

**Logic:**
1. Check content exists → 404 if not
2. Auto-derive `status` if not explicitly provided:
   - `progress_percent === 0` → `not_started`
   - `progress_percent === 100` → `completed`
   - anything between → `in_progress`
3. If `status = 'completed'` OR `progress_percent = 100`, set `completed_at = NOW()`; otherwise `completed_at = NULL`
4. Always update `last_accessed_at = NOW()`
5. UPSERT:
```sql
INSERT INTO user_content_progress (user_id, content_id, status, progress_percent, last_accessed_at, completed_at)
VALUES ($1, $2, $3, $4, NOW(), $5)
ON CONFLICT (user_id, content_id)
DO UPDATE SET
  status = EXCLUDED.status,
  progress_percent = EXCLUDED.progress_percent,
  last_accessed_at = NOW(),
  completed_at = EXCLUDED.completed_at
```

**Response 200:**
```json
{
  "success": true,
  "data": {
    "content_id": 1,
    "status": "in_progress",
    "progress_percent": 60,
    "last_accessed_at": "2025-01-10T10:00:00Z",
    "completed_at": null
  }
}
```

---

### POST /api/content/:id/bookmark
**Auth required.**

Bookmark a content item for the current user.

**Logic:**
1. Check content exists → 404 if not
2. INSERT INTO `bookmarks` (user_id, content_id) ON CONFLICT (user_id, content_id) DO NOTHING
3. Always return 200 (idempotent — bookmarking twice is not an error)

**Response 200:**
```json
{ "success": true, "data": { "message": "Content bookmarked" } }
```

---

### DELETE /api/content/:id/bookmark
**Auth required.**

Remove a bookmark for the current user.

**Logic:**
```sql
DELETE FROM bookmarks WHERE user_id = $1 AND content_id = $2
```

If no row was deleted, still return 200 (idempotent).

**Response 200:**
```json
{ "success": true, "data": { "message": "Bookmark removed" } }
```

---

## SECTION B: Category & Career Path Routes

---

### GET /api/categories
**Public.** Return all categories as a nested tree (parent → children).

**Logic:**
1. SELECT all rows from `categories`
2. Build the tree in JavaScript (not SQL):
   - First pass: create a map of `id → category`
   - Second pass: for each category with a `parent_id`, push it into the parent's `children` array
   - Return only root-level categories (those with `parent_id = null`)

**Response 200:**
```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "name": "Technology",
      "description": "Tech and computing topics",
      "children": [
        { "id": 5, "name": "AI & ML", "description": null, "children": [] },
        { "id": 6, "name": "Web Development", "description": null, "children": [] }
      ]
    },
    {
      "id": 2,
      "name": "Science",
      "description": null,
      "children": []
    }
  ]
}
```

---

### GET /api/career-paths
**Public.** List all career paths with optional field filter.

**Query params:**
- `field` — filter by field name (case-insensitive, ILIKE)
- `search` — partial match on title

**Response 200:**
```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "title": "Software Engineer",
      "field": "Technology",
      "required_skills": ["JavaScript", "Python", "SQL"],
      "avg_salary_range": "₹4–8 LPA",
      "content_count": 8,
      "created_at": "2025-01-01T10:00:00Z"
    }
  ]
}
```

Include `content_count` (number of linked content items) using a subquery or LEFT JOIN with COUNT.

---

### GET /api/career-paths/:id
**Public.** Get a career path with all its linked content items in order.

**Logic:**
```sql
SELECT
  cp.*,
  c.id AS content_id,
  c.title AS content_title,
  c.type AS content_type,
  c.difficulty AS content_difficulty,
  c.duration_minutes AS content_duration,
  c.thumbnail_url AS content_thumbnail,
  cpc.order_index
FROM career_paths cp
LEFT JOIN career_path_content cpc ON cp.id = cpc.career_path_id
LEFT JOIN content c ON cpc.content_id = c.id
WHERE cp.id = $1
ORDER BY cpc.order_index ASC
```

Aggregate the content rows into a single `content` array in JavaScript after fetching.

**Response 200:**
```json
{
  "success": true,
  "data": {
    "id": 1,
    "title": "Software Engineer",
    "description": "Full roadmap for becoming a software engineer",
    "field": "Technology",
    "required_skills": ["JavaScript", "Python", "SQL"],
    "avg_salary_range": "₹4–8 LPA",
    "content": [
      {
        "order_index": 1,
        "id": 3,
        "title": "Intro to Programming",
        "type": "video",
        "difficulty": "beginner",
        "duration_minutes": 45,
        "thumbnail_url": "https://..."
      },
      {
        "order_index": 2,
        "id": 7,
        "title": "Data Structures",
        "type": "article",
        "difficulty": "intermediate",
        "duration_minutes": null,
        "thumbnail_url": null
      }
    ]
  }
}
```

---

### POST /api/career-paths
**Auth required. Admin only.**

Create a new career path.

**Request body:**
```json
{
  "title": "string (required)",
  "description": "string (optional)",
  "field": "string (optional)",
  "required_skills": ["skill1", "skill2"] ,
  "avg_salary_range": "string (optional)"
}
```

**Validation:**
- `title` — required, non-empty string
- `required_skills` — optional, must be an array if provided

**Logic:**
1. Verify `req.user.role === 'admin'` → 403
2. INSERT into `career_paths`. Pass `required_skills` as a PostgreSQL array.

**Response 201:** Created career path object.

---

### PUT /api/career-paths/:id
**Auth required. Admin only.**

Update a career path (partial update).

**Request body (all optional):**
```json
{
  "title": "string",
  "description": "string",
  "field": "string",
  "required_skills": ["skill1", "skill2"],
  "avg_salary_range": "string"
}
```

**Logic:** Check exists → 404. Build partial UPDATE. Return updated row.

**Response 200:** Updated career path.

---

### DELETE /api/career-paths/:id
**Auth required. Admin only.**

Delete a career path. Linked `career_path_content` rows are removed by CASCADE.

**Response 200:**
```json
{ "success": true, "data": { "message": "Career path deleted successfully" } }
```

---

### POST /api/career-paths/:id/content
**Auth required. Admin only.**

Link a content item to a career path with an order index.

**Request body:**
```json
{
  "content_id": "integer (required)",
  "order_index": "integer (optional, default: 0)"
}
```

**Validation:**
- `content_id` — required, integer

**Logic:**
1. Verify `req.user.role === 'admin'` → 403
2. Verify career path exists → 404
3. Verify content exists → 400 if not
4. INSERT INTO `career_path_content` ON CONFLICT (career_path_id, content_id) DO UPDATE SET `order_index = EXCLUDED.order_index`

**Response 200:**
```json
{
  "success": true,
  "data": { "message": "Content linked to career path", "order_index": 3 }
}
```

---

### DELETE /api/career-paths/:id/content/:contentId
**Auth required. Admin only.**

Remove a content item from a career path.

**Logic:**
```sql
DELETE FROM career_path_content
WHERE career_path_id = $1 AND content_id = $2
```

**Response 200:**
```json
{ "success": true, "data": { "message": "Content removed from career path" } }
```

---

## SECTION C: Webinar Routes

---

### GET /api/webinars
**Public.** List upcoming webinars (only future ones).

**Query params:**
- `topic` — partial match on topic (ILIKE)
- `from_date` — ISO date string, only return webinars on or after this date (default: today)
- `page` — default 1
- `limit` — default 20

**Logic:**
```sql
SELECT
  w.*,
  u.name AS host_name,
  COUNT(wr.id) AS registration_count,
  COUNT(*) OVER() AS total_count
FROM webinars w
LEFT JOIN users u ON w.host_id = u.id
LEFT JOIN webinar_registrations wr ON w.id = wr.webinar_id
WHERE
  w.scheduled_at >= $1
  AND ($2::text IS NULL OR w.topic ILIKE '%' || $2 || '%')
GROUP BY w.id, u.name
ORDER BY w.scheduled_at ASC
LIMIT $3 OFFSET $4
```

**Response 200:**
```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "title": "Career in AI — Expert Talk",
      "topic": "AI & ML",
      "scheduled_at": "2025-02-15T14:00:00Z",
      "duration_minutes": 90,
      "host_name": "Dr. Karpagam",
      "registration_count": 34,
      "max_participants": 100,
      "join_link": "https://meet.google.com/abc-xyz"
    }
  ],
  "pagination": { "page": 1, "limit": 20, "total": 5 }
}
```

---

### GET /api/webinars/my-registrations
**Auth required.** Must be registered BEFORE `GET /api/webinars/:id`.

Get all webinars the current user is registered for (future ones first).

**Logic:**
```sql
SELECT w.*, u.name AS host_name, wr.registered_at
FROM webinar_registrations wr
JOIN webinars w ON wr.webinar_id = w.id
LEFT JOIN users u ON w.host_id = u.id
WHERE wr.user_id = $1
ORDER BY w.scheduled_at ASC
```

**Response 200:** Array of webinars with `registered_at` field included.

---

### GET /api/webinars/:id
**Public.** Get full details of one webinar.

**Logic:**
1. SELECT webinar JOIN host user name
2. COUNT registrations
3. If request has a valid auth token, also check `webinar_registrations` to include `isRegistered: true/false`

**Response 200:**
```json
{
  "success": true,
  "data": {
    "id": 1,
    "title": "Career in AI — Expert Talk",
    "description": "Join us for an in-depth talk on careers in AI",
    "topic": "AI & ML",
    "scheduled_at": "2025-02-15T14:00:00Z",
    "duration_minutes": 90,
    "join_link": "https://meet.google.com/abc-xyz",
    "max_participants": 100,
    "host": { "id": 5, "name": "Dr. Karpagam" },
    "registration_count": 34,
    "is_full": false,
    "isRegistered": true,
    "created_at": "2025-01-01T10:00:00Z"
  }
}
```

`is_full` = `registration_count >= max_participants` (if `max_participants` is null, never full).
`isRegistered` = null if user is not authenticated.

---

### POST /api/webinars
**Auth required. Admin or Mentor only.**

Create a new webinar.

**Request body:**
```json
{
  "title": "string (required)",
  "description": "string (optional)",
  "scheduled_at": "ISO timestamp (required, must be future)",
  "duration_minutes": "integer (optional)",
  "join_link": "string (optional)",
  "topic": "string (optional)",
  "max_participants": "integer (optional)"
}
```

**Validation:**
- `title` — required, non-empty
- `scheduled_at` — required, must be a valid future timestamp
- `max_participants` — optional, positive integer if provided
- `duration_minutes` — optional, positive integer if provided

**Logic:**
1. Verify `req.user.role === 'admin' || req.user.role === 'mentor'` → 403
2. Set `host_id = req.user.id`
3. INSERT into `webinars`

**Response 201:** Created webinar with host name.

---

### PUT /api/webinars/:id
**Auth required. Admin or the host mentor.**

Update a webinar.

**Request body (all optional):**
```json
{
  "title": "string",
  "description": "string",
  "scheduled_at": "ISO timestamp",
  "duration_minutes": "integer",
  "join_link": "string",
  "topic": "string",
  "max_participants": "integer"
}
```

**Logic:**
1. Fetch webinar → 404 if not found
2. Verify `req.user.role === 'admin'` OR `webinar.host_id === req.user.id` → 403 if neither
3. Build partial UPDATE query

**Response 200:** Updated webinar object.

---

### DELETE /api/webinars/:id
**Auth required. Admin only.**

Delete a webinar. Registrations are removed by CASCADE.

**Logic:** Verify admin. Check exists → 404. DELETE.

**Response 200:**
```json
{ "success": true, "data": { "message": "Webinar deleted successfully" } }
```

---

### POST /api/webinars/:id/register
**Auth required.**

Register the current user for a webinar.

**Logic:**
1. Fetch webinar → 404 if not found
2. Check `webinar.scheduled_at > NOW()` → 400 with message "Webinar has already passed" if not
3. If `max_participants` is set, check `registration_count < max_participants` → 409 with message "Webinar is full" if exceeded
4. INSERT INTO `webinar_registrations` ON CONFLICT (webinar_id, user_id) DO NOTHING

**Response 200:**
```json
{ "success": true, "data": { "message": "Successfully registered for webinar" } }
```

---

### DELETE /api/webinars/:id/register
**Auth required.**

Cancel the current user's registration for a webinar.

**Logic:**
1. Fetch webinar → 404 if not found
2. Check `webinar.scheduled_at > NOW()` → 400 "Cannot cancel registration for a past webinar"
3. DELETE FROM `webinar_registrations` WHERE `webinar_id = :id AND user_id = req.user.id`
4. If no row deleted, return 404 "You are not registered for this webinar"

**Response 200:**
```json
{ "success": true, "data": { "message": "Registration cancelled successfully" } }
```

---

## Implementation Notes

1. **Route order matters** — In Express, routes are matched in the order they are declared. Always declare specific routes (`/recommended`, `/bookmarks`, `/my-registrations`) before parameterized routes (`/:id`). Failing to do this will cause Express to treat the literal strings as IDs.

2. **Admin role check pattern:**
   ```javascript
   if (req.user.role !== 'admin') {
     return res.status(403).json({ success: false, error: 'Access denied. Admin only.' });
   }
   ```

3. **Optional auth on public routes** — For `GET /api/content/:id` and `GET /api/webinars/:id`, auth is optional. Use a helper middleware that tries to verify the token but calls `next()` regardless:
   ```javascript
   const optionalAuth = (req, res, next) => {
     const header = req.headers.authorization;
     if (!header) return next();
     try {
       const token = header.split(' ')[1];
       req.user = jwt.verify(token, process.env.JWT_SECRET);
     } catch (_) { /* ignore invalid token */ }
     next();
   };
   ```

4. **Building dynamic WHERE clauses** — use a params array and counter pattern:
   ```javascript
   const conditions = [];
   const params = [];
   let i = 1;

   if (type) { conditions.push(`c.type = $${i++}`); params.push(type); }
   if (category_id) { conditions.push(`c.category_id = $${i++}`); params.push(category_id); }
   if (search) { conditions.push(`c.title ILIKE $${i++}`); params.push(`%${search}%`); }

   const whereClause = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
   ```

5. **PostgreSQL array fields** — `required_skills` and `strengths` are `text[]`. Pass them as JS arrays in parameterized queries. To query if a skill is in the array:
   ```sql
   WHERE 'Python' = ANY(required_skills)
   ```

6. **Building category tree** — Do this in JavaScript after a single SELECT * FROM categories:
   ```javascript
   const map = {};
   const roots = [];
   rows.forEach(r => { map[r.id] = { ...r, children: [] }; });
   rows.forEach(r => {
     if (r.parent_id && map[r.parent_id]) {
       map[r.parent_id].children.push(map[r.id]);
     } else {
       roots.push(map[r.id]);
     }
   });
   return roots;
   ```

7. **Aggregating career path content** — After the JOIN query returns multiple rows (one per content item), reduce them in JavaScript:
   ```javascript
   const path = null;
   const content = [];
   rows.forEach(row => {
     if (!path) {
       path = {
         id: row.id, title: row.title, field: row.field,
         required_skills: row.required_skills, avg_salary_range: row.avg_salary_range,
         content: []
       };
     }
     if (row.content_id) {
       path.content.push({
         order_index: row.order_index,
         id: row.content_id,
         title: row.content_title,
         type: row.content_type,
         difficulty: row.content_difficulty,
         duration_minutes: row.content_duration
       });
     }
   });
   ```

8. **Pagination offset formula:**
   ```javascript
   const page = parseInt(req.query.page) || 1;
   const limit = Math.min(parseInt(req.query.limit) || 20, 100);
   const offset = (page - 1) * limit;
   ```

9. **Webinar `is_full` logic:**
   ```javascript
   const isFull = webinar.max_participants !== null &&
     webinar.registration_count >= webinar.max_participants;
   ```

10. **Partial update pattern** — for all PUT routes:
    ```javascript
    const allowed = ['title', 'description', 'type', 'url', 'difficulty', 'language'];
    const fields = [];
    const values = [];
    let i = 1;
    allowed.forEach(key => {
      if (req.body[key] !== undefined) {
        fields.push(`${key} = $${i++}`);
        values.push(req.body[key]);
      }
    });
    if (fields.length === 0) {
      return res.status(400).json({ success: false, error: 'No fields to update' });
    }
    values.push(id);
    await pool.query(`UPDATE content SET ${fields.join(', ')} WHERE id = $${i}`, values);
    ```

11. **Express validator example** — for `POST /api/content`:
    ```javascript
    const { body, validationResult } = require('express-validator');

    const validateContent = [
      body('title').notEmpty().withMessage('Title is required'),
      body('type').isIn(['video', 'article', 'quiz', 'ebook']).withMessage('Invalid content type'),
      body('category_id').isInt().withMessage('category_id must be an integer'),
      body('difficulty').optional().isIn(['beginner', 'intermediate', 'advanced']),
      body('duration_minutes').optional().isInt({ min: 1 }).withMessage('duration_minutes must be a positive integer'),
      (req, res, next) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) return res.status(400).json({ success: false, error: errors.array()[0].msg });
        next();
      }
    ];
    ```

12. **Error handling** — wrap all controller functions in try/catch:
    ```javascript
    } catch (err) {
      console.error(err);
      res.status(500).json({ success: false, error: 'Internal server error' });
    }
    ```
