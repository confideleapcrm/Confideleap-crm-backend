

-- 20250628050800_icy_smoke.sql
-- Sample Data for Investor Relations CRM
-- Converted for pgAdmin / Standard PostgreSQL compatibility

BEGIN;

-- =============================================
-- SAMPLE COMPANIES
-- =============================================

INSERT INTO public.companies (id, name, domain, industry, size, description, website, headquarters, founded_year, funding_stage, total_funding, employee_count) VALUES
('550e8400-e29b-41d4-a716-446655440001', 'TechFlow Solutions', 'techflow.com', 'FinTech', '51-200', 'AI-powered financial analytics platform for institutional investors', 'https://techflow.com', 'San Francisco, CA', 2019, 'Series B', 25000000.00, 85),
('550e8400-e29b-41d4-a716-446655440002', 'HealthTech Innovations', 'healthtech.io', 'HealthTech', '11-50', 'Digital health platform connecting patients with specialists', 'https://healthtech.io', 'Boston, MA', 2020, 'Series A', 8000000.00, 32)
ON CONFLICT (id) DO NOTHING;

-- =============================================
-- SAMPLE USERS
-- =============================================

INSERT INTO public.users (id, email, password_hash, first_name, last_name, avatar_url, phone, job_title, department, bio, timezone, theme) VALUES
('550e8400-e29b-41d4-a716-446655440010', 'sarah.chen@techflow.com', '$2b$10$example_hash_1', 'Sarah', 'Chen', 'https://images.pexels.com/photos/2381069/pexels-photo-2381069.jpeg?auto=compress&cs=tinysrgb&w=150&h=150&fit=crop', '+1 (555) 123-4567', 'VP of Investor Relations', 'Finance', 'Experienced IR professional with 8+ years in FinTech fundraising', 'America/Los_Angeles', 'light'),
('550e8400-e29b-41d4-a716-446655440011', 'michael.torres@techflow.com', '$2b$10$example_hash_2', 'Michael', 'Torres', 'https://images.pexels.com/photos/2182970/pexels-photo-2182970.jpeg?auto=compress&cs=tinysrgb&w=150&h=150&fit=crop', '+1 (555) 234-5678', 'IR Manager', 'Finance', 'Focused on growth-stage investor relationships and campaign management', 'America/Los_Angeles', 'light'),
('550e8400-e29b-41d4-a716-446655440012', 'lisa.park@healthtech.io', '$2b$10$example_hash_3', 'Lisa', 'Park', 'https://images.pexels.com/photos/2709388/pexels-photo-2709388.jpeg?auto=compress&cs=tinysrgb&w=150&h=150&fit=crop', '+1 (555) 345-6789', 'Head of Business Development', 'Strategy', 'Leading fundraising efforts for Series A expansion', 'America/New_York', 'light')
ON CONFLICT (id) DO NOTHING;

-- Link users to companies
INSERT INTO public.company_users (company_id, user_id, role) VALUES
('550e8400-e29b-41d4-a716-446655440001', '550e8400-e29b-41d4-a716-446655440010', 'admin'),
('550e8400-e29b-41d4-a716-446655440001', '550e8400-e29b-41d4-a716-446655440011', 'manager'),
('550e8400-e29b-41d4-a716-446655440002', '550e8400-e29b-41d4-a716-446655440012', 'admin')
ON CONFLICT (company_id, user_id) DO NOTHING;

-- =============================================
-- SAMPLE INVESTMENT FIRMS
-- =============================================

