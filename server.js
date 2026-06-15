import express from 'express';
import cors from 'cors';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import nodemailer from 'nodemailer';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

// Memory storage for active session tokens
const activeSessions = new Set();

app.use(cors());
app.use(express.json());

// Helper functions for reading/writing db.json
const DB_FILE = path.join(__dirname, 'db.json');
const EMAIL_LOG_FILE = path.join(__dirname, 'email-logs.txt');

function readDb() {
  try {
    const data = fs.readFileSync(DB_FILE, 'utf-8');
    return JSON.parse(data);
  } catch (err) {
    console.error('Error reading database file, returning default schema:', err);
    return { hero: {}, projects: [], villas_info: {}, apartments_info: {}, plots_info: {}, leads: [] };
  }
}

function writeDb(data) {
  try {
    fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2), 'utf-8');
    return true;
  } catch (err) {
    console.error('Error writing to database file:', err);
    return false;
  }
}

// Mail Dispatcher Routine
async function dispatchEmail(leadInfo) {
  const mailTarget = process.env.NOTIFICATION_EMAIL || 'kshetraspacesbyhimabindu@gmail.com';
  
  const textBody = `
=== KSHETRA SPACES - NEW INQUIRY ===
Form Type: ${leadInfo.formType || 'Advisory Inquiry'}
Date/Time: ${leadInfo.timestamp}
Name: ${leadInfo.name}
Phone: ${leadInfo.phone}
Email: ${leadInfo.email || 'N/A'}
Interested In/Project: ${leadInfo.interest || leadInfo.project || 'N/A'}
Preferred Date: ${leadInfo.visitDate || 'N/A'}
Requirements/Message: 
${leadInfo.message || 'No extra requirements specified.'}
===================================
`;

  // Check if SMTP is configured
  const smtpHost = process.env.SMTP_HOST;
  const smtpUser = process.env.SMTP_USER;
  const smtpPass = process.env.SMTP_PASS;

  if (smtpHost && smtpUser && smtpPass) {
    try {
      const transporter = nodemailer.createTransport({
        host: smtpHost,
        port: parseInt(process.env.SMTP_PORT) || 587,
        secure: process.env.SMTP_SECURE === 'true',
        auth: {
          user: smtpUser,
          pass: smtpPass
        }
      });

      await transporter.sendMail({
        from: `"Kshetra Spaces Portal" <${smtpUser}>`,
        to: mailTarget,
        subject: `New Lead: ${leadInfo.name} - ${leadInfo.interest || leadInfo.project || 'Inquiry'}`,
        text: textBody
      });
      console.log(`Email successfully dispatched via SMTP to ${mailTarget}`);
    } catch (mailErr) {
      console.error('SMTP Mail dispatch failed, falling back to local logs:', mailErr);
      logEmailLocally(textBody);
    }
  } else {
    logEmailLocally(textBody);
  }
}

// Local logging fallback
function logEmailLocally(body) {
  const logMessage = `\n[MOCK EMAIL SENT AT ${new Date().toISOString()}]\n${body}\n`;
  console.log(logMessage);
  try {
    fs.appendFileSync(EMAIL_LOG_FILE, logMessage, 'utf-8');
  } catch (err) {
    console.error('Failed to write to local email-logs.txt file:', err);
  }
}

// Admin Authentication Middleware
function authenticateAdmin(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(410).json({ error: 'Unauthorized: Session missing or expired' });
  }
  const token = authHeader.substring(7);
  if (!activeSessions.has(token)) {
    return res.status(410).json({ error: 'Unauthorized: Invalid session token' });
  }
  next();
}

/* ==========================================================================
   API ENDPOINTS
   ========================================================================== */

// 1. Get dynamic website content
app.get('/api/content', (req, res) => {
  const db = readDb();
  res.json({
    hero: db.hero,
    projects: db.projects,
    villas_info: db.villas_info,
    apartments_info: db.apartments_info,
    plots_info: db.plots_info
  });
});

