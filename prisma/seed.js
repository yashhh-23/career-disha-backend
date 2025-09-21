// ===============================================
// CAREER DISHA BACKEND - DATABASE SEEDING SCRIPT
// ===============================================
// Seeds the database with comprehensive sample data for development and testing

const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

// Utility function to generate random data
const getRandomElement = (array) => array[Math.floor(Math.random() * array.length)];
const getRandomElements = (array, count) => {
  const shuffled = [...array].sort(() => 0.5 - Math.random());
  return shuffled.slice(0, count);
};

// Sample data constants
const SAMPLE_DATA = {
  skills: [
    'JavaScript', 'Python', 'Java', 'React', 'Node.js', 'SQL', 'MongoDB',
    'AWS', 'Docker', 'Kubernetes', 'Machine Learning', 'Data Science',
    'UI/UX Design', 'Project Management', 'Digital Marketing', 'Content Writing',
    'Cybersecurity', 'Blockchain', 'Mobile Development', 'DevOps'
  ],
  
  interests: [
    'Web Development', 'Mobile Apps', 'Artificial Intelligence', 'Data Analytics',
    'Cloud Computing', 'Cybersecurity', 'Game Development', 'E-commerce',
    'FinTech', 'HealthTech', 'EdTech', 'IoT', 'Augmented Reality', 'Virtual Reality'
  ],
  
  industries: [
    'Technology', 'Healthcare', 'Finance', 'Education', 'E-commerce',
    'Manufacturing', 'Media', 'Transportation', 'Energy', 'Government'
  ],
  
  jobTitles: [
    'Software Engineer', 'Product Manager', 'Data Scientist', 'UX Designer',
    'DevOps Engineer', 'Marketing Manager', 'Sales Representative', 
    'Business Analyst', 'Project Manager', 'Full Stack Developer'
  ],
  
  companies: [
    'Google', 'Microsoft', 'Amazon', 'Apple', 'Meta', 'Netflix', 'Spotify',
    'Uber', 'Airbnb', 'Tesla', 'Startup Inc', 'Tech Solutions Ltd'
  ],
  
  courseCategories: [
    { name: 'Programming', slug: 'programming', description: 'Learn programming languages and frameworks' },
    { name: 'Data Science', slug: 'data-science', description: 'Master data analysis and machine learning' },
    { name: 'Design', slug: 'design', description: 'UI/UX and graphic design courses' },
    { name: 'Business', slug: 'business', description: 'Business and management skills' },
    { name: 'Marketing', slug: 'marketing', description: 'Digital marketing and growth strategies' },
    { name: 'Career Development', slug: 'career-development', description: 'Professional skills and career guidance' }
  ],
  
  courseTitles: [
    'Complete JavaScript Bootcamp', 'Python for Data Science', 'React Masterclass',
    'Machine Learning Fundamentals', 'UI/UX Design Principles', 'Digital Marketing Strategy',
    'Node.js Backend Development', 'SQL Database Management', 'Cloud Computing with AWS',
    'Cybersecurity Basics', 'Project Management Professional', 'Advanced Excel for Business'
  ],
  
  mentorSpecializations: [
    'Software Engineering', 'Product Management', 'Data Science', 'UI/UX Design',
    'Digital Marketing', 'Career Transition', 'Leadership', 'Entrepreneurship',
    'Technical Writing', 'Public Speaking', 'Interview Preparation'
  ]
};

async function clearDatabase() {
  console.log('🧹 Clearing existing data...');
  
  // Delete in correct order to avoid foreign key constraints
  await prisma.sessionResource.deleteMany();
  await prisma.mentorshipSession.deleteMany();
  await prisma.mentorshipRequest.deleteMany();
  await prisma.mentorProfile.deleteMany();
  
  await prisma.lessonProgress.deleteMany();
  await prisma.enrollment.deleteMany();
  await prisma.review.deleteMany();
  await prisma.lesson.deleteMany();
  await prisma.course.deleteMany();
  await prisma.category.deleteMany();
  await prisma.courseTag.deleteMany();
  
  await prisma.interviewSession.deleteMany();
  await prisma.skillAssessment.deleteMany();
  await prisma.achievement.deleteMany();
  await prisma.careerPath.deleteMany();
  
  await prisma.notification.deleteMany();
  await prisma.analytics.deleteMany();
  await prisma.systemLog.deleteMany();
  await prisma.setting.deleteMany();
  await prisma.fileUpload.deleteMany();
  
  await prisma.passwordReset.deleteMany();
  await prisma.refreshToken.deleteMany();
  await prisma.userProfile.deleteMany();
  await prisma.user.deleteMany();
  
  console.log('✅ Database cleared successfully');
}