INSERT INTO public.investment_firms (id, name, type, website, description, headquarters, founded_year, aum, portfolio_size, investment_stages, sector_focus, geographic_focus, min_investment, max_investment, typical_investment, linkedin_url) VALUES
('550e8400-e29b-41d4-a716-446655440020', 'Andreessen Horowitz', 'VC', 'https://a16z.com', 'Leading venture capital firm investing in technology companies', 'Menlo Park, CA', 2009, 35000000000.00, 400, ARRAY['Seed', 'Series A', 'Series B', 'Series C', 'Growth'], ARRAY['FinTech', 'SaaS', 'AI/ML', 'Crypto', 'Enterprise'], ARRAY['North America'], 1000000.00, 100000000.00, 15000000.00, 'https://linkedin.com/company/andreessen-horowitz'),
('550e8400-e29b-41d4-a716-446655440021', 'Sequoia Capital', 'VC', 'https://sequoiacap.com', 'Global venture capital firm partnering with bold founders', 'Menlo Park, CA', 1972, 85000000000.00, 1000, ARRAY['Seed', 'Series A', 'Series B', 'Series C', 'Growth'], ARRAY['HealthTech', 'Biotech', 'AI/ML', 'Enterprise', 'Consumer'], ARRAY['North America', 'Europe', 'Asia Pacific'], 500000.00, 200000000.00, 25000000.00, 'https://linkedin.com/company/sequoia-capital'),
('550e8400-e29b-41d4-a716-446655440022', 'GV (Google Ventures)', 'Corporate VC', 'https://gv.com', 'Venture capital arm of Alphabet Inc.', 'Mountain View, CA', 2009, 7000000000.00, 300, ARRAY['Seed', 'Series A', 'Series B'], ARRAY['AI/ML', 'Enterprise', 'Consumer', 'HealthTech'], ARRAY['North America', 'Europe'], 100000.00, 50000000.00, 8000000.00, 'https://linkedin.com/company/google-ventures'),
('550e8400-e29b-41d4-a716-446655440023', 'Index Ventures', 'VC', 'https://indexventures.com', 'European and US venture capital firm', 'London, UK', 1996, 8000000000.00, 200, ARRAY['Series A', 'Series B', 'Series C'], ARRAY['SaaS', 'Developer Tools', 'Infrastructure', 'FinTech'], ARRAY['Europe', 'North America'], 2000000.00, 75000000.00, 20000000.00, 'https://linkedin.com/company/index-ventures'),
('550e8400-e29b-41d4-a716-446655440024', 'Kleiner Perkins', 'VC', 'https://kleinerperkins.com', 'Venture capital firm investing in incubation, early and growth-stage companies', 'Palo Alto, CA', 1972, 9000000000.00, 900, ARRAY['Seed', 'Series A', 'Series B'], ARRAY['EdTech', 'Consumer', 'Enterprise', 'HealthTech'], ARRAY['North America'], 500000.00, 30000000.00, 10000000.00, 'https://linkedin.com/company/kleiner-perkins')
ON CONFLICT (id) DO NOTHING;

-- =============================================
-- SAMPLE INVESTORS
-- =============================================

