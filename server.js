// server.js - Manual BIP47 Auth47 implementation
import express from 'express';
import cors from 'cors';
import ecc from '@bitcoinerlab/secp256k1';
import { BIP32Factory } from 'bip32';
import { BIP47Factory } from '@samouraiwallet/bip47';
import QRCode from 'qrcode';
import crypto from 'crypto';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// Initialize BIP32 and BIP47 with ECC
const bip32 = BIP32Factory(ecc);
const bip47 = BIP47Factory(ecc);

// Dynamic callback URL for production deployment
const CALLBACK_URL = process.env.CALLBACK_URL || `http://localhost:${PORT}/callback`;


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
  const { nonce } = req.params;
  const auth = pendingAuths.get(nonce);
  
  if (!auth) {
    return res.json({ status: 'invalid' });
  }
  
  if (auth.verified) {
    return res.json({ 
      status: 'verified',
      nym: auth.nym,
      paymentCode: auth.paymentCode
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
    
    // Parse payment code
    console.log(`🔑 Parsing payment code: ${nym}`);
    const paymentCode = bip47.fromBase58(nym);
    const notificationPubKey = paymentCode.getNotificationPublicKey();
    
    console.log(`📋 Notification pubkey length: ${notificationPubKey.length}`);
    
    // Create message hash from challenge
    const messageHash = crypto.createHash('sha256')
      .update(challenge)
      .digest();
    
    console.log(`🔐 Message hash: ${messageHash.toString('hex')}`);
    
    // Decode signature from base64
    const signatureBuffer = Buffer.from(signature, 'base64');
    console.log(`✍️  Signature length: ${signatureBuffer.length}`);
    
    // Verify signature
    const isValid = ecc.verify(messageHash, notificationPubKey, signatureBuffer);
    
    console.log(`${isValid ? '✅' : '❌'} Signature verification: ${isValid}`);
    
    if (isValid) {
      // Mark as verified
      auth.verified = true;
      auth.nym = nym;
      auth.paymentCode = nym;
      
      console.log(`🎉 Authentication successful for ${nym}`);
      
      res.json({
        result: 'ok',
        nym,
        payment_code: nym
      });
    } else {
      console.error('❌ Invalid signature');
      res.json({
        result: 'error',
        error: 'Invalid signature'
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
    
    // Manual signature verification (same as /verify endpoint)
    try {
      // Parse payment code
      console.log(`🔑 Parsing payment code in callback: ${nym}`);
      const paymentCode = bip47.fromBase58(nym);
      const notificationPubKey = paymentCode.getNotificationPublicKey();
      
      console.log(`📋 Callback notification pubkey length: ${notificationPubKey.length}`);
      
      // Create message hash from challenge
      const messageHash = crypto.createHash('sha256')
        .update(challenge)
        .digest();
      
      console.log(`🔐 Callback message hash: ${messageHash.toString('hex')}`);
      
      // Decode signature from base64
      const signatureBuffer = Buffer.from(signature, 'base64');
      console.log(`✍️  Callback signature length: ${signatureBuffer.length}`);
      
      // Verify signature
      const isValid = ecc.verify(messageHash, notificationPubKey, signatureBuffer);
      
      console.log(`${isValid ? '✅' : '❌'} Callback signature verification: ${isValid}`);
      
      if (isValid) {
        // Mark as verified
        auth.verified = true;
        auth.nym = nym;
        auth.paymentCode = nym;
        
        console.log(`🎉 Authentication successful via callback for ${nym}`);
        
        // Serve the success page
        res.sendFile(path.join(__dirname, 'public', 'callback.html'));
      } else {
        console.log('❌ Callback verification failed: Invalid signature');
        // Still serve the callback page
        res.sendFile(path.join(__dirname, 'public', 'callback.html'));
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

// Root route - serve the main terminal interface
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
  console.log('\n🟢 BIP47 Manual Auth Server running!');
  console.log(`→ http://localhost:${PORT}`);
  console.log(`→ Callback: ${CALLBACK_URL}`);
  console.log(`→ Using @bitcoinerlab/secp256k1\n`);
});
