-- SkillBridge Database Schema
-- Production-ready PostgreSQL schema for freelance marketplace

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Users table (base authentication)
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    role VARCHAR(20) NOT NULL CHECK (role IN ('freelancer', 'client', 'admin')),
    email_verified BOOLEAN DEFAULT FALSE,
    status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'suspended', 'banned')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Profiles table (extended user info)
CREATE TABLE profiles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID UNIQUE REFERENCES users(id) ON DELETE CASCADE,
    display_name VARCHAR(100) NOT NULL,
    avatar_url TEXT,
    headline VARCHAR(255),
    bio TEXT,
    location VARCHAR(100),
    timezone VARCHAR(50),
    website_url TEXT,
    linkedin_url TEXT,
    github_url TEXT,
    social_links JSONB DEFAULT '[]'::jsonb,
    upwork_url TEXT,
    fiverr_url TEXT,
    cv_url TEXT,
    profile_completed BOOLEAN DEFAULT FALSE,
    hourly_rate DECIMAL(10, 2),
    is_verified BOOLEAN DEFAULT FALSE,
    verification_badge VARCHAR(50),
    total_earnings DECIMAL(15, 2) DEFAULT 0,
    total_spent DECIMAL(15, 2) DEFAULT 0,
    jobs_completed INTEGER DEFAULT 0,
    rating DECIMAL(3, 2) DEFAULT 0,
    review_count INTEGER DEFAULT 0,
    availability VARCHAR(20) DEFAULT 'full_time' CHECK (availability IN ('full_time', 'part_time', 'not_available')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Skills table
CREATE TABLE skills (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(100) UNIQUE NOT NULL,
    category VARCHAR(50) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- User skills junction table
CREATE TABLE user_skills (
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    skill_id UUID REFERENCES skills(id) ON DELETE CASCADE,
    proficiency_level INTEGER CHECK (proficiency_level BETWEEN 1 AND 5),
    PRIMARY KEY (user_id, skill_id)
);

-- Portfolio items
CREATE TABLE portfolio_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    image_urls TEXT[],
    project_url TEXT,
    skills UUID[],
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Projects table
CREATE TABLE projects (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    client_id UUID REFERENCES users(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    description TEXT NOT NULL,
    category VARCHAR(50) NOT NULL,
    skills_required UUID[],
    budget_min DECIMAL(10, 2),
    budget_max DECIMAL(10, 2),
    budget_type VARCHAR(20) DEFAULT 'fixed' CHECK (budget_type IN ('fixed', 'hourly')),
    duration VARCHAR(50),
    experience_level VARCHAR(20) CHECK (experience_level IN ('entry', 'intermediate', 'expert')),
    status VARCHAR(20) DEFAULT 'open' CHECK (status IN ('draft', 'open', 'in_progress', 'completed', 'cancelled')),
    promotion_tier VARCHAR(20) DEFAULT 'normal' CHECK (promotion_tier IN ('normal', 'hot', 'super_hot')),
    promotion_expires_at TIMESTAMP WITH TIME ZONE,
    visibility VARCHAR(20) DEFAULT 'public' CHECK (visibility IN ('public', 'private', 'invite_only')),
    deadline TIMESTAMP WITH TIME ZONE,
    location_type VARCHAR(20) DEFAULT 'remote' CHECK (location_type IN ('remote', 'onsite', 'hybrid')),
    views INTEGER DEFAULT 0,
    applications_count INTEGER DEFAULT 0,
    hired_count INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Project milestones
CREATE TABLE milestones (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    amount DECIMAL(10, 2) NOT NULL,
    due_date TIMESTAMP WITH TIME ZONE,
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'submitted', 'approved', 'disputed')),
    order_index INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Applications table
CREATE TABLE applications (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
    freelancer_id UUID REFERENCES users(id) ON DELETE CASCADE,
    cover_letter TEXT NOT NULL,
    proposed_budget DECIMAL(10, 2),
    proposed_duration INTEGER,
    attachments TEXT[],
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'shortlisted', 'rejected', 'hired')),
    client_notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(project_id, freelancer_id)
);

-- Contracts table (hired applications)
CREATE TABLE contracts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
    application_id UUID REFERENCES applications(id) ON DELETE CASCADE,
    client_id UUID REFERENCES users(id) ON DELETE CASCADE,
    freelancer_id UUID REFERENCES users(id) ON DELETE CASCADE,
    agreed_budget DECIMAL(10, 2) NOT NULL,
    agreed_duration INTEGER,
    start_date TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    end_date TIMESTAMP WITH TIME ZONE,
    status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'paused', 'completed', 'cancelled', 'disputed')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Test templates (client-created tests)