// 2. Submit new lead
app.post('/api/leads', async (req, res) => {
  const { name, phone, email, interest, message, project, visitDate } = req.body;
  
  if (!name || !phone) {
    return res.status(400).json({ error: 'Name and phone number are required fields' });
  }

  const db = readDb();
  
  const newLead = {
    id: 'lead_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5),
    name,
    phone,
    email: email || '',
    interest: interest || '',
    project: project || '',
    visitDate: visitDate || '',
    message: message || '',
    formType: visitDate ? 'Site Visit Request' : 'Contact/Advisory Form',
    status: 'New',
    timestamp: new Date().toISOString()
  };

  db.leads.push(newLead);
  writeDb(db);

  // Dispatch Email Notification
  await dispatchEmail(newLead);

  res.status(201).json({ success: true, message: 'Inquiry received successfully' });
});

// 3. Admin Login
app.post('/api/auth/login', (req, res) => {
  const { username, password } = req.body;
  const targetUser = process.env.ADMIN_USERNAME || 'admin';
  const targetPass = process.env.ADMIN_PASSWORD || 'admin123';

  if (username === targetUser && password === targetPass) {
    const token = 'token_' + Math.random().toString(36).substr(2, 10) + Date.now().toString(36);
    activeSessions.add(token);
    res.json({ success: true, token });
  } else {
    res.status(401).json({ error: 'Invalid login credentials' });
  }
});

// 4. Admin Logout
app.post('/api/auth/logout', (req, res) => {
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.substring(7);
    activeSessions.delete(token);
  }
  res.json({ success: true });
});

// 5. Get Leads list (Auth protected)
app.get('/api/admin/leads', authenticateAdmin, (req, res) => {
  const db = readDb();
  res.json({ leads: db.leads });
});

// 6. Delete Lead (Auth protected)
app.delete('/api/admin/leads/:id', authenticateAdmin, (req, res) => {
  const { id } = req.params;
  const db = readDb();
  const index = db.leads.findIndex(l => l.id === id);

  if (index === -1) {
    return res.status(404).json({ error: 'Lead not found' });
  }

  db.leads.splice(index, 1);
  writeDb(db);
  res.json({ success: true, message: 'Lead deleted successfully' });
});

// 6.5. Update Lead Status (Auth protected)
app.patch('/api/admin/leads/:id/status', authenticateAdmin, (req, res) => {
  const { id } = req.params;
  const { status } = req.body;
  const db = readDb();
  const lead = db.leads.find(l => l.id === id);

  if (!lead) {
    return res.status(404).json({ error: 'Lead not found' });
  }

  lead.status = status || 'New';
  writeDb(db);
  res.json({ success: true, message: 'Lead status updated successfully' });
});

// 7. Edit Page Content / Portfolio (Auth protected)
app.post('/api/admin/content', authenticateAdmin, (req, res) => {
  const { hero, projects, villas_info, apartments_info, plots_info } = req.body;
  const db = readDb();

  if (hero) db.hero = hero;
  if (projects) db.projects = projects;
  if (villas_info) db.villas_info = villas_info;
  if (apartments_info) db.apartments_info = apartments_info;
  if (plots_info) db.plots_info = plots_info;

  if (writeDb(db)) {
    res.json({ success: true, message: 'Content updated successfully' });
  } else {
    res.status(500).json({ error: 'Failed to write updates to database' });
  }
});

/* ==========================================================================
   PRODUCTION SERVING
   ========================================================================== */
const distPath = path.join(__dirname, 'dist');
if (fs.existsSync(distPath)) {
  app.use(express.static(distPath));
  app.get('*', (req, res) => {
    res.sendFile(path.join(distPath, 'index.html'));
  });
}

app.listen(PORT, () => {
  console.log(`Express server running on http://localhost:${PORT}`);
  console.log(`SMTP configured: ${process.env.SMTP_HOST ? 'YES' : 'NO (Using local fallback log files)'}`);
});