async function seedUsers() {
  console.log('👥 Seeding users...');
  
  const hashedPassword = await bcrypt.hash('password123', 12);
  
  // Create admin user
  const admin = await prisma.user.create({
    data: {
      email: 'admin@careerdisha.com',
      password: hashedPassword,
      name: 'Admin User',
      role: 'ADMIN',
      emailVerified: true,
      emailVerifiedAt: new Date(),
      profile: {
        create: {
          firstName: 'Admin',
          lastName: 'User',
          bio: 'System administrator for Career Disha platform',
          skills: ['Leadership', 'Project Management', 'System Administration'],
          interests: ['Technology', 'Education', 'Career Development'],
          isProfilePublic: true
        }
      }
    }
  });
  
  // Create mentor users
  const mentors = [];
  for (let i = 0; i < 10; i++) {
    const mentor = await prisma.user.create({
      data: {
        email: `mentor${i + 1}@careerdisha.com`,
        password: hashedPassword,
        name: `Mentor ${i + 1}`,
        role: 'MENTOR',
        emailVerified: true,
        emailVerifiedAt: new Date(),
        profile: {
          create: {
            firstName: `Mentor`,
            lastName: `${i + 1}`,
            bio: `Experienced ${getRandomElement(SAMPLE_DATA.jobTitles)} with ${5 + i} years of experience`,
            currentJobTitle: getRandomElement(SAMPLE_DATA.jobTitles),
            company: getRandomElement(SAMPLE_DATA.companies),
            experience: getRandomElement(['INTERMEDIATE', 'ADVANCED', 'EXPERT']),
            industry: getRandomElement(SAMPLE_DATA.industries),
            skills: getRandomElements(SAMPLE_DATA.skills, 5 + Math.floor(Math.random() * 5)),
            interests: getRandomElements(SAMPLE_DATA.interests, 3 + Math.floor(Math.random() * 3)),
            location: getRandomElement(['New York, NY', 'San Francisco, CA', 'London, UK', 'Toronto, CA', 'Austin, TX']),
            linkedinUrl: `https://linkedin.com/in/mentor${i + 1}`,
            isProfilePublic: true
          }
        },
        mentorProfile: {
          create: {
            title: `Senior ${getRandomElement(SAMPLE_DATA.jobTitles)}`,
            specialization: getRandomElements(SAMPLE_DATA.mentorSpecializations, 2 + Math.floor(Math.random() * 3)),
            yearsOfExperience: 5 + i,
            hourlyRate: 50 + (i * 10),
            isAvailable: true,
            maxStudents: 3 + Math.floor(Math.random() * 5),
            description: `Passionate about helping others grow in their career. Specializing in ${getRandomElements(SAMPLE_DATA.mentorSpecializations, 2).join(' and ')}.`,
            availability: {
              monday: { available: true, slots: ['09:00', '14:00', '16:00'] },
              tuesday: { available: true, slots: ['10:00', '15:00'] },
              wednesday: { available: i % 2 === 0, slots: ['09:00', '13:00'] },
              thursday: { available: true, slots: ['11:00', '16:00'] },
              friday: { available: true, slots: ['09:00', '14:00'] },
              saturday: { available: i % 3 === 0, slots: ['10:00'] },
              sunday: { available: false, slots: [] }
            },
            totalSessions: Math.floor(Math.random() * 50),
            averageRating: 4.2 + (Math.random() * 0.8),
            totalReviews: Math.floor(Math.random() * 20),
            isVerified: i < 7, // First 7 mentors are verified
            verifiedAt: i < 7 ? new Date() : null
          }
        }
      }
    });
    mentors.push(mentor);
  }
  
  // Create student users
  const students = [];
  for (let i = 0; i < 50; i++) {
    const student = await prisma.user.create({
      data: {
        email: `student${i + 1}@example.com`,
        password: hashedPassword,
        name: `Student ${i + 1}`,
        role: 'STUDENT',
        emailVerified: Math.random() > 0.2, // 80% verified
        emailVerifiedAt: Math.random() > 0.2 ? new Date() : null,
        profile: {
          create: {
            firstName: `Student`,
            lastName: `${i + 1}`,
            bio: `Aspiring ${getRandomElement(SAMPLE_DATA.jobTitles)} looking to advance my career`,
            currentJobTitle: Math.random() > 0.3 ? getRandomElement(SAMPLE_DATA.jobTitles) : null,
            company: Math.random() > 0.4 ? getRandomElement(SAMPLE_DATA.companies) : null,
            experience: getRandomElement(['BEGINNER', 'INTERMEDIATE']),
            industry: getRandomElement(SAMPLE_DATA.industries),
            careerGoals: `Transition to ${getRandomElement(SAMPLE_DATA.jobTitles)} role within the next 2 years`,
            skills: getRandomElements(SAMPLE_DATA.skills, 2 + Math.floor(Math.random() * 4)),
            interests: getRandomElements(SAMPLE_DATA.interests, 2 + Math.floor(Math.random() * 4)),
            location: getRandomElement(['New York, NY', 'Los Angeles, CA', 'Chicago, IL', 'Houston, TX', 'Remote']),
            isProfilePublic: Math.random() > 0.3 // 70% public profiles
          }
        }
      }
    });
    students.push(student);
  }
  
  console.log(`✅ Created ${mentors.length} mentors and ${students.length} students`);
  return { admin, mentors, students };
}

