const express = require('express');
const prisma = require('../config/prisma');

const router = express.Router();

// Mock data structure for constellation graph
// In production, this would come from external APIs or a dedicated database
const CAREER_DATA = {
  skills: {
    // Programming Skills
    "javascript": { 
      type: "technical", 
      demand: 95, 
      avgSalary: 75000, 
      growthRate: 15,
      relatedSkills: ["react", "node-js", "typescript"],
      industries: ["software", "fintech", "e-commerce"],
      experienceLevel: "beginner"
    },
    "python": { 
      type: "technical", 
      demand: 90, 
      avgSalary: 85000, 
      growthRate: 20,
      relatedSkills: ["machine-learning", "data-analysis", "django"],
      industries: ["ai-ml", "data-science", "web-development"],
      experienceLevel: "beginner"
    },
    "react": { 
      type: "technical", 
      demand: 88, 
      avgSalary: 80000, 
      growthRate: 12,
      relatedSkills: ["javascript", "html-css", "redux"],
      industries: ["frontend", "mobile-app", "e-commerce"],
      experienceLevel: "intermediate"
    },
    "machine-learning": { 
      type: "technical", 
      demand: 85, 
      avgSalary: 110000, 
      growthRate: 25,
      relatedSkills: ["python", "statistics", "data-analysis"],
      industries: ["ai-ml", "healthcare", "finance"],
      experienceLevel: "advanced"
    },
    "cloud-computing": { 
      type: "technical", 
      demand: 92, 
      avgSalary: 95000, 
      growthRate: 18,
      relatedSkills: ["aws", "docker", "kubernetes"],
      industries: ["devops", "enterprise", "startups"],
      experienceLevel: "intermediate"
    },
    // Soft Skills
    "leadership": { 
      type: "soft", 
      demand: 80, 
      avgSalary: 120000, 
      growthRate: 8,
      relatedSkills: ["communication", "project-management", "team-building"],
      industries: ["management", "consulting", "all"],
      experienceLevel: "advanced"
    },
    "communication": { 
      type: "soft", 
      demand: 95, 
      avgSalary: 65000, 
      growthRate: 5,
      relatedSkills: ["presentation", "writing", "negotiation"],
      industries: ["all"],
      experienceLevel: "beginner"
    },
    "project-management": { 
      type: "soft", 
      demand: 85, 
      avgSalary: 90000, 
      growthRate: 10,
      relatedSkills: ["leadership", "planning", "risk-management"],
      industries: ["consulting", "construction", "it"],
      experienceLevel: "intermediate"
    }
  },
  
  careerPaths: {
    "software-developer": {
      title: "Software Developer",
      avgSalary: 78000,
      growthRate: 22,
      requiredSkills: ["javascript", "python", "react"],
      optionalSkills: ["cloud-computing", "machine-learning"],
      industries: ["software", "fintech", "healthcare"],
      experienceLevel: "entry",
      educationPaths: ["computer-science", "bootcamp", "self-taught"],
      nextRoles: ["senior-developer", "tech-lead", "product-manager"]
    },
    "data-scientist": {
      title: "Data Scientist",
      avgSalary: 105000,
      growthRate: 31,
      requiredSkills: ["python", "machine-learning", "statistics"],
      optionalSkills: ["cloud-computing", "communication"],
      industries: ["ai-ml", "healthcare", "finance"],
      experienceLevel: "intermediate",
      educationPaths: ["data-science", "mathematics", "computer-science"],
      nextRoles: ["senior-data-scientist", "ml-engineer", "data-architect"]
    },
    "product-manager": {
      title: "Product Manager",
      avgSalary: 115000,
      growthRate: 19,
      requiredSkills: ["communication", "leadership", "project-management"],
      optionalSkills: ["javascript", "data-analysis"],
      industries: ["tech", "consulting", "startup"],
      experienceLevel: "intermediate",
      educationPaths: ["business", "engineering", "design"],
      nextRoles: ["senior-pm", "director-product", "cpo"]
    },
    "fullstack-developer": {
      title: "Full Stack Developer",
      avgSalary: 85000,
      growthRate: 20,
      requiredSkills: ["javascript", "react", "node-js", "databases"],
      optionalSkills: ["cloud-computing", "devops"],
      industries: ["web-development", "e-commerce", "startups"],
      experienceLevel: "intermediate",
      educationPaths: ["computer-science", "bootcamp"],
      nextRoles: ["senior-fullstack", "tech-lead", "solution-architect"]
    }
  },
  
  industries: {
    "software": { demand: 95, growthRate: 18, avgSalary: 85000 },
    "ai-ml": { demand: 88, growthRate: 35, avgSalary: 120000 },
    "fintech": { demand: 85, growthRate: 25, avgSalary: 105000 },
    "healthcare": { demand: 82, growthRate: 15, avgSalary: 90000 },
    "e-commerce": { demand: 90, growthRate: 20, avgSalary: 80000 },
    "consulting": { demand: 75, growthRate: 8, avgSalary: 110000 }
  }
};

