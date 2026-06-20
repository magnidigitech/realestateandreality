-- Schema for Kshetra Spaces PostgreSQL Database

-- 1. Site Content Table (Key-Value style for flexible page sections)
CREATE TABLE IF NOT EXISTS site_content (
    key VARCHAR(100) PRIMARY KEY,
    value JSONB NOT NULL
);

-- 2. Leads Table (Structured storage for customer inquiries)
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
);