async function seedCategories() {
  console.log('📚 Seeding categories...');
  
  const categories = [];
  for (const categoryData of SAMPLE_DATA.courseCategories) {
    const category = await prisma.category.create({
      data: {
        name: categoryData.name,
        slug: categoryData.slug,
        description: categoryData.description,
        icon: `icon-${categoryData.slug}`,
        color: getRandomElement(['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#06B6D4']),
        isActive: true,
        sortOrder: categories.length
      }
    });
    categories.push(category);
  }
  
  console.log(`✅ Created ${categories.length} categories`);
  return categories;
}

async function seedCourses(categories, admin) {
  console.log('🎓 Seeding courses...');
  
  const courses = [];
  const courseTags = [];
  
  // Create course tags first
  const tagNames = ['beginner', 'intermediate', 'advanced', 'popular', 'trending', 'certification'];
  for (const tagName of tagNames) {
    const tag = await prisma.courseTag.create({
      data: {
        name: tagName,
        slug: tagName
      }
    });
    courseTags.push(tag);
  }
  
  // Create courses
  for (let i = 0; i < 24; i++) {
    const category = getRandomElement(categories);
    const courseTitle = `${getRandomElement(SAMPLE_DATA.courseTitles)} ${i + 1}`;
    
    const course = await prisma.course.create({
      data: {
        title: courseTitle,
        slug: courseTitle.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
        description: `Comprehensive course covering all aspects of ${courseTitle.toLowerCase()}. Perfect for beginners and intermediate learners looking to advance their skills.`,
        shortDescription: `Learn ${courseTitle.toLowerCase()} from scratch to advanced level.`,
        thumbnail: `https://images.unsplash.com/photo-${1500000000 + i}?w=300&h=200&fit=crop`,
        objectives: [
          'Master fundamental concepts',
          'Build practical projects',
          'Prepare for real-world applications',
          'Develop professional skills'
        ],
        prerequisites: Math.random() > 0.5 ? ['Basic computer skills', 'High school mathematics'] : [],
        targetAudience: ['Beginners', 'Career changers', 'Students'],
        categoryId: category.id,
        createdById: admin.id,
        level: getRandomElement(['BEGINNER', 'INTERMEDIATE', 'ADVANCED']),
        difficulty: Math.floor(Math.random() * 10) + 1,
        estimatedHours: 10 + Math.floor(Math.random() * 40),
        status: 'PUBLISHED',
        isPublished: true,
        publishedAt: new Date(Date.now() - Math.floor(Math.random() * 365 * 24 * 60 * 60 * 1000)),
        isPremium: Math.random() > 0.7,
        price: Math.random() > 0.7 ? 29.99 + Math.floor(Math.random() * 200) : null,
        enrollmentCount: Math.floor(Math.random() * 500),
        completionRate: 0.6 + (Math.random() * 0.35),
        averageRating: 3.5 + (Math.random() * 1.5),
        totalReviews: Math.floor(Math.random() * 100),
        tags: {
          connect: getRandomElements(courseTags, 1 + Math.floor(Math.random() * 3)).map(tag => ({ id: tag.id }))
        }
      }
    });
    courses.push(course);
  }
  
  console.log(`✅ Created ${courses.length} courses`);
  return courses;
}

