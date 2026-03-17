# Dream Crafters — Module 3: AI Study Planner & Personalization Engine
## Implementation Prompt

---

## Your Task
Implement the **AI Study Planner & Personalization Engine** backend module for the Dream Crafters platform using the stack and spec below. Implement all routes, business logic, and database queries exactly as described.

---

## Tech Stack
- **Runtime**: Node.js with Express.js
- **Database**: PostgreSQL using `node-postgres` (`pg` package)
- **Auth**: JWT middleware (the `authenticate` function is already implemented in `middleware/auth.js` — it verifies the Bearer token and attaches `req.user = { id, role }` to the request)
- **Validation**: `express-validator` on all POST/PUT/PATCH routes
- **File structure**:
  ```
  routes/studyPlanner.js
  controllers/studyPlannerController.js
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
{ "success": true, "data": [...], "pagination": { "page": 1, "limit": 20, "total": 100 } }
```

**HTTP status codes to use:**
- `200` — OK
- `201` — Created
- `400` — Validation error / bad input
- `401` — Not authenticated
- `403` — Forbidden (wrong role or not owner)
- `404` — Resource not found
- `409` — Conflict (duplicate)
- `500` — Internal server error

---

## Database Tables for This Module

### `study_plans`
```sql
CREATE TABLE study_plans (
  id               SERIAL PRIMARY KEY,
  user_id          INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title            VARCHAR(255) NOT NULL,
  goal             TEXT,
  start_date       DATE NOT NULL,
  end_date         DATE,
  status           VARCHAR(20) DEFAULT 'active',   -- active | paused | completed | archived
  generated_by     VARCHAR(20) DEFAULT 'ai',        -- ai | user
  created_at       TIMESTAMP DEFAULT NOW(),
  updated_at       TIMESTAMP DEFAULT NOW()
);
```

### `study_sessions`
```sql
CREATE TABLE study_sessions (
  id               SERIAL PRIMARY KEY,
  plan_id          INTEGER NOT NULL REFERENCES study_plans(id) ON DELETE CASCADE,
  content_id       INTEGER REFERENCES content(id) ON DELETE SET NULL,
  title            VARCHAR(255) NOT NULL,
  scheduled_date   DATE NOT NULL,
  scheduled_time   TIME,
  duration_minutes INTEGER NOT NULL,
  status           VARCHAR(20) DEFAULT 'pending',   -- pending | completed | missed | rescheduled
  priority         INTEGER DEFAULT 2,               -- 1=low, 2=medium, 3=high
  notes            TEXT,
  completed_at     TIMESTAMP
);
```

### `study_session_reschedules`
```sql
CREATE TABLE study_session_reschedules (
  id               SERIAL PRIMARY KEY,
  session_id       INTEGER NOT NULL REFERENCES study_sessions(id) ON DELETE CASCADE,
  old_date         DATE NOT NULL,
  new_date         DATE NOT NULL,
  reason           VARCHAR(100),   -- missed | user_request | ai
  rescheduled_at   TIMESTAMP DEFAULT NOW()
);
```

### `personalization_profiles`
```sql
CREATE TABLE personalization_profiles (
  id                   SERIAL PRIMARY KEY,
  user_id              INTEGER UNIQUE NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  rec_career_path_id   INTEGER REFERENCES career_paths(id) ON DELETE SET NULL,
  strengths            TEXT[],
  areas_to_improve     TEXT[],
  ai_scores            JSONB,
  last_assessed_at     TIMESTAMP
);
```

### `ai_recommendations`
```sql
CREATE TABLE ai_recommendations (
  id                   SERIAL PRIMARY KEY,
  user_id              INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type                 VARCHAR(50) NOT NULL,   -- content | career | study_time | skill
  recommendation_data  JSONB NOT NULL,
  is_accepted          BOOLEAN,               -- NULL = not yet acted on
  created_at           TIMESTAMP DEFAULT NOW()
);
```

