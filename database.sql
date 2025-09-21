-- Enables the use of UUID generation functions
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- First, create the main database for your application
CREATE DATABASE carrier_disha_db;

-- NOTE: For this script to work in one go, you must be connected to the default 'postgres' database.
-- The following tables will be created, but to use them, you would connect your app
-- to the newly created 'carrier_disha_db'.

CREATE TABLE users (
    uid UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(255) UNIQUE NOT NULL,
    display_name VARCHAR(255) NOT NULL,
    photo_url TEXT,
    phone VARCHAR(20),
    age INT,
    location VARCHAR(255),
    education TEXT,
    bio TEXT,
    experience JSONB,
    goals TEXT,
    profile_completed BOOLEAN DEFAULT FALSE,
    interview_completed BOOLEAN DEFAULT FALSE,
    email_verified BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE skills (
    skill_id SERIAL PRIMARY KEY,
    skill_name VARCHAR(100) UNIQUE NOT NULL
);

CREATE TABLE user_skills (
    user_uid UUID REFERENCES users(uid) ON DELETE CASCADE,
    skill_id INT REFERENCES skills(skill_id) ON DELETE CASCADE,
    PRIMARY KEY (user_uid, skill_id)
);

CREATE TABLE interests (
    interest_id SERIAL PRIMARY KEY,
    interest_name VARCHAR(100) UNIQUE NOT NULL
);

CREATE TABLE user_interests (
    user_uid UUID REFERENCES users(uid) ON DELETE CASCADE,
    interest_id INT REFERENCES interests(interest_id) ON DELETE CASCADE,
    PRIMARY KEY (user_uid, interest_id)
);

CREATE TYPE interview_status AS ENUM ('pending', 'completed', 'in-progress');

CREATE TABLE interviews (
    interview_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_uid UUID NOT NULL REFERENCES users(uid) ON DELETE CASCADE,
    interview_date TIMESTAMPTZ DEFAULT NOW(),
    target_role VARCHAR(255),
    company_name VARCHAR(255),
    status interview_status DEFAULT 'pending',
    score NUMERIC(5, 2),
    feedback TEXT
);

CREATE TABLE courses (
    course_id SERIAL PRIMARY KEY,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    provider VARCHAR(255),
    url TEXT UNIQUE
);

CREATE TYPE enrollment_status AS ENUM ('not-started', 'in-progress', 'completed');

CREATE TABLE user_enrollments (
    enrollment_id SERIAL PRIMARY KEY,
    user_uid UUID NOT NULL REFERENCES users(uid) ON DELETE CASCADE,
    course_id INT NOT NULL REFERENCES courses(course_id) ON DELETE CASCADE,
    status enrollment_status DEFAULT 'not-started',
    progress INT DEFAULT 0,
    enrolled_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE (user_uid, course_id)
);