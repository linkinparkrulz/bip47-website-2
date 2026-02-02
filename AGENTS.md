# AGENTS.md - AI Agent Guide for BIP47 Website

This file provides detailed guidance for AI coding agents working on the BIP47 Terminal website project.

## Project Overview

This is a Node.js/Express web application implementing BIP47 Auth47 authentication protocol with a terminal-style interface. It includes a Paynym Explorer for searching and viewing BIP47 payment codes and their social connections.

**Tech Stack:**
- Backend: Node.js with Express (ES modules)
- Frontend: Vanilla HTML/CSS/JavaScript
- Cryptography: @bitcoinerlab/secp256k1, @samouraiwallet/bip47
- Deployment: Railway (production), localhost (development)

## Project Vision & Roadmap

The BIP47 Terminal website is a comprehensive showcase hub for BIP47 technology and Paynym ecosystem, featuring a terminal-style cypherpunk aesthetic.

### 6-Card Showcase Vision
1. **AUTH47 LOGIN** - BIP47 authentication protocol demo ✓
2. **BIP47 LAB** - Interactive payment code tools (planned)
3. **GUESTBOOK** - Community signed messages (planned)
4. **PAYNYM EXPLORER** - Search and explore Paynyms ✓
5. **DOCUMENTATION** - Technical docs and API references (planned)
6. **ABOUT** - Educational content about privacy (planned)

### Implementation Phases

**Phase 1: Foundation** (COMPLETED ✓)
- Terminal-style UI with 6-card grid
- Auth47 authentication flow
- Paynym Explorer with search and followers
- Backend API proxy for Paynym services

**Phase 2: Interactive Tools** (COMPLETED ✓)
- BIP47 LAB: Payment code validator
- Interactive "Alice Pays Bob" scenario walkthrough
- Educational BIP47 payment flow demonstration

**Phase 3: Community Features** (COMPLETED ✓)
- Guestbook with Auth47 authentication
- Signed message display with Paynym avatars
- Database integration (MongoDB)

**Phase 4: Documentation** (PLANNED)
- BIP47 protocol explanation
- Auth47 specification
- API endpoint documentation
- Code examples and tutorials

### Current Status
**Progress: 75% Complete (3 of 4 phases)**
- ✅ Foundation & UI
- ✅ Auth47 & Paynym Explorer
- ✅ Interactive Tools (BIP47 LAB)
- ✅ Community Features (Guestbook)
- 📋 Documentation
- 📋 About Page

## Feature Status Matrix

| Feature | Status | Priority | Dependencies | Notes |
|---------|---------|------------|---------|
| **AUTH47 LOGIN** | ✅ Complete | None | Fully functional with QR code and signature verification |
| **PAYNYM EXPLORER** | ✅ Complete | None | Search, followers, and avatar display working |
| **Showcase Hub** | ✅ Complete | None | 6-card grid layout with terminal aesthetic |
| **BIP47 LAB** | ✅ Complete | None | Payment code validator + interactive scenario |
| **GUESTBOOK** | ✅ Complete | Database | Auth47 authentication + message storage with avatars |
| **DOCUMENTATION** | 📋 Planned | None | Technical docs and API references |
| **ABOUT** | 📋 Planned | None | Educational content about privacy |

### Feature Dependencies
```
GUESTBOOK → Database (PostgreSQL/MongoDB) + Auth47
BIP47 LAB → BIP47 library functions (already available)
DOCUMENTATION → Static content
ABOUT → Static content
```

## Detailed Architecture

### Frontend-Backend Data Flow

```
┌─────────────────┐         ┌──────────────────┐         ┌──────────────────┐
│   Frontend     │────────▶│   Express       │────────▶│  External APIs   │
│   (Vanilla JS) │         │   Server        │         │  (paynym.rs)    │
└─────────────────┘         └──────────────────┘         └──────────────────┘
       │                           │                           │
       │                           │                           │
       │◀── JSON Response ◀───────────┘                           │
       │                                                       │
       │◀────────────────────────────────────── JSON Response ◀─────┘
```