async function seedLessons(courses, admin) {
  console.log('📖 Seeding lessons...');
  
  const lessons = [];
  
  for (const course of courses) {
    const lessonCount = 5 + Math.floor(Math.random() * 10); // 5-15 lessons per course
    
    for (let i = 0; i < lessonCount; i++) {
      const lesson = await prisma.lesson.create({
        data: {
          courseId: course.id,
          createdById: admin.id,
          title: `Lesson ${i + 1}: Introduction to Core Concepts`,
          slug: `lesson-${i + 1}-core-concepts`,
          description: `In this lesson, you'll learn the fundamental concepts that form the foundation of this subject area.`,
          content: `<h2>Learning Objectives</h2>
<ul>
  <li>Understand key terminology and concepts</li>
  <li>Apply theoretical knowledge to practical examples</li>
  <li>Complete hands-on exercises</li>
</ul>

<h2>Content Overview</h2>
<p>This lesson covers essential topics that you'll need to master before moving on to more advanced subjects.</p>

<h2>Key Takeaways</h2>
<p>By the end of this lesson, you'll have a solid understanding of the fundamental principles.</p>`,
          chapterNumber: Math.floor(i / 3) + 1,
          lessonNumber: (i % 3) + 1,
          duration: 10 + Math.floor(Math.random() * 30), // 10-40 minutes
          videoUrl: Math.random() > 0.3 ? `https://videos.example.com/lesson-${course.id}-${i + 1}` : null,
          audioUrl: Math.random() > 0.8 ? `https://audio.example.com/lesson-${course.id}-${i + 1}` : null,
          documentUrl: Math.random() > 0.6 ? `https://docs.example.com/lesson-${course.id}-${i + 1}.pdf` : null,
          slides: Math.random() > 0.5 ? {
            slides: [
              { title: 'Introduction', content: 'Welcome to this lesson' },
              { title: 'Main Content', content: 'Key concepts and examples' },
              { title: 'Summary', content: 'Recap and next steps' }
            ]
          } : null,
          quiz: Math.random() > 0.4 ? {
            questions: [
              {
                question: 'What is the main concept covered in this lesson?',
                options: ['Option A', 'Option B', 'Option C', 'Option D'],
                correctAnswer: 0,
                explanation: 'This is the correct answer because...'
              }
            ]
          } : null,
          assignments: Math.random() > 0.6 ? {
            assignments: [
              {
                title: 'Practice Exercise',
                description: 'Complete the following task to reinforce your learning',
                dueDate: null,
                points: 10
              }
            ]
          } : null,
          resources: {
            links: [
              { title: 'Additional Reading', url: 'https://example.com/reading' },
              { title: 'Practice Exercises', url: 'https://example.com/exercises' }
            ]
          },
          isPublished: true,
          isPreview: i === 0, // First lesson is always preview
          sortOrder: i
        }
      });
      lessons.push(lesson);
    }
  }
  
  console.log(`✅ Created ${lessons.length} lessons`);
  return lessons;
}