---

## Routes to Implement

### Route File: `routes/studyPlanner.js`
```
POST   /api/study-plans/generate               → AI generates a study plan
GET    /api/study-plans                         → List user's study plans
GET    /api/study-plans/:id                     → Get one plan with all sessions
POST   /api/study-plans                         → Manually create a plan
PUT    /api/study-plans/:id                     → Update a plan
DELETE /api/study-plans/:id                     → Delete a plan

GET    /api/study-plans/:id/progress            → Completion stats for a plan
GET    /api/study-plans/:id/sessions            → List sessions for a plan
POST   /api/study-plans/:id/sessions            → Add a session manually

PATCH  /api/study-sessions/:id/complete         → Mark session as completed
PATCH  /api/study-sessions/:id/reschedule       → Reschedule a session
POST   /api/study-sessions/auto-reschedule      → AI reschedules all missed sessions
DELETE /api/study-sessions/:id                  → Delete a session

GET    /api/personalization/profile             → Get user's personalization profile
POST   /api/personalization/assess              → Submit quiz, update profile
GET    /api/recommendations                     → Get AI recommendations
PATCH  /api/recommendations/:id/accept          → Accept a recommendation
PATCH  /api/recommendations/:id/dismiss         → Dismiss a recommendation
```

All routes require authentication. Use the `authenticate` middleware on all of them.

---

## Detailed Route Specifications

---

### POST /api/study-plans/generate
**Auth required.**

AI generates a personalized study plan for the user based on their profile, preferences, and optionally a career path.

**Request body:**
```json
{
  "goal": "string (required)",
  "start_date": "YYYY-MM-DD (required)",
  "end_date": "YYYY-MM-DD (optional)",
  "daily_hours": "integer 1–8 (required)",
  "career_path_id": "integer (optional)"
}
```

**Validation:**
- `goal` — required, non-empty string
- `start_date` — required, must be today or future date
- `daily_hours` — required, integer between 1 and 8
- `end_date` — optional, but if provided must be after `start_date`

**Logic:**
1. Fetch the user's `user_learning_preferences` (difficulty_preference, preferred_language) and `user_interests`
2. If `career_path_id` is provided, fetch linked content from `career_path_content` joined with `content` table, ordered by `order_index`
3. If no `career_path_id`, fetch recommended content: SELECT from `content` table where `category_id` matches user's interests (join `categories` with `user_interests`)
4. Determine end_date: if not provided, calculate as `start_date + 90 days`
5. Calculate total available days = end_date - start_date (inclusive)
6. Each session = 60 minutes by default. Total sessions = `Math.floor((total_days × daily_hours × 60) / 60)` capped at total content items available
7. Spread sessions evenly across days: assign `daily_hours` sessions per day, cycling through content items
8. Assign priority based on difficulty: `advanced = 3`, `intermediate = 2`, `beginner = 1`
9. Generate a title: e.g. `"Study Plan — {goal}"` truncated to 255 chars
10. INSERT into `study_plans` with `generated_by = 'ai'`
11. Bulk INSERT all sessions into `study_sessions`

**Response 201:**
```json
{
  "success": true,
  "data": {
    "plan": {
      "id": 1,
      "title": "Study Plan — Prepare for JEE",
      "goal": "Prepare for JEE",
      "start_date": "2025-01-01",
      "end_date": "2025-04-01",
      "status": "active",
      "generated_by": "ai"
    },
    "sessions_created": 42
  }
}
```

---

### GET /api/study-plans
**Auth required.**

List all study plans for the current user, most recent first.

**Query params:**
- `status` — filter by status (active | paused | completed | archived), optional

**Logic:**
- SELECT from `study_plans` WHERE `user_id = req.user.id`
- For each plan, include a computed `progress` object:
  - `total` — COUNT of sessions in the plan
  - `completed` — COUNT where status = 'completed'
  - `percent` — Math.round((completed / total) * 100) or 0 if total = 0

