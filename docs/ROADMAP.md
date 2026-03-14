# NexLedger Roadmap & Feature Checklist

## Epic 1: Authentication & Security (High Priority)

- [x] AUTH-01: Login UI (email/password)
- [x] AUTH-02: Signup UI with email validation
- [x] AUTH-03: Backend JWT auth with refresh tokens
- [x] AUTH-04: Input validation frontend/backend
- [x] AUTH-05: Brute force protection / rate limiting
- [x] AUTH-06: Role management (user/admin)
- [x] AUTH-07: Unit tests for auth routes & UI
- [x] 2FA TOTP setup, verify, disable
- [x] Password change with validation
- [x] Audit logging for security events

## Epic 2: Financial Data Models (High Priority)

- [x] DATA-01: Account model (bank, savings, card) — `Asset` model
- [x] DATA-02: Transaction model (amount, date, category, account)
- [x] DATA-03: Category model (hierarchical expense/revenue)
- [x] DATA-04: Financial goals model (budget/target savings)
- [x] DATA-05: Net Worth / Financial Health model
- [x] DATA-06: User preferences (currency, language, notifications)
- [x] DATA-07: DB migrations (Alembic) & seed data
- [x] DATA-08: Model unit tests

## Epic 3: Transaction Import & Ingestion (High Priority)

- [x] IMPORT-01: CSV import via UI
- [x] IMPORT-02: OFX/QFX parser
- [x] IMPORT-03: Automatic category mapping (keyword heuristics + AI)
- [x] IMPORT-04: Bank API connector (Plaid sandbox + demo mode)
- [x] IMPORT-05: Data validation for imported transactions
- [x] IMPORT-06: Unit tests for import/parsing

## Epic 4: Dashboard & User Interface (High Priority)

- [x] UI-01: Main dashboard (total balance, charts, KPIs)
- [x] UI-02: Transaction filter & search (date, type, category)
- [x] UI-03: Add/Edit/Delete transaction forms
- [x] UI-04: Financial goals visualization (progress bars, plans)
- [x] UI-05: Alerts & notifications for budget/recommendations
- [x] UI-06: Responsive mobile + desktop design
- [x] UI-07: UI component tests (Vitest)

## Epic 5: Heuristic Analytics Engine (Medium-High Priority)

- [x] AI-01: Automatic transaction categorization
- [x] AI-02: Recurring payment detection
- [x] AI-03: Risk detection of spending behaviors (anomalies)
- [x] AI-04: Personalized financial recommendations (AI coach)
- [x] AI-05: Multi-factor financial health scoring
- [x] AI-06: Unit tests for heuristic engine accuracy

## Epic 6: Gamification (Medium Priority)

- [x] GAM-01: Achievement badges (12+ badges)
- [x] GAM-02: Levels & progression (5 levels, XP system)
- [x] GAM-03: Rewards dashboard
- [x] GAM-04: Notifications for milestones (proactive notifications)
- [x] GAM-05: Weekly challenges (reduce, save, behavior)
- [x] GAM-06: Gamification tests

## Epic 7: Testing & CI/CD (Medium Priority)

- [x] TEST-01: Backend unit tests (auth, transactions, categories, goals, import, admin, gamification, health)
- [x] TEST-02: Frontend unit tests (format, auth, cn utilities)
- [x] TEST-03: Import service unit tests (CSV, OFX parsing)
- [x] TEST-04: CI/CD pipeline (GitHub Actions — lint, type-check, build, test)
- [x] TEST-05: Deployment scripts (staging & production) + Dockerfiles

## Epic 8: Documentation & User Support (Medium-Low Priority)

- [x] DOC-01: Developer guide (setup, architecture, conventions)
- [x] DOC-02: User guide (import, transactions, dashboard, AI coach, gamification)
- [x] DOC-03: API documentation (auto-generated Swagger/OpenAPI via FastAPI)
- [x] DOC-04: Roadmap & feature checklist (this document)

## Future Enhancements

- [ ] Multi-language support (EN/FR toggle)
- [ ] Push notifications (web push / service worker)
- [ ] Investment portfolio tracking with real-time prices
- [ ] Tax optimization tools (RRSP/TFSA room tracking)
- [ ] Social features (community benchmarks, shared goals)
- [ ] Mobile app (React Native or PWA enhancements)
- [ ] AI chat history persistence in database
- [ ] Webhook support for Plaid real-time updates
- [ ] PDF report generation (server-side via FPDF2)
- [ ] Multi-currency support with FX rates
