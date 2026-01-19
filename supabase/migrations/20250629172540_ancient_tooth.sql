-- 2025_06_29_ancient_tooth.sql
-- Comprehensive Schema Update for Investor Analytics and Reporting
-- Converted for pgAdmin / Standard PostgreSQL compatibility

-- Ensure pgcrypto is available for gen_random_uuid()
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Ensure auth schema mock exists for RLS compatibility
CREATE SCHEMA IF NOT EXISTS auth;
CREATE OR REPLACE FUNCTION auth.uid() 
RETURNS uuid 
AS $$ SELECT current_setting('app.current_user_id', true)::uuid; $$ 
LANGUAGE sql STABLE;

BEGIN;

-- =============================================
-- ANALYTICS AND PERFORMANCE TRACKING
-- =============================================

CREATE TABLE IF NOT EXISTS public.analytics_metrics (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    metric_type VARCHAR(50) NOT NULL,
    metric_name VARCHAR(100) NOT NULL,
    metric_value DECIMAL(15,4) NOT NULL,
    metric_unit VARCHAR(20),
    dimension_type VARCHAR(50),
    dimension_value VARCHAR(255),
    time_period VARCHAR(20) NOT NULL,
    period_start TIMESTAMPTZ NOT NULL,
    period_end TIMESTAMPTZ NOT NULL,
    calculated_at TIMESTAMPTZ DEFAULT now(),
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.performance_benchmarks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    metric_type VARCHAR(50) NOT NULL,
    benchmark_type VARCHAR(20) NOT NULL,
    benchmark_value DECIMAL(15,4) NOT NULL,
    benchmark_unit VARCHAR(20),
    industry VARCHAR(50),
    company_size VARCHAR(20),
    valid_from TIMESTAMPTZ NOT NULL,
    valid_to TIMESTAMPTZ,
    source VARCHAR(100),
    confidence_level DECIMAL(5,2),
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.investor_engagement_scores (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    investor_id UUID NOT NULL REFERENCES public.investors(id) ON DELETE CASCADE,
    engagement_score INTEGER NOT NULL DEFAULT 0,
    response_rate DECIMAL(5,2) DEFAULT 0,
    avg_response_time_hours DECIMAL(8,2),
    meeting_acceptance_rate DECIMAL(5,2) DEFAULT 0,
    email_open_rate DECIMAL(5,2) DEFAULT 0,
    email_click_rate DECIMAL(5,2) DEFAULT 0,
    total_interactions INTEGER DEFAULT 0,
    positive_interactions INTEGER DEFAULT 0,
    last_interaction_date TIMESTAMPTZ,
    score_calculated_at TIMESTAMPTZ DEFAULT now(),
    score_factors JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.campaign_performance_metrics (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    campaign_id UUID NOT NULL REFERENCES public.campaigns(id) ON DELETE CASCADE,
    metric_date DATE NOT NULL,
    emails_sent INTEGER DEFAULT 0,
    emails_delivered INTEGER DEFAULT 0,
    emails_opened INTEGER DEFAULT 0,
    emails_clicked INTEGER DEFAULT 0,
    emails_replied INTEGER DEFAULT 0,
    emails_bounced INTEGER DEFAULT 0,
    emails_unsubscribed INTEGER DEFAULT 0,
    linkedin_sent INTEGER DEFAULT 0,
    linkedin_opened INTEGER DEFAULT 0,
    linkedin_replied INTEGER DEFAULT 0,
    phone_attempts INTEGER DEFAULT 0,
    phone_connected INTEGER DEFAULT 0,
    meetings_scheduled INTEGER DEFAULT 0,
    meetings_completed INTEGER DEFAULT 0,
    meetings_no_show INTEGER DEFAULT 0,
    cost_incurred DECIMAL(10,2) DEFAULT 0,
    revenue_attributed DECIMAL(15,2) DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(campaign_id, metric_date)
);

CREATE TABLE IF NOT EXISTS public.roi_analysis (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    analysis_type VARCHAR(50) NOT NULL,
    entity_id UUID,
    entity_type VARCHAR(50),
    time_period VARCHAR(20) NOT NULL,
    period_start TIMESTAMPTZ NOT NULL,
    period_end TIMESTAMPTZ NOT NULL,
    total_investment DECIMAL(15,2) NOT NULL DEFAULT 0,
    total_return DECIMAL(15,2) NOT NULL DEFAULT 0,
    roi_percentage DECIMAL(8,4) NOT NULL DEFAULT 0,
    cost_per_lead DECIMAL(10,2),
    cost_per_meeting DECIMAL(10,2),
    cost_per_investment DECIMAL(10,2),
    ltv_cac_ratio DECIMAL(8,2),
    payback_period_months DECIMAL(6,2),
    break_even_point TIMESTAMPTZ,
    investment_breakdown JSONB DEFAULT '{}',
    return_breakdown JSONB DEFAULT '{}',
    calculated_at TIMESTAMPTZ DEFAULT now(),
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.cost_tracking (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    cost_category VARCHAR(50) NOT NULL,
    cost_subcategory VARCHAR(100),
    cost_description TEXT,
    amount DECIMAL(10,2) NOT NULL,
    currency VARCHAR(3) DEFAULT 'USD',
    cost_date DATE NOT NULL,
    campaign_id UUID REFERENCES public.campaigns(id) ON DELETE SET NULL,
    investor_id UUID REFERENCES public.investors(id) ON DELETE SET NULL,
    user_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
    vendor VARCHAR(100),
    invoice_number VARCHAR(100),
    is_recurring BOOLEAN DEFAULT false,
    recurring_frequency VARCHAR(20),
    allocation_method VARCHAR(50),
    allocation_percentage DECIMAL(5,2),
    tags TEXT[],
    metadata JSONB DEFAULT '{}',
    created_by UUID REFERENCES public.users(id),
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- =============================================
-- IMPORT AND DATA MANAGEMENT
-- =============================================

CREATE TABLE IF NOT EXISTS public.import_jobs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    job_name VARCHAR(255) NOT NULL,
    import_type VARCHAR(50) NOT NULL,
    import_method VARCHAR(50) NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'pending',
    file_name VARCHAR(255),
    file_size BIGINT,
    file_path VARCHAR(500),
    total_records INTEGER DEFAULT 0,
    processed_records INTEGER DEFAULT 0,
    successful_records INTEGER DEFAULT 0,
    failed_records INTEGER DEFAULT 0,
    duplicate_records INTEGER DEFAULT 0,
    field_mapping JSONB DEFAULT '{}',
    validation_rules JSONB DEFAULT '{}',
    import_settings JSONB DEFAULT '{}',
    error_summary JSONB DEFAULT '{}',
    processing_start TIMESTAMPTZ,
    processing_end TIMESTAMPTZ,
    created_by UUID REFERENCES public.users(id),
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.import_job_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    import_job_id UUID NOT NULL REFERENCES public.import_jobs(id) ON DELETE CASCADE,
    log_level VARCHAR(10) NOT NULL,
    log_message TEXT NOT NULL,
    record_number INTEGER,
    field_name VARCHAR(100),
    field_value TEXT,
    error_code VARCHAR(50),
    error_details JSONB,
    logged_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.data_validation_rules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    rule_name VARCHAR(100) NOT NULL,
    field_name VARCHAR(100) NOT NULL,
    validation_type VARCHAR(50) NOT NULL,
    validation_config JSONB NOT NULL,
    error_message TEXT NOT NULL,
    warning_message TEXT,
    is_active BOOLEAN DEFAULT true,
    applies_to VARCHAR(50) DEFAULT 'all',
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.import_templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    template_name VARCHAR(255) NOT NULL,
    template_description TEXT,
    import_type VARCHAR(50) NOT NULL,
    field_mapping JSONB NOT NULL,
    validation_rules JSONB DEFAULT '{}',
    sample_data JSONB,
    is_default BOOLEAN DEFAULT false,
    is_public BOOLEAN DEFAULT false,
    download_count INTEGER DEFAULT 0,
    created_by UUID REFERENCES public.users(id),
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- =============================================
-- ENHANCED INVESTOR AND FIRM DATA
-- =============================================

CREATE TABLE IF NOT EXISTS public.investor_portfolio_fit (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    investor_id UUID NOT NULL REFERENCES public.investors(id) ON DELETE CASCADE,
    company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
    overall_fit_score INTEGER NOT NULL DEFAULT 0,
    sector_fit_score INTEGER DEFAULT 0,
    stage_fit_score INTEGER DEFAULT 0,
    geographic_fit_score INTEGER DEFAULT 0,
    check_size_fit_score INTEGER DEFAULT 0,
    experience_fit_score INTEGER DEFAULT 0,
    network_fit_score INTEGER DEFAULT 0,
    scoring_factors JSONB DEFAULT '{}',
    last_calculated TIMESTAMPTZ DEFAULT now(),
    calculation_version VARCHAR(10) DEFAULT '1.0',
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(investor_id, company_id)
);

CREATE TABLE IF NOT EXISTS public.investor_segments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    segment_name VARCHAR(100) NOT NULL,
    segment_description TEXT,
    segment_criteria JSONB NOT NULL,
    segment_color VARCHAR(7),
    is_active BOOLEAN DEFAULT true,
    created_by UUID REFERENCES public.users(id),
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.investor_segment_membership (
    investor_id UUID NOT NULL REFERENCES public.investors(id) ON DELETE CASCADE,
    segment_id UUID NOT NULL REFERENCES public.investor_segments(id) ON DELETE CASCADE,
    assigned_at TIMESTAMPTZ DEFAULT now(),
    assigned_by UUID REFERENCES public.users(id),
    is_auto_assigned BOOLEAN DEFAULT true,
    PRIMARY KEY (investor_id, segment_id)
);

CREATE TABLE IF NOT EXISTS public.investment_firm_metrics (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    firm_id UUID NOT NULL REFERENCES public.investment_firms(id) ON DELETE CASCADE,
    metric_date DATE NOT NULL,
    total_portfolio_companies INTEGER DEFAULT 0,
    active_investments INTEGER DEFAULT 0,
    new_investments_this_period INTEGER DEFAULT 0,
    avg_investment_size DECIMAL(15,2),
    total_aum DECIMAL(15,2),
    fund_vintage_year INTEGER,
    deployment_rate DECIMAL(5,2),
    portfolio_performance_score INTEGER,
    created_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(firm_id, metric_date)
);

-- =============================================
-- ENHANCED CAMPAIGN TRACKING
-- =============================================

CREATE TABLE IF NOT EXISTS public.campaign_ab_tests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    campaign_id UUID NOT NULL REFERENCES public.campaigns(id) ON DELETE CASCADE,
    test_name VARCHAR(255) NOT NULL,
    test_type VARCHAR(50) NOT NULL,
    variant_a_config JSONB NOT NULL,
    variant_b_config JSONB NOT NULL,
    traffic_split DECIMAL(3,2) DEFAULT 0.5,
    test_start TIMESTAMPTZ NOT NULL,
    test_end TIMESTAMPTZ,
    winner_variant VARCHAR(1),
    confidence_level DECIMAL(5,2),
    statistical_significance BOOLEAN DEFAULT false,
    results JSONB DEFAULT '{}',
    status VARCHAR(20) DEFAULT 'active',
    created_by UUID REFERENCES public.users(id),
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.campaign_sequence_steps (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    campaign_id UUID NOT NULL REFERENCES public.campaigns(id) ON DELETE CASCADE,
    step_number INTEGER NOT NULL,
    step_name VARCHAR(255) NOT NULL,
    step_type VARCHAR(50) NOT NULL,
    delay_days INTEGER DEFAULT 0,
    delay_hours INTEGER DEFAULT 0,
    content_template TEXT,
    subject_template TEXT,
    conditions JSONB DEFAULT '{}',
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(campaign_id, step_number)
);

CREATE TABLE IF NOT EXISTS public.communication_metrics (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    communication_id UUID NOT NULL REFERENCES public.communications(id) ON DELETE CASCADE,
    metric_type VARCHAR(50) NOT NULL,
    metric_value DECIMAL(10,4),
    metric_timestamp TIMESTAMPTZ NOT NULL,
    user_agent TEXT,
    ip_address INET,
    location VARCHAR(100),
    device_type VARCHAR(50),
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT now()
);

-- =============================================
-- DASHBOARDS AND REPORTS
-- =============================================

CREATE TABLE IF NOT EXISTS public.dashboard_widgets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    widget_type VARCHAR(50) NOT NULL,
    widget_name VARCHAR(255) NOT NULL,
    widget_config JSONB NOT NULL,
    position_x INTEGER NOT NULL DEFAULT 0,
    position_y INTEGER NOT NULL DEFAULT 0,
    width INTEGER NOT NULL DEFAULT 1,
    height INTEGER NOT NULL DEFAULT 1,
    is_visible BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.saved_reports (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    report_name VARCHAR(255) NOT NULL,
    report_type VARCHAR(50) NOT NULL,
    report_config JSONB NOT NULL,
    filters JSONB DEFAULT '{}',
    schedule_config JSONB,
    is_public BOOLEAN DEFAULT false,
    last_generated TIMESTAMPTZ,
    generation_count INTEGER DEFAULT 0,
    created_by UUID REFERENCES public.users(id),
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.report_generation_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    saved_report_id UUID REFERENCES public.saved_reports(id) ON DELETE CASCADE,
    generation_trigger VARCHAR(50) NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'pending',
    file_path VARCHAR(500),
    file_size BIGINT,
    generation_start TIMESTAMPTZ DEFAULT now(),
    generation_end TIMESTAMPTZ,
    error_message TEXT,
    generated_by UUID REFERENCES public.users(id),
    created_at TIMESTAMPTZ DEFAULT now()
);

-- =============================================
-- INDEXES
-- =============================================

CREATE INDEX IF NOT EXISTS idx_analytics_metrics_type_period ON public.analytics_metrics(metric_type, time_period, period_start);
CREATE INDEX IF NOT EXISTS idx_performance_benchmarks_metric ON public.performance_benchmarks(metric_type, benchmark_type);
CREATE INDEX IF NOT EXISTS idx_investor_engagement_investor ON public.investor_engagement_scores(investor_id);
CREATE INDEX IF NOT EXISTS idx_campaign_performance_campaign ON public.campaign_performance_metrics(campaign_id);
CREATE INDEX IF NOT EXISTS idx_roi_analysis_type_entity ON public.roi_analysis(analysis_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_cost_tracking_campaign ON public.cost_tracking(campaign_id);
CREATE INDEX IF NOT EXISTS idx_import_jobs_status ON public.import_jobs(status);
CREATE INDEX IF NOT EXISTS idx_investor_portfolio_fit_investor ON public.investor_portfolio_fit(investor_id);
CREATE INDEX IF NOT EXISTS idx_communication_metrics_comm ON public.communication_metrics(communication_id);

-- =============================================
-- FUNCTIONS
-- =============================================

CREATE OR REPLACE FUNCTION public.calculate_investor_engagement_score(investor_uuid UUID)
RETURNS INTEGER AS $$
DECLARE
    score INTEGER := 0;
    response_rate DECIMAL;
    avg_response_time DECIMAL;
    meeting_rate DECIMAL;
    interaction_count INTEGER;
BEGIN
    SELECT 
        COALESCE(AVG(CASE WHEN direction = 'inbound' THEN 1 ELSE 0 END) * 100, 0),
        COALESCE(AVG(EXTRACT(EPOCH FROM (occurred_at - LAG(occurred_at) OVER (ORDER BY occurred_at))) / 3600), 24),
        COUNT(*)
    INTO response_rate, avg_response_time, interaction_count
    FROM public.communications 
    WHERE investor_id = investor_uuid 
    AND occurred_at > now() - INTERVAL '6 months';
    
    -- Assuming a participants table might exist; if not, returns 0
    BEGIN
        SELECT COALESCE(AVG(CASE WHEN status = 'attended' THEN 1 ELSE 0 END) * 100, 0)
        INTO meeting_rate
        FROM public.meeting_participants mp
        WHERE mp.investor_id = investor_uuid;
    EXCEPTION WHEN OTHERS THEN
        meeting_rate := 0;
    END;
    
    score := LEAST(100, GREATEST(0, 
        (response_rate * 0.4) + 
        (CASE WHEN avg_response_time <= 2 THEN 30 WHEN avg_response_time <= 24 THEN 20 ELSE 10 END) +
        (meeting_rate * 0.3) +
        (LEAST(interaction_count, 20))
    ));
    
    RETURN score;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION public.update_campaign_performance_metrics(campaign_uuid UUID, metric_date_param DATE)
RETURNS VOID AS $$
BEGIN
    INSERT INTO public.campaign_performance_metrics (
        campaign_id, metric_date, emails_sent, emails_delivered, emails_opened, 
        emails_replied, meetings_scheduled, cost_incurred
    )
    SELECT 
        campaign_uuid,
        metric_date_param,
        COUNT(CASE WHEN cm.status IN ('sent', 'delivered', 'opened', 'replied') THEN 1 END),
        COUNT(CASE WHEN cm.status IN ('delivered', 'opened', 'replied') THEN 1 END),
        COUNT(CASE WHEN cm.status IN ('opened', 'replied') THEN 1 END),
        COUNT(CASE WHEN cm.status = 'replied' THEN 1 END),
        0, -- meetings_scheduled logic simplified
        COALESCE(SUM(ct.amount), 0)
    FROM public.campaign_recipients cr
    LEFT JOIN public.campaign_messages cm ON cr.id = cm.recipient_id
    LEFT JOIN public.cost_tracking ct ON ct.campaign_id = campaign_uuid AND ct.cost_date = metric_date_param
    WHERE cr.campaign_id = campaign_uuid
    ON CONFLICT (campaign_id, metric_date) 
    DO UPDATE SET
        emails_sent = EXCLUDED.emails_sent,
        emails_delivered = EXCLUDED.emails_delivered,
        emails_opened = EXCLUDED.emails_opened,
        emails_replied = EXCLUDED.emails_replied,
        cost_incurred = EXCLUDED.cost_incurred;
END;
$$ LANGUAGE plpgsql;

-- Trigger to update engagement scores
CREATE OR REPLACE FUNCTION public.trigger_update_engagement_score()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.investor_engagement_scores (investor_id, engagement_score)
    VALUES (NEW.investor_id, public.calculate_investor_engagement_score(NEW.investor_id))
    ON CONFLICT (investor_id) 
    DO UPDATE SET
        engagement_score = public.calculate_investor_engagement_score(NEW.investor_id),
        score_calculated_at = now(),
        updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply trigger
DROP TRIGGER IF EXISTS update_engagement_score_trigger ON public.communications;
CREATE TRIGGER update_engagement_score_trigger
    AFTER INSERT OR UPDATE ON public.communications
    FOR EACH ROW EXECUTE FUNCTION public.trigger_update_engagement_score();

-- =============================================
-- RLS POLICIES (Simplified for Standard PG)
-- =============================================

ALTER TABLE public.analytics_metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.import_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dashboard_widgets ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can read analytics" ON public.analytics_metrics;
CREATE POLICY "Users can read analytics" ON public.analytics_metrics
    FOR SELECT USING (EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid()));

DROP POLICY IF EXISTS "Users can manage import jobs" ON public.import_jobs;
CREATE POLICY "Users can manage import jobs" ON public.import_jobs
    FOR ALL USING (created_by = auth.uid());

DROP POLICY IF EXISTS "Users can manage widgets" ON public.dashboard_widgets;
CREATE POLICY "Users can manage widgets" ON public.dashboard_widgets
    FOR ALL USING (user_id = auth.uid());

-- =============================================
-- INITIAL DATA
-- =============================================

INSERT INTO public.investor_segments (segment_name, segment_description, segment_criteria, segment_color) VALUES
('Hot Prospects', 'High-engagement investors', '{"engagement_score": {"min": 80}}', '#EF4444'),
('Warm Leads', 'Moderately engaged', '{"engagement_score": {"min": 60}}', '#F59E0B'),
('Cold Contacts', 'Low engagement', '{"engagement_score": {"max": 59}}', '#3B82F6')
ON CONFLICT DO NOTHING;

INSERT INTO public.data_validation_rules (rule_name, field_name, validation_type, validation_config, error_message) VALUES
('Email Format', 'email', 'format', '{"pattern": "^[\\w\\.-]+@[\\w\\.-]+\\.[a-zA-Z]{2,}$"}', 'Invalid email format'),
('Required Name', 'firstName', 'required', '{}', 'First name is required')
ON CONFLICT DO NOTHING;

COMMIT;