// server.js - Manual BIP47 Auth47 implementation
import express from 'express';
import cors from 'cors';
import { MongoClient } from 'mongodb';
import ecc from '@bitcoinerlab/secp256k1';
import { BIP32Factory } from 'bip32';
import { BIP47Factory } from '@samouraiwallet/bip47';
import { Auth47Verifier } from '@samouraiwallet/auth47';
import QRCode from 'qrcode';
import crypto from 'crypto';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

// MongoDB connection
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/bip47-guestbook';
let db;

// Connect to MongoDB
async function connectToDatabase() {
  try {
    const client = new MongoClient(MONGODB_URI);
    await client.connect();
    console.log('✅ Connected to MongoDB');
    db = client.db();
    
    // Create index on payment_code for faster lookups
    await db.collection('messages').createIndex({ paymentCode: 1 });
    await db.collection('messages').createIndex({ createdAt: -1 });
    console.log('✅ Database indexes created');
  } catch (error) {
    console.error('❌ MongoDB connection error:', error);
    // Continue running even if DB fails (for local development)
    console.log('⚠️  Running without database - guestbook will be disabled');
  }
}

// Initialize database connection
connectToDatabase();

app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// Initialize BIP32 and BIP47 with ECC
const bip32 = BIP32Factory(ecc);
const bip47 = BIP47Factory(ecc);

// Dynamic callback URL for production deployment
const CALLBACK_URL = process.env.CALLBACK_URL || `http://localhost:${PORT}/callback`;

// Initialize Auth47 Verifier
const verifier = new Auth47Verifier(ecc, CALLBACK_URL);


// Store pending authentications (use Redis/DB in production)
const pendingAuths = new Map();

// Generate Auth47 URI
app.get('/start-auth', async (req, res) => {
  try {
    const nonce = crypto.randomBytes(16).toString('hex');
    
    // Calculate expiry (5 minutes from now)
    const expiry = Math.floor(Date.now() / 1000) + 300; // 5 minutes
    
    // Proper Auth47 URI format: auth47://<nonce>?c=<callback_url>&e=<expiry>
    // NOTE: Do NOT url-encode the callback URL - wallets expect it unencoded
    const uri = `auth47://${nonce}?c=${CALLBACK_URL}&e=${expiry}`;
    const qr = await QRCode.toDataURL(uri);
    
    // Store nonce with expiry
    pendingAuths.set(nonce, {
      timestamp: Date.now(),
      verified: false,
      expiry: expiry
    });
    
    // Clean up old nonces (>5 minutes)
    for (const [key, value] of pendingAuths.entries()) {
      if (Date.now() - value.timestamp > 300000) {
        pendingAuths.delete(key);
      }
    }
    
    console.log(`✅ Generated auth URI with nonce: ${nonce}, expiry: ${expiry}`);
    
    res.json({ 
      uri, 
      qr, 
      nonce,
      callbackUrl: CALLBACK_URL,
      expiry: expiry
    });
  } catch (error) {
    console.error('❌ Error generating auth:', error);
    res.status(500).json({ error: error.message });
  }
});

// Check auth status (polling endpoint)
app.get('/check-auth/:nonce', (req, res) => {
  // Disable caching to ensure fresh auth status
  res.set('Cache-Control', 'no-store, no-cache, must-revalidate, private');
  res.set('Pragma', 'no-cache');
  res.set('Expires', '0');
  
  const { nonce } = req.params;
  const auth = pendingAuths.get(nonce);
  
  if (!auth) {
    return res.json({ status: 'invalid' });
  }
  
  if (auth.verified) {
    return res.json({ 
      status: 'verified',
      nym: auth.nym,
      paymentCode: auth.paymentCode,
      challenge: auth.challenge,
      signature: auth.signature
    });
  }
  
  res.json({ status: 'pending' });
});

