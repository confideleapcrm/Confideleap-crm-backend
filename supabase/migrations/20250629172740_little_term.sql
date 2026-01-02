-- 20250629172740_little_term.sql
-- Sample Analytics Data for Testing
-- Converted for pgAdmin / Standard PostgreSQL compatibility

BEGIN;

-- =============================================
-- SAMPLE ANALYTICS METRICS
-- =============================================

-- Insert sample analytics metrics for the last 6 months
INSERT INTO public.analytics_metrics (metric_type, metric_name, metric_value, metric_unit, dimension_type, dimension_value, time_period, period_start, period_end) VALUES
-- Overall metrics
('engagement', 'total_investors', 2847, 'count', 'overall', 'all', 'monthly', '2024-01-01', '2024-01-31'),
('engagement', 'total_investors', 2934, 'count', 'overall', 'all', 'monthly', '2024-02-01', '2024-02-29'),
('engagement', 'total_investors', 3021, 'count', 'overall', 'all', 'monthly', '2024-03-01', '2024-03-31'),
('engagement', 'total_investors', 3156, 'count', 'overall', 'all', 'monthly', '2024-04-01', '2024-04-30'),
('engagement', 'total_investors', 3289, 'count', 'overall', 'all', 'monthly', '2024-05-01', '2024-05-31'),
('engagement', 'total_investors', 3412, 'count', 'overall', 'all', 'monthly', '2024-06-01', '2024-06-30'),

-- Response rates by month
('response_rate', 'avg_response_rate', 22.1, 'percentage', 'overall', 'all', 'monthly', '2024-01-01', '2024-01-31'),
('response_rate', 'avg_response_rate', 24.3, 'percentage', 'overall', 'all', 'monthly', '2024-02-01', '2024-02-29'),
('response_rate', 'avg_response_rate', 26.8, 'percentage', 'overall', 'all', 'monthly', '2024-03-01', '2024-03-31'),
('response_rate', 'avg_response_rate', 25.4, 'percentage', 'overall', 'all', 'monthly', '2024-04-01', '2024-04-30'),
('response_rate', 'avg_response_rate', 28.6, 'percentage', 'overall', 'all', 'monthly', '2024-05-01', '2024-05-31'),
('response_rate', 'avg_response_rate', 29.2, 'percentage', 'overall', 'all', 'monthly', '2024-06-01', '2024-06-30'),

-- Open rates by channel
('open_rate', 'email_open_rate', 64.2, 'percentage', 'channel', 'email', 'monthly', '2024-06-01', '2024-06-30'),
('open_rate', 'linkedin_open_rate', 72.1, 'percentage', 'channel', 'linkedin', 'monthly', '2024-06-01', '2024-06-30'),

-- Meeting conversion rates
('meeting_rate', 'meeting_conversion', 8.3, 'percentage', 'overall', 'all', 'monthly', '2024-01-01', '2024-01-31'),
('meeting_rate', 'meeting_conversion', 8.7, 'percentage', 'overall', 'all', 'monthly', '2024-02-01', '2024-02-29'),
('meeting_rate', 'meeting_conversion', 9.1, 'percentage', 'overall', 'all', 'monthly', '2024-03-01', '2024-03-31'),
('meeting_rate', 'meeting_conversion', 8.9, 'percentage', 'overall', 'all', 'monthly', '2024-04-01', '2024-04-30'),
('meeting_rate', 'meeting_conversion', 9.5, 'percentage', 'overall', 'all', 'monthly', '2024-05-01', '2024-05-31'),
('meeting_rate', 'meeting_conversion', 8.7, 'percentage', 'overall', 'all', 'monthly', '2024-06-01', '2024-06-30');

-- =============================================
-- SAMPLE INVESTOR ENGAGEMENT SCORES
-- =============================================

-- Calculate and insert engagement scores for existing investors
INSERT INTO public.investor_engagement_scores (investor_id, engagement_score, response_rate, avg_response_time_hours, meeting_acceptance_rate, total_interactions)
SELECT 
    i.id,
    CASE 
        WHEN i.status = 'hot' THEN 85 + (RANDOM() * 15)::INTEGER
        WHEN i.status = 'warm' THEN 65 + (RANDOM() * 20)::INTEGER
        WHEN i.status = 'contacted' THEN 45 + (RANDOM() * 25)::INTEGER
        ELSE 20 + (RANDOM() * 30)::INTEGER
    END,
    CASE 
        WHEN i.status = 'hot' THEN 75 + (RANDOM() * 25)
        WHEN i.status = 'warm' THEN 50 + (RANDOM() * 30)
        WHEN i.status = 'contacted' THEN 25 + (RANDOM() * 35)
        ELSE 10 + (RANDOM() * 25)
    END,
    2 + (RANDOM() * 48), -- 2-50 hours response time
    CASE 
        WHEN i.status = 'hot' THEN 80 + (RANDOM() * 20)
        WHEN i.status = 'warm' THEN 60 + (RANDOM() * 25)
        WHEN i.status = 'contacted' THEN 40 + (RANDOM() * 30)
        ELSE 20 + (RANDOM() * 30)
    END,
    (5 + (RANDOM() * 25))::INTEGER -- 5-30 interactions