CREATE TABLE test_templates (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    client_id UUID REFERENCES users(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    category VARCHAR(50) NOT NULL,
    duration_minutes INTEGER NOT NULL,
    passing_score INTEGER NOT NULL CHECK (passing_score BETWEEN 0 AND 100),
    is_ai_generated BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Test questions
CREATE TABLE test_questions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    test_template_id UUID REFERENCES test_templates(id) ON DELETE CASCADE,
    question_type VARCHAR(20) NOT NULL CHECK (question_type IN ('mcq', 'coding', 'written', 'file_upload')),
    question_text TEXT NOT NULL,
    options JSONB,
    correct_answer TEXT,
    points INTEGER DEFAULT 10,
    order_index INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Project required tests
CREATE TABLE project_tests (
    project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
    test_template_id UUID REFERENCES test_templates(id) ON DELETE CASCADE,
    is_required BOOLEAN DEFAULT TRUE,
    PRIMARY KEY (project_id, test_template_id)
);

-- Test attempts
CREATE TABLE test_attempts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    test_template_id UUID REFERENCES test_templates(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    started_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    completed_at TIMESTAMP WITH TIME ZONE,
    score INTEGER,
    max_score INTEGER,
    percentage DECIMAL(5, 2),
    passed BOOLEAN,
    ai_feedback TEXT,
    answers JSONB,
    status VARCHAR(20) DEFAULT 'in_progress' CHECK (status IN ('in_progress', 'completed', 'timed_out')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Messages table
CREATE TABLE messages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    sender_id UUID REFERENCES users(id) ON DELETE CASCADE,
    recipient_id UUID REFERENCES users(id) ON DELETE CASCADE,
    project_id UUID REFERENCES projects(id) ON DELETE SET NULL,
    contract_id UUID REFERENCES contracts(id) ON DELETE SET NULL,
    content TEXT NOT NULL,
    attachments TEXT[],
    is_read BOOLEAN DEFAULT FALSE,
    read_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Conversations (for grouping messages)
CREATE TABLE conversations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    participant_1 UUID REFERENCES users(id) ON DELETE CASCADE,
    participant_2 UUID REFERENCES users(id) ON DELETE CASCADE,
    project_id UUID REFERENCES projects(id) ON DELETE SET NULL,
    last_message_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(participant_1, participant_2, project_id)
);

-- Wallets table
CREATE TABLE wallets (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID UNIQUE REFERENCES users(id) ON DELETE CASCADE,
    balance DECIMAL(15, 2) DEFAULT 0,
    escrow_balance DECIMAL(15, 2) DEFAULT 0,
    total_deposited DECIMAL(15, 2) DEFAULT 0,
    total_withdrawn DECIMAL(15, 2) DEFAULT 0,
    currency VARCHAR(3) DEFAULT 'USD',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Transactions table
CREATE TABLE transactions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    wallet_id UUID REFERENCES wallets(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    type VARCHAR(30) NOT NULL CHECK (type IN ('deposit', 'withdrawal', 'payment', 'refund', 'escrow_deposit', 'escrow_release', 'platform_fee', 'promotion_payment')),
    amount DECIMAL(15, 2) NOT NULL,
    fee DECIMAL(10, 2) DEFAULT 0,
    currency VARCHAR(3) DEFAULT 'USD',
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'failed', 'cancelled')),
    description TEXT,
    project_id UUID REFERENCES projects(id) ON DELETE SET NULL,
    contract_id UUID REFERENCES contracts(id) ON DELETE SET NULL,
    milestone_id UUID REFERENCES milestones(id) ON DELETE SET NULL,
    stripe_payment_intent_id VARCHAR(255),
    stripe_transfer_id VARCHAR(255),
    metadata JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    completed_at TIMESTAMP WITH TIME ZONE
);

-- Escrow table
CREATE TABLE escrow (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    contract_id UUID REFERENCES contracts(id) ON DELETE CASCADE,
    milestone_id UUID REFERENCES milestones(id) ON DELETE CASCADE,
    client_id UUID REFERENCES users(id) ON DELETE CASCADE,
    freelancer_id UUID REFERENCES users(id) ON DELETE CASCADE,
    amount DECIMAL(15, 2) NOT NULL,
    platform_fee DECIMAL(10, 2) NOT NULL,
    status VARCHAR(20) DEFAULT 'held' CHECK (status IN ('held', 'released', 'refunded', 'disputed')),
    released_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Reviews table
CREATE TABLE reviews (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    contract_id UUID REFERENCES contracts(id) ON DELETE CASCADE,
    project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
    reviewer_id UUID REFERENCES users(id) ON DELETE CASCADE,
    reviewee_id UUID REFERENCES users(id) ON DELETE CASCADE,
    rating INTEGER NOT NULL CHECK (rating BETWEEN 1 AND 5),
    title VARCHAR(255),
    content TEXT,
    is_public BOOLEAN DEFAULT TRUE,
    response TEXT,
    responded_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Notifications table
CREATE TABLE notifications (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    type VARCHAR(50) NOT NULL,
    title VARCHAR(255) NOT NULL,
    message TEXT NOT NULL,
    data JSONB,
    is_read BOOLEAN DEFAULT FALSE,
    read_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Disputes table
CREATE TABLE disputes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    contract_id UUID REFERENCES contracts(id) ON DELETE CASCADE,
    milestone_id UUID REFERENCES milestones(id) ON DELETE SET NULL,
    raised_by UUID REFERENCES users(id) ON DELETE CASCADE,
    against_user UUID REFERENCES users(id) ON DELETE CASCADE,
    reason TEXT NOT NULL,
    description TEXT NOT NULL,
    evidence_urls TEXT[],
    status VARCHAR(20) DEFAULT 'open' CHECK (status IN ('open', 'under_review', 'resolved', 'closed')),
    resolution TEXT,
    resolved_by UUID REFERENCES users(id) ON DELETE SET NULL,
    resolved_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Admin actions log
CREATE TABLE admin_actions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    admin_id UUID REFERENCES users(id) ON DELETE CASCADE,
    action_type VARCHAR(50) NOT NULL,
    target_type VARCHAR(50) NOT NULL,
    target_id UUID NOT NULL,
    reason TEXT,
    metadata JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Platform settings
CREATE TABLE platform_settings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    key VARCHAR(100) UNIQUE NOT NULL,
    value TEXT NOT NULL,
    description TEXT,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Insert default skills
INSERT INTO skills (name, category) VALUES
('JavaScript', 'Web Development'),
('TypeScript', 'Web Development'),
('React', 'Web Development'),
('Node.js', 'Web Development'),
('Python', 'Web Development'),
('Next.js', 'Web Development'),
('Vue.js', 'Web Development'),
('Angular', 'Web Development'),
('HTML/CSS', 'Web Development'),
('Tailwind CSS', 'Web Development'),
('Machine Learning', 'AI/ML'),
('Deep Learning', 'AI/ML'),
('TensorFlow', 'AI/ML'),
('PyTorch', 'AI/ML'),
('Data Science', 'AI/ML'),
('NLP', 'AI/ML'),
('Computer Vision', 'AI/ML'),
('UI/UX Design', 'Design'),
('Graphic Design', 'Design'),
('Logo Design', 'Design'),
('Figma', 'Design'),
('Adobe Photoshop', 'Design'),
('Adobe Illustrator', 'Design'),
('Motion Graphics', 'Design'),
('3D Modeling', 'Design'),
('Content Writing', 'Writing'),
('Copywriting', 'Writing'),
('Technical Writing', 'Writing'),
('SEO Writing', 'Writing'),
('Blog Writing', 'Writing'),
('Proofreading', 'Writing'),
('Video Editing', 'Video Editing'),
('After Effects', 'Video Editing'),
('Premiere Pro', 'Video Editing'),
('Motion Graphics', 'Video Editing'),
('Color Grading', 'Video Editing');

-- Insert platform settings
INSERT INTO platform_settings (key, value, description) VALUES
('platform_fee_percentage', '10', 'Platform fee percentage on each transaction'),
('hot_project_price', '49.99', 'Price to promote project to Hot tier'),
('super_hot_project_price', '99.99', 'Price to promote project to Super Hot tier'),
('min_withdrawal_amount', '50.00', 'Minimum withdrawal amount'),
('max_withdrawal_amount', '10000.00', 'Maximum withdrawal amount'),
('escrow_hold_days', '7', 'Days to hold escrow before auto-release'),
('dispute_resolution_days', '14', 'Days to resolve disputes');

-- Create indexes for performance
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_role ON users(role);
CREATE INDEX idx_projects_client_id ON projects(client_id);
CREATE INDEX idx_projects_status ON projects(status);
CREATE INDEX idx_projects_category ON projects(category);
CREATE INDEX idx_projects_promotion ON projects(promotion_tier);
CREATE INDEX idx_applications_project_id ON applications(project_id);
CREATE INDEX idx_applications_freelancer_id ON applications(freelancer_id);
CREATE INDEX idx_applications_status ON applications(status);
CREATE INDEX idx_contracts_project_id ON contracts(project_id);
CREATE INDEX idx_contracts_freelancer_id ON contracts(freelancer_id);
CREATE INDEX idx_contracts_status ON contracts(status);
CREATE INDEX idx_messages_sender_id ON messages(sender_id);
CREATE INDEX idx_messages_recipient_id ON messages(recipient_id);
CREATE INDEX idx_messages_project_id ON messages(project_id);
CREATE INDEX idx_messages_created_at ON messages(created_at);
CREATE INDEX idx_transactions_user_id ON transactions(user_id);
CREATE INDEX idx_transactions_type ON transactions(type);
CREATE INDEX idx_transactions_status ON transactions(status);
CREATE INDEX idx_notifications_user_id ON notifications(user_id);
CREATE INDEX idx_notifications_is_read ON notifications(is_read);
CREATE INDEX idx_test_attempts_user_id ON test_attempts(user_id);
CREATE INDEX idx_reviews_reviewee_id ON reviews(reviewee_id);

-- Create updated_at trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create triggers for updated_at
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON profiles
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_projects_updated_at BEFORE UPDATE ON projects
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_applications_updated_at BEFORE UPDATE ON applications
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_contracts_updated_at BEFORE UPDATE ON contracts
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_wallets_updated_at BEFORE UPDATE ON wallets
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