async function seedEnrollmentsAndProgress(courses, students, lessons) {
  console.log('📝 Seeding enrollments and progress...');
  
  let enrollmentCount = 0;
  let progressCount = 0;
  
  // Each student enrolls in 1-5 random courses
  for (const student of students) {
    const enrolledCourses = getRandomElements(courses, 1 + Math.floor(Math.random() * 4));
    
    for (const course of enrolledCourses) {
      const enrollment = await prisma.enrollment.create({
        data: {
          userId: student.id,
          courseId: course.id,
          status: getRandomElement(['ACTIVE', 'COMPLETED', 'PAUSED']),
          progress: Math.random() * 100,
          enrolledAt: new Date(Date.now() - Math.floor(Math.random() * 90 * 24 * 60 * 60 * 1000)),
          startedAt: new Date(Date.now() - Math.floor(Math.random() * 80 * 24 * 60 * 60 * 1000)),
          completedAt: Math.random() > 0.7 ? new Date() : null,
          lastAccessedAt: new Date(Date.now() - Math.floor(Math.random() * 7 * 24 * 60 * 60 * 1000))
        }
      });
      enrollmentCount++;
      
      // Create lesson progress for some lessons
      const courseLessons = lessons.filter(l => l.courseId === course.id);
      const progressLessons = getRandomElements(courseLessons, Math.floor(courseLessons.length * 0.6));
      
      for (const lesson of progressLessons) {
        await prisma.lessonProgress.create({
          data: {
            userId: student.id,
            lessonId: lesson.id,
            status: getRandomElement(['IN_PROGRESS', 'COMPLETED', 'SKIPPED']),
            progressPercent: Math.random() * 100,
            timeSpent: Math.floor(Math.random() * 3600), // 0-1 hour in seconds
            watchTime: Math.floor(Math.random() * 2400), // 0-40 minutes
            quizScores: lesson.quiz ? { scores: [85 + Math.floor(Math.random() * 15)] } : null,
            startedAt: new Date(Date.now() - Math.floor(Math.random() * 30 * 24 * 60 * 60 * 1000)),
            completedAt: Math.random() > 0.3 ? new Date() : null,
            lastAccessedAt: new Date()
          }
        });
        progressCount++;
      }
    }
  }
  
  console.log(`✅ Created ${enrollmentCount} enrollments and ${progressCount} progress records`);
}

async function seedMentorshipData(mentors, students) {
  console.log('🤝 Seeding mentorship data...');
  
  let requestCount = 0;
  let sessionCount = 0;
  
  // Create mentorship requests
  for (let i = 0; i < 30; i++) {
    const student = getRandomElement(students);
    const mentor = getRandomElement(mentors);
    
    const request = await prisma.mentorshipRequest.create({
      data: {
        studentId: student.id,
        mentorId: mentor.id,
        subject: getRandomElement([
          'Career Transition Guidance',
          'Technical Interview Preparation',
          'Portfolio Review',
          'Skill Development Planning',
          'Job Search Strategy',
          'Leadership Development'
        ]),
        description: 'I would like to schedule a mentorship session to discuss my career goals and get guidance on next steps.',
        preferredTime: new Date(Date.now() + Math.floor(Math.random() * 30 * 24 * 60 * 60 * 1000)),
        status: getRandomElement(['PENDING', 'ACCEPTED', 'DECLINED', 'COMPLETED']),
        priority: getRandomElement(['LOW', 'MEDIUM', 'HIGH']),
        mentorResponse: Math.random() > 0.5 ? 'I would be happy to help you with your career goals.' : null,
        respondedAt: Math.random() > 0.5 ? new Date() : null
      }
    });
    requestCount++;
    
    // Create sessions for accepted requests
    if (request.status === 'ACCEPTED' || request.status === 'COMPLETED') {
      const session = await prisma.mentorshipSession.create({
        data: {
          requestId: request.id,
          studentId: student.id,
          mentorId: mentor.id,
          title: request.subject,
          description: 'Mentorship session based on the request',
          scheduledAt: new Date(Date.now() + Math.floor(Math.random() * 14 * 24 * 60 * 60 * 1000)),
          duration: 30 + Math.floor(Math.random() * 60), // 30-90 minutes
          status: getRandomElement(['SCHEDULED', 'COMPLETED', 'CANCELLED']),
          sessionType: getRandomElement(['VIDEO_CALL', 'PHONE_CALL', 'CHAT_ONLY']),
          meetingUrl: 'https://meet.google.com/abc-defg-hij',
          actualStartTime: Math.random() > 0.3 ? new Date() : null,
          actualEndTime: Math.random() > 0.3 ? new Date() : null,
          notes: Math.random() > 0.4 ? 'Great session! The student showed excellent progress.' : null,
          mentorFeedback: Math.random() > 0.5 ? 'Student was well-prepared and engaged throughout the session.' : null,
          studentFeedback: Math.random() > 0.5 ? 'Very helpful session. Got clear guidance on next steps.' : null,
          rating: Math.random() > 0.3 ? 4 + Math.floor(Math.random() * 2) : null
        }
      });
      sessionCount++;
    }
  }
  
  console.log(`✅ Created ${requestCount} mentorship requests and ${sessionCount} sessions`);
}

