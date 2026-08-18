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
          stripe_customer_id: string | null;
          stripe_connect_id: string | null;
          created_at: string;
        };
        Insert: Partial<Database['public']['Tables']['profiles']['Row']>;
        Update: Partial<Database['public']['Tables']['profiles']['Row']>;
        Relationships: [
          {
            foreignKeyName: 'profiles_referred_by_fkey';
            columns: ['referred_by'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
        ];
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
        Insert: Partial<Database['public']['Tables']['freelancers']['Row']>;
        Update: Partial<Database['public']['Tables']['freelancers']['Row']>;
        Relationships: [
          {
            foreignKeyName: 'freelancers_id_fkey';
            columns: ['id'];
            isOneToOne: true;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
        ];
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
        Insert: Partial<Database['public']['Tables']['jobs']['Row']>;
        Update: Partial<Database['public']['Tables']['jobs']['Row']>;
        Relationships: [
          {
            foreignKeyName: 'jobs_client_id_fkey';
            columns: ['client_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
        ];
      };
      job_embeddings: {
        Row: {
          id: string;
          job_id: string;
          embedding: number[] | null;
          content: string;
          created_at: string;
        };
        Insert: Partial<Database['public']['Tables']['job_embeddings']['Row']>;
        Update: Partial<Database['public']['Tables']['job_embeddings']['Row']>;
        Relationships: [
          {
            foreignKeyName: 'job_embeddings_job_id_fkey';
            columns: ['job_id'];
            isOneToOne: false;
            referencedRelation: 'jobs';
            referencedColumns: ['id'];
          },
        ];
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
        Insert: Partial<Database['public']['Tables']['bids']['Row']>;
        Update: Partial<Database['public']['Tables']['bids']['Row']>;
        Relationships: [
          {
            foreignKeyName: 'bids_job_id_fkey';
            columns: ['job_id'];
            isOneToOne: false;
            referencedRelation: 'jobs';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'bids_freelancer_id_fkey';
            columns: ['freelancer_id'];
            isOneToOne: false;
            referencedRelation: 'freelancers';
            referencedColumns: ['id'];
          },
        ];
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
        Insert: Partial<Database['public']['Tables']['projects']['Row']>;
        Update: Partial<Database['public']['Tables']['projects']['Row']>;
        Relationships: [
          {
            foreignKeyName: 'projects_client_id_fkey';
            columns: ['client_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
        ];
      };
      project_members: {
        Row: {
          id: string;
          project_id: string;
          freelancer_id: string;
          role: string;
          created_at: string;
        };
        Insert: Partial<Database['public']['Tables']['project_members']['Row']>;
        Update: Partial<Database['public']['Tables']['project_members']['Row']>;
        Relationships: [
          {
            foreignKeyName: 'project_members_project_id_fkey';
            columns: ['project_id'];
            isOneToOne: false;
            referencedRelation: 'projects';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'project_members_freelancer_id_fkey';
            columns: ['freelancer_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
        ];
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
        Insert: Partial<Database['public']['Tables']['reviews']['Row']>;
        Update: Partial<Database['public']['Tables']['reviews']['Row']>;
        Relationships: [
          {
            foreignKeyName: 'reviews_freelancer_id_fkey';
            columns: ['freelancer_id'];
            isOneToOne: false;
            referencedRelation: 'freelancers';
            referencedColumns: ['id'];
          },
        ];
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
        Insert: Partial<Database['public']['Tables']['escrow_accounts']['Row']>;
        Update: Partial<Database['public']['Tables']['escrow_accounts']['Row']>;
        Relationships: [
          {
            foreignKeyName: 'escrow_accounts_project_id_fkey';
            columns: ['project_id'];
            isOneToOne: false;
            referencedRelation: 'projects';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'escrow_accounts_client_id_fkey';
            columns: ['client_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
        ];
      };
      transactions: {
        Row: {
          id: string;
          escrow_id: string | null;
          user_id: string;
          type: string;
          amount: number;
          stripe_transaction_id: string;
          description: string;
          metadata: Json;
          created_at: string;
        };
        Insert: Partial<Database['public']['Tables']['transactions']['Row']>;
        Update: Partial<Database['public']['Tables']['transactions']['Row']>;
        Relationships: [
          {
            foreignKeyName: 'transactions_escrow_id_fkey';
            columns: ['escrow_id'];
            isOneToOne: false;
            referencedRelation: 'escrow_accounts';
            referencedColumns: ['id'];
          },
        ];
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
        Insert: Partial<Database['public']['Tables']['milestones']['Row']>;
        Update: Partial<Database['public']['Tables']['milestones']['Row']>;
        Relationships: [
          {
            foreignKeyName: 'milestones_project_id_fkey';
            columns: ['project_id'];
            isOneToOne: false;
            referencedRelation: 'projects';
            referencedColumns: ['id'];
          },
        ];
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
        Insert: Partial<Database['public']['Tables']['match_scores']['Row']>;
        Update: Partial<Database['public']['Tables']['match_scores']['Row']>;
        Relationships: [
          {
            foreignKeyName: 'match_scores_job_id_fkey';
            columns: ['job_id'];
            isOneToOne: false;
            referencedRelation: 'jobs';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'match_scores_freelancer_id_fkey';
            columns: ['freelancer_id'];
            isOneToOne: false;
            referencedRelation: 'freelancers';
            referencedColumns: ['id'];
          },
        ];
      };
      subscriptions: {
        Row: {
          id: string;
          user_id: string;
          tier: 'free' | 'plus' | 'pro' | 'enterprise';
          stripe_subscription_id: string;
          stripe_customer_id: string | null;
          status: string;
          current_period_end: string | null;
          created_at: string;
        };
        Insert: Partial<Database['public']['Tables']['subscriptions']['Row']>;
        Update: Partial<Database['public']['Tables']['subscriptions']['Row']>;
        Relationships: [
          {
            foreignKeyName: 'subscriptions_user_id_fkey';
            columns: ['user_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
        ];
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
        Insert: Partial<Database['public']['Tables']['notifications']['Row']>;
        Update: Partial<Database['public']['Tables']['notifications']['Row']>;
        Relationships: [
          {
            foreignKeyName: 'notifications_user_id_fkey';
            columns: ['user_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
        ];
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
        Insert: Partial<Database['public']['Tables']['saved_searches']['Row']>;
        Update: Partial<Database['public']['Tables']['saved_searches']['Row']>;
        Relationships: [
          {
            foreignKeyName: 'saved_searches_user_id_fkey';
            columns: ['user_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
        ];
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
        Insert: Partial<Database['public']['Tables']['disputes']['Row']>;
        Update: Partial<Database['public']['Tables']['disputes']['Row']>;
        Relationships: [
          {
            foreignKeyName: 'disputes_project_id_fkey';
            columns: ['project_id'];
            isOneToOne: false;
            referencedRelation: 'projects';
            referencedColumns: ['id'];
          },
        ];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      [_ in never]: never;
    };
    Enums: {
      [_ in never]: never;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
}

type PublicSchema = Database['public'];

export type Tables<T extends keyof PublicSchema['Tables']> = PublicSchema['Tables'][T]['Row'];
export type InsertTables<T extends keyof PublicSchema['Tables']> = PublicSchema['Tables'][T]['Insert'];
export type UpdateTables<T extends keyof PublicSchema['Tables']> = PublicSchema['Tables'][T]['Update'];

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
