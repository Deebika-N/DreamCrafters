# Dream Crafters — Module 4: Chatbot & Guidance Engine
## Implementation Prompt

---

## Your Task
Implement the **Chatbot & Guidance Engine** backend module for the Dream Crafters platform using the stack and spec below. Implement all routes, business logic, and database queries exactly as described.

---

## Tech Stack
- **Runtime**: Node.js with Express.js
- **Database**: PostgreSQL using `node-postgres` (`pg` package)
- **Auth**: JWT middleware (the `authenticate` function is already implemented in `middleware/auth.js` — it verifies the Bearer token and attaches `req.user = { id, role }` to the request)
- **Role check helper**: `req.user.role` is one of `student | mentor | admin`
- **Validation**: `express-validator` on all POST/PUT/PATCH routes
- **File structure**:
  ```
  routes/chat.js
  routes/mentorship.js
  controllers/chatController.js
  controllers/mentorshipController.js
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

### `chat_sessions`
```sql
CREATE TABLE chat_sessions (
  id            SERIAL PRIMARY KEY,
  user_id       INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  session_type  VARCHAR(50) DEFAULT 'general',   -- general | career | study | navigation
  started_at    TIMESTAMP DEFAULT NOW(),
  ended_at      TIMESTAMP,                       -- NULL = active session
  context       JSONB                            -- Persistent context state for AI
);
```

### `chat_messages`
```sql
CREATE TABLE chat_messages (
  id          SERIAL PRIMARY KEY,
  session_id  INTEGER NOT NULL REFERENCES chat_sessions(id) ON DELETE CASCADE,
  role        VARCHAR(20) NOT NULL,              -- user | bot
  message     TEXT NOT NULL,
  metadata    JSONB,                             -- intent, confidence, quick_replies[]
  created_at  TIMESTAMP DEFAULT NOW()
);
```

### `mentor_sessions`
```sql
CREATE TABLE mentor_sessions (
  id               SERIAL PRIMARY KEY,
  mentor_id        INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  student_id       INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  status           VARCHAR(20) DEFAULT 'requested',  -- requested | accepted | rejected | completed | cancelled
  scheduled_at     TIMESTAMP,                        -- Set when mentor accepts
  duration_minutes INTEGER DEFAULT 60,
  topic            VARCHAR(255),                     -- What the student wants guidance on
  meet_link        TEXT,                             -- Added by mentor when accepting
  created_at       TIMESTAMP DEFAULT NOW()
);
```

### `mentor_feedback`
```sql
CREATE TABLE mentor_feedback (
  id            SERIAL PRIMARY KEY,
  session_id    INTEGER NOT NULL REFERENCES mentor_sessions(id) ON DELETE CASCADE,
  from_user_id  INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  rating        INTEGER CHECK (rating >= 1 AND rating <= 5),
  comment       TEXT,
  created_at    TIMESTAMP DEFAULT NOW()
);
```

---

## Routes to Implement

### Route File: `routes/chat.js`
```
POST   /api/chat/sessions                    → Start a new chat session
GET    /api/chat/sessions                    → List user's past chat sessions
GET    /api/chat/sessions/:id/messages       → Get all messages in a session
POST   /api/chat/sessions/:id/messages       → Send a message, get bot reply
PATCH  /api/chat/sessions/:id/end            → End a chat session
DELETE /api/chat/sessions/:id                → Delete session and its messages
```

### Route File: `routes/mentorship.js`
```
GET    /api/mentors                          → List available mentors
GET    /api/mentors/:id                      → Get mentor profile
POST   /api/mentor-sessions                  → Student requests a mentorship session
GET    /api/mentor-sessions                  → List sessions (role-based)
GET    /api/mentor-sessions/:id              → Get session details
PATCH  /api/mentor-sessions/:id/accept       → Mentor accepts request
PATCH  /api/mentor-sessions/:id/reject       → Mentor rejects request
PATCH  /api/mentor-sessions/:id/complete     → Mark session as completed
POST   /api/mentor-sessions/:id/feedback     → Submit feedback after session
```

All routes require authentication. Use the `authenticate` middleware on all of them.

---

## Detailed Route Specifications

---

## SECTION A: Chatbot Routes

---

### POST /api/chat/sessions
**Auth required.**

Start a new chat session for the current user.

**Request body:**
```json
{
  "session_type": "general | career | study | navigation (optional, default: 'general')"
}
```

**Validation:**
- `session_type` — optional, must be one of: general, career, study, navigation

**Logic:**
1. INSERT into `chat_sessions` with `user_id = req.user.id`, `session_type`, `started_at = NOW()`, `context = {}`
2. Return the created session

**Response 201:**
```json
{
  "success": true,
  "data": {
    "id": 1,
    "user_id": 5,
    "session_type": "career",
    "started_at": "2025-01-15T10:00:00Z",
    "ended_at": null,
    "context": {}
  }
}
```

---

### GET /api/chat/sessions
**Auth required.**

List the current user's past chat sessions, most recent first.

**Query params:**
- `session_type` — filter by type (general | career | study | navigation), optional
- `active` — if `true`, only show sessions where `ended_at IS NULL`, optional

**Logic:**
- SELECT from `chat_sessions` WHERE `user_id = req.user.id`
- Apply optional filters
- For each session, include `message_count` (COUNT of messages in that session) using a subquery or LEFT JOIN
- ORDER BY `started_at DESC`

**Response 200:**
```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "session_type": "career",
      "started_at": "2025-01-15T10:00:00Z",
      "ended_at": null,
      "message_count": 12
    },
    {
      "id": 2,
      "session_type": "general",
      "started_at": "2025-01-14T08:00:00Z",
      "ended_at": "2025-01-14T08:30:00Z",
      "message_count": 8
    }
  ]
}
```

---

### GET /api/chat/sessions/:id/messages
**Auth required.**

Get all messages in a specific chat session, ordered chronologically.

**Logic:**
1. Verify session exists and belongs to `req.user.id` → 404 if not found, 403 if not owner
2. SELECT from `chat_messages` WHERE `session_id = :id` ORDER BY `created_at ASC`

**Response 200:**
```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "role": "user",
      "message": "What career options are there in AI?",
      "metadata": null,
      "created_at": "2025-01-15T10:00:30Z"
    },
    {
      "id": 2,
      "role": "bot",
      "message": "Great question! AI offers many career paths including...",
      "metadata": {
        "intent": "career_inquiry",
        "confidence": 0.92,
        "quick_replies": ["Tell me about ML Engineer", "Data Scientist roles", "AI Research"]
      },
      "created_at": "2025-01-15T10:00:32Z"
    }
  ]
}
```

---

### POST /api/chat/sessions/:id/messages
**Auth required.**

Send a user message and receive an AI bot reply. Both the user message and bot reply are stored.

**Request body:**
```json
{
  "message": "string (required)"
}
```

**Validation:**
- `message` — required, non-empty string

**Logic:**
1. Verify session exists and belongs to `req.user.id` → 404/403
2. Verify session is active (`ended_at IS NULL`) → 400 if session is ended
3. INSERT user message into `chat_messages` with `role = 'user'`
4. Generate bot response:
   - Fetch session `context` from `chat_sessions`
   - Fetch the last 10 messages from this session for conversation history
   - Based on `session_type`, apply different response strategies:
     - `general` — generic helpful responses
     - `career` — career-focused guidance, reference `career_paths` table
     - `study` — study plan tips, reference user's `study_plans` and `study_sessions`
     - `navigation` — help navigating the platform
   - For MVP: implement a simple rule-based response engine with keyword matching. The bot should:
     - Detect keywords/intents from the user message
     - Return a relevant response with metadata containing `intent`, `confidence`, and optionally `quick_replies`
   - Update session `context` with latest state (last intent, topic, etc.)
5. INSERT bot message into `chat_messages` with `role = 'bot'` and metadata
6. UPDATE `chat_sessions` SET `context = updated_context`

**Response 200:**
```json
{
  "success": true,
  "data": {
    "user_message": {
      "id": 5,
      "role": "user",
      "message": "How do I become a data scientist?",
      "created_at": "2025-01-15T10:05:00Z"
    },
    "bot_reply": {
      "id": 6,
      "role": "bot",
      "message": "To become a Data Scientist, you'll need strong skills in statistics, Python, and machine learning. Here's a recommended path...",
      "metadata": {
        "intent": "career_guidance",
        "confidence": 0.88,
        "quick_replies": ["Show me DS courses", "What salary can I expect?", "Create a study plan"]
      },
      "created_at": "2025-01-15T10:05:01Z"
    }
  }
}
```

---

### PATCH /api/chat/sessions/:id/end
**Auth required.**

End an active chat session by setting `ended_at`.

**Logic:**
1. Verify session belongs to `req.user.id` → 404/403
2. Check session is not already ended → 400 if `ended_at IS NOT NULL`
3. UPDATE `chat_sessions` SET `ended_at = NOW()` WHERE `id = :id`

**Response 200:**
```json
{
  "success": true,
  "data": {
    "id": 1,
    "ended_at": "2025-01-15T11:00:00Z",
    "message": "Chat session ended"
  }
}
```

---

### DELETE /api/chat/sessions/:id
**Auth required.**

Delete a chat session and all its messages (CASCADE handled by DB).

**Logic:**
1. Verify session belongs to `req.user.id` → 404/403
2. DELETE FROM `chat_sessions` WHERE `id = :id`

**Response 200:**
```json
{ "success": true, "data": { "message": "Chat session deleted" } }
```

---

## SECTION B: Mentorship Routes

---

### GET /api/mentors
**Auth required.**

List available mentors with their fields/topics. Only users with `role = 'mentor'` are listed.

**Query params:**
- `field` — filter mentors by interests that match this field (ILIKE), optional
- `topic` — filter by topic keyword in past session topics (ILIKE), optional
- `page` — integer, default 1
- `limit` — integer, default 20, max 100

**Logic:**
1. SELECT from `users` WHERE `role = 'mentor'` AND `is_active = true`
2. For each mentor include:
   - `total_sessions` — COUNT from `mentor_sessions` WHERE `mentor_id = user.id` AND `status = 'completed'`
   - `avg_rating` — AVG of `rating` from `mentor_feedback` joined through `mentor_sessions`
   - `interests` — from `user_interests` table
3. If `field` is provided, filter mentors whose interests match (JOIN `user_interests` WHERE `interest ILIKE '%' || field || '%'`)
4. If `topic` is provided, filter mentors who have past sessions with matching topics
5. Paginate results

**SQL pattern:**
```sql
SELECT
  u.id, u.name, u.email, u.profile_pic_url, u.location,
  COUNT(DISTINCT ms.id) FILTER (WHERE ms.status = 'completed') AS total_sessions,
  ROUND(AVG(mf.rating)::numeric, 1) AS avg_rating,
  ARRAY_AGG(DISTINCT ui.interest) AS interests,
  COUNT(*) OVER() AS total_count
