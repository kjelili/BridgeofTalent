export interface User {
  id: string;
  email: string;
  name: string;
  role: 'freelancer' | 'client';
  avatar?: string;
  subscriptionTier: string;
  verificationLevel: string;
}

export interface FreelancerProfile extends User {
  title: string;
  bio: string;
  location: string;
  hourlyRate: number;
  skills: string[];
  verifiedSkills: string[];
  rating: number;
  reviewCount: number;
  jssScore: number;
  totalEarnings: number;
  availabilityStatus: string;
  weeklyHours: number;
  identityVerified: boolean;
  topRated: boolean;
  portfolio?: PortfolioItem[];
}

export interface PortfolioItem {
  id: string;
  title: string;
  description: string;
  link?: string;
  imageUrl?: string;
}

export interface JobPost {
  id: string;
  clientId: string;
  clientName: string;
  title: string;
  description: string;
  skills: string[];
  budgetMin: number;
  budgetMax: number;
  budgetType: 'fixed' | 'hourly';
  category: string;
  location: string;
  teamSize: number;
  status: 'open' | 'closed' | 'draft';
  deadline?: string;
  createdAt: string;
  matchScore?: number;
}

export interface Bid {
  id: string;
  jobId: string;
  freelancerId: string;
  freelancerName: string;
  freelancerAvatar?: string;
  freelancerRating?: number;
  amount: number;
  message: string;
  timeline: string;
  status: 'pending' | 'accepted' | 'rejected';
  createdAt: string;
}

export interface Project {
  id: string;
  clientId: string;
  clientName: string;
  title: string;
  description: string;
  budget: number;
  category: string;
  status: 'active' | 'completed' | 'disputed';
  escrowReleased: boolean;
  teamMembers: TeamMember[];
  milestones: Milestone[];
  createdAt: string;
}

export interface TeamMember {
  id: string;
  name: string;
  title: string;
  avatar?: string;
  hourlyRate: number;
}

export interface Milestone {
  id: string;
  title: string;
  description: string;
  amount: number;
  dueDate?: string;
  status: 'pending' | 'funded' | 'in_progress' | 'submitted' | 'approved' | 'disputed';
  deliverables: string[];
  completedAt?: string;
}

export interface EscrowAccount {
  id: string;
  projectId: string;
  totalAmount: number;
  platformFee: number;
  freelancerPayout: number;
  status: 'pending' | 'held' | 'released' | 'refunded' | 'disputed';
}

export interface Review {
  id: string;
  freelancerId: string;
  clientName: string;
  rating: number;
  comment: string;
  createdAt: string;
}

export interface NotificationItem {
  id: string;
  type: string;
  title: string;
  message: string;
  read: boolean;
  actionUrl?: string;
  createdAt: string;
}

export interface SavedSearch {
  id: string;
  name: string;
  searchType: 'jobs' | 'freelancers';
  filters: Record<string, unknown>;
  alertFrequency: string;
}

export interface MatchResult {
  freelancerId: string;
  score: number;
  skillMatch: number;
  rateMatch: number;
  experienceMatch: number;
  availabilityMatch: number;
  aiReasoning: string;
}

export interface AIProposal {
  subject: string;
  body: string;
  suggestedRate: number;
  estimatedDuration: string;
  keyPoints: string[];
}

export interface SubscriptionTier {
  tier: string;
  monthlyProposalLimit: number;
  canSeeCompetitorBids: boolean;
  featuredProfile: boolean;
  prioritySupport: boolean;
  instantPayouts: boolean;
  aiProposalsPerMonth: number;
  teamMembersLimit: number;
  customBranding: boolean;
}

export interface Dispute {
  id: string;
  projectId: string;
  raisedBy: string;
  reason: string;
  evidence: string[];
  status: string;
  resolution?: string;
  createdAt: string;
}
