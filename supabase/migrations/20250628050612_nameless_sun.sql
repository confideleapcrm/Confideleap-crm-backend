-- 20250628050612_nameless_sun.sql
-- Investor Relations CRM Database Schema
-- Converted for pgAdmin / Standard PostgreSQL compatibility

-- Ensure pgcrypto is available for gen_random_uuid()
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Mock Supabase auth schema for RLS compatibility in standard PostgreSQL
CREATE SCHEMA IF NOT EXISTS auth;
CREATE OR REPLACE FUNCTION auth.uid() 
RETURNS uuid 
AS $$ SELECT current_setting('app.current_user_id', true)::uuid; $$ 
LANGUAGE sql STABLE;

BEGIN;

-- =============================================
-- USERS AND AUTHENTICATION
-- =============================================

CREATE TABLE IF NOT EXISTS public.users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100) NOT NULL,
    avatar_url TEXT,
    phone VARCHAR(20),
    job_title VARCHAR(100),
    department VARCHAR(100),
    bio TEXT,
    timezone VARCHAR(50) DEFAULT 'UTC',
    language VARCHAR(10) DEFAULT 'en',
    theme VARCHAR(20) DEFAULT 'light',
    is_active BOOLEAN DEFAULT true,
    email_verified BOOLEAN DEFAULT false,
    two_factor_enabled BOOLEAN DEFAULT false,
    last_login_at TIMESTAMPTZ,
    google_refresh_token TEXT,
    google_email TEXT,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.user_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    session_token VARCHAR(255) UNIQUE NOT NULL,
    device_info JSONB,
    ip_address INET,
    location VARCHAR(100),
    expires_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.roles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(50) UNIQUE NOT NULL,
    description TEXT,
    permissions JSONB NOT NULL DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.user_roles (
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    role_id UUID NOT NULL REFERENCES public.roles(id) ON DELETE CASCADE,
    assigned_at TIMESTAMPTZ DEFAULT now(),
    assigned_by UUID REFERENCES public.users(id),
    PRIMARY KEY (user_id, role_id)
);

-- =============================================
-- COMPANIES AND ORGANIZATIONS
-- =============================================