// Verify Auth47 proof
app.post('/verify', async (req, res) => {
  try {
    console.log('📥 Received verification request:', JSON.stringify(req.body, null, 2));
    
    const { auth47_response, challenge, nym, signature } = req.body;
    
    // Validate required fields
    if (!challenge || !nym || !signature) {
      console.error('❌ Missing required fields');
      return res.status(400).json({
        result: 'error',
        error: 'Missing required fields: challenge, nym, signature'
      });
    }
    
    // Parse challenge URL to extract nonce and validate expiry
    let nonce;
    let challengeExpiry;
    try {
      const challengeUrl = new URL(challenge);
      nonce = challengeUrl.hostname || challengeUrl.pathname.replace(/^\/\//, '');
      
      // Extract expiry from challenge parameters
      const params = new URLSearchParams(challengeUrl.search);
      challengeExpiry = params.get('e');
      
      if (!challengeExpiry) {
        console.error('❌ Missing expiry parameter in challenge');
        return res.status(400).json({
          result: 'error',
          error: 'Missing expiry parameter in challenge'
        });
      }
    } catch (e) {
      console.error('❌ Invalid challenge format:', challenge);
      return res.status(400).json({
        result: 'error',
        error: 'Invalid challenge format'
      });
    }
    
    console.log(`🔍 Extracted nonce: ${nonce}, expiry: ${challengeExpiry}`);
    
    // Verify nonce exists
    const auth = pendingAuths.get(nonce);
    if (!auth) {
      console.error('❌ Invalid or expired nonce');
      return res.status(400).json({
        result: 'error',
        error: 'Invalid or expired nonce'
      });
    }
    
    // Verify expiry matches and is not expired
    const currentTime = Math.floor(Date.now() / 1000);
    const expiryTime = parseInt(challengeExpiry, 10);
    
    if (expiryTime <= currentTime) {
      console.error('❌ Challenge has expired');
      return res.status(400).json({
        result: 'error',
        error: 'Challenge has expired'
      });
    }
    
    if (auth.expiry !== expiryTime) {
      console.error('❌ Expiry mismatch in challenge');
      return res.status(400).json({
        result: 'error',
        error: 'Expiry mismatch in challenge'
      });
    }
    
    if (auth.verified) {
      console.error('❌ Nonce already used');
      return res.status(400).json({
        result: 'error',
        error: 'Nonce already used'
      });
    }
    
    // Verify signature using Auth47 library (Bitcoin Message Signing protocol)
    const verifiedProof = verifier.verifyProof(req.body, 'bitcoin');
    
    if (verifiedProof.result === 'ok') {
      // Mark as verified and store auth data
      auth.verified = true;
      auth.nym = nym;
      auth.paymentCode = nym;
      auth.challenge = challenge;
      auth.signature = signature;
      
      console.log(`🎉 Authentication successful for ${nym}`);
      
      res.json({
        result: 'ok',
        nym,
        payment_code: nym
      });
    } else {
      console.error(`❌ Invalid signature: ${verifiedProof.error}`);
      res.json({
        result: 'error',
        error: verifiedProof.error
      });
    }
  } catch (error) {
    console.error('💥 Verification error:', error);
    res.status(400).json({
      result: 'error',
      error: error.message
    });
  }
});

// Callback endpoint (displayed after wallet scans)
app.get('/callback', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'callback.html'));
});

// Handle Auth47 wallet callback (POST request from wallet)
app.post('/callback', async (req, res) => {
  try {
    console.log('📥 Received Auth47 callback:', JSON.stringify(req.body, null, 2));
    
    const { auth47_response, challenge, nym, signature } = req.body;
    
    // Validate required fields
    if (!challenge || !nym || !signature) {
      console.error('❌ Missing required fields in callback');
      return res.sendFile(path.join(__dirname, 'public', 'callback.html'));
    }
    
    // Parse challenge URL to extract nonce and validate expiry
    let nonce;
    let challengeExpiry;
    try {
      const challengeUrl = new URL(challenge);
      nonce = challengeUrl.hostname || challengeUrl.pathname.replace(/^\/\//, '');
      
      // Extract expiry from challenge parameters
      const params = new URLSearchParams(challengeUrl.search);
      challengeExpiry = params.get('e');
      
      if (!challengeExpiry) {
        console.error('❌ Missing expiry parameter in challenge');
        return res.sendFile(path.join(__dirname, 'public', 'callback.html'));
      }
    } catch (e) {
      console.error('❌ Invalid challenge format in callback:', challenge);
      return res.sendFile(path.join(__dirname, 'public', 'callback.html'));
    }
    
    console.log(`🔍 Callback - Extracted nonce: ${nonce}, expiry: ${challengeExpiry}`);
    
    // Verify nonce exists
    const auth = pendingAuths.get(nonce);
    if (!auth) {
      console.error('❌ Invalid or expired nonce in callback');
      return res.sendFile(path.join(__dirname, 'public', 'callback.html'));
    }
    
    // Verify expiry matches and is not expired
    const currentTime = Math.floor(Date.now() / 1000);
    const expiryTime = parseInt(challengeExpiry, 10);
    
    if (expiryTime <= currentTime) {
      console.error('❌ Challenge has expired in callback');
      return res.sendFile(path.join(__dirname, 'public', 'callback.html'));
    }
    
    if (auth.expiry !== expiryTime) {
      console.error('❌ Expiry mismatch in callback');
      return res.sendFile(path.join(__dirname, 'public', 'callback.html'));
    }
    
    if (auth.verified) {
      console.error('❌ Nonce already used in callback');
      return res.sendFile(path.join(__dirname, 'public', 'callback.html'));
    }
    
    // Verify signature using Auth47 library (Bitcoin Message Signing protocol)
    try {
      const verifiedProof = verifier.verifyProof(req.body, 'bitcoin');
      
      if (verifiedProof.result === 'ok') {
        // Mark as verified and store auth data
        auth.verified = true;
        auth.nym = nym;
        auth.paymentCode = nym;
        auth.challenge = challenge;
        auth.signature = signature;
        
        console.log(`🎉 Authentication successful via callback for ${nym}`);
        
        // Redirect to callback page with nonce parameter so it can poll auth status
        return res.redirect(`/callback?nonce=${nonce}`);
      } else {
        console.log(`❌ Callback verification failed: ${verifiedProof.error}`);
        // Redirect to callback page with nonce for error display
        return res.redirect(`/callback?nonce=${nonce}`);
      }
    } catch (verifyError) {
      console.log('❌ Callback verification error:', verifyError.message);
      // Still serve the callback page
      res.sendFile(path.join(__dirname, 'public', 'callback.html'));
    }
  } catch (error) {
    console.error('💥 Callback error:', error);
    // Still serve the callback page even on error
    res.sendFile(path.join(__dirname, 'public', 'callback.html'));
  }
});

// Health check
app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    pendingAuths: pendingAuths.size,
    verified: Array.from(pendingAuths.values()).filter(a => a.verified).length
  });
});

