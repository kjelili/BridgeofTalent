// Generated types from Supabase schema
// Run: npm run db:generate

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          email: string;
          name: string;
          role: 'freelancer' | 'client';
          company: string;
          avatar_url: string;
          timezone: string;
          language: string;
          subscription_tier: 'free' | 'plus' | 'pro' | 'enterprise';
          verification_level: 'none' | 'email' | 'identity' | 'skill_tested' | 'expert_vetted';
          onboarding_completed: boolean;
          last_active_at: string;
          referral_code: string;
          referred_by: string | null;
          created_at: string;
        };
        Insert: Omit<Database['public']['Tables']['profiles']['Row'], 'created_at' | 'referral_code'>;
        Update: Partial<Database['public']['Tables']['profiles']['Insert']>;
      };
      freelancers: {
        Row: {
          id: string;
          title: string;
          location: string;
          hourly_rate: number;
          rating: number;
          review_count: number;
          skills: string[];
          verified_skills: string[];
          bio: string;
          status: string;
          avatar: string;
          identity_verified: boolean;
          top_rated: boolean;
          jss_score: number;
          total_earnings: number;
          total_hours_worked: number;
          availability_status: string;
          weekly_hours_available: number;
          preferred_project_types: string[];
          ai_match_score: number;
          embedding: number[] | null;
          created_at: string;
        };
      };
      jobs: {
        Row: {
          id: string;
          client_id: string;
          client_name: string;
          title: string;
          description: string;
          skills: string[];
          budget_min: number;
          budget_max: number;
          budget_type: 'fixed' | 'hourly';
          category: string;
          location: string;
          team_size: number;
          status: 'open' | 'closed' | 'draft';
          deadline: string | null;
          created_at: string;
        };
      };
      bids: {
        Row: {
          id: string;
          job_id: string;
          freelancer_id: string;
          freelancer_name: string;
          amount: number;
          message: string;
          timeline: string;
          status: 'pending' | 'accepted' | 'rejected';
          created_at: string;
        };
      };
      projects: {
        Row: {
          id: string;
          client_id: string;
          client_name: string;
          title: string;
          description: string;
          budget: number;
          category: string;
          status: 'active' | 'completed' | 'disputed';
          escrow_released: boolean;
          created_at: string;
        };
      };
      reviews: {
        Row: {
          id: string;
          freelancer_id: string;
          client_id: string;
          client_name: string;
          rating: number;
          comment: string;
          created_at: string;
        };
      };
      escrow_accounts: {
        Row: {
          id: string;
          project_id: string;
          client_id: string;
          total_amount: number;
          platform_fee: number;
          freelancer_payout: number;
          stripe_payment_intent_id: string;
          status: 'pending' | 'held' | 'released' | 'refunded' | 'disputed';
          created_at: string;
          released_at: string | null;
        };
      };
      milestones: {
        Row: {
          id: string;
          project_id: string;
          title: string;
          description: string;
          amount: number;
          due_date: string | null;
          status: 'pending' | 'funded' | 'in_progress' | 'submitted' | 'approved' | 'disputed';
          deliverables: string[];
          completed_at: string | null;
          created_at: string;
          sort_order: number;
        };
      };
      match_scores: {
        Row: {
          id: string;
          job_id: string;
          freelancer_id: string;
          score: number;
          skill_match: number;
          rate_match: number;
          experience_match: number;
          availability_match: number;
          ai_reasoning: string;
          created_at: string;
        };
      };
      notifications: {
        Row: {
          id: string;
          user_id: string;
          type: string;
          title: string;
          message: string;
          read: boolean;
          channel: 'in_app' | 'email' | 'push' | 'sms';
          action_url: string;
          expires_at: string | null;
          created_at: string;
        };
      };
      saved_searches: {
        Row: {
          id: string;
          user_id: string;
          name: string;
          search_type: 'jobs' | 'freelancers';
          filters: Json;
          alert_frequency: string;
          last_alert_sent_at: string | null;
          created_at: string;
        };
      };
      disputes: {
        Row: {
          id: string;
          project_id: string;
          raised_by: string;
          reason: string;
          evidence: string[];
          status: string;
          resolution: string;
          resolved_by: string | null;
          resolved_at: string | null;
          created_at: string;
        };
      };
    };
  };
}

export type Tables<T extends keyof Database['public']['Tables']> = Database['public']['Tables'][T]['Row'];
export type InsertTables<T extends keyof Database['public']['Tables']> = Database['public']['Tables'][T]['Insert'];
export type UpdateTables<T extends keyof Database['public']['Tables']> = Database['public']['Tables'][T]['Update'];

export type Profile = Tables<'profiles'>;
export type Freelancer = Tables<'freelancers'>;
export type Job = Tables<'jobs'>;
export type Bid = Tables<'bids'>;
export type Project = Tables<'projects'>;
export type Review = Tables<'reviews'>;
export type Escrow = Tables<'escrow_accounts'>;
export type Milestone = Tables<'milestones'>;
export type MatchScore = Tables<'match_scores'>;
export type Notification = Tables<'notifications'>;
export type SavedSearch = Tables<'saved_searches'>;
export type Dispute = Tables<'disputes'>;