FROM public.investors i;

-- =============================================
-- SAMPLE CAMPAIGN PERFORMANCE METRICS
-- =============================================

-- Insert performance metrics for existing campaigns
INSERT INTO public.campaign_performance_metrics (campaign_id, metric_date, emails_sent, emails_delivered, emails_opened, emails_clicked, emails_replied, meetings_scheduled, cost_incurred)
SELECT 
    c.id,
    CURRENT_DATE - (RANDOM() * 30)::INTEGER, -- Random date in last 30 days
    c.total_recipients,
    GREATEST(0, c.total_recipients - (RANDOM() * 10)::INTEGER), -- Delivered (slight bounce rate)
    c.opened_count,
    GREATEST(0, (c.opened_count * (0.3 + RANDOM() * 0.4))::INTEGER), -- Click rate 30-70% of opens
    c.replied_count,
    c.meeting_count,
    (c.budget * (0.1 + RANDOM() * 0.3))::DECIMAL -- 10-40% of budget spent per day
FROM public.campaigns c
WHERE c.status IN ('active', 'completed');

-- =============================================
-- SAMPLE ROI ANALYSIS DATA
-- =============================================

-- Insert ROI analysis for campaigns
INSERT INTO public.roi_analysis (analysis_type, entity_id, entity_type, time_period, period_start, period_end, total_investment, total_return, roi_percentage, cost_per_lead, cost_per_meeting)
SELECT 
    'campaign',
    c.id,
    'campaign',
    'monthly',
    date_trunc('month', c.created_at),
    date_trunc('month', c.created_at) + INTERVAL '1 month' - INTERVAL '1 day',
    c.spent,
    c.spent * (3 + RANDOM() * 47), -- 3x to 50x return
    ((c.spent * (3 + RANDOM() * 47) - c.spent) / NULLIF(c.spent, 0) * 100)::DECIMAL,
    CASE WHEN c.total_recipients > 0 THEN (c.spent / c.total_recipients)::DECIMAL ELSE 0 END,
    CASE WHEN c.meeting_count > 0 THEN (c.spent / c.meeting_count)::DECIMAL ELSE 0 END
FROM public.campaigns c
WHERE c.spent > 0;

-- Insert overall ROI analysis
INSERT INTO public.roi_analysis (analysis_type, entity_type, time_period, period_start, period_end, total_investment, total_return, roi_percentage)
VALUES 
('overall', 'overall', 'quarterly', '2024-01-01', '2024-03-31', 75000, 2800000, 3633.33),
('overall', 'overall', 'quarterly', '2024-04-01', '2024-06-30', 89000, 3200000, 3494.38);

-- =============================================
-- SAMPLE COST TRACKING DATA
-- =============================================

-- Insert sample cost tracking data
INSERT INTO public.cost_tracking (cost_category, cost_subcategory, cost_description, amount, cost_date, campaign_id, created_by) 
SELECT 
    'campaign_costs',
    'email_tools',
    'Monthly email platform subscription',
    299.00,
    CURRENT_DATE - (RANDOM() * 90)::INTEGER,
    c.id,
    c.created_by
FROM public.campaigns c
WHERE c.status IN ('active', 'completed')
LIMIT 10;

INSERT INTO public.cost_tracking (cost_category, cost_subcategory, cost_description, amount, cost_date, created_by)
SELECT 
    'personnel_costs',
    'ir_team_salaries',
    'Monthly IR team allocation',
    15000.00 + (RANDOM() * 5000),
    generate_series(
        CURRENT_DATE - INTERVAL '6 months',
        CURRENT_DATE,
        INTERVAL '1 month'
    )::DATE,
    u.id
FROM public.users u
LIMIT 6;

INSERT INTO public.cost_tracking (cost_category, cost_subcategory, cost_description, amount, cost_date, created_by)
VALUES 
('technology_tools', 'crm_software', 'CRM platform monthly subscription', 199.00, CURRENT_DATE - 30, (SELECT id FROM public.users LIMIT 1)),
('technology_tools', 'analytics_tools', 'Analytics platform subscription', 149.00, CURRENT_DATE - 25, (SELECT id FROM public.users LIMIT 1)),
('events_travel', 'conference_attendance', 'VC conference registration', 2500.00, CURRENT_DATE - 45, (SELECT id FROM public.users LIMIT 1)),
('events_travel', 'investor_meetings', 'Travel for investor meetings', 1200.00, CURRENT_DATE - 20, (SELECT id FROM public.users LIMIT 1));

-- =============================================
-- SAMPLE PORTFOLIO FIT SCORES
-- =============================================

