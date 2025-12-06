-- Seed Personal Data for Alfred PWA
-- Run this SQL in your Supabase SQL Editor (Dashboard > SQL Editor)
-- This will populate your profile and entities

-- First, get the user_id (assuming you're the first/only user)
DO $$
DECLARE
  v_user_id UUID;
BEGIN
  -- Get the first user from auth.users
  SELECT id INTO v_user_id FROM auth.users LIMIT 1;

  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'No users found in auth.users. Please sign up first.';
  END IF;

  RAISE NOTICE 'Using user_id: %', v_user_id;

  -- ============================================
  -- 1. Insert/Update User Profile with About Me
  -- ============================================
  INSERT INTO user_profiles (user_id, about_me, preferences)
  VALUES (
    v_user_id,
    E'I live in Rochester, Minnesota with my partner Misa and my Pomeranian puppy Latte. My other children, Ryder and Neeks, visit regularly.\n\nFaith and daily devotionals play a central role in my life and decisions.\n\nProfessionally, I work in the hospitality/hotel industry with connections to Noble Investment Group and Virgin Hotels. I teach at RCTC (Rochester Community and Technical College) and have speaking engagements at Penn State Georgetown.\n\nRecognition: "Top 25 Minds" award recipient and recently completed a master''s program.\n\nI drive a Tesla and actively use detailed personal documentation and reflection systems. I value building custom workflow and data analysis tools, and I''m passionate about AI-powered website development using tools like Claude Code.',
    '{}'::jsonb
  )
  ON CONFLICT (user_id)
  DO UPDATE SET
    about_me = EXCLUDED.about_me,
    updated_at = NOW();

  -- ============================================
  -- 2. Insert People Entities
  -- ============================================

  -- Misa
  INSERT INTO entities (user_id, name, type, relationship, notes, context)
  VALUES (
    v_user_id,
    'Misa',
    'person',
    'Partner',
    'Involved in dance (performing at venues like Asian Mall, Mall of America). Runs a press-on nail business.',
    'Personal life, creative partner, entrepreneur'
  )
  ON CONFLICT DO NOTHING;

  -- Ryder
  INSERT INTO entities (user_id, name, type, relationship, notes, context)
  VALUES (
    v_user_id,
    'Ryder',
    'person',
    'Child',
    'Visits regularly.',
    'Family'
  )
  ON CONFLICT DO NOTHING;

  -- Neeks
  INSERT INTO entities (user_id, name, type, relationship, notes, context)
  VALUES (
    v_user_id,
    'Neeks',
    'person',
    'Child',
    'Visits regularly.',
    'Family'
  )
  ON CONFLICT DO NOTHING;

  -- Latte
  INSERT INTO entities (user_id, name, type, relationship, notes, context)
  VALUES (
    v_user_id,
    'Latte',
    'other',
    'Pet',
    'Pomeranian puppy. Healthcare through Banfield Pet Hospital.',
    'Family, pet care'
  )
  ON CONFLICT DO NOTHING;

  -- ============================================
  -- 3. Insert Organization Entities
  -- ============================================

  -- Noble Investment Group
  INSERT INTO entities (user_id, name, type, relationship, notes, context)
  VALUES (
    v_user_id,
    'Noble Investment Group',
    'organization',
    'Business Contact',
    'Important business contact/organization in the hospitality/hotel industry.',
    'Professional, hospitality industry, hotels'
  )
  ON CONFLICT DO NOTHING;

  -- RCTC
  INSERT INTO entities (user_id, name, type, relationship, notes, context)
  VALUES (
    v_user_id,
    'RCTC (Rochester Community and Technical College)',
    'organization',
    'Educational Institution',
    'Educational institution relevant to teaching and professional network.',
    'Professional, education, teaching'
  )
  ON CONFLICT DO NOTHING;

  -- Virgin Hotels
  INSERT INTO entities (user_id, name, type, relationship, notes, context)
  VALUES (
    v_user_id,
    'Virgin Hotels',
    'organization',
    'Business Partner',
    'Potential work or business projects.',
    'Professional, hospitality industry, hotels'
  )
  ON CONFLICT DO NOTHING;

  -- Penn State Georgetown
  INSERT INTO entities (user_id, name, type, relationship, notes, context)
  VALUES (
    v_user_id,
    'Penn State Georgetown',
    'organization',
    'Speaking Engagement',
    'Organization/institution where I have speaking/lecture engagements.',
    'Professional, education, speaking'
  )
  ON CONFLICT DO NOTHING;

  -- Banfield Pet Hospital
  INSERT INTO entities (user_id, name, type, relationship, notes, context)
  VALUES (
    v_user_id,
    'Banfield Pet Hospital',
    'organization',
    'Service Provider',
    'Organization for dog''s insurance/healthcare (Latte).',
    'Personal, pet care, healthcare'
  )
  ON CONFLICT DO NOTHING;

  -- Management Company
  INSERT INTO entities (user_id, name, type, relationship, notes, context)
  VALUES (
    v_user_id,
    'Management Company',
    'organization',
    'Business Collaborator',
    'Collaborators on hotel-related projects.',
    'Professional, hospitality industry, hotels'
  )
  ON CONFLICT DO NOTHING;

  -- ============================================
  -- 4. Insert Place Entities
  -- ============================================

  -- Rochester, Minnesota
  INSERT INTO entities (user_id, name, type, relationship, notes, context)
  VALUES (
    v_user_id,
    'Rochester, Minnesota',
    'place',
    'Home',
    'Current residence location.',
    'Personal, home base'
  )
  ON CONFLICT DO NOTHING;

  -- Asian Mall
  INSERT INTO entities (user_id, name, type, relationship, notes, context)
  VALUES (
    v_user_id,
    'Asian Mall',
    'place',
    'Performance Venue',
    'Venue where Misa performs dance.',
    'Personal, Misa''s activities'
  )
  ON CONFLICT DO NOTHING;

  -- Mall of America
  INSERT INTO entities (user_id, name, type, relationship, notes, context)
  VALUES (
    v_user_id,
    'Mall of America',
    'place',
    'Performance Venue',
    'Venue where Misa performs dance.',
    'Personal, Misa''s activities'
  )
  ON CONFLICT DO NOTHING;

  -- ============================================
  -- 5. Insert Project/Business Entities
  -- ============================================

  -- Hotel Renovation Project
  INSERT INTO entities (user_id, name, type, relationship, notes, context)
  VALUES (
    v_user_id,
    'Hotel Renovation & Teaser Video Project',
    'other',
    'Ongoing Project',
    'Ongoing professional project involving hotel renovation and promotional video.',
    'Professional, hospitality, creative'
  )
  ON CONFLICT DO NOTHING;

  -- Misa's Nail Business
  INSERT INTO entities (user_id, name, type, relationship, notes, context)
  VALUES (
    v_user_id,
    'Misa''s Nail Business',
    'organization',
    'Family Business',
    'Press-on nail business run by partner Misa.',
    'Personal, business, entrepreneur'
  )
  ON CONFLICT DO NOTHING;

  -- Custom Workflow Tools
  INSERT INTO entities (user_id, name, type, relationship, notes, context)
  VALUES (
    v_user_id,
    'Custom Workflow and Data Analysis Tools',
    'other',
    'Personal Projects',
    'Custom solutions built for productivity and data analysis.',
    'Professional, technology, productivity'
  )
  ON CONFLICT DO NOTHING;

  -- AI Website Development
  INSERT INTO entities (user_id, name, type, relationship, notes, context)
  VALUES (
    v_user_id,
    'AI-powered Website Development',
    'other',
    'Project Focus',
    'Projects leveraging AI, especially with Claude Code.',
    'Professional, technology, AI'
  )
  ON CONFLICT DO NOTHING;

  -- Geo-targeted Marketing
  INSERT INTO entities (user_id, name, type, relationship, notes, context)
  VALUES (
    v_user_id,
    'Geo-targeted Marketing Campaigns',
    'other',
    'Business Activity',
    'Work involving launching campaigns with partners.',
    'Professional, marketing'
  )
  ON CONFLICT DO NOTHING;

  RAISE NOTICE 'Successfully seeded personal data!';

END $$;

-- Verify the data was inserted
SELECT 'User Profile' as type, about_me FROM user_profiles LIMIT 1;
SELECT 'Entities Count' as info, COUNT(*) as count FROM entities;
SELECT name, type, relationship FROM entities ORDER BY type, name;