**Response 200:**
```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "title": "Study Plan — JEE Prep",
      "goal": "Crack JEE Main",
      "status": "active",
      "start_date": "2025-01-01",
      "end_date": "2025-04-01",
      "generated_by": "ai",
      "progress": { "total": 42, "completed": 10, "percent": 24 },
      "created_at": "2025-01-01T10:00:00Z"
    }
  ]
}
```

---

### GET /api/study-plans/:id
**Auth required.**

Get a specific study plan with all its sessions.

**Logic:**
1. SELECT plan from `study_plans` WHERE `id = :id` AND `user_id = req.user.id` → 404 if not found, 403 if belongs to another user
2. SELECT all sessions from `study_sessions` WHERE `plan_id = :id` ORDER BY `scheduled_date ASC`, `scheduled_time ASC NULLS LAST`
3. Compute progress stats (total, completed, missed, pending, percent)

**Response 200:**
```json
{
  "success": true,
  "data": {
    "id": 1,
    "title": "Study Plan — JEE Prep",
    "goal": "Crack JEE Main",
    "start_date": "2025-01-01",
    "end_date": "2025-04-01",
    "status": "active",
    "generated_by": "ai",
    "progress": {
      "total": 42,
      "completed": 10,
      "missed": 2,
      "pending": 30,
      "percent": 24
    },
    "sessions": [
      {
        "id": 1,
        "title": "Physics Chapter 1",
        "scheduled_date": "2025-01-01",
        "scheduled_time": "09:00",
        "duration_minutes": 60,
        "status": "completed",
        "priority": 2,
        "content_id": 5,
        "notes": null
      }
    ],
    "created_at": "2025-01-01T10:00:00Z"
  }
}
```

---

### POST /api/study-plans
**Auth required.**

Manually create a study plan (no AI generation, no auto-sessions).

**Request body:**
```json
{
  "title": "string (required)",
  "goal": "string (optional)",
  "start_date": "YYYY-MM-DD (required)",
  "end_date": "YYYY-MM-DD (optional)"
}
```

**Validation:**
- `title` — required, non-empty
- `start_date` — required, valid date

**Logic:** INSERT into `study_plans` with `generated_by = 'user'`. Return created plan.

**Response 201:**
```json
{
  "success": true,
  "data": {
    "id": 3,
    "title": "My Custom Plan",
    "goal": null,
    "start_date": "2025-02-01",
    "end_date": null,
    "status": "active",
    "generated_by": "user",
    "created_at": "2025-01-20T10:00:00Z"
  }
}
```

---

### PUT /api/study-plans/:id
**Auth required.**

Update a study plan's title, goal, dates, or status.

**Request body (all fields optional):**
```json
{
  "title": "string",
  "goal": "string",
  "end_date": "YYYY-MM-DD",
  "status": "active | paused | completed | archived"
}
```

**Logic:**
1. Verify plan belongs to `req.user.id` → 404 if not found, 403 if not owner
2. Only update fields that are actually present in the request body (partial update)
3. Always update `updated_at = NOW()`

**Response 200:** Return updated plan object.

---

### DELETE /api/study-plans/:id
**Auth required.**

Delete a plan and all its sessions (CASCADE handled by DB).

**Logic:** Verify plan belongs to `req.user.id`. DELETE FROM `study_plans` WHERE `id = :id`.

**Response 200:**
```json
{ "success": true, "data": { "message": "Study plan deleted successfully" } }
```

---

### GET /api/study-plans/:id/progress
**Auth required.**

Get detailed completion statistics for a plan.

**Logic:**
1. Verify plan belongs to `req.user.id`
2. Run aggregate query on `study_sessions` WHERE `plan_id = :id`
3. Compute weekly_summary: group sessions by ISO week, count completed vs missed per week
4. Compute daily_summary: group by `scheduled_date`, count sessions and completed per day