INSERT INTO public.investors (id, firm_id, first_name, last_name, email, phone, job_title, seniority_level, bio, avatar_url, linkedin_url, location, investment_stages, sector_preferences, min_check_size, max_check_size, portfolio_fit_score, engagement_score, response_rate, status, tags, created_by) VALUES
('550e8400-e29b-41d4-a716-446655440030', '550e8400-e29b-41d4-a716-446655440020', 'Michael', 'Chen', 'mchen@a16z.com', '+1 (555) 123-4567', 'Partner', 'Partner', 'Partner at Andreessen Horowitz focusing on FinTech and enterprise software investments.', 'https://images.pexels.com/photos/2182970/pexels-photo-2182970.jpeg?auto=compress&cs=tinysrgb&w=150&h=150&fit=crop', 'https://linkedin.com/in/michaelchen', 'San Francisco, CA', ARRAY['Series A', 'Series B'], ARRAY['FinTech', 'SaaS', 'AI/ML'], 5000000.00, 25000000.00, 92, 85, 34.5, 'hot', ARRAY['FinTech', 'Enterprise', 'AI'], '550e8400-e29b-41d4-a716-446655440010'),
('550e8400-e29b-41d4-a716-446655440031', '550e8400-e29b-41d4-a716-446655440021', 'Sarah', 'Williams', 'swilliams@sequoiacap.com', '+1 (555) 234-5678', 'Principal', 'Principal', 'Principal at Sequoia Capital with expertise in healthcare technology.', 'https://images.pexels.com/photos/2381069/pexels-photo-2381069.jpeg?auto=compress&cs=tinysrgb&w=150&h=150&fit=crop', 'https://linkedin.com/in/sarahwilliams', 'Menlo Park, CA', ARRAY['Series B', 'Series C'], ARRAY['HealthTech', 'Biotech', 'AI/ML'], 10000000.00, 50000000.00, 88, 78, 28.3, 'warm', ARRAY['HealthTech', 'Biotech'], '550e8400-e29b-41d4-a716-446655440010'),
('550e8400-e29b-41d4-a716-446655440032', '550e8400-e29b-41d4-a716-446655440022', 'Emily', 'Park', 'epark@gv.com', '+1 (555) 456-7890', 'Investment Partner', 'Partner', 'Investment Partner at GV focusing on AI/ML.', 'https://images.pexels.com/photos/2709388/pexels-photo-2709388.jpeg?auto=compress&cs=tinysrgb&w=150&h=150&fit=crop', 'https://linkedin.com/in/emilypark', 'Mountain View, CA', ARRAY['Seed', 'Series A', 'Series B'], ARRAY['AI/ML', 'Enterprise', 'Consumer'], 1000000.00, 10000000.00, 94, 92, 42.1, 'hot', ARRAY['AI/ML', 'Google', 'Enterprise'], '550e8400-e29b-41d4-a716-446655440010'),
('550e8400-e29b-41d4-a716-446655440033', '550e8400-e29b-41d4-a716-446655440023', 'Lisa', 'Zhang', 'lzhang@indexventures.com', '+1 (555) 567-8901', 'General Partner', 'Partner', 'General Partner at Index Ventures specializing in SaaS.', 'https://images.pexels.com/photos/2381069/pexels-photo-2381069.jpeg?auto=compress&cs=tinysrgb&w=150&h=150&fit=crop', 'https://linkedin.com/in/lisazhang', 'San Francisco, CA', ARRAY['Series A', 'Series B'], ARRAY['SaaS', 'Developer Tools', 'Infrastructure'], 3000000.00, 20000000.00, 90, 82, 31.7, 'contacted', ARRAY['SaaS', 'DevTools'], '550e8400-e29b-41d4-a716-446655440010'),
('550e8400-e29b-41d4-a716-446655440034', '550e8400-e29b-41d4-a716-446655440024', 'David', 'Rodriguez', 'drodriguez@kpcb.com', '+1 (555) 345-6789', 'General Partner', 'Partner', 'General Partner at Kleiner Perkins with focus on EdTech.', 'https://images.pexels.com/photos/2379004/pexels-photo-2379004.jpeg?auto=compress&cs=tinysrgb&w=150&h=150&fit=crop', 'https://linkedin.com/in/davidrodriguez', 'Palo Alto, CA', ARRAY['Seed', 'Series A'], ARRAY['EdTech', 'Consumer', 'Enterprise'], 2000000.00, 15000000.00, 76, 65, 22.8, 'cold', ARRAY['EdTech', 'Consumer'], '550e8400-e29b-41d4-a716-446655440010'),
('550e8400-e29b-41d4-a716-446655440035', '550e8400-e29b-41d4-a716-446655440020', 'James', 'Thompson', 'jthompson@a16z.com', '+1 (555) 678-9012', 'Principal', 'Principal', 'Principal at Andreessen Horowitz focusing on crypto.', 'https://images.pexels.com/photos/2182975/pexels-photo-2182975.jpeg?auto=compress&cs=tinysrgb&w=150&h=150&fit=crop', 'https://linkedin.com/in/jamesthompson', 'San Francisco, CA', ARRAY['Series A', 'Series B', 'Series C'], ARRAY['FinTech', 'Crypto', 'Enterprise'], 3000000.00, 30000000.00, 82, 74, 26.4, 'warm', ARRAY['Crypto', 'FinTech'], '550e8400-e29b-41d4-a716-446655440010')
ON CONFLICT (id) DO NOTHING;

-- =============================================
-- SAMPLE CAMPAIGNS
-- =============================================