async function seedInterviewSessions(students) {
  console.log('💼 Seeding interview sessions...');
  
  const sessions = [];
  
  for (let i = 0; i < 40; i++) {
    const student = getRandomElement(students);
    const session = await prisma.interviewSession.create({
      data: {
        userId: student.id,
        title: `Mock Interview Session ${i + 1}`,
        jobRole: getRandomElement(SAMPLE_DATA.jobTitles),
        company: Math.random() > 0.3 ? getRandomElement(SAMPLE_DATA.companies) : null,
        difficulty: getRandomElement(['EASY', 'MEDIUM', 'HARD']),
        interviewType: getRandomElement(['TECHNICAL', 'BEHAVIORAL', 'MIXED']),
        duration: 30 + Math.floor(Math.random() * 60),
        questionCount: 5 + Math.floor(Math.random() * 10),
        aiModel: 'gemini',
        questions: {
          questions: [
            { question: 'Tell me about yourself', type: 'behavioral', timeLimit: 120 },
            { question: 'What are your strengths?', type: 'behavioral', timeLimit: 90 },
            { question: 'Describe a challenging project', type: 'situational', timeLimit: 180 }
          ]
        },
        responses: Math.random() > 0.3 ? {
          responses: [
            { questionId: 1, answer: 'I am a passionate developer...', duration: 115 },
            { questionId: 2, answer: 'My key strengths include...', duration: 85 }
          ]
        } : null,
        feedback: Math.random() > 0.3 ? {
          overall: 'Good performance with room for improvement',
          strengths: ['Clear communication', 'Technical knowledge'],
          improvements: ['More specific examples', 'Confidence in presentation']
        } : null,
        overallScore: Math.random() > 0.3 ? 60 + Math.random() * 35 : null,
        skillScores: Math.random() > 0.3 ? {
          communication: 75,
          technical: 80,
          problemSolving: 70,
          leadership: 65
        } : null,
        status: getRandomElement(['SCHEDULED', 'IN_PROGRESS', 'COMPLETED']),
        startedAt: Math.random() > 0.3 ? new Date(Date.now() - Math.floor(Math.random() * 30 * 24 * 60 * 60 * 1000)) : null,
        completedAt: Math.random() > 0.5 ? new Date() : null,
        strengths: ['Technical competence', 'Communication skills'],
        improvements: ['Provide more specific examples', 'Show more enthusiasm'],
        recommendations: ['Practice STAR method', 'Research company background']
      }
    });
    sessions.push(session);
  }
  
  console.log(`✅ Created ${sessions.length} interview sessions`);
}

