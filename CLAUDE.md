# 饭局星球 (Fanjuxingqiu) — CLAUDE.md

## Startup Workflow

Before writing code:

1. **Read this file** completely
2. **Read `docs/harness/feature_list.json`** — see what's done and what's active
3. **Read `docs/harness/progress.md`** — see what the last session did
4. **Check `git log --oneline -5`** — confirm you're on the right branch
5. **Verify backend** — `curl http://localhost:2001/api/health`

## Working Rules

- **One feature at a time**: Pick exactly one unfinished feature from `feature_list.json`. Don't fix unrelated things along the way.
- **Verification required**: Don't claim done without running checks from `docs/harness/CHECKLIST.md`.
- **Stay in scope**: Only modify files listed in the feature's `files` field in `feature_list.json`.
- **Doc sync before commit**: Run `bash docs/harness/done_check.sh` before every commit. If it fails, update docs first.
- **Evidence matters**: Every completed item needs a commit hash, test output, or screenshot reference.

## Definition of Done

A feature is done only when ALL of the following are true:

- Implementation matches the `done_criteria` in `feature_list.json`
- Backend health check passes (`curl /api/health`)
- Only files in the feature's scope were modified
- `progress.md` updated with changes
- `feature_list.json` status updated with evidence
- `bash docs/harness/done_check.sh` passes

## End of Session