### API Endpoint Catalog

#### Auth47 Endpoints
| Method | Endpoint | Purpose | Auth Required |
|---------|-----------|----------|---------------|
| GET | `/start-auth` | Generate authentication challenge | No |
| GET | `/check-auth/:nonce` | Poll auth status | No |
| POST | `/verify` | Verify wallet signature | No |
| POST | `/callback` | Wallet callback endpoint | No |

#### Paynym Explorer Endpoints
| Method | Endpoint | Purpose | Auth Required |
|---------|-----------|----------|---------------|
| POST | `/api/paynym/lookup` | Search Paynym by ID/name | No |
| POST | `/api/paynym/followers` | Get follower details | No |

#### BIP47 LAB Endpoints
| Method | Endpoint | Purpose | Auth Required |
|---------|-----------|----------|---------------|
| POST | `/api/bip47/validate` | Validate BIP47 payment code format | No |

#### System Endpoints
| Method | Endpoint | Purpose | Auth Required |
|---------|-----------|----------|---------------|
| GET | `/health` | Health check | No |
| GET | `/` | Main showcase hub | No |
| GET | `/auth` | Auth47 demo page | No |
| GET | `/paynym` | Paynym Explorer page | No |
| GET | `/lab` | BIP47 LAB tools page | No |
| GET | `/guestbook` | Guestbook page | No |

### Frontend-Backend Interaction Patterns

#### Pattern 1: Simple GET Request
```javascript
// Frontend
const response = await fetch('/start-auth');
const data = await response.json();
```

#### Pattern 2: POST Request with JSON
```javascript
// Frontend
const response = await fetch('/api/paynym/lookup', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ nym: paynymId })
});
const data = await response.json();
```

#### Pattern 3: Polling Loop
```javascript
// Frontend - Poll for auth status
const pollAuthStatus = async (nonce) => {
  const interval = setInterval(async () => {
    const response = await fetch(`/check-auth/${nonce}`);
    const data = await response.json();
    if (data.status === 'verified' || data.status === 'invalid') {
      clearInterval(interval);
      // Handle result
    }
  }, 2000);
};
```

### Paynym API Integration Details

**Primary API: paynym.rs**
- Used for: Paynym lookup, follower details
- Base URL: `https://paynym.rs/api/v1/nym/`
- Method: POST
- Request body: `{ nym: "payment_code_or_nym_id" }`
- Response: JSON with Paynym details

**Error Handling Pattern:**
```javascript
// Always check for empty response first
const text = await response.text();
if (!text || text.trim() === '') {
  return res.status(404).json({ error: 'Paynym not found' });
}

// Then parse JSON
const data = JSON.parse(text);
```

**Rate Limiting:**
- Paynym APIs may have rate limits
- Consider caching frequent lookups
- Implement exponential backoff for retries

## Testing Strategy

### Test Coverage Goals

| Feature | Manual Tests | Automated Tests | Priority |
|---------|---------------|------------------|------------|
| Auth47 Flow | ✓ Required | Recommended | High |
| Paynym Explorer | ✓ Required | Recommended | High |
| BIP47 LAB | ✓ Required | Recommended | High |
| Error Handling | ✓ Required | Recommended | High |
| Edge Cases | Optional | Recommended | Medium |
| Performance | Optional | Recommended | Low |

### Testing Priorities

#### High Priority (Must Test)
1. **Valid Auth47 Flow:**
   - Generate QR code
   - Scan with wallet
   - Verify signature
   - Check polling updates

2. **Valid Paynym Search:**
   - Search by nymID (e.g., `+mundanepunch78`)
   - Search by nymName
   - Verify followers load
   - Check avatars display

3. **BIP47 LAB Tools:**
   - Validate a real BIP47 payment code
   - Test with invalid format (should fail)
   - Walk through interactive scenario
   - Verify all 4 steps work

4. **Error Handling:**
   - Invalid Paynym search
   - Missing parameters
   - Network failures
   - Empty API responses