CREATE TABLE IF NOT EXISTS public.companies (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    domain VARCHAR(255),
    industry VARCHAR(100),
    size VARCHAR(50),
    description TEXT,
    website VARCHAR(255),
    logo_url TEXT,
    headquarters VARCHAR(255),
    founded_year INTEGER,
    funding_stage VARCHAR(50),
    total_funding DECIMAL(15,2),
    employee_count INTEGER,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.company_users (
    company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    role VARCHAR(50) NOT NULL DEFAULT 'member',
    joined_at TIMESTAMPTZ DEFAULT now(),
    PRIMARY KEY (company_id, user_id)
);

-- =============================================
-- INVESTORS AND FIRMS
-- =============================================

CREATE TABLE IF NOT EXISTS public.investment_firms (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    type VARCHAR(50),
    website VARCHAR(255),
    description TEXT,
    logo_url TEXT,
    headquarters VARCHAR(255),
    founded_year INTEGER,
    aum DECIMAL(15,2),
    portfolio_size INTEGER,
    investment_stages TEXT[],
    sector_focus TEXT[],
    geographic_focus TEXT[],
    min_investment DECIMAL(15,2),
    max_investment DECIMAL(15,2),
    typical_investment DECIMAL(15,2),
    linkedin_url VARCHAR(255),
    twitter_url VARCHAR(255),
    crunchbase_url VARCHAR(255),
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.investors (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    firm_id UUID REFERENCES public.investment_firms(id) ON DELETE SET NULL,
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100) NOT NULL,
    email VARCHAR(255),
    phone VARCHAR(20),
    job_title VARCHAR(100),
    seniority_level VARCHAR(50),
    bio TEXT,
    avatar_url TEXT,
    linkedin_url VARCHAR(255),
    twitter_url VARCHAR(255),
    personal_website VARCHAR(255),
    location VARCHAR(255),
    investment_stages TEXT[],
    sector_preferences TEXT[],
    geographic_preferences TEXT[],
    min_check_size DECIMAL(15,2),
    max_check_size DECIMAL(15,2),
    portfolio_companies TEXT[],
    notable_investments TEXT[],
    education JSONB,
    experience JSONB,
    portfolio_fit_score INTEGER DEFAULT 0,
    engagement_score INTEGER DEFAULT 0,
    response_rate DECIMAL(5,2) DEFAULT 0,
    last_contact_date TIMESTAMPTZ,
    status VARCHAR(20) DEFAULT 'cold',
    tags TEXT[],
    notes TEXT,
    is_active BOOLEAN DEFAULT true,
    created_by UUID REFERENCES public.users(id),
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.investor_contacts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    investor_id UUID NOT NULL REFERENCES public.investors(id) ON DELETE CASCADE,
    type VARCHAR(20) NOT NULL,
    value VARCHAR(255) NOT NULL,
    label VARCHAR(50),
    is_primary BOOLEAN DEFAULT false,
    is_verified BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- =============================================
-- CAMPAIGNS AND OUTREACH
-- =============================================

CREATE TABLE IF NOT EXISTS public.campaign_templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    description TEXT,
    type VARCHAR(50) NOT NULL,
    channels TEXT[] NOT NULL,
    subject_template TEXT,
    body_template TEXT,
    follow_up_templates JSONB,
    estimated_response_rate DECIMAL(5,2),
    tags TEXT[],
    is_active BOOLEAN DEFAULT true,
    created_by UUID REFERENCES public.users(id),
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.campaigns (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    description TEXT,
    type VARCHAR(50) NOT NULL,
    status VARCHAR(20) DEFAULT 'draft',
    template_id UUID REFERENCES public.campaign_templates(id),
    channels TEXT[] NOT NULL,
    target_audience JSONB,
    subject_line TEXT,
    message_content TEXT,
    follow_up_sequence JSONB,
    send_schedule JSONB,
    budget DECIMAL(10,2),
    spent DECIMAL(10,2) DEFAULT 0,
    total_recipients INTEGER DEFAULT 0,
    sent_count INTEGER DEFAULT 0,
    delivered_count INTEGER DEFAULT 0,
    opened_count INTEGER DEFAULT 0,
    clicked_count INTEGER DEFAULT 0,
    replied_count INTEGER DEFAULT 0,
    bounced_count INTEGER DEFAULT 0,
    unsubscribed_count INTEGER DEFAULT 0,
    meeting_count INTEGER DEFAULT 0,
    conversion_rate DECIMAL(5,2) DEFAULT 0,
    open_rate DECIMAL(5,2) DEFAULT 0,
    response_rate DECIMAL(5,2) DEFAULT 0,
    meeting_rate DECIMAL(5,2) DEFAULT 0,
    priority VARCHAR(10) DEFAULT 'medium',
    tags TEXT[],
    settings JSONB DEFAULT '{}',
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    created_by UUID REFERENCES public.users(id),
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.campaign_recipients (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    campaign_id UUID NOT NULL REFERENCES public.campaigns(id) ON DELETE CASCADE,
    investor_id UUID NOT NULL REFERENCES public.investors(id) ON DELETE CASCADE,
    status VARCHAR(20) DEFAULT 'pending',
    personalization JSONB,
    sent_at TIMESTAMPTZ,
    delivered_at TIMESTAMPTZ,
    opened_at TIMESTAMPTZ,
    clicked_at TIMESTAMPTZ,
    replied_at TIMESTAMPTZ,
    bounced_at TIMESTAMPTZ,
    unsubscribed_at TIMESTAMPTZ,
    open_count INTEGER DEFAULT 0,
    click_count INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(campaign_id, investor_id)
);

CREATE TABLE IF NOT EXISTS public.campaign_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    campaign_id UUID NOT NULL REFERENCES public.campaigns(id) ON DELETE CASCADE,
    recipient_id UUID NOT NULL REFERENCES public.campaign_recipients(id) ON DELETE CASCADE,
    investor_id UUID NOT NULL REFERENCES public.investors(id) ON DELETE CASCADE,
    message_type VARCHAR(20) NOT NULL,
    channel VARCHAR(20) NOT NULL,
    subject TEXT,
    content TEXT NOT NULL,
    status VARCHAR(20) DEFAULT 'pending',
    scheduled_at TIMESTAMPTZ,
    sent_at TIMESTAMPTZ,
    delivered_at TIMESTAMPTZ,
    opened_at TIMESTAMPTZ,
    clicked_at TIMESTAMPTZ,
    replied_at TIMESTAMPTZ,
    bounced_at TIMESTAMPTZ,
    error_message TEXT,
    tracking_data JSONB,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- =============================================
-- COMMUNICATIONS AND INTERACTIONS
-- =============================================

CREATE TABLE IF NOT EXISTS public.communications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    investor_id UUID NOT NULL REFERENCES public.investors(id) ON DELETE CASCADE,
    campaign_id UUID REFERENCES public.campaigns(id) ON DELETE SET NULL,
    user_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
    type VARCHAR(20) NOT NULL,
    direction VARCHAR(10) NOT NULL,
    subject TEXT,
    content TEXT,
    status VARCHAR(20),
    channel_data JSONB,
    attachments JSONB,
    sentiment VARCHAR(20),
    priority VARCHAR(10) DEFAULT 'normal',
    tags TEXT[],
    scheduled_at TIMESTAMPTZ,
    occurred_at TIMESTAMPTZ DEFAULT now(),
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.meetings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title VARCHAR(255) NOT NULL,
    description TEXT,
    type VARCHAR(50),
    status VARCHAR(20) DEFAULT 'scheduled',
    location VARCHAR(255),
    meeting_url VARCHAR(255),
    duration_minutes INTEGER DEFAULT 60,
    scheduled_start TIMESTAMPTZ NOT NULL,
    scheduled_end TIMESTAMPTZ NOT NULL,
    actual_start TIMESTAMPTZ,
    actual_end TIMESTAMPTZ,
    agenda TEXT,
    notes TEXT,
    outcome VARCHAR(50),
    next_steps TEXT,
    recording_url VARCHAR(255),
    calendar_event_id VARCHAR(255),
    created_by UUID REFERENCES public.users(id),
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- =============================================
-- PIPELINE AND DEAL TRACKING
-- =============================================

CREATE TABLE IF NOT EXISTS public.pipeline_stages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(100) NOT NULL,
    description TEXT,
    order_index INTEGER NOT NULL,
    color VARCHAR(7),
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.pipeline_opportunities (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    description TEXT,
    stage_id UUID NOT NULL REFERENCES public.pipeline_stages(id),
    investor_id UUID NOT NULL REFERENCES public.investors(id) ON DELETE CASCADE,
    amount DECIMAL(15,2),
    probability DECIMAL(5,2),
    expected_close_date DATE,
    actual_close_date DATE,
    status VARCHAR(20) DEFAULT 'open',
    loss_reason TEXT,
    source VARCHAR(50),
    tags TEXT[],
    custom_fields JSONB,
    created_by UUID REFERENCES public.users(id),
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.pipeline_stage_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    opportunity_id UUID NOT NULL REFERENCES public.pipeline_opportunities(id) ON DELETE CASCADE,
    from_stage_id UUID REFERENCES public.pipeline_stages(id),
    to_stage_id UUID NOT NULL REFERENCES public.pipeline_stages(id),
    changed_by UUID REFERENCES public.users(id),
    notes TEXT,
    changed_at TIMESTAMPTZ DEFAULT now()
);

-- =============================================
-- DOCUMENTS AND FILES
-- =============================================

CREATE TABLE IF NOT EXISTS public.documents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    description TEXT,
    file_path VARCHAR(500) NOT NULL,
    file_size BIGINT,
    mime_type VARCHAR(100),
    category VARCHAR(50),
    version VARCHAR(20) DEFAULT '1.0',
    is_public BOOLEAN DEFAULT false,
    download_count INTEGER DEFAULT 0,
    tags TEXT[],
    uploaded_by UUID REFERENCES public.users(id),
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.document_shares (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    document_id UUID NOT NULL REFERENCES public.documents(id) ON DELETE CASCADE,
    investor_id UUID REFERENCES public.investors(id) ON DELETE CASCADE,
    user_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
    shared_by UUID REFERENCES public.users(id),
    access_level VARCHAR(20) DEFAULT 'view',
    expires_at TIMESTAMPTZ,
    password_protected BOOLEAN DEFAULT false,
    download_count INTEGER DEFAULT 0,
    last_accessed_at TIMESTAMPTZ,
    shared_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.document_access_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    document_id UUID NOT NULL REFERENCES public.documents(id) ON DELETE CASCADE,
    share_id UUID REFERENCES public.document_shares(id) ON DELETE SET NULL,
    investor_id UUID REFERENCES public.investors(id) ON DELETE SET NULL,
    user_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
    action VARCHAR(20) NOT NULL,
    ip_address INET,
    user_agent TEXT,
    accessed_at TIMESTAMPTZ DEFAULT now()
);

-- =============================================
-- ANALYTICS AND REPORTING
-- =============================================

CREATE TABLE IF NOT EXISTS public.reports (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    description TEXT,
    type VARCHAR(50) NOT NULL,
    configuration JSONB NOT NULL,
    schedule JSONB,
    is_public BOOLEAN DEFAULT false,
    last_generated_at TIMESTAMPTZ,
    created_by UUID REFERENCES public.users(id),
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.report_shares (
    report_id UUID NOT NULL REFERENCES public.reports(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    access_level VARCHAR(20) DEFAULT 'view',
    shared_by UUID REFERENCES public.users(id),
    shared_at TIMESTAMPTZ DEFAULT now(),
    PRIMARY KEY (report_id, user_id)
);

CREATE TABLE IF NOT EXISTS public.analytics_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
    event_type VARCHAR(50) NOT NULL,
    event_data JSONB,
    session_id VARCHAR(255),
    ip_address INET,
    user_agent TEXT,
    occurred_at TIMESTAMPTZ DEFAULT now()
);

-- =============================================
-- INTEGRATIONS AND EXTERNAL SERVICES
-- =============================================

CREATE TABLE IF NOT EXISTS public.integrations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(100) NOT NULL,
    type VARCHAR(50) NOT NULL,
    provider VARCHAR(50) NOT NULL,
    configuration JSONB NOT NULL,
    credentials JSONB,
    status VARCHAR(20) DEFAULT 'active',
    last_sync_at TIMESTAMPTZ,
    sync_frequency INTEGER DEFAULT 3600,
    error_message TEXT,
    created_by UUID REFERENCES public.users(id),
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.integration_sync_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    integration_id UUID NOT NULL REFERENCES public.integrations(id) ON DELETE CASCADE,
    sync_type VARCHAR(50) NOT NULL,
    status VARCHAR(20) NOT NULL,
    records_processed INTEGER DEFAULT 0,
    records_created INTEGER DEFAULT 0,
    records_updated INTEGER DEFAULT 0,
    records_failed INTEGER DEFAULT 0,
    error_details JSONB,
    started_at TIMESTAMPTZ DEFAULT now(),
    completed_at TIMESTAMPTZ
);

-- =============================================
-- NOTIFICATIONS AND ALERTS
-- =============================================

CREATE TABLE IF NOT EXISTS public.notification_preferences (
    user_id UUID PRIMARY KEY REFERENCES public.users(id) ON DELETE CASCADE,
    email_enabled BOOLEAN DEFAULT true,
    push_enabled BOOLEAN DEFAULT true,
    sms_enabled BOOLEAN DEFAULT false,
    desktop_enabled BOOLEAN DEFAULT true,
    quiet_hours_start TIME,
    quiet_hours_end TIME,
    timezone VARCHAR(50) DEFAULT 'UTC',
    frequency VARCHAR(20) DEFAULT 'immediate',
    categories JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    type VARCHAR(50) NOT NULL,
    title VARCHAR(255) NOT NULL,
    message TEXT NOT NULL,
    data JSONB,
    channels TEXT[] DEFAULT ARRAY['email'],
    priority VARCHAR(10) DEFAULT 'normal',
    status VARCHAR(20) DEFAULT 'pending',
    scheduled_at TIMESTAMPTZ DEFAULT now(),
    sent_at TIMESTAMPTZ,
    read_at TIMESTAMPTZ,
    expires_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- =============================================
-- SYSTEM CONFIGURATION
-- =============================================

CREATE TABLE IF NOT EXISTS public.system_settings (
    key VARCHAR(100) PRIMARY KEY,
    value JSONB NOT NULL,
    description TEXT,
    category VARCHAR(50),
    is_public BOOLEAN DEFAULT false,
    updated_by UUID REFERENCES public.users(id),
    updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
    table_name VARCHAR(100) NOT NULL,
    record_id UUID,
    action VARCHAR(20) NOT NULL,
    old_values JSONB,
    new_values JSONB,
    ip_address INET,
    user_agent TEXT,
    occurred_at TIMESTAMPTZ DEFAULT now()
);

-- =============================================
-- INDEXES
-- =============================================

CREATE INDEX IF NOT EXISTS idx_users_email ON public.users(email);
CREATE INDEX IF NOT EXISTS idx_users_active ON public.users(is_active);

CREATE INDEX IF NOT EXISTS idx_investors_firm ON public.investors(firm_id);
CREATE INDEX IF NOT EXISTS idx_investors_status ON public.investors(status);
CREATE INDEX IF NOT EXISTS idx_investors_fit_score ON public.investors(portfolio_fit_score DESC);
CREATE INDEX IF NOT EXISTS idx_investors_location ON public.investors(location);
CREATE INDEX IF NOT EXISTS idx_investors_sectors ON public.investors USING GIN(sector_preferences);
CREATE INDEX IF NOT EXISTS idx_investors_stages ON public.investors USING GIN(investment_stages);
CREATE INDEX IF NOT EXISTS idx_investors_tags ON public.investors USING GIN(tags);
CREATE INDEX IF NOT EXISTS idx_investors_created_by ON public.investors(created_by);
CREATE INDEX IF NOT EXISTS idx_investors_last_contact ON public.investors(last_contact_date DESC);

CREATE INDEX IF NOT EXISTS idx_firms_type ON public.investment_firms(type);
CREATE INDEX IF NOT EXISTS idx_firms_stages ON public.investment_firms USING GIN(investment_stages);
CREATE INDEX IF NOT EXISTS idx_firms_sectors ON public.investment_firms USING GIN(sector_focus);
CREATE INDEX IF NOT EXISTS idx_firms_active ON public.investment_firms(is_active);

CREATE INDEX IF NOT EXISTS idx_campaigns_status ON public.campaigns(status);
CREATE INDEX IF NOT EXISTS idx_campaigns_type ON public.campaigns(type);
CREATE INDEX IF NOT EXISTS idx_campaigns_created_by ON public.campaigns(created_by);
CREATE INDEX IF NOT EXISTS idx_campaigns_created_at ON public.campaigns(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_campaign_recipients_campaign ON public.campaign_recipients(campaign_id);
CREATE INDEX IF NOT EXISTS idx_campaign_recipients_investor ON public.campaign_recipients(investor_id);
CREATE INDEX IF NOT EXISTS idx_campaign_recipients_status ON public.campaign_recipients(status);

CREATE INDEX IF NOT EXISTS idx_communications_investor ON public.communications(investor_id);
CREATE INDEX IF NOT EXISTS idx_communications_type ON public.communications(type);
CREATE INDEX IF NOT EXISTS idx_communications_occurred_at ON public.communications(occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_communications_campaign ON public.communications(campaign_id);

CREATE INDEX IF NOT EXISTS idx_meetings_scheduled_start ON public.meetings(scheduled_start);
CREATE INDEX IF NOT EXISTS idx_meetings_status ON public.meetings(status);
CREATE INDEX IF NOT EXISTS idx_meetings_created_by ON public.meetings(created_by);

CREATE INDEX IF NOT EXISTS idx_pipeline_opportunities_stage ON public.pipeline_opportunities(stage_id);
CREATE INDEX IF NOT EXISTS idx_pipeline_opportunities_investor ON public.pipeline_opportunities(investor_id);
CREATE INDEX IF NOT EXISTS idx_pipeline_opportunities_status ON public.pipeline_opportunities(status);
CREATE INDEX IF NOT EXISTS idx_pipeline_opportunities_amount ON public.pipeline_opportunities(amount DESC);

CREATE INDEX IF NOT EXISTS idx_documents_category ON public.documents(category);
CREATE INDEX IF NOT EXISTS idx_documents_uploaded_by ON public.documents(uploaded_by);
CREATE INDEX IF NOT EXISTS idx_documents_created_at ON public.documents(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_analytics_events_user ON public.analytics_events(user_id);
CREATE INDEX IF NOT EXISTS idx_analytics_events_type ON public.analytics_events(event_type);
CREATE INDEX IF NOT EXISTS idx_analytics_events_occurred_at ON public.analytics_events(occurred_at DESC);

CREATE INDEX IF NOT EXISTS idx_notifications_user ON public.notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_status ON public.notifications(status);
CREATE INDEX IF NOT EXISTS idx_notifications_scheduled_at ON public.notifications(scheduled_at);

CREATE INDEX IF NOT EXISTS idx_audit_logs_user ON public.audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_table ON public.audit_logs(table_name);
CREATE INDEX IF NOT EXISTS idx_audit_logs_occurred_at ON public.audit_logs(occurred_at DESC);

-- =============================================
-- FUNCTIONS AND TRIGGERS
-- =============================================

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ language 'plpgsql';

DO $$
BEGIN
    -- Apply updated_at trigger to relevant tables
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_users_updated_at') THEN
        CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON public.users FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_companies_updated_at') THEN
        CREATE TRIGGER update_companies_updated_at BEFORE UPDATE ON public.companies FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_investment_firms_updated_at') THEN
        CREATE TRIGGER update_investment_firms_updated_at BEFORE UPDATE ON public.investment_firms FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_investors_updated_at') THEN
        CREATE TRIGGER update_investors_updated_at BEFORE UPDATE ON public.investors FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_campaigns_updated_at') THEN
        CREATE TRIGGER update_campaigns_updated_at BEFORE UPDATE ON public.campaigns FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_pipeline_opportunities_updated_at') THEN
        CREATE TRIGGER update_pipeline_opportunities_updated_at BEFORE UPDATE ON public.pipeline_opportunities FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
    END IF;
END $$;

CREATE OR REPLACE FUNCTION public.calculate_portfolio_fit_score(
    investor_sectors TEXT[],
    investor_stages TEXT[],
    company_sector TEXT,
    company_stage TEXT
) RETURNS INTEGER AS $$
DECLARE
    score INTEGER := 0;
BEGIN
    IF company_sector = ANY(investor_sectors) THEN score := score + 40; END IF;
    IF company_stage = ANY(investor_stages) THEN score := score + 30; END IF;
    RETURN LEAST(score, 100);
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION public.update_campaign_stats(campaign_uuid UUID)
RETURNS VOID AS $$
BEGIN
    UPDATE public.campaigns SET
        total_recipients = (SELECT COUNT(*) FROM public.campaign_recipients WHERE campaign_id = campaign_uuid),
        sent_count = (SELECT COUNT(*) FROM public.campaign_recipients WHERE campaign_id = campaign_uuid AND status IN ('sent', 'delivered', 'opened', 'clicked', 'replied')),
        opened_count = (SELECT COUNT(*) FROM public.campaign_recipients WHERE campaign_id = campaign_uuid AND status IN ('opened', 'clicked', 'replied')),
        replied_count = (SELECT COUNT(*) FROM public.campaign_recipients WHERE campaign_id = campaign_uuid AND status = 'replied'),
        open_rate = CASE 
            WHEN (SELECT COUNT(*) FROM public.campaign_recipients WHERE campaign_id = campaign_uuid AND status IN ('sent', 'delivered', 'opened', 'clicked', 'replied')) > 0
            THEN (SELECT COUNT(*) FROM public.campaign_recipients WHERE campaign_id = campaign_uuid AND status IN ('opened', 'clicked', 'replied')) * 100.0 / 
                 (SELECT COUNT(*) FROM public.campaign_recipients WHERE campaign_id = campaign_uuid AND status IN ('sent', 'delivered', 'opened', 'clicked', 'replied'))
            ELSE 0
        END,
        response_rate = CASE 
            WHEN (SELECT COUNT(*) FROM public.campaign_recipients WHERE campaign_id = campaign_uuid AND status IN ('sent', 'delivered', 'opened', 'clicked', 'replied')) > 0
            THEN (SELECT COUNT(*) FROM public.campaign_recipients WHERE campaign_id = campaign_uuid AND status = 'replied') * 100.0 / 
                 (SELECT COUNT(*) FROM public.campaign_recipients WHERE campaign_id = campaign_uuid AND status IN ('sent', 'delivered', 'opened', 'clicked', 'replied'))
            ELSE 0
        END
    WHERE id = campaign_uuid;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION public.trigger_update_campaign_stats()
RETURNS TRIGGER AS $$
BEGIN
    PERFORM public.update_campaign_stats(NEW.campaign_id);
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_campaign_stats_trigger ON public.campaign_recipients;
CREATE TRIGGER update_campaign_stats_trigger
    AFTER INSERT OR UPDATE ON public.campaign_recipients
    FOR EACH ROW EXECUTE FUNCTION public.trigger_update_campaign_stats();

-- =============================================
-- INITIAL DATA
-- =============================================

INSERT INTO public.roles (name, description, permissions) VALUES
('admin', 'Full system access', '{"all": true}'),
('manager', 'Team management and reporting', '{"campaigns": "all", "investors": "all", "reports": "all", "team": "manage"}'),
('user', 'Standard user access', '{"campaigns": "own", "investors": "read", "reports": "read"}'),
('viewer', 'Read-only access', '{"campaigns": "read", "investors": "read", "reports": "read"}')
ON CONFLICT (name) DO NOTHING;

INSERT INTO public.pipeline_stages (name, description, order_index, color) VALUES
('Initial Contact', 'First outreach or introduction', 1, '#3B82F6'),
('Qualified Interest', 'Investor has shown interest', 2, '#F59E0B'),
('Due Diligence', 'Investor is conducting due diligence', 3, '#EF4444'),
('Term Sheet', 'Term sheet negotiation', 4, '#8B5CF6'),
('Closed Won', 'Investment completed', 5, '#10B981'),
('Closed Lost', 'Opportunity lost', 6, '#6B7280')
ON CONFLICT DO NOTHING;

INSERT INTO public.system_settings (key, value, description, category) VALUES
('company_name', '"InvestorCRM"', 'Company name displayed in the application', 'general'),
('default_timezone', '"UTC"', 'Default timezone for the application', 'general'),
('email_from_address', '"noreply@investorcrm.com"', 'Default from address for system emails', 'email'),
('max_file_upload_size', '52428800', 'Maximum file upload size in bytes (50MB)', 'files'),
('session_timeout', '86400', 'Session timeout in seconds (24 hours)', 'security'),
('password_min_length', '8', 'Minimum password length', 'security'),
('enable_two_factor', 'true', 'Enable two-factor authentication', 'security')
ON CONFLICT (key) DO NOTHING;

-- =============================================
-- ROW LEVEL SECURITY (Converted Syntax)
-- =============================================

ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.investment_firms ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.investors ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.campaign_recipients ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.communications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.meetings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pipeline_opportunities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can read own data" ON public.users;
CREATE POLICY "Users can read own data" ON public.users FOR SELECT USING (auth.uid() = id);

DROP POLICY IF EXISTS "Users can update own profile" ON public.users;
CREATE POLICY "Users can update own profile" ON public.users FOR UPDATE USING (auth.uid() = id);

DROP POLICY IF EXISTS "Company members can read company data" ON public.companies;
CREATE POLICY "Company members can read company data" ON public.companies FOR SELECT USING (id IN (SELECT company_id FROM public.company_users WHERE user_id = auth.uid()));

DROP POLICY IF EXISTS "Users can read accessible investors" ON public.investors;
CREATE POLICY "Users can read accessible investors" ON public.investors FOR SELECT USING (created_by = auth.uid() OR EXISTS (SELECT 1 FROM public.company_users cu JOIN public.company_users cu2 ON cu.company_id = cu2.company_id WHERE cu.user_id = auth.uid() AND cu2.user_id = created_by));

DROP POLICY IF EXISTS "Users can create investors" ON public.investors;
CREATE POLICY "Users can create investors" ON public.investors FOR INSERT WITH CHECK (created_by = auth.uid());

DROP POLICY IF EXISTS "Users can update accessible investors" ON public.investors;
CREATE POLICY "Users can update accessible investors" ON public.investors FOR UPDATE USING (created_by = auth.uid() OR EXISTS (SELECT 1 FROM public.company_users cu JOIN public.company_users cu2 ON cu.company_id = cu2.company_id WHERE cu.user_id = auth.uid() AND cu2.user_id = created_by));

COMMIT;