// Paynym API proxy endpoint
app.post('/api/paynym/lookup', async (req, res) => {
  try {
    const { nym } = req.body;
    
    if (!nym) {
      return res.status(400).json({ error: 'Missing nym parameter' });
    }
    
    console.log(`🔍 Looking up Paynym: ${nym}`);
    
    // Call paynym.rs API
    const response = await fetch('https://paynym.rs/api/v1/nym/', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ nym })
    });
    
    // Check if response body is empty
    const text = await response.text();
    if (!text || text.trim() === '') {
      console.error(`❌ Paynym lookup failed: Empty response from API`);
      return res.status(404).json({ 
        error: 'Paynym not found. Please check the nymID or nymName and try again.' 
      });
    }
    
    // Parse JSON
    let data;
    try {
      data = JSON.parse(text);
    } catch (parseError) {
      console.error(`❌ Failed to parse API response:`, parseError.message);
      return res.status(500).json({ 
        error: 'Invalid response from Paynym API' 
      });
    }
    
    if (!response.ok) {
      console.error(`❌ Paynym lookup failed: ${data.error || response.statusText}`);
      return res.status(response.status).json({ 
        error: data.error || 'Paynym not found' 
      });
    }
    
    console.log(`✅ Paynym found: ${data.nymName}`);
    res.json(data);
    
  } catch (error) {
    console.error('💥 Paynym lookup error:', error);
    res.status(500).json({ 
      error: 'Failed to lookup Paynym' 
    });
  }
});

// Batch Paynym details endpoint for followers
app.post('/api/paynym/followers', async (req, res) => {
  try {
    const { nymIds } = req.body;
    
    if (!nymIds || !Array.isArray(nymIds)) {
      return res.status(400).json({ error: 'Missing or invalid nymIds parameter' });
    }
    
    if (nymIds.length === 0) {
      return res.json([]);
    }
    
    console.log(`🔍 Fetching details for ${nymIds.length} followers`);
    
    // Fetch details for each follower in parallel
    const followerPromises = nymIds.map(async (nymId) => {
      try {
        const response = await fetch('https://paynym.rs/api/v1/nym/', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ nym: nymId })
        });
        
        if (!response.ok) {
          return { nymId, error: 'Not found' };
        }
        
        const data = await response.json();
        
        // Get primary payment code for avatar
        const primaryCode = data.codes && data.codes.length > 0 ? data.codes[0].code : '';
        
        return {
          nymId: data.nymID,
          nymName: data.nymName || 'Unknown',
          avatarUrl: primaryCode ? `https://paynym.rs/${primaryCode}/avatar` : null,
          primaryCode: primaryCode
        };
      } catch (error) {
        console.error(`❌ Error fetching follower ${nymId}:`, error.message);
        return { nymId, error: 'Failed to fetch' };
      }
    });

    const followers = await Promise.all(followerPromises);
    
    // Filter out failed fetches
    const validFollowers = followers.filter(f => !f.error);
    
    console.log(`✅ Successfully fetched ${validFollowers.length} follower details`);
    res.json(validFollowers);
    
  } catch (error) {
    console.error('💥 Batch followers error:', error);
    res.status(500).json({ 
      error: 'Failed to fetch follower details' 
    });
  }
});

// Auth page route
app.get('/auth', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'auth.html'));
});

// Paynym Explorer page route
app.get('/paynym', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'paynym.html'));
});