async function seedNotifications(students, mentors) {
  console.log('🔔 Seeding notifications...');
  
  const allUsers = [...students, ...mentors];
  const notifications = [];
  
  for (let i = 0; i < 100; i++) {
    const user = getRandomElement(allUsers);
    const notification = await prisma.notification.create({
      data: {
        userId: user.id,
        type: getRandomElement([
          'SYSTEM', 'COURSE_REMINDER', 'MENTORSHIP_REQUEST', 
          'INTERVIEW_REMINDER', 'ACHIEVEMENT_UNLOCKED', 'PROGRESS_UPDATE'
        ]),
        title: getRandomElement([
          'Welcome to Career Disha!',
          'New Mentorship Request',
          'Course Reminder',
          'Achievement Unlocked',
          'Interview Session Scheduled',
          'Progress Update'
        ]),
        message: 'This is a sample notification message with relevant details.',
        data: { additionalInfo: 'Sample data' },
        isRead: Math.random() > 0.4,
        readAt: Math.random() > 0.4 ? new Date() : null,
        channels: getRandomElements(['IN_APP', 'EMAIL'], 1 + Math.floor(Math.random() * 2)),
        priority: getRandomElement(['LOW', 'MEDIUM', 'HIGH']),
        sentAt: new Date(),
        category: getRandomElement(['system', 'learning', 'mentorship', 'career']),
        tags: getRandomElements(['important', 'urgent', 'info', 'reminder'], Math.floor(Math.random() * 3))
      }
    });
    notifications.push(notification);
  }
  
  console.log(`✅ Created ${notifications.length} notifications`);
}

async function seedSettings() {
  console.log('⚙️ Seeding system settings...');
  
  const settings = [
    { key: 'platform_name', value: 'Career Disha', type: 'STRING', description: 'Platform name', category: 'general', isPublic: true },
    { key: 'max_enrollment_per_user', value: '10', type: 'INTEGER', description: 'Maximum course enrollments per user', category: 'learning' },
    { key: 'session_timeout_minutes', value: '30', type: 'INTEGER', description: 'Session timeout in minutes', category: 'security' },
    { key: 'enable_email_notifications', value: 'true', type: 'BOOLEAN', description: 'Enable email notifications', category: 'notifications', isPublic: true },
    { key: 'maintenance_mode', value: 'false', type: 'BOOLEAN', description: 'Maintenance mode status', category: 'system' },
    { key: 'default_course_price', value: '49.99', type: 'FLOAT', description: 'Default course price', category: 'pricing' },
    { key: 'supported_languages', value: JSON.stringify(['en', 'es', 'fr']), type: 'JSON', description: 'Supported languages', category: 'i18n', isPublic: true }
  ];
  
  for (const setting of settings) {
    await prisma.setting.create({
      data: {
        key: setting.key,
        value: setting.value,
        type: setting.type,
        description: setting.description,
        category: setting.category,
        isPublic: setting.isPublic || false,
        isEditable: true
      }
    });
  }
  
  console.log(`✅ Created ${settings.length} system settings`);
}

async function main() {
  try {
    console.log('🚀 Starting database seeding...');
    console.log('='.repeat(50));
    
    // Clear existing data
    await clearDatabase();
    
    // Seed data in order
    const { admin, mentors, students } = await seedUsers();
    const categories = await seedCategories();
    const courses = await seedCourses(categories, admin);
    const lessons = await seedLessons(courses, admin);
    
    await seedEnrollmentsAndProgress(courses, students, lessons);
    await seedMentorshipData(mentors, students);
    await seedInterviewSessions(students);
    await seedNotifications(students, mentors);
    await seedSettings();
    
    console.log('='.repeat(50));
    console.log('🎉 Database seeding completed successfully!');
    console.log('');
    console.log('📊 Summary:');
    console.log(`   • ${mentors.length} mentors created`);
    console.log(`   • ${students.length} students created`);
    console.log(`   • ${categories.length} categories created`);
    console.log(`   • ${courses.length} courses created`);
    console.log(`   • ${lessons.length} lessons created`);
    console.log('   • Enrollments, progress, mentorship data, and notifications seeded');
    console.log('');
    console.log('🔑 Test Accounts:');
    console.log('   Admin: admin@careerdisha.com / password123');
    console.log('   Mentor: mentor1@careerdisha.com / password123');
    console.log('   Student: student1@example.com / password123');
    
  } catch (error) {
    console.error('❌ Error seeding database:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

// Run the seeding
main();