import express from 'express';
import cors from 'cors';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import nodemailer from 'nodemailer';
import pool from './db.js';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

// Memory storage for active session tokens
const activeSessions = new Set();

app.use(cors());
app.use(express.json());

const EMAIL_LOG_FILE = path.join(__dirname, 'email-logs.txt');

// Database auto-migration & seeding
async function initializeDatabase() {
  console.log('Initializing PostgreSQL database...');
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    
    // Create site_content table
    await client.query(`
      CREATE TABLE IF NOT EXISTS site_content (
        key VARCHAR(100) PRIMARY KEY,
        value JSONB NOT NULL
      )
    `);

    // Create leads table
    await client.query(`
      CREATE TABLE IF NOT EXISTS leads (
        id VARCHAR(100) PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        phone VARCHAR(100) NOT NULL,
        email VARCHAR(255),
        interest VARCHAR(255),
        project VARCHAR(255),
        visit_date VARCHAR(100),
        message TEXT,
        form_type VARCHAR(255),
        status VARCHAR(100) DEFAULT 'New',
        timestamp VARCHAR(100) NOT NULL
      )
    `);

    // Check if site_content is empty. If so, seed from db.json
    const { rows } = await client.query('SELECT COUNT(*) FROM site_content');
    if (parseInt(rows[0].count) === 0) {
      console.log('Database is empty. Seeding from db.json...');
      const dbPath = path.join(__dirname, 'db.json');
      if (fs.existsSync(dbPath)) {
        const fileContent = fs.readFileSync(dbPath, 'utf-8');
        const dbJson = JSON.parse(fileContent);

        const sections = ['hero', 'projects', 'villas_info', 'apartments_info', 'plots_info'];
        for (const section of sections) {
          if (dbJson[section]) {
            await client.query(
              'INSERT INTO site_content (key, value) VALUES ($1, $2) ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value',
              [section, JSON.stringify(dbJson[section])]
            );
          }
        }

        if (dbJson.leads && Array.isArray(dbJson.leads)) {
          for (const lead of dbJson.leads) {
            await client.query(
              `INSERT INTO leads (id, name, phone, email, interest, project, visit_date, message, form_type, status, timestamp)
               VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
               ON CONFLICT (id) DO NOTHING`,
              [
                lead.id,
                lead.name,
                lead.phone,
                lead.email || '',
                lead.interest || '',
                lead.project || '',
                lead.visitDate || '',
                lead.message || '',
                lead.formType || '',
                lead.status || 'New',
                lead.timestamp
              ]
            );
          }
        }
        console.log('Database seeding completed successfully.');
      } else {
        console.warn('db.json not found for database seeding.');
      }
    } else {
      console.log('Database tables verify OK (already initialized).');
    }
    
    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Failed to initialize database:', err);
  } finally {
    client.release();
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
app.get('/api/content', async (req, res) => {
  try {
    const result = await pool.query('SELECT key, value FROM site_content');
    const content = {};
    result.rows.forEach(row => {
      content[row.key] = row.value;
    });

    res.json({
      hero: content.hero || {},
      projects: content.projects || [],
      villas_info: content.villas_info || {},
      apartments_info: content.apartments_info || {},
      plots_info: content.plots_info || {}
    });
  } catch (err) {
    console.error('Error reading content from database:', err);
    res.status(500).json({ error: 'Failed to retrieve website content' });
  }
});

// 2. Submit new lead
app.post('/api/leads', async (req, res) => {
  const { name, phone, email, interest, message, project, visitDate } = req.body;
  
  if (!name || !phone) {
    return res.status(400).json({ error: 'Name and phone number are required fields' });
  }

  const id = 'lead_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5);
  const timestamp = new Date().toISOString();
  const formType = visitDate ? 'Site Visit Request' : 'Contact/Advisory Form';
  const status = 'New';

  try {
    await pool.query(
      `INSERT INTO leads (id, name, phone, email, interest, project, visit_date, message, form_type, status, timestamp)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
      [id, name, phone, email || '', interest || '', project || '', visitDate || '', message || '', formType, status, timestamp]
    );

    const leadInfo = {
      id, name, phone, email, interest, project, visitDate, message, formType, status, timestamp
    };

    // Dispatch Email Notification
    await dispatchEmail(leadInfo);

    res.status(201).json({ success: true, message: 'Inquiry received successfully' });
  } catch (err) {
    console.error('Error inserting lead into database:', err);
    res.status(500).json({ error: 'Failed to record lead' });
  }
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
app.get('/api/admin/leads', authenticateAdmin, async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM leads ORDER BY timestamp DESC');
    const leads = result.rows.map(row => ({
      id: row.id,
      name: row.name,
      phone: row.phone,
      email: row.email,
      interest: row.interest,
      project: row.project,
      visitDate: row.visit_date,
      message: row.message,
      formType: row.form_type,
      status: row.status,
      timestamp: row.timestamp
    }));
    res.json({ leads });
  } catch (err) {
    console.error('Error fetching leads:', err);
    res.status(500).json({ error: 'Failed to retrieve leads list' });
  }
});

// 6. Delete Lead (Auth protected)
app.delete('/api/admin/leads/:id', authenticateAdmin, async (req, res) => {
  const { id } = req.params;
  try {
    const result = await pool.query('DELETE FROM leads WHERE id = $1', [id]);
    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'Lead not found' });
    }
    res.json({ success: true, message: 'Lead deleted successfully' });
  } catch (err) {
    console.error('Error deleting lead:', err);
    res.status(500).json({ error: 'Failed to delete lead' });
  }
});

// 6.5. Update Lead Status (Auth protected)
app.patch('/api/admin/leads/:id/status', authenticateAdmin, async (req, res) => {
  const { id } = req.params;
  const { status } = req.body;
  try {
    const result = await pool.query('UPDATE leads SET status = $1 WHERE id = $2', [status || 'New', id]);
    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'Lead not found' });
    }
    res.json({ success: true, message: 'Lead status updated successfully' });
  } catch (err) {
    console.error('Error updating lead status:', err);
    res.status(500).json({ error: 'Failed to update status' });
  }
});

// 7. Edit Page Content / Portfolio (Auth protected)
app.post('/api/admin/content', authenticateAdmin, async (req, res) => {
  const { hero, projects, villas_info, apartments_info, plots_info } = req.body;
  try {
    await pool.query('BEGIN');
    if (hero) {
      await pool.query('INSERT INTO site_content (key, value) VALUES ($1, $2) ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value', ['hero', JSON.stringify(hero)]);
    }
    if (projects) {
      await pool.query('INSERT INTO site_content (key, value) VALUES ($1, $2) ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value', ['projects', JSON.stringify(projects)]);
    }
    if (villas_info) {
      await pool.query('INSERT INTO site_content (key, value) VALUES ($1, $2) ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value', ['villas_info', JSON.stringify(villas_info)]);
    }
    if (apartments_info) {
      await pool.query('INSERT INTO site_content (key, value) VALUES ($1, $2) ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value', ['apartments_info', JSON.stringify(apartments_info)]);
    }
    if (plots_info) {
      await pool.query('INSERT INTO site_content (key, value) VALUES ($1, $2) ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value', ['plots_info', JSON.stringify(plots_info)]);
    }
    await pool.query('COMMIT');
    res.json({ success: true, message: 'Content updated successfully' });
  } catch (err) {
    await pool.query('ROLLBACK');
    console.error('Error updating page content:', err);
    res.status(500).json({ error: 'Failed to save page contents' });
  }
});

/* ==========================================================================
   PRODUCTION SERVING (WITH CLEAN URL SUPPORT)
   ========================================================================== */
const distPath = path.join(__dirname, 'dist');
if (fs.existsSync(distPath)) {
  // Serve static assets, allowing HTML files to be resolved without extensions (e.g. /about serves about.html)
  app.use(express.static(distPath, { extensions: ['html'] }));
}

// Database initialization followed by starting the web server
initializeDatabase().then(() => {
  app.listen(PORT, () => {
    console.log(`Express server running on http://localhost:${PORT}`);
    console.log(`SMTP configured: ${process.env.SMTP_HOST ? 'YES' : 'NO (Using local fallback log files)'}`);
  });
}).catch(err => {
  console.error('Database initialization failed, server did not start:', err);
});
