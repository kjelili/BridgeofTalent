# Security – BridgeofTalent

## Client-side protections (implemented)

### Input sanitization
- **`src/utils/security.js`** centralizes all sanitization and validation:
  - **`escapeHtml`** – escapes HTML to prevent XSS when rendering user content.
  - **`sanitizeString`** – trims, length-limits, and strips control characters.
  - **`sanitizeEmail`** – validates and normalizes email format.
  - **`sanitizeUrl`** – allows only `http:`, `https:`, `mailto:` (blocks `javascript:`, `data:`, etc.).
  - **`sanitizeJobInput`** – sanitizes job title, description, category, budget, skills.
  - **`sanitizeBidInput`** – sanitizes bid amount, message, timeline.
  - **`sanitizeMessage`** – chat/message text with length limit.
  - **`sanitizeReviewInput`** – rating (1–5) and comment.
  - **`sanitizeProfileInput`** – name, title, bio, location, company, skills.
  - **`sanitizeStringArray`** – bounded array of strings (e.g. skills).

All user-supplied input that is stored or displayed is passed through these helpers before being saved or shown.

### Where it’s used in the app
- **Registration** – email, name, password, profile fields via `sanitizeProfileInput` and `sanitizeEmail`.
- **Post job** – job data via `sanitizeJobInput`.
- **Place bid** – bid data via `sanitizeBidInput`.
- **Send message** – message text via `sanitizeMessage`.
- **Leave review** – rating and comment via `sanitizeReviewInput`.
- **Create project** – title, description, budget, category via `sanitizeString` and numeric checks.
- **Talent pool name** – via `sanitizeString` in `onAddPool`.
- **Dispute reason** – via `sanitizeString` in `raiseDispute`.

### Rendering
- User content is rendered as **text** in React (e.g. `{userInput}`). React escapes by default, so no `dangerouslySetInnerHTML` is used with user data.
- For any future HTML rendering, use **`escapeHtml(userInput)`** (or an equivalent) before output.

### Headers and HTML (production)
- **`public/index.html`** sets:
  - **X-Content-Type-Options: nosniff**
  - **X-Frame-Options: DENY**
  - **X-XSS-Protection: 1; mode=block**
  - **Referrer: strict-origin-when-cross-origin**
- **Content-Security-Policy** should be set on the **server** (e.g. Helmet in Node) so script-src can be tuned for your build (e.g. hashes or nonces for inline script).

### Data and storage
- No passwords or secrets are stored in `localStorage`; only preferences (theme, saved IDs, notification prefs, talent pools, saved searches).
- Demo passwords are in memory only; in production use server-side hashing (e.g. bcrypt/argon2) and secure session tokens.

## Backend recommendations (when you add a server)

1. **Authentication** – JWT in httpOnly cookies, short-lived access token, refresh token flow.
2. **Authorization** – enforce clientId/freelancerId on every request (e.g. “can only accept bid on own job”).
3. **Validation** – re-validate and re-sanitize all input on the server; never trust client-only checks.
4. **SQL/NoSQL** – use parameterized queries or ORM to avoid injection.
5. **Rate limiting** – per IP and per user on login, signup, post job, place bid, send message.
6. **HTTPS** – enforce TLS and HSTS.
7. **CSP** – set Content-Security-Policy header from the server with a strict policy.