#### Medium Priority (Should Test)
5. **Edge Cases:**
   - Empty search query
   - Very long payment codes
   - Special characters
   - Duplicate requests

6. **Performance:**
   - Large follower lists (100+)
   - Multiple concurrent requests
   - API timeout handling

#### Low Priority (Nice to Have)
7. **UI/UX:**
   - Mobile responsiveness
   - Accessibility features
   - Loading states
   - Error display

### Manual Testing Checklist

**Before Each PR:**
- [ ] Run `npm start` locally
- [ ] Test all new features
- [ ] Test error scenarios
- [ ] Check browser console for errors
- [ ] Test on different browsers (Chrome, Firefox)
- [ ] Test on mobile if applicable

**After Database Changes:**
- [ ] Test database connections
- [ ] Verify data persistence
- [ ] Test query performance
- [ ] Check for SQL injection vulnerabilities
- [ ] Test transaction rollback

### Performance Testing

```bash
# Load test with curl
for i in {1..100}; do
  curl -s -X POST http://localhost:3000/api/paynym/lookup \
    -H "Content-Type: application/json" \
    -d '{"nym":"+test"}' &
done
```

### Automated Testing (Future)

Consider adding:
```javascript
// Example: Jest tests
describe('Paynym API', () => {
  test('should return error for invalid Paynym', async () => {
    const response = await fetch('/api/paynym/lookup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nym: 'invalid' })
    });
    const data = await response.json();
    expect(response.status).toBe(404);
    expect(data.error).toBeDefined();
  });
});
```

## Setup Commands

### Initial Setup

```bash
# Clone the repository
git clone <repository-url>
cd bip47-website

# Install dependencies
npm install

# Start development server
npm start
```

### Development Workflow

```bash
# Start the server (runs on port 3000)
node server.js

# Or use npm script
npm start

# Server will be available at:
# http://localhost:3000 - Main terminal interface
# http://localhost:3000/paynym - Paynym Explorer
# http://localhost:3000/auth - Auth47 demo
```

### Environment Variables

Create a `.env` file or set environment variables:

```bash
# Optional: Override default port
PORT=3000

# Required for production deployment
CALLBACK_URL=https://your-app.railway.app/callback

# Environment
NODE_ENV=development
```

## Testing Instructions

### Manual Testing

1. **Auth47 Flow:**
   - Visit http://localhost:3000/auth
   - Click "Generate Auth QR Code"
   - Scan with Samourai Wallet (or compatible BIP47 wallet)
   - Verify authentication status updates

2. **Paynym Explorer:**
   - Visit http://localhost:3000/paynym
   - Search for valid Paynym (e.g., `+mundanepunch78`)
   - Verify follower details load correctly
   - Test invalid searches (should show error message)

3. **BIP47 LAB:**
   - Visit http://localhost:3000/lab
   - Test payment code validator with valid code
   - Test with invalid format (should fail validation)
   - Walk through "Alice Pays Bob" scenario
   - Verify all 4 steps display correctly

4. **API Endpoints:**
   ```bash
   # Health check
   curl http://localhost:3000/health
   
   # Paynym lookup
   curl -X POST http://localhost:3000/api/paynym/lookup \
     -H "Content-Type: application/json" \
     -d '{"nym":"+mundanepunch78"}'
   
   # Follower details
   curl -X POST http://localhost:3000/api/paynym/followers \
     -H "Content-Type: application/json" \
     -d '{"nymIds":["nymEHrso...","nymSPvUv..."]}'
   
   # BIP47 LAB - Validate payment code
   curl -X POST http://localhost:3000/api/bip47/validate \
     -H "Content-Type: application/json" \
     -d '{"paymentCode":"PM8TJYp8zHvhimVNRjUcEuULfmvmUML6YTbTSnU69MYy93AzsXELFLaVjpxc5mxDex7R8ttgtL1tGAt2TshZAoFeB5zn4c9nRo4oZpmuyuo4FTpUrd"}'
   ```

### Testing Error Handling