**Response 200:**
```json
{
  "success": true,
  "data": {
    "total_sessions": 42,
    "completed": 15,
    "missed": 3,
    "pending": 24,
    "completion_percent": 36,
    "weekly_summary": [
      { "week": "2025-W01", "completed": 5, "missed": 1, "total": 7 },
      { "week": "2025-W02", "completed": 4, "missed": 2, "total": 7 }
    ],
    "daily_summary": [
      { "date": "2025-01-01", "total": 3, "completed": 3, "missed": 0 },
      { "date": "2025-01-02", "total": 3, "completed": 2, "missed": 1 }
    ]
  }
}
```

---

### GET /api/study-plans/:id/sessions
**Auth required.**

Get sessions for a plan with optional filters.

**Query params:**
- `date` — filter by exact `scheduled_date` (YYYY-MM-DD)
- `status` — filter by `status` (pending | completed | missed | rescheduled)

**Logic:** Verify plan belongs to user. SELECT sessions with optional WHERE filters. Always order by `scheduled_date ASC`, `scheduled_time ASC NULLS LAST`.

**Response 200:**
```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "plan_id": 1,
      "title": "Physics Ch. 1",
      "scheduled_date": "2025-01-01",
      "scheduled_time": "09:00",
      "duration_minutes": 60,
      "status": "completed",
      "priority": 3,
      "content_id": 5,
      "notes": "Covered kinematics thoroughly",
      "completed_at": "2025-01-01T09:55:00Z"
    }
  ]
}
```

---

### POST /api/study-plans/:id/sessions
**Auth required.**

Manually add a custom session to an existing plan.

**Request body:**
```json
{
  "title": "string (required)",
  "scheduled_date": "YYYY-MM-DD (required)",
  "scheduled_time": "HH:MM (optional)",
  "duration_minutes": "integer (required, min: 5)",
  "content_id": "integer (optional)",
  "priority": "1 | 2 | 3 (default: 2)"
}
```

**Validation:**
- `title` — required
- `scheduled_date` — required, valid date
- `duration_minutes` — required, integer ≥ 5
- `priority` — must be 1, 2, or 3 if provided

**Logic:** Verify plan belongs to `req.user.id`. INSERT into `study_sessions`.

**Response 201:** Return created session object.

---

### PATCH /api/study-sessions/:id/complete
**Auth required.**

Mark a session as completed.

**Request body:**
```json
{ "notes": "string (optional)" }
```

**Logic:**
1. Find session by `id`, then get its `plan_id`, then verify `study_plans.user_id = req.user.id` → 403 if not owner
2. Check session is not already completed → 400 if already completed
3. UPDATE `study_sessions` SET `status = 'completed'`, `completed_at = NOW()`, `notes = notes` (if provided)
4. If session has a `content_id`, also UPSERT `user_content_progress`:
   - INSERT INTO `user_content_progress` (user_id, content_id, status, progress_percent, completed_at)
   - ON CONFLICT (user_id, content_id) DO UPDATE SET status = 'completed', progress_percent = 100, completed_at = NOW()

**Response 200:**
```json
{
  "success": true,
  "data": {
    "id": 1,
    "status": "completed",
    "completed_at": "2025-01-01T10:00:00Z",
    "notes": "Covered all key concepts"
  }
}
```

---

### PATCH /api/study-sessions/:id/reschedule
**Auth required.**

Reschedule a session to a new date/time.

**Request body:**
```json
{
  "new_date": "YYYY-MM-DD (required)",
  "new_time": "HH:MM (optional)",
  "reason": "missed | user_request | ai (default: user_request)"
}
```

**Validation:**
- `new_date` — required, valid date
- `reason` — must be one of: missed, user_request, ai