INSERT INTO public.campaigns (id, name, description, type, status, channels, subject_line, message_content, total_recipients, sent_count, opened_count, replied_count, meeting_count, open_rate, response_rate, meeting_rate, priority, tags, created_by) VALUES
('550e8400-e29b-41d4-a716-446655440040', 'Series B Outreach Q1 2024', 'Targeting growth-stage investors', 'email', 'active', ARRAY['email', 'linkedin'], 'TechFlow Series B', 'Hi {{first_name}}, I am reaching out...', 145, 145, 89, 34, 12, 61.4, 23.4, 8.3, 'high', ARRAY['Series B', 'Growth', 'FinTech'], '550e8400-e29b-41d4-a716-446655440010'),
('550e8400-e29b-41d4-a716-446655440041', 'FinTech Investor Focus', 'Specialized outreach to FinTech VCs', 'multi-channel', 'active', ARRAY['email', 'linkedin', 'phone'], 'Revolutionizing Financial Analytics', 'Dear {{first_name}}, share exciting opportunity...', 98, 98, 67, 28, 8, 68.4, 28.6, 8.2, 'high', ARRAY['FinTech', 'Specialized'], '550e8400-e29b-41d4-a716-446655440011'),
('550e8400-e29b-41d4-a716-446655440042', 'AI/ML Investor Network', 'Reaching out to AI focused investors', 'linkedin', 'paused', ARRAY['linkedin', 'twitter'], 'AI Innovation', 'Hi {{first_name}}, noticed your investment...', 76, 76, 52, 19, 6, 68.4, 25.0, 7.9, 'medium', ARRAY['AI/ML', 'Tech'], '550e8400-e29b-41d4-a716-446655440012'),
('550e8400-e29b-41d4-a716-446655440043', 'Growth Stage Expansion', 'Large-scale outreach', 'email', 'completed', ARRAY['email', 'phone', 'events'], 'TechFlow - Scaling AI', 'Hello {{first_name}}, reached an inflection point...', 234, 234, 156, 67, 23, 66.7, 28.6, 9.8, 'low', ARRAY['Growth', 'Late Stage'], '550e8400-e29b-41d4-a716-446655440010')
ON CONFLICT (id) DO NOTHING;

-- =============================================
-- SAMPLE CAMPAIGN RECIPIENTS
-- =============================================

INSERT INTO public.campaign_recipients (id, campaign_id, investor_id, status, sent_at, opened_at, replied_at, open_count, click_count) VALUES
('550e8400-e29b-41d4-a716-446655440050', '550e8400-e29b-41d4-a716-446655440040', '550e8400-e29b-41d4-a716-446655440030', 'replied', '2024-01-15 09:00:00+00', '2024-01-15 10:30:00+00', '2024-01-15 14:20:00+00', 3, 2),
('550e8400-e29b-41d4-a716-446655440051', '550e8400-e29b-41d4-a716-446655440040', '550e8400-e29b-41d4-a716-446655440032', 'opened', '2024-01-15 09:05:00+00', '2024-01-15 11:15:00+00', NULL, 2, 1),
('550e8400-e29b-41d4-a716-446655440052', '550e8400-e29b-41d4-a716-446655440041', '550e8400-e29b-41d4-a716-446655440031', 'replied', '2024-01-20 10:00:00+00', '2024-01-20 11:45:00+00', '2024-01-20 16:30:00+00', 2, 3),
('550e8400-e29b-41d4-a716-446655440053', '550e8400-e29b-41d4-a716-446655440041', '550e8400-e29b-41d4-a716-446655440033', 'opened', '2024-01-20 10:02:00+00', '2024-01-20 13:20:00+00', NULL, 1, 0)
ON CONFLICT (id) DO NOTHING;

-- =============================================
-- SAMPLE COMMUNICATIONS
-- =============================================

INSERT INTO public.communications (id, investor_id, campaign_id, user_id, type, direction, subject, content, status, occurred_at) VALUES
('550e8400-e29b-41d4-a716-446655440060', '550e8400-e29b-41d4-a716-446655440030', '550e8400-e29b-41d4-a716-446655440040', '550e8400-e29b-41d4-a716-446655440010', 'email', 'outbound', 'TechFlow Series B', 'Hi Michael, reaching out...', 'replied', '2024-01-15 09:00:00+00'),
('550e8400-e29b-41d4-a716-446655440061', '550e8400-e29b-41d4-a716-446655440030', NULL, '550e8400-e29b-41d4-a716-446655440010', 'email', 'inbound', 'Re: TechFlow Series B', 'Hi Sarah, looks interesting...', 'read', '2024-01-15 14:20:00+00'),
('550e8400-e29b-41d4-a716-446655440062', '550e8400-e29b-41d4-a716-446655440032', '550e8400-e29b-41d4-a716-446655440040', '550e8400-e29b-41d4-a716-446655440010', 'email', 'outbound', 'TechFlow Series B', 'Hi Emily, share exciting opportunity...', 'read', '2024-01-15 09:05:00+00'),
('550e8400-e29b-41d4-a716-446655440063', '550e8400-e29b-41d4-a716-446655440031', NULL, '550e8400-e29b-41d4-a716-446655440010', 'meeting', 'outbound', 'Introduction Call', 'Discuss Series B opportunity', 'completed', '2024-01-22 15:00:00+00')
ON CONFLICT (id) DO NOTHING;