// GET /api/v1/constellation/skills - Get skills constellation data
router.get('/skills', async (req, res) => {
  try {
    const { 
      filter, // technical, soft, all
      minDemand = 0,
      maxSalary,
      minSalary,
      experienceLevel,
      industry,
      limit = 50
    } = req.query;

    let skills = Object.entries(CAREER_DATA.skills);

    // Apply filters
    if (filter && filter !== 'all') {
      skills = skills.filter(([_, skill]) => skill.type === filter);
    }

    if (minDemand > 0) {
      skills = skills.filter(([_, skill]) => skill.demand >= parseInt(minDemand));
    }

    if (minSalary) {
      skills = skills.filter(([_, skill]) => skill.avgSalary >= parseInt(minSalary));
    }

    if (maxSalary) {
      skills = skills.filter(([_, skill]) => skill.avgSalary <= parseInt(maxSalary));
    }

    if (experienceLevel) {
      skills = skills.filter(([_, skill]) => skill.experienceLevel === experienceLevel);
    }

    if (industry) {
      skills = skills.filter(([_, skill]) => skill.industries.includes(industry));
    }

    // Limit results
    skills = skills.slice(0, parseInt(limit));

    // Transform to node format for graph visualization
    const nodes = skills.map(([skillName, skillData]) => ({
      id: skillName,
      label: skillName.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
      type: 'skill',
      category: skillData.type,
      demand: skillData.demand,
      avgSalary: skillData.avgSalary,
      growthRate: skillData.growthRate,
      size: Math.max(10, skillData.demand / 5), // Node size based on demand
      color: skillData.type === 'technical' ? '#4F46E5' : '#10B981',
      metadata: skillData
    }));

    // Generate edges (connections between related skills)
    const edges = [];
    skills.forEach(([skillName, skillData]) => {
      if (skillData.relatedSkills) {
        skillData.relatedSkills.forEach(relatedSkill => {
          if (skills.find(([name]) => name === relatedSkill)) {
            edges.push({
              source: skillName,
              target: relatedSkill,
              weight: 0.8,
              type: 'related'
            });
          }
        });
      }
    });

    res.json({
      graph: {
        nodes: nodes,
        edges: edges
      },
      metadata: {
        totalSkills: Object.keys(CAREER_DATA.skills).length,
        filtered: nodes.length,
        filters: {
          filter,
          minDemand,
          minSalary,
          maxSalary,
          experienceLevel,
          industry
        }
      }
    });

  } catch (error) {
    console.error('Skills constellation error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/v1/constellation/career-paths - Get career paths constellation
router.get('/career-paths', async (req, res) => {
  try {
    const { 
      minSalary,
      maxSalary,
      industry,
      experienceLevel,
      requiredSkills,
      limit = 20
    } = req.query;

    let careerPaths = Object.entries(CAREER_DATA.careerPaths);

    // Apply filters
    if (minSalary) {
      careerPaths = careerPaths.filter(([_, path]) => path.avgSalary >= parseInt(minSalary));
    }

    if (maxSalary) {
      careerPaths = careerPaths.filter(([_, path]) => path.avgSalary <= parseInt(maxSalary));
    }

    if (industry) {
      careerPaths = careerPaths.filter(([_, path]) => path.industries.includes(industry));
    }

    if (experienceLevel) {
      careerPaths = careerPaths.filter(([_, path]) => path.experienceLevel === experienceLevel);
    }

    if (requiredSkills) {
      const skillsArray = requiredSkills.split(',');
      careerPaths = careerPaths.filter(([_, path]) => 
        skillsArray.some(skill => path.requiredSkills.includes(skill))
      );
    }

    careerPaths = careerPaths.slice(0, parseInt(limit));

    // Transform to nodes
    const nodes = careerPaths.map(([pathId, pathData]) => ({
      id: pathId,
      label: pathData.title,
      type: 'career',
      avgSalary: pathData.avgSalary,
      growthRate: pathData.growthRate,
      experienceLevel: pathData.experienceLevel,
      size: Math.max(15, pathData.avgSalary / 4000), // Node size based on salary
      color: '#F59E0B',
      metadata: pathData
    }));

    // Add skill nodes that connect to careers
    const skillNodes = new Set();
    careerPaths.forEach(([_, pathData]) => {
      pathData.requiredSkills.forEach(skill => skillNodes.add(skill));
      if (pathData.optionalSkills) {
        pathData.optionalSkills.forEach(skill => skillNodes.add(skill));
      }
    });

    // Add skill nodes to the graph
    Array.from(skillNodes).forEach(skillName => {
      if (CAREER_DATA.skills[skillName]) {
        const skillData = CAREER_DATA.skills[skillName];
        nodes.push({
          id: `skill-${skillName}`,
          label: skillName.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
          type: 'skill',
          category: skillData.type,
          demand: skillData.demand,
          size: 8,
          color: skillData.type === 'technical' ? '#4F46E5' : '#10B981',
          metadata: skillData
        });
      }
    });

    // Generate edges (career -> skills, career -> next roles)
    const edges = [];
    careerPaths.forEach(([pathId, pathData]) => {
      // Connect careers to required skills
      pathData.requiredSkills.forEach(skill => {
        edges.push({
          source: pathId,
          target: `skill-${skill}`,
          weight: 1.0,
          type: 'requires'
        });
      });

      // Connect careers to optional skills
      if (pathData.optionalSkills) {
        pathData.optionalSkills.forEach(skill => {
          edges.push({
            source: pathId,
            target: `skill-${skill}`,
            weight: 0.5,
            type: 'optional'
          });
        });
      }

      // Connect to next roles if they exist in our data
      if (pathData.nextRoles) {
        pathData.nextRoles.forEach(nextRole => {
          if (careerPaths.find(([id]) => id === nextRole)) {
            edges.push({
              source: pathId,
              target: nextRole,
              weight: 0.8,
              type: 'progression'
            });
          }
        });
      }
    });

    res.json({
      graph: {
        nodes: nodes,
        edges: edges
      },
      metadata: {
        totalCareerPaths: Object.keys(CAREER_DATA.careerPaths).length,
        filtered: careerPaths.length,
        connectedSkills: skillNodes.size,
        filters: {
          minSalary,
          maxSalary,
          industry,
          experienceLevel,
          requiredSkills
        }
      }
    });

  } catch (error) {
    console.error('Career paths constellation error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/v1/constellation/personalized - Get personalized constellation for user
router.get('/personalized', async (req, res) => {
  try {
    const userId = req.user.id;

    // Get user profile and data
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        profile: true,
        interviews: {
          where: { status: 'completed' },
          orderBy: { completedAt: 'desc' },
          take: 1
        },
        recommendations: {
          where: { status: { in: ['pending', 'in_progress'] } },
          take: 5
        }
      }
    });

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Extract user skills and interests
    const userSkills = user.profile?.skills || [];
    const userInterests = user.profile?.interests || [];
    const profileTags = user.interviews[0]?.profileTags || [];

    // Get relevant skills based on user profile
    const relevantSkills = Object.entries(CAREER_DATA.skills).filter(([skillName, skillData]) => {
      // Include user's current skills
      if (userSkills.some(userSkill => 
        userSkill.toLowerCase().includes(skillName.replace(/-/g, '')) ||
        skillName.replace(/-/g, '').includes(userSkill.toLowerCase())
      )) {
        return true;
      }

      // Include skills from profile tags
      if (profileTags.some(tag => 
        tag.toLowerCase().includes(skillName.replace(/-/g, '')) ||
        skillName.replace(/-/g, '').includes(tag.toLowerCase())
      )) {
        return true;
      }

      // Include related skills
      return userSkills.some(userSkill => 
        skillData.relatedSkills?.some(relatedSkill =>
          relatedSkill.includes(userSkill.toLowerCase()) ||
          userSkill.toLowerCase().includes(relatedSkill)
        )
      );
    });

    // Get relevant career paths
    const relevantCareerPaths = Object.entries(CAREER_DATA.careerPaths).filter(([pathId, pathData]) => {
      // Match with user skills
      const skillMatch = pathData.requiredSkills.some(requiredSkill =>
        userSkills.some(userSkill => 
          userSkill.toLowerCase().includes(requiredSkill.replace(/-/g, '')) ||
          requiredSkill.includes(userSkill.toLowerCase())
        )
      );

      // Match with user interests (industries)
      const interestMatch = userInterests.some(interest =>
        pathData.industries.some(industry =>
          industry.toLowerCase().includes(interest.toLowerCase()) ||
          interest.toLowerCase().includes(industry)
        )
      );

      return skillMatch || interestMatch;
    });

    // Build personalized graph
    const nodes = [];
    const edges = [];

    // Add user node at center
    nodes.push({
      id: 'user',
      label: 'You',
      type: 'user',
      size: 20,
      color: '#EF4444',
      metadata: {
        skills: userSkills,
        interests: userInterests,
        profileTags: profileTags
      }
    });

    // Add skill nodes
    relevantSkills.forEach(([skillName, skillData]) => {
      const isUserSkill = userSkills.some(userSkill => 
        userSkill.toLowerCase().includes(skillName.replace(/-/g, '')) ||
        skillName.replace(/-/g, '').includes(userSkill.toLowerCase())
      );

      nodes.push({
        id: skillName,
        label: skillName.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
        type: 'skill',
        category: skillData.type,
        owned: isUserSkill,
        demand: skillData.demand,
        avgSalary: skillData.avgSalary,
        size: isUserSkill ? 12 : 8,
        color: isUserSkill ? '#059669' : (skillData.type === 'technical' ? '#4F46E5' : '#10B981'),
        metadata: skillData
      });

      // Connect user to their skills
      if (isUserSkill) {
        edges.push({
          source: 'user',
          target: skillName,
          weight: 1.0,
          type: 'owns'
        });
      }
    });

    // Add career path nodes
    relevantCareerPaths.forEach(([pathId, pathData]) => {
      nodes.push({
        id: pathId,
        label: pathData.title,
        type: 'career',
        avgSalary: pathData.avgSalary,
        growthRate: pathData.growthRate,
        experienceLevel: pathData.experienceLevel,
        size: 15,
        color: '#F59E0B',
        metadata: pathData
      });

      // Connect careers to skills
      pathData.requiredSkills.forEach(skill => {
        if (relevantSkills.find(([name]) => name === skill)) {
          edges.push({
            source: pathId,
            target: skill,
            weight: 1.0,
            type: 'requires'
          });
        }
      });
    });

    // Add recommendations as nodes
    user.recommendations.forEach(rec => {
      nodes.push({
        id: `rec-${rec.id}`,
        label: rec.title,
        type: 'recommendation',
        priority: rec.priority,
        size: rec.priority === 'high' ? 10 : 8,
        color: '#8B5CF6',
        metadata: {
          description: rec.description,
          type: rec.type,
          priority: rec.priority
        }
      });

      edges.push({
        source: 'user',
        target: `rec-${rec.id}`,
        weight: 0.7,
        type: 'recommended'
      });
    });

    res.json({
      graph: {
        nodes: nodes,
        edges: edges
      },
      userContext: {
        skills: userSkills,
        interests: userInterests,
        profileTags: profileTags,
        recommendations: user.recommendations.length
      },
      insights: {
        totalSkillsInGraph: relevantSkills.length,
        ownedSkills: relevantSkills.filter(([name]) => 
          nodes.find(n => n.id === name && n.owned)
        ).length,
        availableCareerPaths: relevantCareerPaths.length,
        activeRecommendations: user.recommendations.length
      }
    });

  } catch (error) {
    console.error('Personalized constellation error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/v1/constellation/industries - Get industry data
router.get('/industries', async (req, res) => {
  try {
    const industries = Object.entries(CAREER_DATA.industries).map(([industryId, data]) => ({
      id: industryId,
      name: industryId.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
      demand: data.demand,
      growthRate: data.growthRate,
      avgSalary: data.avgSalary,
      size: Math.max(10, data.demand / 5),
      color: '#6366F1'
    }));

    res.json({
      industries: industries,
      metadata: {
        totalIndustries: industries.length,
        highGrowth: industries.filter(i => i.growthRate > 20).length,
        highDemand: industries.filter(i => i.demand > 85).length
      }
    });

  } catch (error) {
    console.error('Industries constellation error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;