```bash
# Test invalid Paynym (should return proper error)
curl -X POST http://localhost:3000/api/paynym/lookup \
  -H "Content-Type: application/json" \
  -d '{"nym":"invalidpaynym"}'

# Expected response:
# {"error":"Paynym not found. Please check the nymID or nymName and try again."}
```

## Code Style

### JavaScript/Node.js

- **ES Modules:** Use `import`/`export` (not CommonJS `require`)
- **Async/Await:** Prefer async/await over Promise chains
- **Error Handling:** Always use try-catch for async operations
- **Logging:** Use emoji prefixes for log messages:
  - `✅` for success
  - `❌` for errors
  - `🔍` for lookups/queries
  - `💥` for exceptions

Example:
```javascript
// ✅ Good
try {
  console.log(`🔍 Looking up Paynym: ${nym}`);
  const response = await fetch(url);
  console.log(`✅ Paynym found: ${data.nymName}`);
} catch (error) {
  console.error('💥 Paynym lookup error:', error);
}

// ❌ Bad
const response = fetch(url); // Missing await
console.log('Found: ' + data); // No error handling
```

### Frontend Code

- **Vanilla JS:** No frameworks - use plain JavaScript
- **CSS:** Use CSS variables for theming
- **HTML:** Semantic HTML5 elements
- **Error Display:** Show user-friendly error messages in the UI

### File Organization

```
bip47-website/
├── public/              # Static frontend files
│   ├── index.html      # Main showcase hub
│   ├── paynym.html     # Paynym Explorer
│   ├── lab.html        # BIP47 LAB tools
│   ├── guestbook.html  # Guestbook with Auth47
│   ├── auth.html       # Auth47 demo
│   └── callback.html   # Wallet callback page
├── server.js           # Express server (all backend logic)
├── package.json        # Dependencies
└── AGENTS.md          # This file
```

## PR Instructions

### Before Submitting a PR

1. **Test Locally:**
   - Run `npm start` and verify all features work
   - Test both valid and invalid inputs
   - Check browser console for errors

2. **Code Quality:**
   - Follow the code style guidelines above
   - Add appropriate error handling
   - Include helpful logging messages

3. **Documentation:**
   - Update README.md if adding user-facing features
   - Update AGENTS.md if changing development workflows
   - Add comments for complex logic

### PR Template

```markdown
## Description
Brief description of changes

## Testing
- [ ] Tested locally with `npm start`
- [ ] Tested valid Paynym lookups
- [ ] Tested invalid/error cases
- [ ] Checked browser console for errors

## Changes
- List of files modified
- Brief explanation of each change

## Screenshots (if applicable)
Add screenshots for UI changes
```

## Dev Environment Tips

### Common Issues

1. **Port Already in Use:**
   ```bash
   # Kill existing server
   pkill -f "node server.js"
   
   # Or use a different port
   PORT=3001 node server.js
   ```

2. **Dependencies Issues:**
   ```bash
   # Clean install
   rm -rf node_modules package-lock.json
   npm install
   ```

3. **ES Module Errors:**
   - Ensure `package.json` has `"type": "module"`
   - Use `import` not `require`
   - Use `.js` extension in imports

### Debugging

```bash
# View server logs
node server.js

# Check specific endpoint
curl -v http://localhost:3000/health

# Test API with verbose output
curl -X POST http://localhost:3000/api/paynym/lookup \
  -H "Content-Type: application/json" \
  -d '{"nym":"+test"}' \
  -v
```

### Working with Paynym API

**Important Notes:**
- Paynym API (`paynym.is`) returns empty responses for invalid Paynyms
- Always check if response body is empty before parsing JSON
- Use `paynym.rs` API for follower details (more reliable)
- Handle errors gracefully - show user-friendly messages

Example error handling:
```javascript
const text = await response.text();
if (!text || text.trim() === '') {
  return res.status(404).json({ 
    error: 'Paynym not found. Please check the nymID or nymName and try again.' 
  });
}

let data;
try {
  data = JSON.parse(text);
} catch (parseError) {
  return res.status(500).json({ 
    error: 'Invalid response from Paynym API' 
  });
}
```