-- =============================================
-- SAMPLE MEETINGS
-- =============================================

INSERT INTO public.meetings (id, title, description, type, status, duration_minutes, scheduled_start, scheduled_end, actual_start, actual_end, outcome, notes, created_by) VALUES
('550e8400-e29b-41d4-a716-446655440070', 'TechFlow - A16Z Initial Call', 'Introduction call with Michael Chen', 'initial_call', 'completed', 60, '2024-01-22 15:00:00+00', '2024-01-22 16:00:00+00', '2024-01-22 15:02:00+00', '2024-01-22 16:05:00+00', 'positive', 'Great conversation.', '550e8400-e29b-41d4-a716-446655440010'),
('550e8400-e29b-41d4-a716-446655440071', 'TechFlow - Sequoia Deep Dive', 'Technical deep dive', 'pitch', 'scheduled', 90, '2024-02-05 14:00:00+00', '2024-02-05 15:30:00+00', NULL, NULL, NULL, NULL, '550e8400-e29b-41d4-a716-446655440010'),
('550e8400-e29b-41d4-a716-446655440072', 'TechFlow - GV Product Demo', 'Product demonstration', 'demo', 'scheduled', 45, '2024-02-08 10:00:00+00', '2024-02-08 10:45:00+00', NULL, NULL, NULL, NULL, '550e8400-e29b-41d4-a716-446655440010')
ON CONFLICT (id) DO NOTHING;

-- =============================================
-- SAMPLE PIPELINE OPPORTUNITIES
-- =============================================

INSERT INTO public.pipeline_opportunities (id, name, description, stage_id, investor_id, amount, probability, expected_close_date, status, source, created_by) VALUES
('550e8400-e29b-41d4-a716-446655440080', 'A16Z Series B Investment', 'Series B opportunity', (SELECT id FROM public.pipeline_stages WHERE name = 'Due Diligence' LIMIT 1), '550e8400-e29b-41d4-a716-446655440030', 15000000.00, 75.0, '2024-03-15', 'open', 'campaign', '550e8400-e29b-41d4-a716-446655440010'),
('550e8400-e29b-41d4-a716-446655440081', 'Sequoia Capital Partnership', 'Strategic partnership', (SELECT id FROM public.pipeline_stages WHERE name = 'Qualified Interest' LIMIT 1), '550e8400-e29b-41d4-a716-446655440031', 20000000.00, 60.0, '2024-04-01', 'open', 'referral', '550e8400-e29b-41d4-a716-446655440010'),
('550e8400-e29b-41d4-a716-446655440082', 'GV Strategic Investment', 'Strategic investment', (SELECT id FROM public.pipeline_stages WHERE name = 'Initial Contact' LIMIT 1), '550e8400-e29b-41d4-a716-446655440032', 8000000.00, 45.0, '2024-05-01', 'open', 'campaign', '550e8400-e29b-41d4-a716-446655440010')
ON CONFLICT (id) DO NOTHING;

-- =============================================
-- SAMPLE DOCUMENTS
-- =============================================

INSERT INTO public.documents (id, name, description, file_path, file_size, mime_type, category, version, tags, uploaded_by) VALUES
('550e8400-e29b-41d4-a716-446655440090', 'TechFlow Pitch Deck Q1 2024', 'Series B pitch deck', '/documents/deck.pdf', 5242880, 'application/pdf', 'pitch_deck', '2.1', ARRAY['pitch', 'series-b'], '550e8400-e29b-41d4-a716-446655440010'),
('550e8400-e29b-41d4-a716-446655440091', 'Financial Model 2024-2027', 'Projections', '/documents/model.xlsx', 1048576, 'application/vnd.ms-excel', 'financial_model', '1.3', ARRAY['financials'], '550e8400-e29b-41d4-a716-446655440010'),
('550e8400-e29b-41d4-a716-446655440092', 'Product Demo Video', 'Showcase features', '/documents/demo.mp4', 52428800, 'video/mp4', 'demo', '1.0', ARRAY['demo'], '550e8400-e29b-41d4-a716-446655440011')
ON CONFLICT (id) DO NOTHING;