**Logic:**
1. Verify session ownership (via plan_id → study_plans.user_id)
2. Check session is not already completed → 400 if completed
3. INSERT into `study_session_reschedules` with `old_date = session.scheduled_date`, `new_date = new_date`, `reason = reason`
4. UPDATE `study_sessions` SET `scheduled_date = new_date`, `scheduled_time = new_time` (if provided), `status = 'rescheduled'`

**Response 200:**
```json
{
  "success": true,
  "data": {
    "session": {
      "id": 1,
      "scheduled_date": "2025-01-05",
      "scheduled_time": "10:00",
      "status": "rescheduled"
    },
    "reschedule_log": {
      "old_date": "2025-01-03",
      "new_date": "2025-01-05",
      "reason": "user_request"
    }
  }
}
```

---

### POST /api/study-sessions/auto-reschedule
**Auth required.**

AI automatically reschedules all missed sessions in a plan into future free slots.

**Request body:**
```json
{ "plan_id": "integer (required)" }
```

**Logic:**
1. Verify plan belongs to `req.user.id`
2. Fetch all sessions WHERE `plan_id = :plan_id` AND `status = 'missed'`
3. If none found, return `{ rescheduled_count: 0, sessions: [] }`
4. Fetch user's `daily_study_hours` from `user_learning_preferences` (default 2 if not set)
5. Get all existing future sessions for the plan, grouped by `scheduled_date` with their count
6. Find the plan's `end_date` (or default to today + 60 days if null)
7. For each missed session, find the next available day where the session count is less than `daily_hours`:
   - Start from `MAX(today, plan.start_date)`
   - Iterate days forward until a slot is found
   - Assign the missed session to that day
8. For each rescheduled session:
   - INSERT into `study_session_reschedules` (old_date, new_date, reason = 'ai')
   - UPDATE `study_sessions` SET `scheduled_date = new_date`, `status = 'rescheduled'`

**Response 200:**
```json
{
  "success": true,
  "data": {
    "rescheduled_count": 5,
    "sessions": [
      { "id": 3, "title": "Chemistry Ch. 2", "old_date": "2025-01-02", "new_date": "2025-01-07" },
      { "id": 4, "title": "Maths Algebra", "old_date": "2025-01-03", "new_date": "2025-01-07" }
    ]
  }
}
```

---

### DELETE /api/study-sessions/:id
**Auth required.**

Remove a single session from its plan.

**Logic:** Verify ownership via plan. DELETE FROM `study_sessions` WHERE `id = :id`.

**Response 200:**
```json
{ "success": true, "data": { "message": "Session deleted" } }
```

---

### GET /api/personalization/profile
**Auth required.**

Get the current user's personalization profile.

**Logic:**
1. SELECT from `personalization_profiles` WHERE `user_id = req.user.id`
2. If no row exists, return a default empty profile (do NOT return 404 — first-time users just have no profile yet)
3. If `rec_career_path_id` is set, JOIN with `career_paths` to include the career path title

**Response 200:**
```json
{
  "success": true,
  "data": {
    "exists": true,
    "recommended_career": {
      "id": 3,
      "title": "Software Engineer",
      "field": "Technology"
    },
    "strengths": ["problem-solving", "mathematics"],
    "areas_to_improve": ["communication", "design"],
    "ai_scores": {
      "aptitude": 78,
      "interest_match": 92,
      "consistency": 65
    },
    "last_assessed_at": "2025-10-01T10:00:00Z"
  }
}
```

**If no profile exists yet:**
```json
{
  "success": true,
  "data": {
    "exists": false,
    "recommended_career": null,
    "strengths": [],
    "areas_to_improve": [],
    "ai_scores": null,
    "last_assessed_at": null
  }
}
```

---

### POST /api/personalization/assess
**Auth required.**

Submit career assessment quiz answers. Updates the personalization profile and generates fresh recommendations.

**Request body:**
```json
{
  "quiz_answers": [
    { "question_id": 1, "answer": "A" },
    { "question_id": 2, "answer": "C" },
    { "question_id": 3, "answer": "B" }
  ]
}
```

