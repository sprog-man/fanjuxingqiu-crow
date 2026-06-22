# Architecture Decision Records

## Format

Every entry follows:

```
## YYYY-MM-DD: Title (short noun phrase)

- **Decision**: What was actually chosen.
- **Reason**: Why — context, tradeoffs, constraints.
- **Constraints**: What this choice makes harder or impossible.
- **Alternatives considered**: What was rejected and why.
- **When to revisit**: What would need to change for this decision to be re-opened.
```

---

## 2026-05-19: Dual Persistence (MongoDB + wx.setStorageSync)

- **Decision**: Most data writes go to BOTH MongoDB (online) AND `wx.setStorageSync` (offline cache). The App instance provides `api*` wrapper methods that auto-fallback.
- **Reason**: WeChat Mini Programs run in unpredictable network environments. Users expect the app to work offline or with poor connectivity. Local cache provides instant UI response; MongoDB provides cross-device consistency.
- **Constraints**: Data can temporarily diverge between local and server. Conflict resolution is manual (server wins on next online write).
- **Alternatives considered**: Single source of truth (MongoDB only) — rejected because offline UX would be unacceptable. PouchDB/CouchDB sync — rejected for WeChat compatibility risk.
- **When to revisit**: If offline/online conflict rate becomes problematic.

---

## 2026-05-19: Mini Program Package Splitting

- **Decision**: Main package contains 5 tab pages only. All secondary features live in sub-packages with preload rules.
- **Reason**: WeChat enforces a 2MB main package limit. Sub-packages are lazy-loaded, keeping initial download small.
- **Constraints**: Sub-package pages cannot be deep-linked via tab bar. Cross-package navigation uses `wx.navigateTo` with full path.
- **Alternatives considered**: Single package — rejected, would exceed 2MB. Dynamic import — not supported in WeChat native.
- **When to revisit**: If WeChat raises the package limit significantly.

---

## 2026-05-19: Canvas 2d API for Animations

- **Decision**: Use `wx.createSelectorQuery` with `node: true` for Canvas, and `setTimeout` chains for animation scheduling.
- **Reason**: `requestAnimationFrame` is not reliably available in WeChat Mini Program WebView. Canvas 2d API is the officially supported path.
- **Constraints**: Animation timing is less precise than `requestAnimationFrame`. Complex animations require manual frame scheduling.
- **Alternatives considered**: CSS animations — rejected for dynamic spinner content. WebGL Canvas — overkill for 2D spinner.
- **When to revisit**: If WeChat adds `requestAnimationFrame` to the renderer context.

---

## 2026-05-19: JWT Auth with Mock Fallback

- **Decision**: Auth uses wx.login() + jscode2session + JWT. When WECHAT_APPID/SECRET are unconfigured, auto-fallback to mock mode with `dev_{code}_{timestamp}` openid.
- **Reason**: Development and CI environments rarely have valid WeChat credentials. Mock mode enables full offline development without a real appid.
- **Constraints**: Mock mode users have no real WeChat avatar/nickname. Some WeChat-only APIs (getPhoneNumber) are unavailable in mock mode.
- **Alternatives considered**: Always requiring real WeChat login — rejected, blocks development. Hardcoded test accounts — mock mode is more flexible.
- **When to revisit**: If production deployment requires phone-bound auth.

---

## 2026-06-17: Branch Strategy — yunfuwu as Deployment Branch

- **Decision**: `yunfuwu` is the active development branch AND auto-deploys to production via GitHub Actions. `master` is the stable release branch.
- **Reason**: Single-developer project with one production server. Merging to master then deploying adds friction without benefit. CI/CD is triggered by push to yunfuwu or master.
- **Constraints**: Development and production share a branch — incomplete features pushed to yunfuwu will deploy. Must use feature toggles or careful commit management.
- **Alternatives considered**: GitFlow (develop → release → master) — overkill for single developer. Feature branches with PR to yunfuwu — current practice, works well.
- **When to revisit**: If multiple developers contribute simultaneously and need staging before production.