### Adding New Features

1. **Backend Changes:**
   - Add routes in `server.js`
   - Include proper error handling
   - Add logging with emoji prefixes
   - Test with curl before frontend integration

2. **Frontend Changes:**
   - Keep vanilla JS (no frameworks)
   - Use existing CSS variables for consistency
   - Add loading states for async operations
   - Show user-friendly error messages

3. **API Integration:**
   - Use the existing proxy pattern (don't call external APIs directly from frontend)
   - Handle rate limiting and errors
   - Cache responses when appropriate

### Deployment

**Railway Deployment:**
```bash
# Install Railway CLI
npm install -g @railway/cli

# Login
railway login

# Initialize project
railway init

# Set environment variables
railway variables set CALLBACK_URL=https://your-app.railway.app/callback
railway variables set NODE_ENV=production

# Deploy
railway up

# View logs
railway logs
```

**Environment-Specific Behavior:**
- Development: Uses `http://localhost:3000/callback`
- Production: Uses `CALLBACK_URL` environment variable

## Key Dependencies

- **@bitcoinerlab/secp256k1**: Bitcoin cryptography (signature verification)
- **@samouraiwallet/bip47**: BIP47 payment code implementation
- **express**: Web server framework
- **cors**: Cross-origin resource sharing
- **qrcode**: QR code generation

## Architecture Notes

### Auth47 Flow
1. Server generates nonce and creates Auth47 URI
2. QR code displayed to user
3. Wallet scans QR and signs challenge
4. Wallet POSTs signature to `/verify` or `/callback`
5. Server verifies signature using BIP47 notification key
6. Frontend polls `/check-auth/:nonce` for status

### Paynym Explorer
1. User searches for Paynym (nymID or nymName)
2. Frontend calls `/api/paynym/lookup` (proxies to paynym.rs)
3. Backend returns Paynym details including followers
4. Frontend calls `/api/paynym/followers` with follower nymIDs
5. Backend fetches details from paynym.rs API in parallel
6. Frontend displays follower cards with avatars

## Security Considerations

- Nonces expire after 5 minutes
- Each nonce can only be used once
- All signature verification happens server-side
- Payment codes are public (BIP47 design)
- No private keys are stored or handled

## Future Enhancements

### BIP47 LAB Feature Specifications (Completed ✓)

**Payment Code Validator (✅ IMPLEMENTED):**
- Validates BIP47 payment code format
- Checks: format, length, base58 encoding, checksum, version
- User-friendly error messages
- Visual pass/fail indicators

**Interactive "Alice Pays Bob" Scenario (✅ IMPLEMENTED):**
- 4-step walkthrough of complete BIP47 payment flow
- Step 1: Exchange payment codes
- Step 2: Create notification transaction (with ECDH visualization)
- Step 3: Derive payment addresses (with formula)
- Step 4: Bob receives & spends (with private key derivation)
- Progress indicators and reset functionality
- Educational tooltips and explanations

### Future BIP47 LAB Enhancements

**Advanced Features (PLANNED):**
- Payment Code Generator from BIP39 mnemonic
- Visual payment code breakdown (byte-level)
- Notification address derivation from outpoint
- Real cryptography operations (not just simulations)
- Payment address derivation calculator
- Transaction builder simulator

### Guestbook Database Schema

**PostgreSQL Schema:**
```sql
CREATE TABLE messages (
  id SERIAL PRIMARY KEY,
  payment_code VARCHAR(80) NOT NULL,
  nym_name VARCHAR(50),
  message TEXT NOT NULL,
  signature TEXT NOT NULL,
  verified BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (payment_code) REFERENCES payment_codes(code)
);
```

**MongoDB Schema:**
```javascript
{
  paymentCode: String,    // BIP47 payment code
  nymName: String,       // Paynym name (if available)
  nymAvatar: String,     // Paynym avatar URL (fetched from Paynym API)
  message: String,        // Message content
  signature: String,      // Auth47 signature
  verified: Boolean,      // Signature verification status
  createdAt: Date,        // Timestamp
  nonce: String          // Auth47 challenge nonce
}
```

**Avatar Fetching:**
- Use existing `fetchPaynymDetails()` function from Paynym Explorer
- Fetch avatar URL from Paynym API during message submission
- Store avatar URL with message for display
- Fallback: Display generic placeholder if avatar fails to load

**Guestbook API Endpoints:**
- `GET /api/guestbook/messages` - List all verified messages
- `POST /api/guestbook/submit` - Submit new message (with Auth47)
- `GET /api/guestbook/verify/:id` - Verify message signature

### Documentation Structure

**Suggested Sections:**
1. **BIP47 Protocol**
   - What is BIP47?
   - How payment codes work
   - Privacy benefits
   - Notification address concept

2. **Auth47 Specification**
   - Protocol overview
   - Challenge-response flow
   - Signature verification
   - Security considerations

3. **API Documentation**
   - All endpoints documented
   - Request/response examples
   - Error codes
   - Rate limiting info

4. **Code Examples**
   - Generate payment codes
   - Verify signatures
   - Integrate with wallet
   - Build Paynym applications

### About Page Content Outline

**Topics to Cover:**
1. **BIP47 Privacy Benefits**
   - Reusable payment codes
   - No address reuse
   - Privacy from blockchain analysis
   - How it differs from regular addresses

2. **How Paynyms Work**
   - Paynym ID vs payment code
   - Social graph concept
   - Following and followers
   - Identity verification

3. **Resources**
   - Official BIP47 specification
   - Samourai Wallet documentation
   - Paynym network info
   - Community resources

### Performance & Optimization

**Caching Strategies:**
```javascript
// Simple in-memory cache for Paynym lookups
const paynymCache = new Map();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

app.post('/api/paynym/lookup', async (req, res) => {
  const { nym } = req.body;
  
  // Check cache
  const cached = paynymCache.get(nym);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return res.json(cached.data);
  }
  
  // Fetch fresh data
  const data = await fetchPaynym(nym);
  
  // Update cache
  paynymCache.set(nym, { data, timestamp: Date.now() });
  
  res.json(data);
});
```

**Rate Limiting Considerations:**
- Implement rate limiting per IP
- Limit: 10 requests per minute for Paynym API
- Use Express rate-limit middleware
- Cache frequently requested Paynyms

**Frontend Optimization:**
- Lazy load follower cards
- Implement infinite scroll for large lists
- Use Intersection Observer for images
- Minimize DOM updates

**Database Optimization:**
- Add indexes on payment_code, created_at
- Use connection pooling
- Implement query caching
- Consider read replicas for scaling

### Development Workflow

**Feature Development Checklist:**
- [ ] Design feature architecture
- [ ] Write API endpoints first
- [ ] Test with curl/postman
- [ ] Implement frontend
- [ ] Add error handling
- [ ] Write unit tests (if applicable)
- [ ] Manual testing
- [ ] Update documentation
- [ ] Submit PR

**Testing Requirements Per Feature:**
1. **Happy Path**: Feature works with valid inputs
2. **Error Cases**: Graceful failure on invalid inputs
3. **Edge Cases**: Boundary conditions, empty inputs
4. **Performance**: Acceptable response times
5. **Security**: No vulnerabilities exposed

**Code Review Criteria:**
- Follows code style guidelines
- Proper error handling
- Adequate logging
- No hardcoded values
- Security best practices
- Performance considerations
- Documentation updated

**Deployment Checklist:**
- [ ] All tests pass
- [ ] Environment variables set
- [ ] Database migrations applied
- [ ] API endpoints tested in production
- [ ] Frontend assets built/minified
- [ ] Monitoring configured
- [ ] Rollback plan documented

## Getting Help

- **BIP47 Protocol**: [Samourai Wallet docs](https://samouraiwallet.com/)
- **Paynym API**: Check `paynym-api.md` for API documentation
- **Railway**: [Railway documentation](https://docs.railway.app/)
- **Issues**: Create a GitHub issue for bugs or feature requests