// Root route - serve the main terminal interface
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// BIP47 LAB API endpoints - Client-side payment code tools

// Payment Code Validator
app.post('/api/bip47/validate', (req, res) => {
  try {
    const { paymentCode } = req.body;

    if (!paymentCode) {
      return res.status(400).json({ error: 'Payment code required' });
    }

    const checks = {
      format: paymentCode.startsWith('PM8T'),
      length: paymentCode.length === 80,
      base58: /^[1-9A-HJ-NP-Za-km-z]+$/.test(paymentCode),
      checksum: false,
      version: false
    };

    // Check checksum by trying to parse
    try {
      const pc = bip47.fromBase58(paymentCode);
      checks.checksum = true;
      checks.version = true;
    } catch (e) {
      checks.checksum = false;
    }

    const isValid = checks.format && checks.length && checks.base58 && 
                    checks.checksum && checks.version;

    res.json({
      valid: isValid,
      checks,
      details: isValid ? {
        type: 'BIP47 Payment Code v1',
        features: 'Reusable payment codes for stealth addresses',
        warning: 'Always verify payment codes before use'
      } : null
    });

  } catch (error) {
    console.error('💥 Validation error:', error);
    res.status(500).json({ error: 'Validation failed: ' + error.message });
  }
});

// Lab page route
app.get('/lab', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'lab.html'));
});

// Guestbook page route
app.get('/guestbook', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'guestbook.html'));
});

// Guestbook API endpoints

// GET /api/guestbook/messages - List all verified messages
app.get('/api/guestbook/messages', async (req, res) => {
  try {
    if (!db) {
      return res.status(503).json({ 
        error: 'Database not available' 
      });
    }

    const messages = await db.collection('messages')
      .find({ verified: true })
      .sort({ createdAt: -1 })
      .toArray();

    console.log(`✅ Retrieved ${messages.length} messages`);
    res.json(messages);

  } catch (error) {
    console.error('💥 Error fetching messages:', error);
    res.status(500).json({ error: 'Failed to fetch messages' });
  }
});

// POST /api/guestbook/submit - Submit new message with Auth47
app.post('/api/guestbook/submit', async (req, res) => {
  try {
    const { nonce, message, challenge, signature, nym } = req.body;

    if (!nonce || !message || !challenge || !signature || !nym) {
      return res.status(400).json({ 
        error: 'Missing required fields: nonce, message, challenge, signature, nym' 
      });
    }

    if (!db) {
      return res.status(503).json({ 
        error: 'Database not available' 
      });
    }

    // Verify the Auth47 authentication
    const auth = pendingAuths.get(nonce);
    if (!auth || !auth.verified || auth.paymentCode !== nym) {
      return res.status(401).json({ 
        error: 'Invalid or expired authentication' 
      });
    }

    console.log(`📝 Submitting message from ${nym}`);

    // Fetch Paynym details including avatar
    let nymName = nym;
    let nymAvatar = null;
    try {
      const paynymResponse = await fetch('https://paynym.rs/api/v1/nym/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nym })
      });

      if (paynymResponse.ok) {
        const paynymData = await paynymResponse.json();
        nymName = paynymData.nymName || nym;
        
        // Get avatar URL from primary payment code
        const primaryCode = paynymData.codes && paynymData.codes.length > 0 
          ? paynymData.codes[0].code 
          : null;
        
        if (primaryCode) {
          nymAvatar = `https://paynym.rs/${primaryCode}/avatar`;
        }
        
        console.log(`✅ Fetched Paynym: ${nymName}, avatar: ${nymAvatar ? 'yes' : 'no'}`);
      }
    } catch (fetchError) {
      console.error('⚠️  Failed to fetch Paynym details:', fetchError.message);
      // Continue without avatar - still allow message submission
    }

    // Store message in database
    const messageDoc = {
      paymentCode: nym,
      nymName,
      nymAvatar,
      message,
      signature,
      verified: true,
      createdAt: new Date(),
      nonce
    };

    await db.collection('messages').insertOne(messageDoc);
    
    console.log(`✅ Message saved for ${nymName}`);
    
    // Mark nonce as used to prevent reuse
    pendingAuths.delete(nonce);

    res.json({ 
      success: true,
      message: 'Message submitted successfully',
      data: messageDoc
    });

  } catch (error) {
    console.error('💥 Error submitting message:', error);
    res.status(500).json({ error: 'Failed to submit message' });
  }
});

app.listen(PORT, () => {
  console.log('\n🟢 BIP47 Terminal Server running!');
  console.log(`→ http://localhost:${PORT}`);
  console.log(`→ Callback: ${CALLBACK_URL}`);
  console.log(`→ Using @bitcoinerlab/secp256k1\n`);
});