-- Calculate portfolio fit scores for existing investors
INSERT INTO public.investor_portfolio_fit (investor_id, company_id, overall_fit_score, sector_fit_score, stage_fit_score, geographic_fit_score, check_size_fit_score)
SELECT 
    i.id,
    c.id,
    i.portfolio_fit_score,
    CASE 
        WHEN 'FinTech' = ANY(i.sector_preferences) THEN 90 + (RANDOM() * 10)::INTEGER
        WHEN 'SaaS' = ANY(i.sector_preferences) THEN 80 + (RANDOM() * 15)::INTEGER
        ELSE 50 + (RANDOM() * 30)::INTEGER
    END,
    CASE 
        WHEN 'Series A' = ANY(i.investment_stages) OR 'Series B' = ANY(i.investment_stages) THEN 85 + (RANDOM() * 15)::INTEGER
        ELSE 60 + (RANDOM() * 25)::INTEGER
    END,
    CASE 
        WHEN i.location LIKE '%San Francisco%' OR i.location LIKE '%CA%' THEN 95 + (RANDOM() * 5)::INTEGER
        WHEN i.location LIKE '%US%' OR i.location LIKE '%United States%' THEN 80 + (RANDOM() * 15)::INTEGER
        ELSE 60 + (RANDOM() * 20)::INTEGER
    END,
    CASE 
        WHEN i.min_check_size <= 5000000 AND i.max_check_size >= 15000000 THEN 90 + (RANDOM() * 10)::INTEGER
        WHEN i.min_check_size <= 10000000 AND i.max_check_size >= 10000000 THEN 75 + (RANDOM() * 20)::INTEGER
        ELSE 50 + (RANDOM() * 30)::INTEGER
    END
FROM public.investors i
CROSS JOIN public.companies c
LIMIT 100;

-- =============================================
-- SAMPLE IMPORT JOB DATA
-- =============================================

-- Insert sample import job history
INSERT INTO public.import_jobs (job_name, import_type, import_method, status, file_name, total_records, processed_records, successful_records, failed_records, processing_start, processing_end, created_by)
VALUES 
('Q1 2024 Investor Import', 'file_upload', 'csv', 'completed', 'investors_q1_2024.csv', 150, 150, 147, 3, '2024-01-15 10:00:00', '2024-01-15 10:05:23', (SELECT id FROM public.users LIMIT 1)),
('LinkedIn Sync - Tech Investors', 'api_sync', 'linkedin', 'completed', NULL, 89, 89, 85, 4, '2024-02-20 14:30:00', '2024-02-20 14:45:12', (SELECT id FROM public.users LIMIT 1)),
('FinTech Investor Database', 'file_upload', 'excel', 'completed', 'fintech_investors.xlsx', 234, 234, 230, 4, '2024-03-10 09:15:00', '2024-03-10 09:22:45', (SELECT id FROM public.users LIMIT 1)),
('Manual Entry - Series B Investors', 'manual_entry', 'manual', 'completed', NULL, 12, 12, 12, 0, '2024-04-05 16:00:00', '2024-04-05 16:30:00', (SELECT id FROM public.users LIMIT 1)),
('CRM Sync - Salesforce', 'api_sync', 'crm', 'failed', NULL, 0, 0, 0, 0, '2024-05-15 11:00:00', '2024-05-15 11:02:30', (SELECT id FROM public.users LIMIT 1));

-- Insert sample import job logs
INSERT INTO public.import_job_logs (import_job_id, log_level, log_message, record_number, field_name, error_code)
SELECT 
    ij.id,
    'error',
    'Invalid email format',
    (RANDOM() * ij.total_records)::INTEGER + 1,
    'email',
    'INVALID_EMAIL'
FROM public.import_jobs ij
WHERE ij.failed_records > 0
LIMIT 5;

INSERT INTO public.import_job_logs (import_job_id, log_level, log_message, record_number, field_name)
SELECT 
    ij.id,
    'warning',
    'Phone number format could be improved',
    (RANDOM() * ij.total_records)::INTEGER + 1,
    'phone'
FROM public.import_jobs ij
WHERE ij.status = 'completed'
LIMIT 8;

-- =============================================
-- SAMPLE DASHBOARD WIDGETS
-- =============================================

-- Insert sample dashboard widgets for users
INSERT INTO public.dashboard_widgets (user_id, widget_type, widget_name, widget_config, position_x, position_y, width, height)
SELECT 
    u.id,
    'metric_card',
    'Total Investors',
    '{"metric": "total_investors", "color": "blue", "icon": "users"}',
    0, 0, 1, 1
FROM public.users u;

INSERT INTO public.dashboard_widgets (user_id, widget_type, widget_name, widget_config, position_x, position_y, width, height)
SELECT 
    u.id,
    'chart',
    'Response Rate Trend',
    '{"chart_type": "line", "metric": "response_rate", "time_period": "monthly"}',
    1, 0, 2, 1
FROM public.users u;

INSERT INTO public.dashboard_widgets (user_id, widget_type, widget_name, widget_config, position_x, position_y, width, height)
SELECT 
    u.id,
    'metric_card',
    'Pipeline Value',
    '{"metric": "pipeline_value", "color": "green", "icon": "dollar-sign", "format": "currency"}',
    0, 1, 1, 1
FROM public.users u;

COMMIT;