**Validation:**
- `quiz_answers` — required, must be a non-empty array
- Each entry must have `question_id` (integer) and `answer` (string)

**Logic (implement a simple scoring algorithm):**
1. Define a scoring map (hardcode for now or load from DB):
   - Each answer maps to a score for different career categories (technology, arts, science, business, healthcare)
   - Example: `{ question_id: 1, A: { technology: 3, arts: 1 }, B: { science: 2 }, C: { business: 3 } }`
2. Sum category scores from all answers
3. Determine `top_career_category` = the category with highest score
4. SELECT matching `career_paths` WHERE `field ILIKE top_career_category` ORDER BY id LIMIT 1
5. Determine strengths: categories with score > 70% of max possible
6. Determine areas_to_improve: categories with score < 40% of max possible
7. Build `ai_scores` JSONB: `{ aptitude: score, interest_match: percent, consistency: (from past session data) }`
8. UPSERT into `personalization_profiles` (ON CONFLICT (user_id) DO UPDATE)
9. DELETE old recommendations for this user, then INSERT 3 fresh `ai_recommendations`:
   - One of type `career` pointing to the matched career path
   - One of type `content` pointing to a top content item matching their interests
   - One of type `study_time` suggesting daily hours based on their score

**Response 200:**
```json
{
  "success": true,
  "data": {
    "recommended_career": { "id": 2, "title": "Data Scientist", "field": "Technology" },
    "strengths": ["analytical-thinking", "mathematics"],
    "areas_to_improve": ["communication"],
    "ai_scores": { "aptitude": 82, "interest_match": 88, "consistency": 70 },
    "recommendations_generated": 3
  }
}
```

---

### GET /api/recommendations
**Auth required.**

Get the latest AI recommendations for the current user.

**Query params:**
- `type` — filter by type: `content | career | study_time | skill` (optional)

**Logic:** SELECT from `ai_recommendations` WHERE `user_id = req.user.id` AND `is_accepted IS NULL` (unacted-on recommendations). Apply type filter if provided. ORDER BY `created_at DESC`.

**Response 200:**
```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "type": "content",
      "recommendation_data": {
        "content_id": 5,
        "title": "Learn Python Basics",
        "reason": "Matches your interest in technology and your current difficulty preference"
      },
      "is_accepted": null,
      "created_at": "2025-10-01T10:00:00Z"
    },
    {
      "id": 2,
      "type": "career",
      "recommendation_data": {
        "career_path_id": 3,
        "title": "Software Engineer",
        "reason": "Best match based on your quiz results (88% interest match)"
      },
      "is_accepted": null,
      "created_at": "2025-10-01T10:00:00Z"
    },
    {
      "id": 3,
      "type": "study_time",
      "recommendation_data": {
        "suggested_daily_hours": 3,
        "reason": "Based on your aptitude score and past completion rate"
      },
      "is_accepted": null,
      "created_at": "2025-10-01T10:00:00Z"
    }
  ]
}
```

---

### PATCH /api/recommendations/:id/accept
**Auth required.**

Mark a recommendation as accepted and trigger a related action if applicable.

**Logic:**
1. Verify recommendation belongs to `req.user.id` → 404 if not found, 403 if not owner
2. UPDATE `ai_recommendations` SET `is_accepted = true`
3. Based on `type`, trigger a side effect:
   - `content` → UPSERT into `user_content_progress` with `status = 'not_started'` for that `content_id`
   - `career` → UPSERT into `personalization_profiles` setting `rec_career_path_id`
   - `study_time` → UPSERT into `user_learning_preferences` setting `daily_study_hours`
   - `skill` → no side effect, just mark accepted

**Response 200:**
```json
{
  "success": true,
  "data": {
    "id": 1,
    "type": "content",
    "is_accepted": true,
    "action_taken": "Content added to your learning list"
  }
}
```