FROM users u
LEFT JOIN mentor_sessions ms ON u.id = ms.mentor_id
LEFT JOIN mentor_feedback mf ON ms.id = mf.session_id
LEFT JOIN user_interests ui ON u.id = ui.user_id
WHERE u.role = 'mentor' AND u.is_active = true
GROUP BY u.id
ORDER BY avg_rating DESC NULLS LAST, total_sessions DESC
LIMIT $1 OFFSET $2
```

**Response 200:**
```json
{
  "success": true,
  "data": [
    {
      "id": 10,
      "name": "Dr. Ramesh Kumar",
      "email": "ramesh@example.com",
      "profile_pic_url": "https://...",
      "location": "Chennai",
      "interests": ["machine-learning", "data-science"],
      "total_sessions": 25,
      "avg_rating": 4.7
    }
  ],
  "pagination": { "page": 1, "limit": 20, "total": 8 }
}
```

---

### GET /api/mentors/:id
**Auth required.**

Get a mentor's detailed profile with session history stats and average rating.

**Logic:**
1. SELECT from `users` WHERE `id = :id` AND `role = 'mentor'` → 404 if not found or not a mentor
2. Fetch completed session count, avg rating, and recent feedback
3. Fetch mentor's interests from `user_interests`
4. Fetch mentor's learning preferences (if any) to show their expertise areas

**Response 200:**
```json
{
  "success": true,
  "data": {
    "id": 10,
    "name": "Dr. Ramesh Kumar",
    "email": "ramesh@example.com",
    "profile_pic_url": "https://...",
    "location": "Chennai",
    "interests": ["machine-learning", "data-science", "python"],
    "stats": {
      "total_sessions": 25,
      "avg_rating": 4.7,
      "total_reviews": 20
    },
    "recent_feedback": [
      {
        "rating": 5,
        "comment": "Excellent guidance on ML fundamentals",
        "created_at": "2025-01-10T10:00:00Z"
      }
    ]
  }
}
```

---

### POST /api/mentor-sessions
**Auth required.**

Student requests a mentorship session with a specific mentor.

**Request body:**
```json
{
  "mentor_id": "integer (required)",
  "topic": "string (required)",
  "preferred_time": "ISO datetime string (optional)"
}
```

**Validation:**
- `mentor_id` — required, integer
- `topic` — required, non-empty string
- `preferred_time` — optional, valid ISO datetime

**Logic:**
1. Verify `req.user.role === 'student'` → 403 if user is not a student
2. Verify mentor exists and has `role = 'mentor'` → 404 if not found
3. Check for existing pending request from this student to this mentor → 409 if duplicate
4. INSERT into `mentor_sessions` with `student_id = req.user.id`, `mentor_id`, `topic`, `status = 'requested'`, `scheduled_at = preferred_time` (if provided, otherwise NULL)

**Response 201:**
```json
{
  "success": true,
  "data": {
    "id": 1,
    "mentor_id": 10,
    "student_id": 5,
    "topic": "Career guidance in AI/ML",
    "status": "requested",
    "scheduled_at": null,
    "duration_minutes": 60,
    "created_at": "2025-01-15T10:00:00Z"
  }
}
```

---

### GET /api/mentor-sessions
**Auth required.**

List mentorship sessions. Students see their own sessions; mentors see sessions assigned to them.

**Query params:**
- `status` — filter by status (requested | accepted | rejected | completed | cancelled), optional

**Logic:**
- If `req.user.role === 'student'`: SELECT WHERE `student_id = req.user.id`
- If `req.user.role === 'mentor'`: SELECT WHERE `mentor_id = req.user.id`
- If `req.user.role === 'admin'`: SELECT all sessions
- JOIN with `users` twice (once for mentor name, once for student name)
- Apply optional `status` filter
- ORDER BY `created_at DESC`

**Response 200:**
```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "mentor": { "id": 10, "name": "Dr. Ramesh Kumar" },
      "student": { "id": 5, "name": "Arun Student" },
      "topic": "Career guidance in AI/ML",
      "status": "requested",
      "scheduled_at": null,
      "duration_minutes": 60,
      "meet_link": null,
      "created_at": "2025-01-15T10:00:00Z"
    }
  ]
}
```

---

### GET /api/mentor-sessions/:id
**Auth required.**

Get full details of a specific mentorship session.

**Logic:**
1. SELECT from `mentor_sessions` WHERE `id = :id`
2. Verify user is either the mentor, the student, or an admin → 403 if not
3. JOIN with `users` for mentor and student details
4. Include feedback (if any) from `mentor_feedback`

**Response 200:**
```json
{
  "success": true,
  "data": {
    "id": 1,
    "mentor": { "id": 10, "name": "Dr. Ramesh Kumar", "email": "ramesh@example.com" },
    "student": { "id": 5, "name": "Arun Student", "email": "arun@example.com" },
    "topic": "Career guidance in AI/ML",
    "status": "accepted",
    "scheduled_at": "2025-01-20T14:00:00Z",
    "duration_minutes": 60,
    "meet_link": "https://meet.google.com/abc-defg-hij",
    "created_at": "2025-01-15T10:00:00Z",
    "feedback": [
      {
        "id": 1,
        "from_user_id": 5,
        "from_user_name": "Arun Student",
        "rating": 5,
        "comment": "Very helpful session!",
        "created_at": "2025-01-20T15:10:00Z"
      }
    ]
  }
}
```

---

### PATCH /api/mentor-sessions/:id/accept
**Auth required. Mentor only.**

Mentor accepts a session request, sets the scheduled time and meet link.

**Request body:**
```json
{
  "scheduled_at": "ISO datetime (required)",
  "meet_link": "string (required)",
  "duration_minutes": "integer (optional, default: 60)"
}
```

**Validation:**
- `scheduled_at` — required, valid ISO datetime, must be a future date
- `meet_link` — required, non-empty string

**Logic:**
1. Verify session exists → 404
2. Verify `req.user.id === mentor_id` of the session → 403 if not the assigned mentor
3. Verify session `status === 'requested'` → 400 if not in `requested` status
4. UPDATE `mentor_sessions` SET `status = 'accepted'`, `scheduled_at`, `meet_link`, `duration_minutes` (if provided)

**Response 200:**
```json
{
  "success": true,
  "data": {
    "id": 1,
    "status": "accepted",
    "scheduled_at": "2025-01-20T14:00:00Z",
    "meet_link": "https://meet.google.com/abc-defg-hij",
    "duration_minutes": 60
  }
}
```

---

### PATCH /api/mentor-sessions/:id/reject
**Auth required. Mentor only.**

Mentor rejects a session request.

**Request body (optional):**
```json
{
  "reason": "string (optional)"
}
```

**Logic:**
1. Verify session exists → 404
2. Verify `req.user.id === mentor_id` → 403
3. Verify session `status === 'requested'` → 400
4. UPDATE `mentor_sessions` SET `status = 'rejected'`

**Response 200:**
```json
{
  "success": true,
  "data": {
    "id": 1,
    "status": "rejected",
    "message": "Session request rejected"
  }
}
```

---

### PATCH /api/mentor-sessions/:id/complete
**Auth required.**

Mark a session as completed. Either mentor or student can mark it.

**Logic:**
1. Verify session exists → 404
2. Verify user is either the `mentor_id` or `student_id` → 403
3. Verify session `status === 'accepted'` → 400 if not accepted
4. UPDATE `mentor_sessions` SET `status = 'completed'`

**Response 200:**
```json
{
  "success": true,
  "data": {
    "id": 1,
    "status": "completed",
    "message": "Session marked as completed"
  }
}
```

---

### POST /api/mentor-sessions/:id/feedback
**Auth required.**

Submit feedback after a completed mentorship session. Either participant can submit.

**Request body:**
```json
{
  "rating": "integer 1–5 (required)",
  "comment": "string (optional)"
}
```

**Validation:**
- `rating` — required, integer between 1 and 5
- `comment` — optional, string

**Logic:**
1. Verify session exists → 404
2. Verify user is either `mentor_id` or `student_id` of the session → 403
3. Verify session `status === 'completed'` → 400 if session is not completed
4. Check if user has already submitted feedback for this session → 409 if duplicate
5. INSERT into `mentor_feedback` with `session_id`, `from_user_id = req.user.id`, `rating`, `comment`

**Response 201:**
```json
{
  "success": true,
  "data": {
    "id": 1,
    "session_id": 1,
    "from_user_id": 5,
    "rating": 5,
    "comment": "Very helpful session, learned a lot about AI career paths!",
    "created_at": "2025-01-20T15:10:00Z"
  }
}
```

---

## Implementation Notes

1. **Ownership check pattern** — always verify the resource belongs to `req.user.id` before any read/write/delete. For chat messages, join through `chat_sessions` to check ownership:
   ```sql
   SELECT cs.* FROM chat_sessions cs
   WHERE cs.id = $1 AND cs.user_id = $2
   ```

2. **Role-based access for mentorship** — mentor endpoints must verify `req.user.id === session.mentor_id`. Student endpoints must verify `req.user.id === session.student_id`. Use a helper function:
   ```javascript
   const verifySessionAccess = async (sessionId, userId, requiredRole) => {
     const result = await pool.query(
       'SELECT * FROM mentor_sessions WHERE id = $1', [sessionId]
     );
     if (!result.rows.length) return { error: 'not_found' };
     const session = result.rows[0];
     if (requiredRole === 'mentor' && session.mentor_id !== userId) return { error: 'forbidden' };
     if (requiredRole === 'student' && session.student_id !== userId) return { error: 'forbidden' };
     if (requiredRole === 'participant' && session.mentor_id !== userId && session.student_id !== userId) return { error: 'forbidden' };
     return { session };
   };
   ```

3. **Bot response engine** — for MVP, implement a keyword-based response system:
   ```javascript
   const generateBotResponse = (message, sessionType, context) => {
     const lowerMsg = message.toLowerCase();
     let intent = 'general';
     let confidence = 0.5;
     let reply = '';
     let quickReplies = [];

     if (lowerMsg.includes('career') || lowerMsg.includes('job')) {
       intent = 'career_inquiry';
       confidence = 0.85;
       reply = 'I can help with career guidance! ...';
       quickReplies = ['Explore career paths', 'Take assessment quiz'];
     }
     // ... more keyword rules

     return { reply, metadata: { intent, confidence, quick_replies: quickReplies } };
   };
   ```

4. **Date handling** — store and retrieve timestamps as ISO strings. For `scheduled_at`, always validate it is a future datetime.

5. **JSONB fields** — `context` and `metadata` are stored as JSONB in PostgreSQL. Pass them as plain JS objects in queries — `node-postgres` serializes them automatically.

6. **Duplicate feedback check** — before inserting feedback, query:
   ```sql
   SELECT id FROM mentor_feedback
   WHERE session_id = $1 AND from_user_id = $2
   ```

7. **Express validator** — example for POST /api/mentor-sessions:
   ```javascript
   const { body, validationResult } = require('express-validator');

   const validateMentorRequest = [
     body('mentor_id').isInt().withMessage('mentor_id must be an integer'),
     body('topic').notEmpty().withMessage('Topic is required'),
     body('preferred_time').optional().isISO8601().withMessage('preferred_time must be a valid datetime'),
     (req, res, next) => {
       const errors = validationResult(req);
       if (!errors.isEmpty()) return res.status(400).json({ success: false, error: errors.array()[0].msg });
       next();
     }
   ];
   ```

8. **Error handling** — wrap all controller functions in try/catch. On unhandled errors, return `500` with a generic message (do not expose the raw error in production):
   ```javascript
   } catch (err) {
     console.error(err);
     res.status(500).json({ success: false, error: 'Internal server error' });
   }
   ```

9. **Mentor listing performance** — the `GET /api/mentors` query involves multiple JOINs and aggregations. Consider adding indexes:
   ```sql
   CREATE INDEX idx_mentor_sessions_mentor_id ON mentor_sessions(mentor_id);
   CREATE INDEX idx_mentor_feedback_session_id ON mentor_feedback(session_id);
   CREATE INDEX idx_users_role ON users(role);
   ```