-- =============================================
-- SAMPLE DOCUMENT SHARES
-- =============================================

INSERT INTO public.document_shares (id, document_id, investor_id, shared_by, access_level, download_count, last_accessed_at, shared_at) VALUES
('550e8400-e29b-41d4-a716-446655440100', '550e8400-e29b-41d4-a716-446655440090', '550e8400-e29b-41d4-a716-446655440030', '550e8400-e29b-41d4-a716-446655440010', 'download', 3, '2024-01-23 10:30:00+00', '2024-01-22 16:00:00+00'),
('550e8400-e29b-41d4-a716-446655440101', '550e8400-e29b-41d4-a716-446655440091', '550e8400-e29b-41d4-a716-446655440030', '550e8400-e29b-41d4-a716-446655440010', 'view', 1, '2024-01-24 14:15:00+00', '2024-01-23 09:00:00+00'),
('550e8400-e29b-41d4-a716-446655440102', '550e8400-e29b-41d4-a716-446655440090', '550e8400-e29b-41d4-a716-446655440032', '550e8400-e29b-41d4-a716-446655440010', 'download', 1, '2024-01-25 11:20:00+00', '2024-01-25 09:30:00+00')
ON CONFLICT (id) DO NOTHING;

-- =============================================
-- SAMPLE NOTIFICATIONS
-- =============================================

INSERT INTO public.notifications (id, user_id, type, title, message, data, channels, priority, status, scheduled_at) VALUES
('550e8400-e29b-41d4-a716-446655440110', '550e8400-e29b-41d4-a716-446655440010', 'campaign_reply', 'New Reply from Michael Chen', 'Michael Chen from a16z replied', '{"investor_id": "550e8400-e29b-41d4-a716-446655440030"}', ARRAY['email', 'push'], 'high', 'read', '2024-01-15 14:20:00+00'),
('550e8400-e29b-41d4-a716-446655440111', '550e8400-e29b-41d4-a716-446655440010', 'meeting_reminder', 'Meeting Reminder', 'Meeting with Michael starting in 15 mins', '{"meeting_id": "550e8400-e29b-41d4-a716-446655440070"}', ARRAY['push', 'desktop'], 'high', 'sent', '2024-01-22 14:45:00+00'),
('550e8400-e29b-41d4-a716-446655440112', '550e8400-e29b-41d4-a716-446655440011', 'campaign_milestone', 'Milestone Reached', '25% response rate reached', '{"campaign_id": "550e8400-e29b-41d4-a716-446655440041"}', ARRAY['email'], 'normal', 'delivered', '2024-01-25 12:00:00+00')
ON CONFLICT (id) DO NOTHING;

-- =============================================
-- SAMPLE ANALYTICS EVENTS
-- =============================================

INSERT INTO public.analytics_events (id, user_id, event_type, event_data, session_id, occurred_at) VALUES
('550e8400-e29b-41d4-a716-446655440120', '550e8400-e29b-41d4-a716-446655440010', 'page_view', '{"page": "/dashboard"}', 'sess_123456', '2024-01-25 09:00:00+00'),
('550e8400-e29b-41d4-a716-446655440121', '550e8400-e29b-41d4-a716-446655440010', 'campaign_created', '{"type": "email"}', 'sess_123456', '2024-01-15 08:30:00+00'),
('550e8400-e29b-41d4-a716-446655440122', '550e8400-e29b-41d4-a716-446655440011', 'investor_added', '{"investor_id": "550e8400-e29b-41d4-a716-446655440035"}', 'sess_789012', '2024-01-20 14:15:00+00'),
('550e8400-e29b-41d4-a716-446655440123', '550e8400-e29b-41d4-a716-446655440010', 'document_shared', '{"doc": "deck"}', 'sess_123456', '2024-01-22 16:00:00+00')
ON CONFLICT (id) DO NOTHING;

COMMIT;
















