# Investor Relations CRM Database Schema

This directory contains the complete database schema and sample data for the Investor Relations CRM application.

## Files

- `schema.sql` - Complete database schema with all tables, indexes, and constraints
- `sample_data.sql` - Sample data for testing and demonstration
- `README.md` - This documentation file

## Database Overview

The database is designed to support a comprehensive investor relations CRM system with the following main functional areas:

### Core Entities

1. **Users & Authentication**
   - User management with roles and permissions
   - Session tracking and security
   - Two-factor authentication support

2. **Companies & Organizations**
   - Company profiles and metadata
   - User-company relationships

3. **Investors & Firms**
   - Investment firm profiles
   - Individual investor profiles
   - Contact information and preferences
   - Portfolio fit scoring

4. **Campaigns & Outreach**
   - Campaign management and templates
   - Multi-channel communication tracking
   - Performance metrics and analytics

5. **Communications**
   - All investor interactions
   - Meeting scheduling and management
   - Document sharing and access tracking

6. **Pipeline Management**
   - Investment opportunity tracking
   - Stage progression and history
   - Deal value and probability tracking

7. **Analytics & Reporting**
   - Custom report generation
   - User behavior tracking
   - Performance metrics

8. **System Features**
   - Document management
   - Notification system
   - Integration management
   - Audit logging

## Key Features

### Security
- Row Level Security (RLS) policies
- Encrypted credential storage
- Audit trail for all changes
- Session management

### Performance
- Comprehensive indexing strategy
- Optimized queries for common operations
- Efficient data structures

### Scalability
- UUID primary keys for distributed systems
- JSONB for flexible data storage
- Partitioning-ready design

### Data Integrity
- Foreign key constraints
- Check constraints for data validation
- Triggers for automatic updates

## Schema Highlights

### Investor Scoring
The system includes sophisticated investor scoring mechanisms:
- Portfolio fit scoring (0-100)
- Engagement scoring based on interactions
- Response rate tracking
- Automated score calculations

### Campaign Management
Comprehensive campaign tracking includes:
- Multi-channel support (email, LinkedIn, phone, etc.)
- Template system for reusable campaigns
- Detailed performance metrics
- A/B testing capabilities

### Pipeline Tracking
Investment pipeline management features:
- Customizable pipeline stages
- Probability and amount tracking
- Stage progression history
- Conversion analytics

### Communication History
Complete communication tracking:
- All touchpoints with investors
- Meeting scheduling and outcomes
- Document sharing and access logs
- Sentiment analysis

## Usage

### Initial Setup
1. Run `schema.sql` to create the database structure
2. Run `sample_data.sql` to populate with test data
3. Configure application connection settings

### Sample Data
The sample data includes:
- 2 sample companies (TechFlow Solutions, HealthTech Innovations)
- 3 sample users with different roles
- 5 investment firms (A16Z, Sequoia, GV, Index, Kleiner Perkins)
- 6 sample investors with realistic profiles
- 4 sample campaigns with performance data
- Meeting and communication history
- Document sharing examples

### Customization
The schema is designed to be extensible:
- Add custom fields using JSONB columns
- Extend notification types
- Add new integration types
- Customize pipeline stages

## Performance Considerations

### Indexes
The schema includes comprehensive indexing for:
- Frequently queried columns
- Foreign key relationships
- Full-text search capabilities
- Composite indexes for complex queries

### Optimization Tips
1. Use prepared statements for repeated queries
2. Leverage JSONB indexes for flexible data
3. Consider partitioning for large datasets
4. Monitor query performance and adjust indexes

## Security Best Practices

### Row Level Security
- Users can only access data they own or have permission to view
- Company-based data isolation
- Role-based access control

### Data Protection
- Sensitive data encryption
- Audit logging for compliance
- Secure credential storage
- Session management

## Maintenance

### Regular Tasks
1. Monitor database performance
2. Update statistics for query optimization
3. Review and rotate audit logs
4. Backup and recovery testing

### Monitoring
Key metrics to monitor:
- Query performance
- Index usage
- Storage growth
- Connection pooling

## Integration Points

The schema supports integration with:
- Email providers (Gmail, Outlook)
- CRM systems (Salesforce, HubSpot)
- Calendar systems
- Document storage (AWS S3, Google Drive)
- Communication platforms (LinkedIn, Slack)

## Compliance

The schema includes features for:
- GDPR compliance (data export, deletion)
- SOC 2 compliance (audit logging, access controls)
- Data retention policies
- Privacy controls

## Support

For questions about the database schema:
1. Review the inline comments in `schema.sql`
2. Check the sample data in `sample_data.sql`
3. Refer to application documentation
4. Contact the development team








# Database Configuration
SUPABASE_URL=https://cwqabnxksxebqrnovvwp.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImN3cWFibnhrc3hlYnFybm92dndwIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MzczMDg4OSwiZXhwIjoyMDY5MzA2ODg5fQ.V20SlQCdMd6s3P0lUKBtP7NcMfJlHrVH9uLp3CbJ6oM

# JWT Configuration
JWT_SECRET=989d5a1136e478bf9aae18aa892fd11889f6706bac21bf8875aad98d75de81ca8b528ef9091f32d32f37840df3d28b05c71c84ea71aa8eead64213ad1be7dfa4
JWT_EXPIRES_IN=15m

FRONTEND_URL=http://localhost:5173 


GOOGLE_CLIENT_ID=913456441173-bsfi56vs76sfm6kkt4isuduugbiic9li.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=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
GOOGLE_REDIRECT_URI=http://localhost:3001/api/oauth/google/callback
ENCRYPTION_KEY=d82hF92mxQ18aPmL09ZbvC6nT4KsE7Wq