---

### PATCH /api/recommendations/:id/dismiss
**Auth required.**

Dismiss a recommendation (mark as not accepted).

**Logic:**
1. Verify recommendation belongs to `req.user.id`
2. UPDATE `ai_recommendations` SET `is_accepted = false`

**Response 200:**
```json
{
  "success": true,
  "data": { "id": 1, "is_accepted": false }
}
```

---

## Implementation Notes

1. **Ownership check pattern** — always verify the resource belongs to `req.user.id` before any read/write/delete. For sessions, join through `study_plans` to check ownership:
   ```sql
   SELECT ss.* FROM study_sessions ss
   JOIN study_plans sp ON ss.plan_id = sp.id
   WHERE ss.id = $1 AND sp.user_id = $2
   ```

2. **Bulk insert sessions** — use a single INSERT with multiple value tuples for performance when generating a plan:
   ```sql
   INSERT INTO study_sessions (plan_id, content_id, title, scheduled_date, duration_minutes, priority)
   VALUES ($1, $2, $3, $4, $5, $6), ($7, $8, $9, $10, $11, $12), ...
   ```

3. **Partial update pattern** — for PUT /api/study-plans/:id, only update fields present in the request:
   ```javascript
   const fields = [];
   const values = [];
   let i = 1;
   if (body.title !== undefined) { fields.push(`title = $${i++}`); values.push(body.title); }
   if (body.goal !== undefined)  { fields.push(`goal = $${i++}`);  values.push(body.goal); }
   // ... etc
   fields.push(`updated_at = NOW()`);
   values.push(planId, req.user.id);
   await pool.query(`UPDATE study_plans SET ${fields.join(', ')} WHERE id = $${i++} AND user_id = $${i}`, values);
   ```

4. **Date handling** — store and retrieve dates as `YYYY-MM-DD` strings. For date arithmetic in Node.js, use the built-in `Date` object or the `date-fns` library. Do not use `moment.js`.

5. **JSONB fields** — `ai_scores`, `recommendation_data`, and `context` are stored as JSONB in PostgreSQL. Pass them as plain JS objects in queries — `node-postgres` serializes them automatically.

6. **PostgreSQL arrays** — `strengths` and `areas_to_improve` are `text[]`. Pass as JS arrays: `['skill1', 'skill2']`. Query with `= ANY($1)` for containment checks.

7. **Transaction for generate** — wrap the study plan INSERT + bulk sessions INSERT in a single `pg` transaction so they either both succeed or both roll back:
   ```javascript
   const client = await pool.connect();
   try {
     await client.query('BEGIN');
     const plan = await client.query('INSERT INTO study_plans ...', [...]);
     await client.query('INSERT INTO study_sessions ...', [...]);
     await client.query('COMMIT');
   } catch (e) {
     await client.query('ROLLBACK');
     throw e;
   } finally {
     client.release();
   }
   ```

8. **Express validator** — example for POST /api/study-plans/generate:
   ```javascript
   const { body, validationResult } = require('express-validator');
   
   const validateGenerate = [
     body('goal').notEmpty().withMessage('Goal is required'),
     body('start_date').isDate().withMessage('start_date must be a valid date (YYYY-MM-DD)'),
     body('daily_hours').isInt({ min: 1, max: 8 }).withMessage('daily_hours must be between 1 and 8'),
     body('end_date').optional().isDate().withMessage('end_date must be a valid date'),
     (req, res, next) => {
       const errors = validationResult(req);
       if (!errors.isEmpty()) return res.status(400).json({ success: false, error: errors.array()[0].msg });
       next();
     }
   ];
   ```

9. **Error handling** — wrap all controller functions in try/catch. On unhandled errors, return `500` with a generic message (do not expose the raw error in production):
   ```javascript
   } catch (err) {
     console.error(err);
     res.status(500).json({ success: false, error: 'Internal server error' });
   }
   ```