1. Update `docs/harness/progress.md` with current state (append, don't rewrite)
2. Update `docs/harness/feature_list.json` with new status + evidence
3. Update `docs/harness/session-handoff.md` for next session
4. Run `bash docs/harness/done_check.sh` — all checks must pass
5. Commit with descriptive message
6. Leave repo clean: `npm start` should work immediately

## Deployment Awareness

- **`yunfuwu` branch auto-deploys**: Pushing to yunfuwu triggers GitHub Actions deploy to `https://sprog-man.fanjuxingqiu.ccwu.cc`
- **`.env` never committed**: Contains real OSS credentials — see `.dockerignore` and `.gitignore`
- **Mini program frontend**: Published via WeChat DevTools, NOT through CI
- **Test on local first**: Always verify with `curl /api/health` before pushing to yunfuwu
- **pm2 on server**: Production runs under pm2; CI restarts via SSH

## Project Overview
饭局星球 is a WeChat Mini Program (微信小程序) that solves group dining decision pain points. It offers: random food spinner, "who pays" games, relationship visualization, dining journal, check-in map, photo album, and friend management.

**Tagline**: "每一桌聚餐，都是一颗独特的星球。"

## Tech Stack

| Layer | Technology | Details |
|-------|-----------|---------|
| **Frontend** | WeChat Native Mini Program | `project/frontend/miniapp/` |
| **Backend** | Node.js + Express | `project/backend/src/app.js` |
| **Database** | MongoDB (Mongoose) | DB name: `fanjuxingqiu` |
| **Real-time** | WebSocket (ws) | Room-based multiplayer gaming |
| **Admin Panel** | Vanilla HTML + CSS + JS | Served at `/admin` |
| **Auth** | JWT (jsonwebtoken) | Mini program + admin share same secret |
| **Storage** | Alibaba Cloud OSS | Ali-SDK for image/photo uploads |
| **Cloud** | WeChat Cloud Development | Env: `prod-d4guifrt160355bbc` |

## Port & Environment

| Service | Port | URL |
|---------|------|-----|
| Backend API + Admin | 2001 | `http://localhost:2001` |
| Health check | — | `GET /api/health` |
| Seed data | — | `POST /api/seed/all` |
| Admin panel | — | `http://localhost:2001/admin` |

**Environment variables** (in `project/backend/.env`):
- `PORT` — default `2001`
- `MONGO_URI` — MongoDB connection string
- `JWT_SECRET` — shared JWT signing key
- `WECHAT_APPID` / `WECHAT_SECRET` — WeChat login credentials
- `ADMIN_USER` / `ADMIN_PASS` — admin panel credentials
- `OSS_*` — Alibaba Cloud OSS configuration

## Directory Structure

```
fanjuxingqiu-crow/
├── project/
│   ├── frontend/
│   │   ├── miniapp/                  # WeChat mini program (main package ~5 pages)
│   │   │   ├── app.js / app.json / app.wxss
│   │   │   ├── pages/                # Main tab bar pages
│   │   │   │   ├── eat/index         # 吃什么 — random food spinner (Canvas)
│   │   │   │   ├── pay/index         # 谁买单 — games + AA accounting
│   │   │   │   ├── record/index      # 聚餐记录本 — list view
│   │   │   │   ├── map/index         # 打卡地图 — city footprints
│   │   │   │   └── mine/index        # 我的 — home / settings
│   │   │   ├── subpackages/          # Sub-packages (lazy-loaded)
│   │   │   │   ├── record/           #   create.js, detail.js
│   │   │   │   ├── mine/             #   relation.js, album.js, buddies.js
│   │   │   │   └── room/             #   index.js (WebSocket multiplayer room)
│   │   │   │       └── utils/        #   anim.js, ws.js
│   │   │   ├── images/               # Tab bar icons
│   │   │   └── utils/                # Shared utilities
│   │   └── admin/                    # Admin panel (vanilla HTML/CSS/JS)
│   │       ├── index.html
│   │       ├── css/style.css
│   │       └── js/api.js
│   └── backend/
│       ├── src/
│       │   ├── app.js                # Express entry point (HTTP server)
│       │   ├── config/               # Config (port, mongo, jwt, wechat, admin, oss)
│       │   ├── middleware/           # adminAuth.js (JWT verification)
│       │   ├── models/               # Mongoose schemas
│       │   │   ├── user.js           # User: openid, nickname, avatar, tags
│       │   │   ├── gathering.js      # Gathering: title, location, participants, cost
│       │   │   ├── relation.js       # Relation: bidirectional friendship graph
│       │   │   ├── cuisine.js        # Cuisine types for spinner
│       │   │   ├── dish.js           # Individual dishes (for spinner)
│       │   │   ├── aaRecord.js       # AA payment tracking
│       │   │   ├── buddy.js          # Friend contacts
│       │   │   └── invitation.js     # Room invitation persistence
│       │   ├── routes/               # API endpoints
│       │   │   ├── auth.js           # POST /api/auth/login (WeChat login)
│       │   │   ├── wheel.js          # Food spinner + voting
│       │   │   ├── tarot.js          # Card reading + avatar upload
│       │   │   ├── game.js           # Pay games (draw, crocodile, pirate, AA)
│       │   │   ├── gathering.js      # CRUD + stats for dining records
│       │   │   ├── relation.js       # Relationship graph API
│       │   │   ├── map.js            # City footprint aggregation
│       │   │   ├── ai.js             # AI memory text generation
│       │   │   ├── preference.js     # User taste preference tracking
│       │   │   ├── buddy.js          # Friend management (create/accept/reject/delete)
│       │   │   ├── room.js           # Room creation/joining API
│       │   │   ├── seed.js           # Seed data endpoint
│       │   │   └── admin.js          # Admin panel data (stats, users, gatherings)
│       │   ├── ws/                   # WebSocket layer
│       │   │   ├── index.js          # Connection handler, room events
│       │   │   ├── roomManager.js    # Room lifecycle management
│       │   │   └── gameHandler.js    # Game events within rooms
│       │   └── utils/
│       │       └── oss.js            # Alibaba Cloud OSS helpers
│       ├── .env                      # Environment variables
│       └── Dockerfile                # Container deployment
├── database/
│   └── init.mongodb.js              # MongoDB collection + index setup
├── doc/                              # Design docs (gitignored)
├── utils/
│   ├── backup-db.js                 # Database backup script
│   └── upload-tarot-to-oss.js       # Bulk tarot image upload
├── project.config.json              # WeChat DevTools project config
├── start-server.bat                 # Quick backend start (Windows)
└── README.md                        # Project readme
```

## Key Architecture Decisions

### 1. Dual Persistence Pattern
Most data writes to BOTH MongoDB (online) AND `wx.setStorageSync` (offline). The App instance (`project/frontend/miniapp/app.js`) provides `api*` wrapper methods that automatically fall back to local storage when offline or not logged in.

### 2. WebSocket Room System
The room system (`project/backend/src/ws/`) supports real-time multiplayer games:
- Rooms have unique 6-char codes
- Members track `openid` for cross-device invites
- Heartbeat ping/pong every 30s
- Auto-cleanup of stale rooms

### 3. Mini Program Package Splitting
- **Main package**: 5 tab bar pages (eat, pay, record list, map, mine home)
- **Sub-packages**: record/create, record/detail, mine/relation, mine/album, mine/buddies, room
- Preload configured: opening record/index preloads "record" package; opening mine/index preloads "mine" package

### 4. Environment Detection
App auto-detects WeChat version type:
- `develop` → uses `http://localhost:2001`
- `trial`/`release` → uses `https://sprog-man.fanjuxingqiu.ccwu.cc`

### 5. Avatar Handling
Avatars go through upload → OSS flow. Temporary paths (`wxfile://`, `http://tmp/`) are detected and uploaded before login. Stale temp paths in storage are cleaned on `onLaunch`.

## API Route Map

| Prefix | File | Purpose |
|--------|------|---------|
| `/api/auth/*` | routes/auth.js | WeChat login, JWT issuance |
| `/api/wheel/*` | routes/wheel.js | Food spinner, cuisines, voting |
| `/api/tarot/*` | routes/tarot.js | Tarot cards, avatar upload |
| `/api/game/*` | routes/game.js | Pay games (draw, croc, pirate, AA) |
| `/api/gathering/*` | routes/gathering.js | CRUD + stats for dining records |
| `/api/relation/*` | routes/relation.js | Relationship graph, titles |
| `/api/map/*` | routes/map.js | City footprints, leaderboards |
| `/api/ai/*` | routes/ai.js | AI memory text generation |
| `/api/preference/*` | routes/preference.js | User taste preferences |
| `/api/buddy/*` | routes/buddy.js | Friend management (search/accept/reject) |
| `/api/room/*` | routes/room.js | Room creation/joining |
| `/api/seed/*` | routes/seed.js | Seed data import |
| `/api/admin/*` | routes/admin.js | Admin panel (JWT required) |

## Data Models (Mongoose)

### User
`openid` (unique index), `nickname`, `avatar_url`, `preference_tags[]`, `friend_ids[]`, timestamps

### Gathering
`title`, `date_time`, `location` (name/lat/lng/city), `participants[]`, `payer`, `total_cost`, `photos[]`, `mood_score`(1-5), `mood_tags[]`, `note`, `food_tags[]`, `creator_id`

### Relation
`user_a`, `user_b`, `gather_count`, `title`, `cities[]`, `total_spent`, `last_gather_at`

### Buddy (Friend Contact)
`openid`, `targetUserId`, `remark`, `status` (pending/accepted/rejected), `requestMessage`

### Invitation (Room Invite)
Stored in DB for offline invite delivery

## WeChat Mini Program Config
- **AppID**: `wx63794ac25f9ded50`
- **Library Version**: `3.15.2`
- **Cloud Environment**: `prod-d4guifrt160355bbc`
- **Plugin**: `citySelector` v1.0.3 (provider: `wx63ffb7b7894e99ae`)
- **Permission**: `scope.userLocation` (for auto-detecting city on map)
- **Required Private Info**: `getLocation`, `chooseLocation`

## Color System
| Role | Hex | Usage |
|------|-----|-------|
| Primary (Coral Orange) | `#D85A30` | Buttons, highlights, active states |
| Primary Light | `#FAECE7` | Card backgrounds, tag bases |
| Secondary (Teal) | `#1D9E75` | Success, crocodile, advancement |
| Accent (Purple) | `#534AB7` | Relations, admin charts |
| Info (Blue) | `#185FA5` | Alerts, map markers |
| Warning (Amber) | `#BA7517` | Check-in map, achievements |

## Development Commands

```bash
# Start backend
cd project/backend && npm install && npm start

# Start backend (watch mode)
cd project/backend && npm run dev

# Database initialization
mongosh < database/init.mongodb.js

# Seed data
curl -X POST http://localhost:2001/api/seed/all

# Health check
curl http://localhost:2001/api/health

# Admin login (default)
# Username: admin
# Password: fanjuxingqiu2026 (see 后台管理员密码.md when configured)
```

## Git Branch Strategy
- **master** — stable, production-ready code
- **yunfuwu** — current development branch (deployed to production server)

## Constraints & Guardrails
- **NO changes to `doc/`** — this directory is gitignored and contains design docs
- **NO changes to `后台管理员密码.md`** — gitignored, contains credentials
- **Backend `.env` contains real OSS credentials** — never commit or expose
- **Mini program main package must stay under 2MB** — heavy features in subpackages
- **Canvas rendering on mini program** — use `wx.createSelectorQuery` with `node=` for Canvas manipulation (no `requestAnimationFrame`)
- **WeChat API deprecations** — `getUserProfile` is deprecated; use `<button open-type="chooseAvatar">` pattern for avatar selection
- **MongoDB validators** — collections have `$jsonSchema` validators; inserts must conform

## File Ownership Rules
When implementing features:
- **Mini program pages**: `project/frontend/miniapp/pages/*/index.*` and `subpackages/*/*`
- **Backend routes**: `project/backend/src/routes/*.js`
- **Backend models**: `project/backend/src/models/*.js`
- **WebSocket**: `project/backend/src/ws/*.js`
- **Config**: `project/backend/src/config/index.js`
- **App entry**: `project/frontend/miniapp/app.js`, `project/backend/src/app.js`

## Documentation
- PRD: `doc/饭局星球_PRD_agent.md` (authoritative product spec)
- Design docs: `doc/v1.1_design.md`, `doc/v2.0_multiplayer_设计文档.md`
- Changelog: `doc/CROW5_CHANGES.md`
- Archive logs: `doc/ARCHIVE_*.md`, `doc/存档*.md`

## Harness Files

| File | Subsystem | Purpose |
|------|-----------|---------|
| `docs/harness/feature_list.json` | State | Feature backlog with done criteria and dependencies |
| `docs/harness/progress.md` | State | Session continuity log (append only) |
| `docs/harness/DECISIONS.md` | State | Architecture Decision Records |
| `docs/harness/CHECKLIST.md` | Verification | Pre-completion verification checklist |
| `docs/harness/done_check.sh` | Forcing Function | Doc sync checker — run before every commit |
| `docs/harness/session-handoff.md` | Lifecycle | Inter-session handoff template |
