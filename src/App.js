import { useState, useEffect, useCallback, useMemo } from "react";
import {
  sanitizeString,
  sanitizeEmail,
  sanitizeJobInput,
  sanitizeBidInput,
  sanitizeMessage,
  sanitizeReviewInput,
  sanitizeProfileInput,
  LIMITS,
} from "./utils/security";
import { supabase, fetchProfile, SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_AUTH_STORAGE_KEY } from "./supabaseClient";

// ============================================================================
// DATA STORE (In-memory database simulation)
// ============================================================================
const generateId = () => Math.random().toString(36).substr(2, 9);

// Flat, transparent platform fee. Single rate, no sliding scale or per-bid credits.
export const PLATFORM_FEE_RATE = 0.05;
export const formatMoney = (n) =>
  "$" + Math.round(Number(n) || 0).toLocaleString("en-US");

// Net amount a freelancer keeps after the platform fee.
export const netAfterFee = (gross) =>
  Math.round((Number(gross) || 0) * (1 - PLATFORM_FEE_RATE));

/**
 * Job Success Score (0–100): a transparent, data-derived trust signal modeled
 * on the visibility mechanics that dominate competing platforms. Combines
 * review rating, review volume, identity/skill verification, and top-rated
 * status so clients can hire with confidence and freelancers are rewarded for
 * consistent quality.
 */
export function jobSuccessScore(freelancer) {
  if (!freelancer) return 0;
  const rating = Number(freelancer.rating) || 0;
  const reviewCount = Number(freelancer.reviewCount) || 0;
  let score = 0;
  score += (rating / 5) * 60;                                  // up to 60 pts: quality
  score += Math.min(reviewCount, 50) / 50 * 20;                // up to 20 pts: track record
  if (freelancer.identityVerified) score += 8;                 // 8 pts: verified identity
  score += Math.min((freelancer.verifiedSkills || []).length, 4) / 4 * 8; // up to 8 pts
  if (freelancer.topRated) score += 4;                         // 4 pts: top-rated badge
  // New freelancers with no reviews start at a neutral baseline rather than 0.
  if (reviewCount === 0) score = Math.max(score, 40);
  return Math.round(Math.min(100, score));
}

const INITIAL_SKILLS = [
  "React", "Node.js", "Python", "TypeScript", "AWS", "Docker", "Kubernetes",
  "Figma", "UI/UX Design", "Machine Learning", "TensorFlow", "SQL", "MongoDB",
  "SEO", "Content Marketing", "React Native", "Flutter", "Swift", "GraphQL",
  "Terraform", "Go", "Rust", "Vue.js", "Angular", "PostgreSQL", "Redis",
  "DevOps", "CI/CD", "Microservices", "System Design", "Blockchain", "Web3"
];

const CATEGORIES = [
  "Web Development", "Mobile Development", "Design", "Data Science",
  "DevOps", "Marketing", "Writing", "Blockchain", "AI/ML", "Other"
];

// NOTE: SEED_FREELANCERS used to live here as a hard-coded in-memory array of
// six demo freelancers. Removed -- freelancers now load from the
// `public.freelancers` table in Supabase via the fetch effect in App below.
// The same six demos were inserted into the DB via migration 0002, so the
// listing looks identical.

const SEED_JOBS = [
  { id: "j1", clientId: "c1", clientName: "TechCorp Inc.", title: "Full Stack Developer for E-commerce Platform", description: "We need an experienced full stack developer to build a modern e-commerce platform with React frontend and Node.js backend. Must have experience with payment integrations and cloud deployment.", skills: ["React", "Node.js", "AWS", "MongoDB"], budgetMin: 5000, budgetMax: 8000, budgetType: "fixed", category: "Web Development", location: "Remote", status: "open", createdAt: Date.now() - 86400000 * 3, deadline: Date.now() + 86400000 * 45, bids: [{ id: "b1", freelancerId: "f1", freelancerName: "Sarah Chen", amount: 6500, message: "I have 8+ years building e-commerce platforms.", timeline: "6 weeks", createdAt: Date.now() - 86400000 * 2, status: "pending" }], teamSize: 1 },
  { id: "j2", clientId: "c2", clientName: "Startup.io", title: "UI/UX Designer for Fitness App", description: "Looking for a talented designer to create stunning designs for our fitness tracking mobile app. Need wireframes, prototypes, and final designs in Figma.", skills: ["Figma", "UI/UX Design"], budgetMin: 2500, budgetMax: 4000, budgetType: "fixed", category: "Design", location: "Remote", status: "open", createdAt: Date.now() - 86400000 * 1, deadline: Date.now() + 86400000 * 30, bids: [], teamSize: 1 },
  { id: "j3", clientId: "c1", clientName: "TechCorp Inc.", title: "Cloud Migration & DevOps Team", description: "Major cloud migration project. Need a team of 3-4 specialists to migrate our legacy infrastructure to AWS with CI/CD pipeline, auto-scaling, and cost optimization.", skills: ["AWS", "Docker", "Kubernetes", "Terraform", "DevOps"], budgetMin: 15000, budgetMax: 25000, budgetType: "fixed", category: "DevOps", location: "Remote", status: "open", createdAt: Date.now() - 86400000 * 5, deadline: Date.now() + 86400000 * 60, bids: [], teamSize: 4 },
  { id: "j4", clientId: "c3", clientName: "DataDriven Co.", title: "ML Model for Customer Churn Prediction", description: "Build a machine learning model to predict customer churn. Includes data analysis, feature engineering, model training, evaluation, and deployment.", skills: ["Python", "Machine Learning", "TensorFlow", "SQL"], budgetMin: 3000, budgetMax: 5000, budgetType: "fixed", category: "AI/ML", location: "Remote", status: "open", createdAt: Date.now() - 86400000 * 2, deadline: Date.now() + 86400000 * 40, bids: [], teamSize: 2 },
];

const SEED_PROJECTS = [
  { id: "p1", clientId: "c1", clientName: "TechCorp Inc.", title: "Enterprise Dashboard Rebuild", description: "Complete redesign and rebuild of our internal analytics dashboard.", status: "active", members: ["f1", "f3"], budget: 20000, category: "Web Development", createdAt: Date.now() - 86400000 * 15, escrowReleased: false },
];

// ============================================================================
// ICONS (inline SVG components)
// ============================================================================
const Icons = {
  Search: () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>,
  Star: () => <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="m12 2 3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>,
  MapPin: () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>,
  Clock: () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>,
  Users: () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>,
  Briefcase: () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="2" y="7" width="20" height="14" rx="2" ry="2"/><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/></svg>,
  Plus: () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>,
  Check: () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="20 6 9 17 4 12"/></svg>,
  X: () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>,
  ArrowRight: () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>,
  Home: () => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>,
  Grid: () => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg>,
  Folder: () => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>,
  User: () => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>,
  LogOut: () => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>,
  DollarSign: () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>,
  Send: () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>,
  MessageCircle: () => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>,
  Bell: () => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>,
  Settings: () => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="3"/><path d="M12 1v2m0 18v2M4.22 4.22l1.42 1.42m12.73 12.73 1.42 1.42M1 12h2m18 0h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"/></svg>,
  ChevronDown: () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="6 9 12 15 18 9"/></svg>,
  Zap: () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>,
  Shield: () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>,
  Globe: () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>,
  BadgeCheck: () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><path d="M9 12l2 2 4-4"/></svg>,
  Heart: () => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>,
  HeartFilled: () => <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" strokeWidth="2"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>,
  Sun: () => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>,
  Moon: () => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>,
};

// ============================================================================
// STYLES
// ============================================================================
const css = `
@import url('https://fonts.googleapis.com/css2?family=DM+Sans:ital,opsz,wght@0,9..40,300;0,9..40,400;0,9..40,500;0,9..40,600;0,9..40,700;1,9..40,400&family=Space+Mono:wght@400;700&display=swap');

:root {
  --brand-50: #eef7ff;
  --brand-100: #d9edff;
  --brand-200: #bce0ff;
  --brand-300: #8eccff;
  --brand-400: #59afff;
  --brand-500: #338bff;
  --brand-600: #1a6af5;
  --brand-700: #1354e1;
  --brand-800: #1644b6;
  --brand-900: #183c8f;
  --brand-950: #132657;
  
  --accent: #ff6b35;
  --accent-light: #fff0ea;
  --success: #10b981;
  --success-light: #ecfdf5;
  --warning: #f59e0b;
  --warning-light: #fffbeb;
  --error: #ef4444;
  --error-light: #fef2f2;
  
  --gray-25: #fcfcfd;
  --gray-50: #f9fafb;
  --gray-100: #f2f4f7;
  --gray-200: #eaecf0;
  --gray-300: #d0d5dd;
  --gray-400: #98a2b3;
  --gray-500: #667085;
  --gray-600: #475467;
  --gray-700: #344054;
  --gray-800: #1d2939;
  --gray-900: #101828;
  
  --radius-sm: 6px;
  --radius-md: 8px;
  --radius-lg: 12px;
  --radius-xl: 16px;
  --radius-2xl: 20px;
  --radius-full: 9999px;
  
  --shadow-xs: 0 1px 2px rgba(16,24,40,.05);
  --shadow-sm: 0 1px 3px rgba(16,24,40,.1), 0 1px 2px rgba(16,24,40,.06);
  --shadow-md: 0 4px 8px -2px rgba(16,24,40,.1), 0 2px 4px -2px rgba(16,24,40,.06);
  --shadow-lg: 0 12px 16px -4px rgba(16,24,40,.08), 0 4px 6px -2px rgba(16,24,40,.03);
  --shadow-xl: 0 20px 24px -4px rgba(16,24,40,.08), 0 8px 8px -4px rgba(16,24,40,.03);
  
  --font-sans: 'DM Sans', -apple-system, BlinkMacSystemFont, sans-serif;
  --font-mono: 'Space Mono', monospace;
}

[data-theme="dark"] {
  --gray-25: #0f1419;
  --gray-50: #1a1f26;
  --gray-100: #252b33;
  --gray-200: #343b44;
  --gray-300: #4a5568;
  --gray-400: #718096;
  --gray-500: #a0aec0;
  --gray-600: #cbd5e0;
  --gray-700: #e2e8f0;
  --gray-800: #edf2f7;
  --gray-900: #f7fafc;
  --brand-50: #1e3a5f;
  --brand-100: #163258;
  --success-light: #064e3b;
  --warning-light: #451a03;
  --error-light: #450a0a;
}
[data-theme="dark"] body { background: var(--gray-25); color: var(--gray-700); }
[data-theme="dark"] .card-bg { background: var(--gray-50) !important; border-color: var(--gray-200) !important; }

* { margin: 0; padding: 0; box-sizing: border-box; }
html { font-size: 16px; scroll-behavior: smooth; -webkit-text-size-adjust: 100%; }
body { font-family: var(--font-sans); color: var(--gray-700); background: var(--gray-25); -webkit-font-smoothing: antialiased; }

/* Scrollbar */
::-webkit-scrollbar { width: 6px; }
::-webkit-scrollbar-track { background: transparent; }
::-webkit-scrollbar-thumb { background: var(--gray-300); border-radius: 3px; }

/* Animations */
@keyframes fadeUp { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }
@keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
@keyframes slideIn { from { opacity: 0; transform: translateX(-10px); } to { opacity: 1; transform: translateX(0); } }
@keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: .5; } }
@keyframes skeleton-pulse { 0%, 100% { opacity: 1; } 50% { opacity: .55; } }
@keyframes shimmer { 0% { background-position: -200% 0; } 100% { background-position: 200% 0; } }
@keyframes float { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-6px); } }

.fade-up { animation: fadeUp .5s ease both; }
.fade-in { animation: fadeIn .4s ease both; }

@media (max-width: 768px) {
  .nav-links-desk { display: none !important; }
  .nav-hamburger { display: flex !important; }
}
.nav-hamburger { display: none; align-items: center; justify-content: center; width: 40px; height: 40px; border-radius: 8px; border: none; background: var(--gray-100); cursor: pointer; color: var(--gray-600); }

/* Toast notifications */
.toast-container { position: fixed; top: 20px; right: 20px; z-index: 10000; display: flex; flex-direction: column; gap: 8px; }
.toast { padding: 12px 20px; border-radius: var(--radius-lg); font-size: 14px; font-weight: 500; box-shadow: var(--shadow-lg); animation: slideIn .3s ease; max-width: 360px; display: flex; align-items: center; gap: 8px; }
.toast-success { background: var(--success); color: white; }
.toast-error { background: var(--error); color: white; }
.toast-info { background: var(--brand-600); color: white; }
`;

// ============================================================================
// APP COMPONENT
// ============================================================================
export default function BridgeOfTalentApp() {
  // Global state
  const [currentUser, setCurrentUser] = useState(null);
  // Persisted page state. React state alone resets on refresh, which sent
  // logged-in users back to the landing page even though their session was
  // restored. localStorage gives us a tiny "remember last page" without
  // pulling in react-router.
  const PAGE_STORAGE_KEY = "bridgeoftalent-current-page";
  const SELECTED_FREELANCER_STORAGE_KEY = "bridgeoftalent-selected-freelancer";
  const RESTORABLE_PAGES = new Set([
    "dashboard", "jobs", "freelancers", "saved", "messages",
    "projects", "about", "profile",
  ]);
  const [page, setPage] = useState(() => {
    try {
      const saved = localStorage.getItem(PAGE_STORAGE_KEY);
      return saved && RESTORABLE_PAGES.has(saved) ? saved : "landing";
    } catch (_) { return "landing"; }
  });
  // Mirror page changes to localStorage. Only persist "restorable" pages.
  useEffect(() => {
    try {
      if (RESTORABLE_PAGES.has(page)) {
        localStorage.setItem(PAGE_STORAGE_KEY, page);
      } else {
        localStorage.removeItem(PAGE_STORAGE_KEY);
      }
    } catch (_) { /* localStorage unavailable */ }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page]);
  const [freelancers, setFreelancers] = useState([]);
  const [freelancersLoading, setFreelancersLoading] = useState(true);
  const [jobs, setJobs] = useState(SEED_JOBS);
  const [projects, setProjects] = useState(SEED_PROJECTS);
  // Restore the selected freelancer id from localStorage too, so a refresh
  // while viewing a profile lands back on that same profile rather than the
  // "freelancer not found" fallback. Mirrored to localStorage on change.
  const [selectedFreelancerId, setSelectedFreelancerId] = useState(() => {
    try {
      return localStorage.getItem(SELECTED_FREELANCER_STORAGE_KEY) || null;
    } catch (_) { return null; }
  });
  useEffect(() => {
    try {
      if (selectedFreelancerId) {
        localStorage.setItem(SELECTED_FREELANCER_STORAGE_KEY, selectedFreelancerId);
      } else {
        localStorage.removeItem(SELECTED_FREELANCER_STORAGE_KEY);
      }
    } catch (_) { /* ignore */ }
  }, [selectedFreelancerId]);
  const [selectedConversationId, setSelectedConversationId] = useState(null);
  // NOTE: this array now holds only the seeded demo CLIENTS used by legacy
  // parts of the UI (jobs, notifications) until they migrate to Supabase. The
  // freelancer entries were removed when Find Talent moved to a DB-backed
  // fetch -- name lookups for freelancers should use the `freelancers` state
  // (which is populated from the Supabase `freelancers` table).
  const [users] = useState([
    { id: "c1", email: "alex@techcorp.com", password: "Password123", name: "Alex Thompson", role: "client", company: "TechCorp Inc." },
    { id: "c2", email: "maria@startup.io", password: "Password123", name: "Maria Garcia", role: "client", company: "Startup.io" },
    { id: "c3", email: "robert@datadriven.com", password: "Password123", name: "Robert Wilson", role: "client", company: "DataDriven Co." },
  ]);
  const [toasts, setToasts] = useState([]);
  const [notifications, setNotifications] = useState([
    { id: "n1", userId: "c1", type: "bid", title: "New bid received", message: "Sarah Chen placed a bid on \"Full Stack Developer for E-commerce Platform\"", read: false, createdAt: Date.now() - 86400000 }
  ]);
  const [conversations, setConversations] = useState([]);
  const [darkMode, setDarkMode] = useState(() => typeof window !== "undefined" && (localStorage.getItem("bridgeoftalent-dark") === "true"));
  const [savedJobIds, setSavedJobIds] = useState(() => { try { return JSON.parse(localStorage.getItem("bridgeoftalent-saved-jobs") || "[]"); } catch { return []; } });
  const [savedFreelancerIds, setSavedFreelancerIds] = useState(() => { try { return JSON.parse(localStorage.getItem("bridgeoftalent-saved-freelancers") || "[]"); } catch { return []; } });
  const [notificationPrefs, setNotificationPrefs] = useState(() => { try { return JSON.parse(localStorage.getItem("bridgeoftalent-notif-prefs") || "{\"bids\":true,\"hired\":true,\"messages\":true}"); } catch { return { bids: true, hired: true, messages: true }; } });
  const [onboardingStep, setOnboardingStep] = useState(null);
  const [profileViews, setProfileViews] = useState({ f1: 120, f2: 85, f3: 95, f4: 110, f5: 45, f6: 78 });
  const [activityLog, setActivityLog] = useState([]);
  const [talentPools, setTalentPools] = useState(() => { try { return JSON.parse(localStorage.getItem("bridgeoftalent-pools") || "[]"); } catch { return []; } });
  const [savedSearches, setSavedSearches] = useState(() => { try { return JSON.parse(localStorage.getItem("bridgeoftalent-saved-searches") || "[]"); } catch { return []; } });
  const [compareFreelancerIds, setCompareFreelancerIds] = useState([]);
  const [disputes, setDisputes] = useState({});

  const logActivity = useCallback((userId, type, message) => {
    setActivityLog(prev => [{ id: generateId(), userId, type, message, createdAt: Date.now() }, ...prev.slice(0, 99)]);
  }, []);

  useEffect(() => {
    if ((page === "dashboard" || page === "client-dashboard") && currentUser) {
      try { if (localStorage.getItem("bridgeoftalent-onboarding-done") !== "true") setOnboardingStep(0); } catch (_) {}
    }
  }, [page, currentUser]);
  useEffect(() => { try { localStorage.setItem("bridgeoftalent-pools", JSON.stringify(talentPools)); } catch (_) {} }, [talentPools]);
  useEffect(() => { try { localStorage.setItem("bridgeoftalent-saved-searches", JSON.stringify(savedSearches)); } catch (_) {} }, [savedSearches]);
  const [reviews, setReviews] = useState([
    { id: "r1", freelancerId: "f1", clientId: "c1", clientName: "TechCorp Inc.", rating: 5, comment: "Excellent work on our e-commerce platform. Delivered on time and exceeded expectations.", createdAt: Date.now() - 86400000 * 30 },
    { id: "r2", freelancerId: "f1", clientId: "c2", clientName: "Startup.io", rating: 5, comment: "Sarah is a top-tier developer. Would hire again.", createdAt: Date.now() - 86400000 * 45 },
  ]);

  const addNotification = useCallback((userId, type, title, message) => {
    setNotifications(prev => [...prev, { id: generateId(), userId, type, title, message, read: false, createdAt: Date.now() }]);
  }, []);

  const markNotificationRead = useCallback((id) => {
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n));
  }, []);

  const markAllNotificationsRead = useCallback(() => {
    if (!currentUser) return;
    setNotifications(prev => prev.map(n => n.userId === currentUser.id ? { ...n, read: true } : n));
  }, [currentUser]);

  const getOrCreateConversation = useCallback((otherUserId) => {
    const existing = conversations.find(c => c.participantIds.includes(currentUser?.id) && c.participantIds.includes(otherUserId));
    if (existing) return existing.id;
    const newId = generateId();
    setConversations(prev => [...prev, { id: newId, participantIds: [currentUser?.id, otherUserId].filter(Boolean), messages: [] }]);
    return newId;
  }, [conversations, currentUser?.id]);

  const sendMessage = useCallback((conversationId, text) => {
    const safe = sanitizeMessage(text);
    if (!safe || !currentUser) return;
    const msg = { id: generateId(), senderId: currentUser.id, text: safe, createdAt: Date.now() };
    setConversations(prev => prev.map(c => c.id === conversationId ? { ...c, messages: [...(c.messages || []), msg] } : c));
  }, [currentUser]);

  const addToast = useCallback((message, type = "info") => {
    const id = generateId();
    setToasts(prev => [...prev, { id, message, type }]);
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 3500);
  }, []);

  const addReview = useCallback((freelancerId, rating, comment) => {
    const { rating: r, comment: c } = sanitizeReviewInput({ rating, comment });
    setReviews(prev => [...prev, { id: generateId(), freelancerId, clientId: currentUser?.id, clientName: currentUser?.company || currentUser?.name, rating: r, comment: c, createdAt: Date.now() }]);
    setFreelancers(prev => prev.map(f => {
      if (f.id !== freelancerId) return f;
      const n = (f.reviewCount || 0) + 1;
      const newAvg = ((f.rating || 0) * (f.reviewCount || 0) + r) / n;
      return { ...f, reviewCount: n, rating: Math.round(newAvg * 10) / 10 };
    }));
    addToast("Review submitted!", "success");
  }, [currentUser, addToast]);

  const releaseEscrow = useCallback((projectId) => {
    setProjects(prev => prev.map(p => p.id === projectId ? { ...p, escrowReleased: true } : p));
    addToast("Payment released to freelancer(s)", "success");
  }, [addToast]);

  const navigate = useCallback((p) => {
    setPage(p);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);

  const viewProfile = useCallback((id) => {
    if (!id) return;
    setSelectedFreelancerId(id);
    setPage("profile");
    // Track profile views (don't count a freelancer viewing their own profile)
    if (currentUser?.id !== id) {
      setProfileViews(prev => ({ ...prev, [id]: (prev[id] || 0) + 1 }));
    }
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, [currentUser?.id]);

  const saveSearch = useCallback((scope, label, criteria) => {
    setSavedSearches(prev => {
      const next = [{ id: generateId(), scope, label, criteria, createdAt: Date.now() }, ...prev].slice(0, 25);
      return next;
    });
    addToast("Search saved", "success");
  }, [addToast]);

  const removeSavedSearch = useCallback((id) => {
    setSavedSearches(prev => prev.filter(s => s.id !== id));
  }, []);

  // ==========================================================================
  // FREELANCER DATA — load all freelancers from the database on mount.
  // Replaces the old in-memory SEED_FREELANCERS array. Public data: no auth
  // required for reading (the freelancers table has a "anyone can read"
  // RLS policy from 0001_initial_schema.sql).
  // ==========================================================================

  // Map a DB row (snake_case, hourly_rate as numeric) to the camelCase shape
  // the UI components expect. Identical to the mapping used in the auth
  // session-restore effect's hydrateFreelancer helper, kept consistent so
  // there's only one definition of "what a freelancer object looks like."
  const dbRowToFreelancer = useCallback((data, profile) => ({
    id: data.id,
    name: profile?.name || "User",
    email: profile?.email || "",
    title: data.title || "Freelancer",
    location: data.location || "",
    hourlyRate: Number(data.hourly_rate) || 50,
    rating: Number(data.rating) || 0,
    reviewCount: Number(data.review_count) || 0,
    skills: data.skills || [],
    verifiedSkills: data.verified_skills || [],
    bio: data.bio || "",
    status: data.status || "available",
    avatar: data.avatar || (profile?.name || "U").slice(0, 2).toUpperCase(),
    identityVerified: !!data.identity_verified,
    topRated: !!data.top_rated,
    portfolio: [],
  }), []);

  // One-time fetch of every freelancer in the database on mount, to populate
  // the Find Talent listing. We fetch freelancers and profiles in two
  // parallel queries and join in JavaScript by id -- more robust than
  // relying on PostgREST's embedded-resource join syntax, and works around
  // potential RLS edge cases where one table's policy hides rows the other
  // exposes. Freelancer rows without a matching profile row are filtered out
  // (edge case: profile deleted but freelancer row orphaned).
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [freelancersRes, profilesRes] = await Promise.all([
          supabase
            .from("freelancers")
            .select("id, title, location, hourly_rate, rating, review_count, skills, verified_skills, bio, status, avatar, identity_verified, top_rated"),
          supabase
            .from("profiles")
            .select("id, name, email, role"),
        ]);
        if (cancelled) return;
        if (freelancersRes.error) {
          // eslint-disable-next-line no-console
          console.warn("Failed to load freelancers:", freelancersRes.error.message);
          return;
        }
        const profilesById = new Map(
          (profilesRes.data || []).map(p => [p.id, p])
        );
        const mapped = (freelancersRes.data || [])
          .map(row => {
            const profile = profilesById.get(row.id);
            if (!profile) return null;
            return dbRowToFreelancer(row, profile);
          })
          .filter(Boolean);
        setFreelancers(mapped);
      } catch (e) {
        // eslint-disable-next-line no-console
        console.warn("Freelancer fetch threw:", e?.message);
      } finally {
        if (!cancelled) setFreelancersLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [dbRowToFreelancer]);

  // ==========================================================================
  // AUTH — real Supabase authentication (replaces the in-memory demo).
  // ==========================================================================

  // True once the initial session-restore attempt on mount has finished
  // (whether or not it found a session). Used by the page-guard effect
  // below to know when "no currentUser yet" means "actually logged out"
  // vs. "session restore still in flight."
  const [sessionRestoreComplete, setSessionRestoreComplete] = useState(false);

  // Restore an existing session on page load and react to login/logout events.
  // Without this, refreshing the page logs the user out.
  useEffect(() => {
    let cancelled = false;

    // Helper: fetch the freelancer row from the DB (if any) and merge it into
    // local state so currentFreelancer resolves correctly. Without this, the
    // dashboard shows "Loading..." forever because it looks up the freelancer
    // in the in-memory seed array, which doesn't contain real Supabase users.
    const hydrateFreelancer = async (profile) => {
      if (!profile || profile.role !== "freelancer") return;
      const { data, error } = await supabase
        .from("freelancers")
        .select("id, title, location, hourly_rate, rating, review_count, skills, verified_skills, bio, status, avatar, identity_verified, top_rated")
        .eq("id", profile.id)
        .maybeSingle();
      if (error || !data || cancelled) return;
      // Map DB snake_case to the app's camelCase shape used by the UI.
      const merged = {
        id: data.id,
        name: profile.name,
        email: profile.email,
        title: data.title || "Freelancer",
        location: data.location || "",
        hourlyRate: Number(data.hourly_rate) || 50,
        rating: Number(data.rating) || 0,
        reviewCount: Number(data.review_count) || 0,
        skills: data.skills || [],
        verifiedSkills: data.verified_skills || [],
        bio: data.bio || "",
        status: data.status || "available",
        avatar: data.avatar || (profile.name || "U").slice(0, 2).toUpperCase(),
        identityVerified: !!data.identity_verified,
        topRated: !!data.top_rated,
        portfolio: [],
      };
      setFreelancers(prev => {
        const without = prev.filter(f => f.id !== merged.id);
        return [merged, ...without];
      });
    };

    (async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (cancelled) return;
        if (session?.user) {
          try {
            const profile = await fetchProfile(session.user.id);
            if (cancelled) return;
            setCurrentUser(profile);
            await hydrateFreelancer(profile);
          } catch (e) {
            // eslint-disable-next-line no-console
            console.warn("Profile lookup failed on session restore:", e?.message);
          }
        }
      } finally {
        if (!cancelled) setSessionRestoreComplete(true);
      }
    })();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (_event, session) => {
        if (!session?.user) { setCurrentUser(null); return; }
        try {
          const profile = await fetchProfile(session.user.id);
          setCurrentUser(profile);
          await hydrateFreelancer(profile);
        } catch (e) {
          // eslint-disable-next-line no-console
          console.warn("Profile lookup failed:", e?.message);
        }
      }
    );

    return () => { cancelled = true; subscription?.unsubscribe(); };
  }, []);
  // Session-aware page guard. If the persisted page is a logged-in-only
  // page but session-restore has finished and the user isn't authenticated,
  // bump them back to landing. Watching the explicit completion flag avoids
  // the timing race that the previous fixed-timeout version had.
  useEffect(() => {
    if (sessionRestoreComplete && !currentUser && RESTORABLE_PAGES.has(page)) {
      setPage("landing");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionRestoreComplete, currentUser]);
  const handleLogin = useCallback(async (email, password) => {
    const cleanEmail = sanitizeEmail(email);
    if (!cleanEmail) { addToast("Invalid email", "error"); return false; }

    // Defensive: nuke any stale session token in localStorage before signing
    // in. We deliberately do NOT call getSession() or signOut() here -- both
    // touch @supabase/gotrue-js's internal localStorage mutex, and if a prior
    // operation left that mutex in a degenerate state, the whole login flow
    // would hang. Wiping the sb-* keys directly achieves the same end-state
    // (no prior session) without any lock contention.
    clearLocalSupabaseSession();

    const { data, error } = await supabase.auth.signInWithPassword({
      email: cleanEmail,
      password: password || "",
    });
    if (error || !data?.user) {
      addToast(error?.message || "Invalid email or password", "error");
      return false;
    }
    try {
      const profile = await fetchProfile(data.user.id);
      setCurrentUser(profile);
      addToast(`Welcome back, ${profile.name}!`, "success");
      navigate(profile.role === "freelancer" ? "dashboard" : "jobs");
      return true;
    } catch (e) {
      addToast("Signed in, but profile is missing. Contact support.", "error");
      return false;
    }
  }, [addToast, navigate]);

  const handleRegister = useCallback(async (data) => {
    const email = sanitizeEmail(data?.email);
    if (!email) { addToast("Invalid email", "error"); return false; }

    const profile = sanitizeProfileInput(data);
    const role = data?.role === "client" ? "client" : "freelancer";
    const password = sanitizeString(data?.password || "", 128);

    // Supabase enforces minimum password length (default 6). Surface this
    // before the API call so the error is friendly.
    if (password.length < 8) {
      addToast("Password must be at least 8 characters", "error");
      return false;
    }

    // The DB trigger `handle_new_user` reads name/role/company out of
    // raw_user_meta_data and creates the matching profiles + freelancers rows.
    const { data: signUpData, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          name: profile.name || "User",
          role,
          company: profile.company || "",
        },
        emailRedirectTo: typeof window !== "undefined" ? window.location.origin : undefined,
      },
    });

    if (error) {
      addToast(error.message || "Registration failed", "error");
      return false;
    }

    // If "Confirm email" is ON in Supabase, signUpData.session is null and the
    // user must click the link in their inbox before they can log in.
    if (!signUpData?.session) {
      addToast("Account created! Check your email to confirm before signing in.", "success");
      navigate("login");
      return true;
    }

    // "Confirm email" OFF — they're logged in immediately. Populate profile.
    try {
      const me = await fetchProfile(signUpData.user.id);
      setCurrentUser(me);
      addToast("Account created! Welcome to BridgeofTalent.", "success");
      navigate(me.role === "freelancer" ? "dashboard" : "jobs");
    } catch (e) {
      addToast("Account created — please sign in.", "success");
      navigate("login");
    }
    return true;
  }, [addToast, navigate]);

  // Helper: nuke ALL Supabase session state from localStorage. Used both as
  // part of logout (defensive) and before a fresh login (to prevent the SDK
  // from auto-calling logout on a stale prior session, which can fail and
  // wedge the auth state). Lives outside handleLogout/handleLogin so both
  // can use it identically.
  const clearLocalSupabaseSession = () => {
    try {
      Object.keys(localStorage)
        .filter((k) => k.startsWith("sb-"))
        .forEach((k) => localStorage.removeItem(k));
    } catch (_) { /* localStorage unavailable in private mode etc. */ }
  };

  const handleLogout = useCallback(async () => {
    // Best-effort server-side signOut. We don't depend on it succeeding --
    // a failed logout (expired token, network glitch) must not strand the
    // user in a half-logged-in UI. The lock-deadlock that previously caused
    // signOut to hang indefinitely is now resolved by configuring processLock
    // in supabaseClient.js, so we no longer race against a timeout here.
    try {
      await supabase.auth.signOut();
    } catch (e) {
      // eslint-disable-next-line no-console
      console.warn("supabase.auth.signOut() failed (ignored):", e?.message);
    }
    clearLocalSupabaseSession();
    try { localStorage.removeItem(PAGE_STORAGE_KEY); } catch (_) { /* ignore */ }
    try { localStorage.removeItem(SELECTED_FREELANCER_STORAGE_KEY); } catch (_) { /* ignore */ }
    setCurrentUser(null);
    setSelectedFreelancerId(null);
    navigate("landing");
    addToast("Logged out successfully", "info");
  }, [addToast, navigate]);

  // Update the logged-in freelancer's profile row in the database, then
  // sync the change into local state so the UI reflects it immediately.
  // The `fields` parameter takes camelCase keys (title, hourlyRate, location,
  // bio, skills, status, avatar) and we translate to the DB's snake_case.
  // RLS policy "freelancers can update own row" (from 0001_initial_schema.sql)
  // restricts this to the logged-in user's own freelancer row -- any attempt
  // to update someone else's row will silently return zero rows, which we
  // surface to the user as an error rather than a false success.
  const handleUpdateProfile = useCallback(async (fields) => {
    if (!currentUser?.id) {
      addToast("You must be signed in to edit your profile", "error");
      return false;
    }
    if (currentUser.role !== "freelancer") {
      addToast("Only freelancers have an editable profile", "error");
      return false;
    }

    // Translate camelCase → snake_case for the DB update, validating each
    // field as we go. Only fields actually present in `fields` are sent;
    // omitting a field leaves the DB column untouched.
    const dbFields = {};
    if (fields.title !== undefined) dbFields.title = sanitizeString(fields.title, 80);
    if (fields.location !== undefined) dbFields.location = sanitizeString(fields.location, 80);
    if (fields.hourlyRate !== undefined) {
      const n = Number(fields.hourlyRate);
      if (!Number.isFinite(n) || n < 0 || n > 10000) {
        addToast("Hourly rate must be between 0 and 10000", "error");
        return false;
      }
      dbFields.hourly_rate = n;
    }
    if (fields.bio !== undefined) dbFields.bio = sanitizeString(fields.bio, 1000);
    if (fields.skills !== undefined) {
      if (!Array.isArray(fields.skills)) {
        addToast("Skills must be a list", "error");
        return false;
      }
      // De-dup (case-insensitive), trim, drop empties, cap individual skill
      // length to 30 chars, cap list size to 30. Preserve the user's original
      // casing for display ("React" not "react").
      const seen = new Set();
      const cleaned = [];
      for (const raw of fields.skills) {
        const s = sanitizeString(String(raw), 30);
        if (!s) continue;
        const key = s.toLowerCase();
        if (seen.has(key)) continue;
        seen.add(key);
        cleaned.push(s);
        if (cleaned.length >= 30) break;
      }
      dbFields.skills = cleaned;
    }
    if (fields.status !== undefined) {
      if (!["available", "busy"].includes(fields.status)) {
        addToast("Status must be available or busy", "error");
        return false;
      }
      dbFields.status = fields.status;
    }
    if (fields.avatar !== undefined) {
      // Avatar is a 2-char display string (initials). Strip whitespace,
      // uppercase, cap at 2 chars. Empty → derive initials from name.
      const v = String(fields.avatar).replace(/\s+/g, "").toUpperCase().slice(0, 2);
      dbFields.avatar = v || (currentUser.name || "U").slice(0, 2).toUpperCase();
    }

    if (Object.keys(dbFields).length === 0) {
      addToast("Nothing to update", "info");
      return false;
    }

    // We send the PATCH as a raw fetch() rather than via supabase.from('...').update(...)
    // because the SDK's PostgREST client internally calls auth.getSession() to
    // attach a Bearer token, and on this app that call hangs indefinitely on
    // the auth library's in-process lock (observed reliably after a few save
    // attempts in one session). The lock issue is documented upstream and
    // bypassing it for this single operation is the most reliable workaround.
    //
    // We read the access token directly from localStorage where the SDK stores
    // it. If it's missing or expired, the PATCH will return 401 and we surface
    // that as an error. Worst case the user re-logs and saves again.
    let accessToken = null;
    try {
      const raw = localStorage.getItem(SUPABASE_AUTH_STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        accessToken = parsed?.access_token || null;
      }
    } catch (_) { /* ignore */ }

    if (!accessToken) {
      addToast("Your session has expired. Please sign in again.", "error");
      return false;
    }

    let data = null;
    let error = null;
    try {
      const resp = await fetch(
        `${SUPABASE_URL}/rest/v1/freelancers?id=eq.${currentUser.id}&select=*`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            "apikey": SUPABASE_ANON_KEY,
            "Authorization": `Bearer ${accessToken}`,
            // Prefer: return=representation tells PostgREST to return the
            // updated rows in the response body. Without this, PostgREST
            // returns an empty body and our state-merge step has nothing
            // to merge.
            "Prefer": "return=representation",
          },
          body: JSON.stringify(dbFields),
        }
      );
      if (!resp.ok) {
        const txt = await resp.text().catch(() => "");
        error = { message: `HTTP ${resp.status}: ${txt || resp.statusText}` };
      } else {
        const rows = await resp.json();
        // PostgREST returns an array even for single-row updates.
        data = Array.isArray(rows) ? (rows[0] || null) : (rows || null);
      }
    } catch (e) {
      error = { message: e?.message || "Network error" };
    }

    if (error) {
      addToast(error.message || "Failed to save profile", "error");
      return false;
    }
    if (!data) {
      // RLS rejected the update silently (returned 0 rows) -- most likely the
      // current user doesn't have a freelancer row yet (signup trigger
      // didn't create one, or it was deleted manually).
      addToast("Couldn't save: no freelancer row found for your account", "error");
      return false;
    }

    // Merge the fresh DB values into local state so the listing and own
    // profile view both reflect the new values without a refetch.
    setFreelancers(prev => prev.map(f => {
      if (f.id !== currentUser.id) return f;
      return {
        ...f,
        title: data.title ?? f.title,
        location: data.location ?? f.location,
        hourlyRate: Number(data.hourly_rate) || f.hourlyRate,
        bio: data.bio ?? f.bio,
        skills: data.skills || f.skills,
        status: data.status || f.status,
        avatar: data.avatar || f.avatar,
      };
    }));

    addToast("Profile updated", "success");
    return true;
  }, [currentUser, addToast]);

  const handleBid = useCallback((jobId, bidData) => {
    const job = jobs.find(j => j.id === jobId);
    const safe = sanitizeBidInput(bidData);
    setJobs(prev => prev.map(j =>
      j.id === jobId
        ? { ...j, bids: [...j.bids, { id: generateId(), freelancerId: currentUser.id, freelancerName: sanitizeString(currentUser.name, LIMITS.NAME), ...safe, createdAt: Date.now(), status: "pending" }] }
        : j
    ));
    if (job?.clientId) addNotification(job.clientId, "bid", "New bid received", `${currentUser.name} placed a bid on "${job.title}"`);
    if (currentUser?.id) logActivity(currentUser.id, "bid", `Placed bid on "${job?.title}"`);
    addToast("Bid submitted successfully!", "success");
  }, [currentUser, jobs, addToast, addNotification, logActivity]);

  const handleAcceptBid = useCallback((jobId, bidId) => {
    const job = jobs.find(j => j.id === jobId);
    if (!job || job.clientId !== currentUser?.id) return;
    const bid = job.bids.find(b => b.id === bidId);
    if (!bid) return;
    setJobs(prev => prev.map(j =>
      j.id === jobId
        ? { ...j, status: "closed", bids: j.bids.map(b => b.id === bidId ? { ...b, status: "accepted" } : { ...b, status: "rejected" }) }
        : j
    ));
    const newProject = {
      id: generateId(), clientId: currentUser.id, clientName: currentUser.company || currentUser.name,
      title: job.title, description: job.description, status: "active", members: [bid.freelancerId],
      budget: bid.amount || job.budgetMax, category: job.category, createdAt: Date.now(), fromJobId: jobId, escrowReleased: false
    };
    setProjects(prev => [newProject, ...prev]);
    addNotification(bid.freelancerId, "hired", "You were hired!", `You were hired for "${job.title}" by ${currentUser.company || currentUser.name}`);
    if (currentUser?.id) logActivity(currentUser.id, "hire", `Hired ${bid.freelancerName} for "${job.title}"`);
    if (bid.freelancerId) logActivity(bid.freelancerId, "hired", `Hired for "${job.title}"`);
    addToast(`Hired ${bid.freelancerName}! Project created.`, "success");
  }, [jobs, currentUser, addToast, addNotification, logActivity]);

  const handleRejectBid = useCallback((jobId, bidId) => {
    const job = jobs.find(j => j.id === jobId);
    const bid = job?.bids?.find(b => b.id === bidId);
    setJobs(prev => prev.map(j =>
      j.id === jobId ? { ...j, bids: j.bids.map(b => b.id === bidId ? { ...b, status: "rejected" } : b) } : j
    ));
    if (bid?.freelancerId) addNotification(bid.freelancerId, "bid_rejected", "Bid not accepted", `Your bid on "${job?.title}" was not accepted.`);
    addToast("Bid rejected", "info");
  }, [jobs, addToast, addNotification]);

  const handlePostJob = useCallback((jobData) => {
    const safe = sanitizeJobInput(jobData);
    const newJob = {
      id: generateId(), clientId: currentUser.id, clientName: sanitizeString(currentUser.company || currentUser.name, LIMITS.NAME),
      ...safe, deadline: jobData?.deadline || Date.now() + 86400000 * 30, status: "open", createdAt: Date.now(), bids: []
    };
    setJobs(prev => [newJob, ...prev]);
    if (currentUser?.id) logActivity(currentUser.id, "job", `Posted job "${safe.title}"`);
    addToast("Job posted successfully!", "success");
    navigate("jobs");
  }, [currentUser, addToast, navigate, logActivity]);

  const handleCreateProject = useCallback((projectData) => {
    const safeTitle = sanitizeString(projectData?.title, LIMITS.TITLE);
    const safeDesc = sanitizeString(projectData?.description, 3000);
    const newProject = {
      id: generateId(), clientId: currentUser.id, clientName: sanitizeString(currentUser.company || currentUser.name, LIMITS.NAME),
      title: safeTitle, description: safeDesc, budget: Math.min(1e9, Math.max(0, Number(projectData?.budget) || 0)),
      category: sanitizeString(projectData?.category, 64), members: Array.isArray(projectData?.members) ? projectData.members.slice(0, 10) : [],
      status: "active", createdAt: Date.now(), escrowReleased: false
    };
    setProjects(prev => [newProject, ...prev]);
    addToast("Project created!", "success");
    navigate("projects");
  }, [currentUser, addToast, navigate]);

  // Get freelancer profile for current user
  const currentFreelancer = useMemo(() =>
    currentUser?.role === "freelancer" ? freelancers.find(f => f.id === currentUser.id) : null,
    [currentUser, freelancers]
  );

  // Recommended jobs for freelancer (by skill match)
  const recommendedJobs = useMemo(() => {
    if (!currentFreelancer?.skills?.length) return [];
    return jobs.filter(j => j.status === "open" && (j.skills || []).some(s => (currentFreelancer.skills || []).includes(s))).slice(0, 5);
  }, [jobs, currentFreelancer]);

  // Recommended freelancers for a job (by skill match) or top-rated
  const getRecommendedFreelancersForJob = useCallback((job) => {
    if (!job?.skills?.length) return freelancers.slice(0, 4);
    return [...freelancers]
      .filter(f => (f.skills || []).some(s => (job.skills || []).includes(s)))
      .sort((a, b) => (b.rating || 0) - (a.rating || 0))
      .slice(0, 4);
  }, [freelancers]);

  const addTalentPool = useCallback((name) => {
    if (!currentUser?.id) return;
    setTalentPools(prev => [...prev, { id: generateId(), clientId: currentUser.id, name: sanitizeString(name, 80), freelancerIds: [] }]);
  }, [currentUser]);
  const addFreelancerToPool = useCallback((poolId, freelancerId) => {
    setTalentPools(prev => prev.map(p => p.id === poolId && !p.freelancerIds.includes(freelancerId) ? { ...p, freelancerIds: [...(p.freelancerIds || []), freelancerId] } : p));
  }, []);
  const removeFreelancerFromPool = useCallback((poolId, freelancerId) => {
    setTalentPools(prev => prev.map(p => p.id === poolId ? { ...p, freelancerIds: (p.freelancerIds || []).filter(id => id !== freelancerId) } : p));
  }, []);

  const raiseDispute = useCallback((projectId, reason) => {
    setDisputes(prev => ({ ...prev, [projectId]: { status: "raised", reason: sanitizeString(reason, 500), createdAt: Date.now() } }));
    addToast("Dispute raised. Our team will review.", "info");
  }, [addToast]);
  const resolveDispute = useCallback((projectId) => {
    setDisputes(prev => ({ ...prev, [projectId]: { ...prev[projectId], status: "resolved", resolvedAt: Date.now() } }));
    addToast("Dispute marked resolved.", "success");
  }, [addToast]);

  const getInvoiceSummary = useCallback((project) => {
    const lines = [`Invoice – ${project?.title || "Project"}`, `Client: ${project?.clientName || ""}`, `Amount: $${(project?.budget || 0).toLocaleString()}`, `Status: ${project?.status || "active"}`, `Date: ${new Date(project?.createdAt || 0).toLocaleDateString()}`];
    return lines.join("\n");
  }, []);

  useEffect(() => {
    const h = (e) => {
      if (e.target.tagName === "INPUT" || e.target.tagName === "TEXTAREA") return;
      if (e.key === "?" || (e.ctrlKey && e.key === "/")) { e.preventDefault(); setPage(p => (p === "shortcuts" ? "jobs" : "shortcuts")); }
      if (e.ctrlKey && e.key === "g") { e.preventDefault(); setPage("jobs"); }
      if (e.ctrlKey && e.key === "f") { e.preventDefault(); setPage("freelancers"); }
      if (e.ctrlKey && e.key === "m") { e.preventDefault(); setPage("messages"); }
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, []);

  useEffect(() => {
    if (typeof document !== "undefined") document.documentElement.setAttribute("data-theme", darkMode ? "dark" : "");
    try { localStorage.setItem("bridgeoftalent-dark", darkMode ? "true" : "false"); } catch (_) {}
  }, [darkMode]);

  useEffect(() => { try { localStorage.setItem("bridgeoftalent-saved-jobs", JSON.stringify(savedJobIds)); } catch (_) {} }, [savedJobIds]);
  useEffect(() => { try { localStorage.setItem("bridgeoftalent-saved-freelancers", JSON.stringify(savedFreelancerIds)); } catch (_) {} }, [savedFreelancerIds]);
  useEffect(() => { try { localStorage.setItem("bridgeoftalent-notif-prefs", JSON.stringify(notificationPrefs)); } catch (_) {} }, [notificationPrefs]);

  const toggleSaveJob = useCallback((jobId) => {
    setSavedJobIds(prev => prev.includes(jobId) ? prev.filter(id => id !== jobId) : [...prev, jobId]);
  }, []);
  const toggleSaveFreelancer = useCallback((id) => {
    setSavedFreelancerIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  }, []);

  return (
    <>
      <style>{css}</style>
      {/* Toast notifications */}
      <div className="toast-container">
        {toasts.map(t => (
          <div key={t.id} className={`toast toast-${t.type}`}>
            {t.type === "success" && <Icons.Check />}
            {t.type === "error" && <Icons.X />}
            {t.message}
          </div>
        ))}
      </div>

      {/* Navigation */}
      {page !== "landing" && page !== "login" && page !== "register" && (
        <Navbar currentUser={currentUser} onNavigate={navigate} onLogout={handleLogout} page={page} notifications={notifications} onMarkNotificationRead={markNotificationRead} onMarkAllNotificationsRead={markAllNotificationsRead} darkMode={darkMode} onToggleDarkMode={() => setDarkMode(d => !d)} savedJobIds={savedJobIds} savedFreelancerIds={savedFreelancerIds} notificationPrefs={notificationPrefs} onNotificationPrefsChange={setNotificationPrefs} onboardingStep={onboardingStep} onOnboardingDismiss={() => setOnboardingStep("done")} />
      )}
      {onboardingStep === 0 && currentUser && (
        <OnboardingOverlay role={currentUser?.role} onDismiss={() => { setOnboardingStep("done"); try { localStorage.setItem("bridgeoftalent-onboarding-done", "true"); } catch (_) {} }} onNavigate={navigate} />
      )}

      {/* Pages */}
      {page === "landing" && <LandingPage onNavigate={navigate} />}
      {page === "login" && <LoginPage onLogin={handleLogin} onNavigate={navigate} />}
      {page === "register" && <RegisterPage onRegister={handleRegister} onNavigate={navigate} />}
      {page === "dashboard" && <DashboardPage freelancer={currentFreelancer} jobs={jobs} projects={projects} onNavigate={navigate} profileViews={profileViews} activityLog={activityLog} recommendedJobs={recommendedJobs} />}
      {page === "client-dashboard" && <ClientDashboardPage jobs={jobs} projects={projects} currentUser={currentUser} onNavigate={navigate} freelancers={freelancers} talentPools={talentPools} onAddPool={addTalentPool} onAddToPool={addFreelancerToPool} onRemoveFromPool={removeFreelancerFromPool} activityLog={activityLog} />}
      {page === "freelancers" && <FreelancersPage freelancers={freelancers} loading={freelancersLoading} onNavigate={navigate} onViewProfile={viewProfile} savedFreelancerIds={savedFreelancerIds} onToggleSaveFreelancer={toggleSaveFreelancer} compareIds={compareFreelancerIds} onCompare={(id) => setCompareFreelancerIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : prev.length >= 2 ? [...prev.slice(1), id] : [...prev, id])} onNavigateToCompare={() => setPage("compare")} onSaveSearch={saveSearch} />}
      {page === "profile" && <ProfilePage freelancer={freelancers.find(f => f.id === selectedFreelancerId)} reviews={reviews} onAddReview={addReview} onNavigate={navigate} onBack={() => { setPage("freelancers"); setSelectedFreelancerId(null); }} onMessage={(freelancerId) => { const convId = getOrCreateConversation(freelancerId); setSelectedConversationId(convId); setPage("messages"); }} currentUser={currentUser} projects={projects} onSaveProfile={handleUpdateProfile} />}
      {page === "messages" && <MessagesPage currentUser={currentUser} conversations={conversations} users={users} freelancers={freelancers} selectedConversationId={selectedConversationId} onSelectConversation={setSelectedConversationId} onSendMessage={sendMessage} getOrCreateConversation={getOrCreateConversation} onNavigate={navigate} />}
      {page === "jobs" && <JobsPage jobs={jobs} currentUser={currentUser} onBid={handleBid} onAcceptBid={handleAcceptBid} onRejectBid={handleRejectBid} onNavigate={navigate} freelancers={freelancers} onOpenMessage={(otherId) => { const cid = getOrCreateConversation(otherId); setSelectedConversationId(cid); setPage("messages"); }} savedJobIds={savedJobIds} onToggleSaveJob={toggleSaveJob} recommendedJobs={recommendedJobs} getRecommendedFreelancers={getRecommendedFreelancersForJob} onSaveSearch={saveSearch} />}
      {page === "saved" && <SavedPage savedJobIds={savedJobIds} savedFreelancerIds={savedFreelancerIds} jobs={jobs} freelancers={freelancers} onNavigate={navigate} onViewProfile={viewProfile} onToggleSaveJob={toggleSaveJob} onToggleSaveFreelancer={toggleSaveFreelancer} savedSearches={savedSearches} onRemoveSavedSearch={removeSavedSearch} />}
      {page === "post-job" && <PostJobPage onPost={handlePostJob} onNavigate={navigate} />}
      {page === "projects" && <ProjectsPage projects={projects} freelancers={freelancers} currentUser={currentUser} onCreate={handleCreateProject} onNavigate={navigate} onReleaseEscrow={releaseEscrow} disputes={disputes} onRaiseDispute={raiseDispute} onResolveDispute={resolveDispute} getInvoiceSummary={getInvoiceSummary} />}
      {page === "about" && <AboutPage onNavigate={navigate} />}
      {page === "shortcuts" && <ShortcutsPage onNavigate={navigate} />}
      {page === "compare" && <ComparePage freelancers={freelancers} compareIds={compareFreelancerIds} onClear={() => setCompareFreelancerIds([])} onNavigate={navigate} onViewProfile={viewProfile} />}
    </>
  );
}

// ============================================================================
// ONBOARDING OVERLAY
// ============================================================================
function OnboardingOverlay({ role, onDismiss, onNavigate }) {
  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 9999, background: "rgba(0,0,0,.5)", display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }} onClick={onDismiss}>
      <div style={{ ...cardStyle, maxWidth: 420, padding: 32, position: "relative" }} onClick={e => e.stopPropagation()}>
        <h3 style={{ fontSize: 20, fontWeight: 800, color: "var(--gray-900)", marginBottom: 12 }}>Welcome to BridgeofTalent!</h3>
        <p style={{ fontSize: 15, color: "var(--gray-600)", lineHeight: 1.6, marginBottom: 20 }}>
          {role === "freelancer" ? "Browse jobs, place bids, and grow your client base. Start by exploring open jobs or complete your profile." : "Post jobs, review bids, and hire the best talent. Post your first job or find freelancers to get started."}
        </p>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <button onClick={() => { onNavigate(role === "freelancer" ? "jobs" : "post-job"); onDismiss(); }} style={{ ...btnStyle, ...btnPrimary }}>{role === "freelancer" ? "Browse Jobs" : "Post a Job"}</button>
          <button onClick={() => { onNavigate(role === "freelancer" ? "freelancers" : "freelancers"); onDismiss(); }} style={{ ...btnStyle, ...btnSecondary }}>Find Talent</button>
          <button onClick={onDismiss} style={{ ...btnStyle, ...btnSecondary }}>Got it</button>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// NAVBAR
// ============================================================================
function Navbar({ currentUser, onNavigate, onLogout, page, notifications = [], onMarkNotificationRead, onMarkAllNotificationsRead, darkMode, onToggleDarkMode, savedJobIds = [], savedFreelancerIds = [], notificationPrefs = {}, onNotificationPrefsChange }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [prefsOpen, setPrefsOpen] = useState(false);
  const isFreelancer = currentUser?.role === "freelancer";
  const myNotifications = (notifications || []).filter(n => n.userId === currentUser?.id).sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
  const unreadCount = myNotifications.filter(n => !n.read).length;
  const navLinks = [
    { label: "Find Talent", page: "freelancers" },
    { label: "Browse Jobs", page: "jobs" },
    { label: "Saved", page: "saved" },
    { label: "Messages", page: "messages" },
    { label: "Projects", page: "projects" },
    { label: "About", page: "about" },
  ];

  return (
    <nav style={{
      position: "sticky", top: 0, zIndex: 100, background: "var(--gray-25)",
      backdropFilter: "blur(12px)", borderBottom: "1px solid var(--gray-200)",
      padding: "0 24px", height: 64, display: "flex", alignItems: "center"
    }}>
      <div style={{ maxWidth: 1200, width: "100%", margin: "0 auto", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <button onClick={() => { onNavigate("landing"); setMobileNavOpen(false); }} style={{ display: "flex", alignItems: "center", gap: 10, background: "none", border: "none", cursor: "pointer" }}>
            <div style={{
              width: 36, height: 36, borderRadius: var_radius_lg,
              background: "linear-gradient(135deg, var(--brand-600), var(--brand-400))",
              display: "flex", alignItems: "center", justifyContent: "center",
              color: "white", fontWeight: 700, fontSize: 13, fontFamily: "var(--font-mono)"
            }}>BT</div>
            <span style={{ fontWeight: 700, fontSize: 18, color: "var(--gray-900)", letterSpacing: "-.01em" }}>BridgeofTalent</span>
          </button>
          <button className="nav-hamburger" onClick={() => setMobileNavOpen(!mobileNavOpen)} aria-label="Menu">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/></svg>
          </button>
        </div>

        <div className="nav-links-desk" style={{ display: "flex", alignItems: "center", gap: 4 }}>
          {navLinks.map(item => (
            <button key={item.page} onClick={() => { onNavigate(item.page); setMobileNavOpen(false); }}
              style={{
                padding: "8px 14px", borderRadius: var_radius_md, border: "none", cursor: "pointer",
                fontSize: 14, fontWeight: 500, fontFamily: "var(--font-sans)",
                background: page === item.page ? "var(--brand-50)" : "transparent",
                color: page === item.page ? "var(--brand-700)" : "var(--gray-600)",
                transition: "all .15s"
              }}>{item.label}</button>
          ))}
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          {currentUser ? (
            <>
              <button onClick={onToggleDarkMode} style={{ width: 40, height: 40, borderRadius: "50%", border: "none", background: "var(--gray-100)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--gray-600)" }} aria-label={darkMode ? "Light mode" : "Dark mode"}>{darkMode ? <Icons.Sun /> : <Icons.Moon />}</button>
              <div style={{ position: "relative" }}>
                <button onClick={() => { setNotifOpen(!notifOpen); setMenuOpen(false); }} style={{ position: "relative", width: 40, height: 40, borderRadius: "50%", border: "none", background: "var(--gray-100)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--gray-600)" }} aria-label="Notifications">
                  <Icons.Bell />
                  {unreadCount > 0 && (
                    <span style={{ position: "absolute", top: 4, right: 4, minWidth: 18, height: 18, borderRadius: 9, background: "var(--error)", color: "white", fontSize: 11, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center", padding: "0 4px" }}>{unreadCount > 99 ? "99+" : unreadCount}</span>
                  )}
                </button>
                {notifOpen && (
                  <div style={{ position: "absolute", top: 48, right: 0, width: 360, maxHeight: 400, overflowY: "auto", background: "white", borderRadius: var_radius_lg, boxShadow: "var(--shadow-xl)", border: "1px solid var(--gray-200)", zIndex: 1001 }}>
                    <div style={{ padding: "12px 16px", borderBottom: "1px solid var(--gray-100)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <span style={{ fontSize: 14, fontWeight: 700, color: "var(--gray-900)" }}>Notifications</span>
                      {unreadCount > 0 && (
                        <button onClick={() => { onMarkAllNotificationsRead?.(); }} style={{ fontSize: 12, fontWeight: 600, color: "var(--brand-600)", background: "none", border: "none", cursor: "pointer" }}>Mark all read</button>
                      )}
                    </div>
                    {myNotifications.length === 0 ? (
                      <div style={{ padding: 24, textAlign: "center", fontSize: 14, color: "var(--gray-400)" }}>No notifications yet</div>
                    ) : (
                      myNotifications.slice(0, 15).map(n => (
                        <div key={n.id} onClick={() => { onMarkNotificationRead?.(n.id); }} style={{ padding: "12px 16px", borderBottom: "1px solid var(--gray-100)", cursor: "pointer", background: n.read ? "transparent" : "var(--brand-50)" }}>
                          <div style={{ fontSize: 13, fontWeight: 600, color: "var(--gray-900)" }}>{n.title}</div>
                          <div style={{ fontSize: 12, color: "var(--gray-500)", marginTop: 2 }}>{n.message}</div>
                        </div>
                      ))
                    )}
                  </div>
                )}
              </div>
              {!isFreelancer && (
                <>
                  <button onClick={() => onNavigate("client-dashboard")} style={{ ...btnStyle, ...btnSecondary, padding: "8px 16px", fontSize: 13 }}>
                    Dashboard
                  </button>
                  <button onClick={() => onNavigate("post-job")} style={{ ...btnStyle, ...btnPrimary, padding: "8px 16px", fontSize: 13 }}>
                    <Icons.Plus /> Post Job
                  </button>
                </>
              )}
              {isFreelancer && (
                <button onClick={() => onNavigate("dashboard")} style={{ ...btnStyle, ...btnSecondary, padding: "8px 16px", fontSize: 13 }}>
                  Dashboard
                </button>
              )}
              <div style={{ position: "relative" }}>
                <button onClick={() => setMenuOpen(!menuOpen)} style={{
                  width: 36, height: 36, borderRadius: "50%", border: "2px solid var(--brand-200)",
                  background: "linear-gradient(135deg, var(--brand-500), var(--accent))",
                  color: "white", fontWeight: 600, fontSize: 12, cursor: "pointer",
                  display: "flex", alignItems: "center", justifyContent: "center"
                }}>{currentUser.name?.split(" ").map(n => n[0]).join("")}</button>
                {menuOpen && (
                  <div style={{
                    position: "absolute", top: 44, right: 0, width: 220, background: "var(--gray-25)",
                    borderRadius: var_radius_lg, boxShadow: "var(--shadow-xl)", border: "1px solid var(--gray-200)",
                    overflow: "hidden", zIndex: 1000
                  }}>
                    <div style={{ padding: "12px 16px", borderBottom: "1px solid var(--gray-100)", fontSize: 13, color: "var(--gray-500)" }}>
                      {currentUser.email}
                    </div>
                    <button onClick={() => { setPrefsOpen(!prefsOpen); }} style={{
                      width: "100%", padding: "10px 16px", border: "none", background: "none",
                      cursor: "pointer", textAlign: "left", fontSize: 14, color: "var(--gray-700)",
                      display: "flex", alignItems: "center", gap: 8, fontFamily: "var(--font-sans)"
                    }}><Icons.Settings /> Notification preferences</button>
                    {prefsOpen && (
                      <div style={{ padding: "12px 16px", background: "var(--gray-50)", borderTop: "1px solid var(--gray-100)", fontSize: 13 }}>
                        <label style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}><input type="checkbox" checked={notificationPrefs.bids !== false} onChange={e => onNotificationPrefsChange?.({ ...notificationPrefs, bids: e.target.checked })} /> New bids</label>
                        <label style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}><input type="checkbox" checked={notificationPrefs.hired !== false} onChange={e => onNotificationPrefsChange?.({ ...notificationPrefs, hired: e.target.checked })} /> Hired / project updates</label>
                        <label style={{ display: "flex", alignItems: "center", gap: 8 }}><input type="checkbox" checked={notificationPrefs.messages !== false} onChange={e => onNotificationPrefsChange?.({ ...notificationPrefs, messages: e.target.checked })} /> Messages</label>
                      </div>
                    )}
                    <button onClick={() => { setMenuOpen(false); onLogout(); }} style={{
                      width: "100%", padding: "10px 16px", border: "none", background: "none",
                      cursor: "pointer", textAlign: "left", fontSize: 14, color: "var(--gray-700)",
                      display: "flex", alignItems: "center", gap: 8, fontFamily: "var(--font-sans)"
                    }}><Icons.LogOut /> Sign Out</button>
                  </div>
                )}
              </div>
            </>
          ) : (
            <>
              <button onClick={() => onNavigate("login")} style={{ ...btnStyle, ...btnSecondary, padding: "8px 18px", fontSize: 13 }}>Sign In</button>
              <button onClick={() => onNavigate("register")} style={{ ...btnStyle, ...btnPrimary, padding: "8px 18px", fontSize: 13 }}>Join Free</button>
            </>
          )}
        </div>
      </div>
      {mobileNavOpen && (
        <div style={{ position: "fixed", inset: 0, top: 64, zIndex: 99, background: "var(--gray-25)", padding: 24, display: "flex", flexDirection: "column", gap: 8 }} onClick={() => setMobileNavOpen(false)}>
          {navLinks.map(item => (
            <button key={item.page} onClick={() => { onNavigate(item.page); setMobileNavOpen(false); }} style={{ padding: "14px 16px", borderRadius: var_radius_md, border: "none", background: page === item.page ? "var(--brand-50)" : "var(--gray-100)", color: page === item.page ? "var(--brand-700)" : "var(--gray-800)", fontSize: 16, fontWeight: 500, textAlign: "left", cursor: "pointer" }}>{item.label}</button>
          ))}
        </div>
      )}
    </nav>
  );
}

// Constants for consistent styling
const var_radius_md = "8px";
const var_radius_lg = "12px";
const var_radius_xl = "16px";

const btnStyle = {
  display: "inline-flex", alignItems: "center", gap: 6, border: "none", cursor: "pointer",
  fontFamily: "var(--font-sans)", fontWeight: 600, borderRadius: var_radius_md, transition: "all .2s",
  textDecoration: "none", whiteSpace: "nowrap"
};
const btnPrimary = {
  background: "linear-gradient(135deg, var(--brand-600), var(--brand-500))",
  color: "white", boxShadow: "0 1px 3px rgba(26,106,245,.3)", padding: "10px 20px", fontSize: 14
};
const btnSecondary = {
  background: "white", color: "var(--gray-700)", border: "1px solid var(--gray-300)",
  padding: "10px 20px", fontSize: 14
};
const btnAccent = {
  background: "linear-gradient(135deg, var(--accent), #ff8a5c)",
  color: "white", boxShadow: "0 1px 3px rgba(255,107,53,.3)", padding: "10px 20px", fontSize: 14
};

const inputStyle = {
  width: "100%", padding: "10px 14px", borderRadius: var_radius_md,
  border: "1.5px solid var(--gray-200)", fontSize: 14, fontFamily: "var(--font-sans)",
  color: "var(--gray-900)", background: "white", outline: "none", transition: "border .2s"
};

const cardStyle = {
  background: "white", borderRadius: var_radius_xl, border: "1px solid var(--gray-200)",
  padding: 24, transition: "all .2s"
};

// ============================================================================
// LANDING PAGE
// ============================================================================
function LandingPage({ onNavigate }) {
  return (
    <div>
      {/* Hero */}
      <section style={{
        position: "relative", overflow: "hidden",
        background: "linear-gradient(160deg, var(--gray-900) 0%, var(--brand-950) 50%, var(--brand-900) 100%)",
        padding: "0 24px", minHeight: "90vh", display: "flex", alignItems: "center"
      }}>
        {/* Decorative elements */}
        <div style={{ position: "absolute", top: -200, right: -200, width: 600, height: 600, borderRadius: "50%", background: "radial-gradient(circle, rgba(51,139,255,.15), transparent)", pointerEvents: "none" }} />
        <div style={{ position: "absolute", bottom: -100, left: -100, width: 400, height: 400, borderRadius: "50%", background: "radial-gradient(circle, rgba(255,107,53,.1), transparent)", pointerEvents: "none" }} />
        <div style={{ position: "absolute", top: 60, left: 40, width: 4, height: 4, borderRadius: "50%", background: "var(--brand-400)", animation: "float 3s ease infinite" }} />
        <div style={{ position: "absolute", top: 120, right: 120, width: 6, height: 6, borderRadius: "50%", background: "var(--accent)", animation: "float 4s ease infinite .5s" }} />
        <div style={{ position: "absolute", bottom: 180, left: 200, width: 3, height: 3, borderRadius: "50%", background: "var(--brand-300)", animation: "float 3.5s ease infinite 1s" }} />

        {/* Top nav on landing */}
        <div style={{ position: "absolute", top: 0, left: 0, right: 0, padding: "20px 32px", display: "flex", justifyContent: "space-between", alignItems: "center", zIndex: 10 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ width: 38, height: 38, borderRadius: var_radius_lg, background: "linear-gradient(135deg, var(--brand-500), var(--brand-400))", display: "flex", alignItems: "center", justifyContent: "center", color: "white", fontWeight: 700, fontSize: 14, fontFamily: "var(--font-mono)" }}>BT</div>
            <span style={{ fontWeight: 700, fontSize: 19, color: "white", letterSpacing: "-.01em" }}>BridgeofTalent</span>
          </div>
          <div style={{ display: "flex", gap: 10 }}>
            <button onClick={() => onNavigate("login")} style={{ ...btnStyle, background: "rgba(255,255,255,.1)", color: "rgba(255,255,255,.9)", border: "1px solid rgba(255,255,255,.15)", padding: "9px 20px", fontSize: 13, backdropFilter: "blur(4px)" }}>Sign In</button>
            <button onClick={() => onNavigate("register")} style={{ ...btnStyle, ...btnPrimary, padding: "9px 20px", fontSize: 13 }}>Get Started Free</button>
          </div>
        </div>

        <div style={{ maxWidth: 1200, width: "100%", margin: "0 auto", textAlign: "center", position: "relative", zIndex: 1 }}>
          <div className="fade-up" style={{ animationDelay: ".1s" }}>
            <div style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "6px 16px", borderRadius: var_radius_full, background: "rgba(255,255,255,.08)", border: "1px solid rgba(255,255,255,.12)", marginBottom: 28, backdropFilter: "blur(4px)" }}>
              <div style={{ width: 6, height: 6, borderRadius: "50%", background: "var(--success)" }} />
              <span style={{ fontSize: 13, fontWeight: 500, color: "rgba(255,255,255,.8)", letterSpacing: ".02em" }}>Platform connecting talent worldwide</span>
            </div>
          </div>
          <h1 className="fade-up" style={{ animationDelay: ".2s", fontSize: "clamp(40px, 6vw, 72px)", fontWeight: 800, color: "white", lineHeight: 1.08, letterSpacing: "-.03em", marginBottom: 24, maxWidth: 800, margin: "0 auto 24px" }}>
            Build Your Dream<br />
            <span style={{ background: "linear-gradient(135deg, var(--brand-300), var(--accent))", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>Team Today</span>
          </h1>
          <p className="fade-up" style={{ animationDelay: ".3s", fontSize: "clamp(16px, 2vw, 20px)", color: "rgba(255,255,255,.65)", maxWidth: 580, margin: "0 auto 40px", lineHeight: 1.6 }}>
            Connect with vetted freelancers, bid on projects, and assemble powerful teams. From solo gigs to enterprise projects.
          </p>
          <div className="fade-up" style={{ animationDelay: ".4s", display: "flex", justifyContent: "center", gap: 14, flexWrap: "wrap" }}>
            <button onClick={() => onNavigate("register")} style={{ ...btnStyle, background: "white", color: "var(--brand-700)", padding: "14px 32px", fontSize: 16, boxShadow: "0 4px 14px rgba(0,0,0,.15)", borderRadius: var_radius_lg }}>
              Start Freelancing <Icons.ArrowRight />
            </button>
            <button onClick={() => onNavigate("jobs")} style={{ ...btnStyle, background: "rgba(255,255,255,.08)", color: "white", border: "1px solid rgba(255,255,255,.2)", padding: "14px 32px", fontSize: 16, borderRadius: var_radius_lg, backdropFilter: "blur(4px)" }}>
              Browse Jobs
            </button>
          </div>

          {/* Stats */}
          <div className="fade-up" style={{ animationDelay: ".5s", display: "flex", justifyContent: "center", gap: 48, marginTop: 64, flexWrap: "wrap" }}>
            {[
              { value: "2,400+", label: "Freelancers" },
              { value: "850+", label: "Active Jobs" },
              { value: "$4.2M", label: "Paid Out" },
              { value: "4.9/5", label: "Avg Rating" },
            ].map((s, i) => (
              <div key={i} style={{ textAlign: "center" }}>
                <div style={{ fontSize: 28, fontWeight: 800, color: "white", fontFamily: "var(--font-mono)", letterSpacing: "-.02em" }}>{s.value}</div>
                <div style={{ fontSize: 13, color: "rgba(255,255,255,.5)", fontWeight: 500, marginTop: 4, textTransform: "uppercase", letterSpacing: ".06em" }}>{s.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features */}
      <section style={{ padding: "96px 24px", maxWidth: 1200, margin: "0 auto" }}>
        <div style={{ textAlign: "center", marginBottom: 64 }}>
          <h2 style={{ fontSize: 36, fontWeight: 800, color: "var(--gray-900)", letterSpacing: "-.02em", marginBottom: 12 }}>How It Works</h2>
          <p style={{ fontSize: 17, color: "var(--gray-500)", maxWidth: 480, margin: "0 auto" }}>Three simple steps to launch your next project</p>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: 24 }}>
          {[
            { icon: <Icons.Briefcase />, num: "01", title: "Post Your Project", desc: "Describe your needs, set budget, define skills required. Solo gigs or team projects." },
            { icon: <Icons.Users />, num: "02", title: "Get Matched", desc: "Freelancers bid on your project. Review portfolios, ratings, and proposals." },
            { icon: <Icons.Zap />, num: "03", title: "Build & Ship", desc: "Assemble your team, collaborate, and deliver exceptional results together." },
          ].map((f, i) => (
            <div key={i} style={{ ...cardStyle, position: "relative", overflow: "hidden", cursor: "default" }}>
              <div style={{ position: "absolute", top: 16, right: 20, fontSize: 60, fontWeight: 800, fontFamily: "var(--font-mono)", color: "var(--gray-100)", lineHeight: 1 }}>{f.num}</div>
              <div style={{ width: 48, height: 48, borderRadius: var_radius_lg, background: "var(--brand-50)", color: "var(--brand-600)", display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 20 }}>{f.icon}</div>
              <h3 style={{ fontSize: 20, fontWeight: 700, color: "var(--gray-900)", marginBottom: 10 }}>{f.title}</h3>
              <p style={{ fontSize: 15, color: "var(--gray-500)", lineHeight: 1.6 }}>{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Why BridgeofTalent — competitive differentiators */}
      <section style={{ padding: "80px 24px", background: "var(--gray-50)" }}>
        <div style={{ maxWidth: 1200, margin: "0 auto" }}>
          <div style={{ textAlign: "center", marginBottom: 56 }}>
            <h2 style={{ fontSize: 36, fontWeight: 800, color: "var(--gray-900)", letterSpacing: "-.02em", marginBottom: 12 }}>Why BridgeofTalent</h2>
            <p style={{ fontSize: 17, color: "var(--gray-500)", maxWidth: 560, margin: "0 auto" }}>Built to keep more money in your pocket and more trust in every hire</p>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 20 }}>
            {[
              { icon: <Icons.DollarSign />, title: "Transparent 5% fee", desc: "A single, flat 5% platform fee — no sliding scales, no per-bid credits, no surprise buyer charges. Compare that to 10–20% elsewhere." },
              { icon: <Icons.Shield />, title: "Escrow on every project", desc: "Funds are held safely and released on your approval, so freelancers always get paid and clients only pay for delivered work." },
              { icon: <Icons.BadgeCheck />, title: "Verified talent & Job Success Score", desc: "Identity checks, verified skills, and a transparent Job Success Score help you hire with confidence." },
              { icon: <Icons.Zap />, title: "Smart matching", desc: "Jobs are matched to freelancers by skills automatically, so you spend less time searching and more time shipping." },
            ].map((f, i) => (
              <div key={i} style={{ ...cardStyle, cursor: "default" }}>
                <div style={{ width: 44, height: 44, borderRadius: var_radius_lg, background: "var(--brand-50)", color: "var(--brand-600)", display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 16 }}>{f.icon}</div>
                <h3 style={{ fontSize: 17, fontWeight: 700, color: "var(--gray-900)", marginBottom: 8 }}>{f.title}</h3>
                <p style={{ fontSize: 14, color: "var(--gray-500)", lineHeight: 1.6 }}>{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section style={{ padding: "80px 24px", background: "linear-gradient(135deg, var(--brand-600), var(--brand-500))", textAlign: "center" }}>
        <h2 style={{ fontSize: 32, fontWeight: 800, color: "white", marginBottom: 16 }}>Ready to get started?</h2>
        <p style={{ fontSize: 17, color: "rgba(255,255,255,.8)", marginBottom: 32 }}>Join thousands of professionals on BridgeofTalent</p>
        <div style={{ display: "flex", justifyContent: "center", gap: 14 }}>
          <button onClick={() => onNavigate("register")} style={{ ...btnStyle, background: "white", color: "var(--brand-700)", padding: "13px 28px", fontSize: 15, borderRadius: var_radius_lg }}>Create Account</button>
          <button onClick={() => onNavigate("jobs")} style={{ ...btnStyle, background: "transparent", color: "white", border: "1.5px solid rgba(255,255,255,.4)", padding: "13px 28px", fontSize: 15, borderRadius: var_radius_lg }}>Browse Jobs</button>
        </div>
      </section>

      {/* Footer */}
      <Footer onNavigate={onNavigate} />
    </div>
  );
}

// ============================================================================
// LOGIN PAGE
// ============================================================================
function LoginPage({ onLogin, onNavigate }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", padding: 24, background: "var(--gray-50)" }}>
      <div className="fade-up" style={{ width: "100%", maxWidth: 420, ...cardStyle, boxShadow: "var(--shadow-xl)", padding: 40 }}>
        <div style={{ textAlign: "center", marginBottom: 32 }}>
          <div style={{ width: 48, height: 48, borderRadius: var_radius_lg, background: "linear-gradient(135deg, var(--brand-600), var(--brand-400))", display: "inline-flex", alignItems: "center", justifyContent: "center", color: "white", fontWeight: 700, fontSize: 16, fontFamily: "var(--font-mono)", marginBottom: 16 }}>BT</div>
          <h1 style={{ fontSize: 26, fontWeight: 800, color: "var(--gray-900)", marginBottom: 6 }}>Welcome back</h1>
          <p style={{ fontSize: 15, color: "var(--gray-500)" }}>Sign in to your account</p>
        </div>

        <form onSubmit={e => { e.preventDefault(); onLogin(email, password); }} style={{ display: "flex", flexDirection: "column", gap: 18 }}>
          <div>
            <label style={{ display: "block", fontSize: 13, fontWeight: 600, color: "var(--gray-700)", marginBottom: 6 }}>Email</label>
            <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="you@example.com" style={inputStyle} required />
          </div>
          <div>
            <label style={{ display: "block", fontSize: 13, fontWeight: 600, color: "var(--gray-700)", marginBottom: 6 }}>Password</label>
            <input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="Enter your password" style={inputStyle} required />
          </div>
          <button type="submit" style={{ ...btnStyle, ...btnPrimary, width: "100%", justifyContent: "center", padding: "12px 0", fontSize: 15, borderRadius: var_radius_md, marginTop: 4 }}>Sign In</button>
        </form>

        <p style={{ textAlign: "center", marginTop: 24, fontSize: 14, color: "var(--gray-500)" }}>
          Don't have an account? <button onClick={() => onNavigate("register")} style={{ color: "var(--brand-600)", fontWeight: 600, background: "none", border: "none", cursor: "pointer", fontSize: 14, fontFamily: "var(--font-sans)" }}>Sign up</button>
        </p>
      </div>
    </div>
  );
}

// ============================================================================
// REGISTER PAGE
// ============================================================================
function RegisterPage({ onRegister, onNavigate }) {
  const [step, setStep] = useState(1);
  const [data, setData] = useState({ email: "", password: "", name: "", role: "freelancer", title: "", location: "", hourlyRate: 50, skills: [], bio: "", company: "" });
  const [skillInput, setSkillInput] = useState("");

  const addSkill = () => {
    if (skillInput.trim() && !data.skills.includes(skillInput.trim())) {
      setData(d => ({ ...d, skills: [...d.skills, skillInput.trim()] }));
      setSkillInput("");
    }
  };

  const removeSkill = (s) => setData(d => ({ ...d, skills: d.skills.filter(sk => sk !== s) }));

  return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", padding: 24, background: "var(--gray-50)" }}>
      <div className="fade-up" style={{ width: "100%", maxWidth: 480, ...cardStyle, boxShadow: "var(--shadow-xl)", padding: 40 }}>
        <div style={{ textAlign: "center", marginBottom: 32 }}>
          <div style={{ width: 48, height: 48, borderRadius: var_radius_lg, background: "linear-gradient(135deg, var(--brand-600), var(--brand-400))", display: "inline-flex", alignItems: "center", justifyContent: "center", color: "white", fontWeight: 700, fontSize: 16, fontFamily: "var(--font-mono)", marginBottom: 16 }}>BT</div>
          <h1 style={{ fontSize: 26, fontWeight: 800, color: "var(--gray-900)", marginBottom: 6 }}>Create Account</h1>
          <p style={{ fontSize: 15, color: "var(--gray-500)" }}>Step {step} of {data.role === "freelancer" ? 2 : 1}</p>
        </div>

        {step === 1 && (
          <form onSubmit={e => {
            e.preventDefault();
            if (data.role === "client") { onRegister(data); } else { setStep(2); }
          }} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <div>
              <label style={labelStyle}>Full Name</label>
              <input value={data.name} onChange={e => setData(d => ({ ...d, name: e.target.value }))} placeholder="John Doe" style={inputStyle} required />
            </div>
            <div>
              <label style={labelStyle}>Email</label>
              <input type="email" value={data.email} onChange={e => setData(d => ({ ...d, email: e.target.value }))} placeholder="you@example.com" style={inputStyle} required />
            </div>
            <div>
              <label style={labelStyle}>Password</label>
              <input type="password" value={data.password} onChange={e => setData(d => ({ ...d, password: e.target.value }))} placeholder="Min 8 chars, uppercase + number" style={inputStyle} required minLength={8} />
            </div>
            <div>
              <label style={labelStyle}>I want to</label>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                {[["freelancer", "Work as Freelancer", "💼"], ["client", "Hire Talent", "🏢"]].map(([val, label, emoji]) => (
                  <button key={val} type="button" onClick={() => setData(d => ({ ...d, role: val }))} style={{
                    padding: "16px 12px", borderRadius: var_radius_lg, cursor: "pointer", textAlign: "center",
                    border: data.role === val ? "2px solid var(--brand-500)" : "2px solid var(--gray-200)",
                    background: data.role === val ? "var(--brand-50)" : "white", fontFamily: "var(--font-sans)"
                  }}>
                    <div style={{ fontSize: 24, marginBottom: 6 }}>{emoji}</div>
                    <div style={{ fontSize: 13, fontWeight: 600, color: data.role === val ? "var(--brand-700)" : "var(--gray-700)" }}>{label}</div>
                  </button>
                ))}
              </div>
            </div>
            {data.role === "client" && (
              <div>
                <label style={labelStyle}>Company Name</label>
                <input value={data.company} onChange={e => setData(d => ({ ...d, company: e.target.value }))} placeholder="Your company" style={inputStyle} />
              </div>
            )}
            <button type="submit" style={{ ...btnStyle, ...btnPrimary, width: "100%", justifyContent: "center", padding: "12px 0", fontSize: 15, marginTop: 4 }}>
              {data.role === "client" ? "Create Account" : "Next: Your Profile"} <Icons.ArrowRight />
            </button>
          </form>
        )}

        {step === 2 && (
          <form onSubmit={e => { e.preventDefault(); onRegister(data); }} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <div>
              <label style={labelStyle}>Professional Title</label>
              <input value={data.title} onChange={e => setData(d => ({ ...d, title: e.target.value }))} placeholder="e.g. Full Stack Developer" style={inputStyle} required />
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              <div>
                <label style={labelStyle}>Location</label>
                <input value={data.location} onChange={e => setData(d => ({ ...d, location: e.target.value }))} placeholder="City, State" style={inputStyle} />
              </div>
              <div>
                <label style={labelStyle}>Hourly Rate ($)</label>
                <input type="number" value={data.hourlyRate} onChange={e => setData(d => ({ ...d, hourlyRate: Number(e.target.value) }))} style={inputStyle} min={5} />
              </div>
            </div>
            <div>
              <label style={labelStyle}>Skills</label>
              <div style={{ display: "flex", gap: 8 }}>
                <input value={skillInput} onChange={e => setSkillInput(e.target.value)} onKeyDown={e => e.key === "Enter" && (e.preventDefault(), addSkill())} placeholder="Type a skill, press Enter" style={{ ...inputStyle, flex: 1 }} list="skills-list" />
                <datalist id="skills-list">{INITIAL_SKILLS.map(s => <option key={s} value={s} />)}</datalist>
                <button type="button" onClick={addSkill} style={{ ...btnStyle, ...btnSecondary, padding: "8px 14px" }}><Icons.Plus /></button>
              </div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 8 }}>
                {data.skills.map(s => (
                  <span key={s} style={{ display: "inline-flex", alignItems: "center", gap: 4, padding: "4px 10px", background: "var(--brand-50)", color: "var(--brand-700)", fontSize: 12, fontWeight: 600, borderRadius: var_radius_full }}>
                    {s} <button type="button" onClick={() => removeSkill(s)} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--brand-400)", fontSize: 14, lineHeight: 1 }}>&times;</button>
                  </span>
                ))}
              </div>
            </div>
            <div>
              <label style={labelStyle}>Bio</label>
              <textarea value={data.bio} onChange={e => setData(d => ({ ...d, bio: e.target.value }))} placeholder="Tell clients about your experience..." rows={3} style={{ ...inputStyle, resize: "vertical" }} />
            </div>
            <div style={{ display: "flex", gap: 10 }}>
              <button type="button" onClick={() => setStep(1)} style={{ ...btnStyle, ...btnSecondary, flex: 1, justifyContent: "center" }}>Back</button>
              <button type="submit" style={{ ...btnStyle, ...btnPrimary, flex: 2, justifyContent: "center" }}>Create Account</button>
            </div>
          </form>
        )}

        <p style={{ textAlign: "center", marginTop: 24, fontSize: 14, color: "var(--gray-500)" }}>
          Already have an account? <button onClick={() => onNavigate("login")} style={{ color: "var(--brand-600)", fontWeight: 600, background: "none", border: "none", cursor: "pointer", fontSize: 14, fontFamily: "var(--font-sans)" }}>Sign in</button>
        </p>
      </div>
    </div>
  );
}

const labelStyle = { display: "block", fontSize: 13, fontWeight: 600, color: "var(--gray-700)", marginBottom: 6 };
const var_radius_full = "9999px";

// ============================================================================
// DASHBOARD PAGE (Freelancer)
// ============================================================================
function DashboardPage({ freelancer, jobs, projects, onNavigate, profileViews = {}, activityLog = [], recommendedJobs = [] }) {
  if (!freelancer) return <div style={{ padding: 40, textAlign: "center" }}>Loading...</div>;
  const myBids = jobs.filter(j => j.bids.some(b => b.freelancerId === freelancer.id));
  const myProjects = projects.filter(p => p.members?.includes(freelancer.id));
  const acceptedBids = jobs.filter(j => j.bids.some(b => b.freelancerId === freelancer.id && b.status === "accepted")).length;
  const bidSuccessRate = myBids.length > 0 ? Math.round((acceptedBids / myBids.length) * 100) : 0;
  const earnings = myProjects.filter(p => p.escrowReleased).reduce((acc, p) => acc + (p.budget || 0) / (p.members?.length || 1), 0);
  const views = profileViews[freelancer.id] ?? 0;
  const myActivity = activityLog.filter(a => a.userId === freelancer.id).slice(0, 10);

  return (
    <div style={{ maxWidth: 1200, margin: "0 auto", padding: "32px 24px" }}>
      {/* Header card */}
      <div className="fade-up" style={{ ...cardStyle, background: "linear-gradient(135deg, var(--brand-600), var(--brand-500))", marginBottom: 24, padding: 32, position: "relative", overflow: "hidden" }}>
        <div style={{ position: "absolute", top: -40, right: -40, width: 200, height: 200, borderRadius: "50%", background: "rgba(255,255,255,.08)" }} />
        <div style={{ display: "flex", alignItems: "center", gap: 20, position: "relative" }}>
          <div style={{ width: 72, height: 72, borderRadius: 18, background: "rgba(255,255,255,.2)", display: "flex", alignItems: "center", justifyContent: "center", color: "white", fontSize: 26, fontWeight: 700 }}>{freelancer.avatar}</div>
          <div>
            <h1 style={{ fontSize: 26, fontWeight: 800, color: "white", marginBottom: 4 }}>{freelancer.name}</h1>
            <p style={{ fontSize: 15, color: "rgba(255,255,255,.8)" }}>{freelancer.title}</p>
            <div style={{ display: "flex", gap: 16, marginTop: 8 }}>
              <span style={{ fontSize: 13, color: "rgba(255,255,255,.7)", display: "flex", alignItems: "center", gap: 4 }}><Icons.Star /> {freelancer.rating} ({freelancer.reviewCount} reviews)</span>
              <span style={{ fontSize: 13, color: "rgba(255,255,255,.7)", display: "flex", alignItems: "center", gap: 4 }}><Icons.DollarSign /> ${freelancer.hourlyRate}/hr</span>
              {freelancer.location && <span style={{ fontSize: 13, color: "rgba(255,255,255,.7)", display: "flex", alignItems: "center", gap: 4 }}><Icons.MapPin /> {freelancer.location}</span>}
            </div>
          </div>
        </div>
      </div>

      {/* Stats & Analytics */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 16, marginBottom: 24 }}>
        {[
          { label: "Active Bids", value: myBids.length, color: "var(--brand-600)" },
          { label: "Projects", value: myProjects.length, color: "var(--success)" },
          { label: "Skills", value: freelancer.skills.length, color: "var(--accent)" },
          { label: "Earnings", value: `$${earnings.toLocaleString()}`, color: "var(--gray-800)" },
          { label: "Bid success rate", value: `${bidSuccessRate}%`, color: "var(--success)" },
          { label: "Profile views", value: views, color: "var(--gray-600)" },
        ].map((s, i) => (
          <div key={i} className="fade-up" style={{ ...cardStyle, animationDelay: `${i * .1}s` }}>
            <div style={{ fontSize: 28, fontWeight: 800, color: s.color, fontFamily: "var(--font-mono)" }}>{s.value}</div>
            <div style={{ fontSize: 13, color: "var(--gray-500)", fontWeight: 500, marginTop: 4 }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* Skills */}
      <div style={{ ...cardStyle, marginBottom: 24 }}>
        <h3 style={{ fontSize: 16, fontWeight: 700, color: "var(--gray-900)", marginBottom: 12 }}>Your Skills</h3>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
          {freelancer.skills.map(s => (
            <span key={s} style={{ padding: "6px 14px", background: "var(--gray-100)", color: "var(--gray-700)", fontSize: 13, fontWeight: 500, borderRadius: var_radius_full }}>{s}</span>
          ))}
        </div>
      </div>

      {recommendedJobs.length > 0 && (
        <div style={{ ...cardStyle, marginBottom: 24 }}>
          <h3 style={{ fontSize: 16, fontWeight: 700, color: "var(--gray-900)", marginBottom: 12 }}>Recommended for you</h3>
          <p style={{ fontSize: 13, color: "var(--gray-500)", marginBottom: 12 }}>Jobs matching your skills</p>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {recommendedJobs.map(j => (
              <div key={j.id} style={{ padding: 12, background: "var(--gray-50)", borderRadius: 8, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div><div style={{ fontSize: 14, fontWeight: 600, color: "var(--gray-900)" }}>{j.title}</div><div style={{ fontSize: 12, color: "var(--gray-500)" }}>${j.budgetMin?.toLocaleString()}–${j.budgetMax?.toLocaleString()}</div></div>
                <button onClick={() => onNavigate("jobs")} style={{ ...btnStyle, ...btnPrimary, padding: "6px 12px", fontSize: 12 }}>View</button>
              </div>
            ))}
          </div>
        </div>
      )}
      {myActivity.length > 0 && (
        <div style={{ ...cardStyle, marginBottom: 24 }}>
          <h3 style={{ fontSize: 16, fontWeight: 700, color: "var(--gray-900)", marginBottom: 12 }}>Recent activity</h3>
          {myActivity.map(a => (
            <div key={a.id} style={{ padding: "8px 0", borderBottom: "1px solid var(--gray-100)", fontSize: 13, color: "var(--gray-600)" }}>{a.message}</div>
          ))}
        </div>
      )}
      {/* Recent bids */}
      <div style={{ ...cardStyle }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
          <h3 style={{ fontSize: 16, fontWeight: 700, color: "var(--gray-900)" }}>Your Bids</h3>
          <button onClick={() => onNavigate("jobs")} style={{ ...btnStyle, ...btnSecondary, padding: "6px 14px", fontSize: 13 }}>Find Jobs</button>
        </div>
        {myBids.length === 0 ? (
          <p style={{ fontSize: 14, color: "var(--gray-400)", textAlign: "center", padding: 24 }}>No bids yet. Browse jobs to get started!</p>
        ) : (
          myBids.map(j => (
            <div key={j.id} style={{ padding: "12px 0", borderBottom: "1px solid var(--gray-100)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div>
                <div style={{ fontSize: 14, fontWeight: 600, color: "var(--gray-900)" }}>{j.title}</div>
                <div style={{ fontSize: 12, color: "var(--gray-500)" }}>{j.clientName}</div>
              </div>
              <span style={{ padding: "4px 10px", borderRadius: var_radius_full, fontSize: 11, fontWeight: 600, background: "var(--brand-50)", color: "var(--brand-600)" }}>Bid Sent</span>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

// ============================================================================
// CLIENT DASHBOARD PAGE
// ============================================================================
function ClientDashboardPage({ jobs, projects, currentUser, onNavigate, freelancers, talentPools = [], onAddPool, onAddToPool, onRemoveFromPool, activityLog = [] }) {
  const [newPoolName, setNewPoolName] = useState("");
  const myJobs = jobs.filter(j => j.clientId === currentUser?.id);
  const openJobs = myJobs.filter(j => j.status === "open");
  const totalBids = myJobs.reduce((acc, j) => acc + (j.bids?.length || 0), 0);
  const myProjects = projects.filter(p => p.clientId === currentUser?.id);
  const activeProjects = myProjects.filter(p => p.status === "active");
  const totalSpending = myProjects.reduce((acc, p) => acc + (p.budget || 0), 0);
  const myPools = talentPools.filter(p => p.clientId === currentUser?.id);
  const myActivity = activityLog.filter(a => a.userId === currentUser?.id).slice(0, 8);

  return (
    <div style={{ maxWidth: 1200, margin: "0 auto", padding: "32px 24px" }}>
      <div className="fade-up" style={{ ...cardStyle, background: "linear-gradient(135deg, var(--brand-600), var(--brand-500))", marginBottom: 24, padding: 32, position: "relative", overflow: "hidden" }}>
        <div style={{ position: "absolute", top: -40, right: -40, width: 200, height: 200, borderRadius: "50%", background: "rgba(255,255,255,.08)" }} />
        <div style={{ position: "relative" }}>
          <h1 style={{ fontSize: 26, fontWeight: 800, color: "white", marginBottom: 4 }}>Client Dashboard</h1>
          <p style={{ fontSize: 15, color: "rgba(255,255,255,.8)" }}>{currentUser?.company || currentUser?.name}</p>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 16, marginBottom: 24 }}>
        {[
          { label: "Posted Jobs", value: openJobs.length, sub: `${myJobs.length - openJobs.length} closed`, color: "var(--brand-600)" },
          { label: "Incoming Bids", value: totalBids, color: "var(--accent)" },
          { label: "Active Projects", value: activeProjects.length, color: "var(--success)" },
          { label: "Total Spending", value: `$${totalSpending.toLocaleString()}`, color: "var(--gray-800)" },
        ].map((s, i) => (
          <div key={i} className="fade-up" style={{ ...cardStyle, animationDelay: `${i * .1}s` }}>
            <div style={{ fontSize: 28, fontWeight: 800, color: s.color, fontFamily: "var(--font-mono)" }}>{s.value}</div>
            <div style={{ fontSize: 13, color: "var(--gray-500)", fontWeight: 500, marginTop: 4 }}>{s.label}</div>
            {s.sub && <div style={{ fontSize: 11, color: "var(--gray-400)", marginTop: 2 }}>{s.sub}</div>}
          </div>
        ))}
      </div>

      <div style={{ ...cardStyle, marginBottom: 24 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
          <h3 style={{ fontSize: 16, fontWeight: 700, color: "var(--gray-900)" }}>Your Posted Jobs</h3>
          <button onClick={() => onNavigate("post-job")} style={{ ...btnStyle, ...btnPrimary, padding: "6px 14px", fontSize: 13 }}><Icons.Plus /> Post Job</button>
        </div>
        {myJobs.length === 0 ? (
          <p style={{ fontSize: 14, color: "var(--gray-400)", textAlign: "center", padding: 24 }}>No jobs yet. Post a job to get started!</p>
        ) : (
          myJobs.slice(0, 5).map(j => (
            <div key={j.id} style={{ padding: "12px 0", borderBottom: "1px solid var(--gray-100)", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8 }}>
              <div>
                <div style={{ fontSize: 14, fontWeight: 600, color: "var(--gray-900)" }}>{j.title}</div>
                <div style={{ fontSize: 12, color: "var(--gray-500)" }}>{j.bids?.length || 0} bid(s) · {j.status}</div>
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                <button onClick={() => onNavigate("jobs")} style={{ ...btnStyle, ...btnSecondary, padding: "6px 12px", fontSize: 12 }}>View / Manage Bids</button>
              </div>
            </div>
          ))
        )}
      </div>

      <div style={{ ...cardStyle }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
          <h3 style={{ fontSize: 16, fontWeight: 700, color: "var(--gray-900)" }}>Active Projects</h3>
          <button onClick={() => onNavigate("projects")} style={{ ...btnStyle, ...btnSecondary, padding: "6px 14px", fontSize: 13 }}>View All</button>
        </div>
        {myProjects.length === 0 ? (
          <p style={{ fontSize: 14, color: "var(--gray-400)", textAlign: "center", padding: 24 }}>No active projects. Accept a bid to start a project.</p>
        ) : (
          myProjects.slice(0, 5).map(p => (
            <div key={p.id} style={{ padding: "12px 0", borderBottom: "1px solid var(--gray-100)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div>
                <div style={{ fontSize: 14, fontWeight: 600, color: "var(--gray-900)" }}>{p.title}</div>
                <div style={{ fontSize: 12, color: "var(--gray-500)" }}>${p.budget?.toLocaleString()} · {p.members?.length || 0} member(s)</div>
              </div>
              <span style={{ padding: "4px 10px", borderRadius: var_radius_full, fontSize: 11, fontWeight: 600, background: "var(--success-light)", color: "var(--success)" }}>{p.status}</span>
            </div>
          ))
        )}
      </div>
      {myPools.length > 0 && (
        <div style={{ ...cardStyle, marginBottom: 24 }}>
          <h3 style={{ fontSize: 16, fontWeight: 700, color: "var(--gray-900)", marginBottom: 12 }}>Talent pools</h3>
          <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
            <input value={newPoolName} onChange={e => setNewPoolName(e.target.value)} placeholder="New pool name" style={{ ...inputStyle, flex: 1, maxWidth: 200 }} />
            <button onClick={() => { if (newPoolName.trim()) { onAddPool?.(newPoolName.trim()); setNewPoolName(""); } }} style={{ ...btnStyle, ...btnSecondary, padding: "8px 14px" }}>Add pool</button>
          </div>
          {myPools.map(pool => (
            <div key={pool.id} style={{ padding: "10px 0", borderBottom: "1px solid var(--gray-100)" }}>
              <div style={{ fontSize: 14, fontWeight: 600, color: "var(--gray-800)", marginBottom: 6 }}>{pool.name}</div>
              <div style={{ fontSize: 12, color: "var(--gray-500)" }}>{(pool.freelancerIds || []).length} freelancer(s) · <button type="button" onClick={() => onNavigate("freelancers")} style={{ background: "none", border: "none", color: "var(--brand-600)", cursor: "pointer", fontSize: 12 }}>Manage</button></div>
            </div>
          ))}
        </div>
      )}
      {myPools.length === 0 && (
        <div style={{ ...cardStyle, marginBottom: 24 }}>
          <h3 style={{ fontSize: 16, fontWeight: 700, color: "var(--gray-900)", marginBottom: 8 }}>Talent pools</h3>
          <p style={{ fontSize: 13, color: "var(--gray-500)", marginBottom: 10 }}>Save freelancers into shortlists for quick hiring.</p>
          <input value={newPoolName} onChange={e => setNewPoolName(e.target.value)} placeholder="Pool name" style={{ ...inputStyle, maxWidth: 240, marginBottom: 8 }} />
          <button type="button" onClick={() => { if (newPoolName.trim()) { onAddPool?.(newPoolName.trim()); setNewPoolName(""); } }} style={{ ...btnStyle, ...btnPrimary, padding: "8px 14px" }}>Create pool</button>
        </div>
      )}
      {myActivity.length > 0 && (
        <div style={{ ...cardStyle }}>
          <h3 style={{ fontSize: 16, fontWeight: 700, color: "var(--gray-900)", marginBottom: 12 }}>Recent activity</h3>
          {myActivity.map(a => (
            <div key={a.id} style={{ padding: "8px 0", borderBottom: "1px solid var(--gray-100)", fontSize: 13, color: "var(--gray-600)" }}>{a.message}</div>
          ))}
        </div>
      )}
    </div>
  );
}

// ============================================================================
// FREELANCERS PAGE
// ============================================================================
// ============================================================================
// FREELANCER CARD SKELETON
// ----------------------------------------------------------------------------
// Shown while the DB fetch is in flight so the page doesn't appear empty.
// The shape matches the real FreelancerCard so the layout doesn't shift when
// real data arrives. CSS keyframe `skeleton-pulse` is defined in the global
// CSS string near the top of the App component.
// ============================================================================
function FreelancerCardSkeleton() {
  const block = (w, h, mt = 0) => ({
    width: w, height: h, marginTop: mt,
    background: "var(--gray-100)",
    borderRadius: 6,
    animation: "skeleton-pulse 1.5s ease-in-out infinite",
  });
  return (
    <div style={{ ...cardStyle, cursor: "default" }} aria-hidden="true">
      <div style={{ display: "flex", alignItems: "start", gap: 14, marginBottom: 14 }}>
        <div style={{ width: 50, height: 50, borderRadius: 14, background: "var(--gray-100)", flexShrink: 0, animation: "skeleton-pulse 1.5s ease-in-out infinite" }} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={block("60%", 16)} />
          <div style={block("40%", 12, 8)} />
        </div>
      </div>
      <div style={block("100%", 12, 4)} />
      <div style={block("90%", 12, 6)} />
      <div style={{ display: "flex", gap: 12, marginTop: 14 }}>
        <div style={block(80, 14)} />
        <div style={block(60, 14)} />
        <div style={block(70, 14)} />
      </div>
      <div style={{ display: "flex", gap: 6, marginTop: 14 }}>
        <div style={block(60, 22)} />
        <div style={block(70, 22)} />
        <div style={block(50, 22)} />
      </div>
    </div>
  );
}

function FreelancersPage({ freelancers, loading = false, onNavigate, onViewProfile, savedFreelancerIds = [], onToggleSaveFreelancer, compareIds = [], onCompare, onNavigateToCompare, onSaveSearch }) {
  const [search, setSearch] = useState("");
  const [skillFilter, setSkillFilter] = useState("");
  const [rateMin, setRateMin] = useState("");
  const [rateMax, setRateMax] = useState("");
  const [sortBy, setSortBy] = useState("rating");
  const filtered = useMemo(() => {
    let list = freelancers.filter(f => {
      const matchSearch = f.name.toLowerCase().includes(search.toLowerCase()) ||
        f.title.toLowerCase().includes(search.toLowerCase()) ||
        (f.skills || []).some(s => s.toLowerCase().includes(search.toLowerCase()));
      const matchSkill = !skillFilter || (f.skills || []).some(s => s === skillFilter);
      const matchRateMin = !rateMin || (f.hourlyRate >= Number(rateMin));
      const matchRateMax = !rateMax || (f.hourlyRate <= Number(rateMax));
      return matchSearch && matchSkill && matchRateMin && matchRateMax;
    });
    if (sortBy === "rating") list = [...list].sort((a, b) => (b.rating || 0) - (a.rating || 0));
    else if (sortBy === "jss") list = [...list].sort((a, b) => jobSuccessScore(b) - jobSuccessScore(a));
    else if (sortBy === "rate-low") list = [...list].sort((a, b) => (a.hourlyRate || 0) - (b.hourlyRate || 0));
    else if (sortBy === "rate-high") list = [...list].sort((a, b) => (b.hourlyRate || 0) - (a.hourlyRate || 0));
    return list;
  }, [freelancers, search, skillFilter, rateMin, rateMax, sortBy]);

  return (
    <div style={{ maxWidth: 1200, margin: "0 auto", padding: "32px 24px" }}>
      <div style={{ marginBottom: 32, display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12 }}>
        <div>
          <h1 style={{ fontSize: 32, fontWeight: 800, color: "var(--gray-900)", letterSpacing: "-.02em", marginBottom: 8 }}>Find Talent</h1>
          <p style={{ fontSize: 15, color: "var(--gray-500)" }}>Discover skilled professionals for your projects</p>
        </div>
        {compareIds.length > 0 && (
          <button onClick={onNavigateToCompare} style={{ ...btnStyle, ...btnPrimary, padding: "10px 18px" }}>Compare ({compareIds.length})</button>
        )}
      </div>

      <div style={{ display: "flex", flexWrap: "wrap", gap: 12, marginBottom: 28 }}>
        <div style={{ flex: "1 1 200px", minWidth: 200, position: "relative" }}>
          <div style={{ position: "absolute", left: 14, top: "50%", transform: "translateY(-50%)", color: "var(--gray-400)" }}><Icons.Search /></div>
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search by name, skill, or keyword..." style={{ ...inputStyle, paddingLeft: 42 }} />
        </div>
        <select value={skillFilter} onChange={e => setSkillFilter(e.target.value)} style={{ ...inputStyle, width: "auto", minWidth: 140, cursor: "pointer" }}>
          <option value="">All Skills</option>
          {INITIAL_SKILLS.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
        <input type="number" value={rateMin} onChange={e => setRateMin(e.target.value)} placeholder="Min $/hr" style={{ ...inputStyle, width: 100 }} />
        <input type="number" value={rateMax} onChange={e => setRateMax(e.target.value)} placeholder="Max $/hr" style={{ ...inputStyle, width: 100 }} />
        <select value={sortBy} onChange={e => setSortBy(e.target.value)} style={{ ...inputStyle, width: "auto", minWidth: 140, cursor: "pointer" }}>
          <option value="rating">Top rated</option>
          <option value="jss">Job Success Score</option>
          <option value="rate-low">Rate: Low to High</option>
          <option value="rate-high">Rate: High to Low</option>
        </select>
      </div>

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 10, marginBottom: 16 }}>
        <p style={{ fontSize: 14, color: "var(--gray-400)" }}>
          {loading && freelancers.length === 0
            ? "Loading freelancers..."
            : `Showing ${filtered.length} freelancer${filtered.length !== 1 ? "s" : ""}`}
        </p>
        {onSaveSearch && (search || skillFilter || rateMin || rateMax) && (
          <button
            onClick={() => onSaveSearch("freelancers", search || skillFilter || `Talent ${rateMin || 0}-${rateMax || "∞"}/hr`, { search, skillFilter, rateMin, rateMax, sortBy })}
            style={{ ...btnStyle, ...btnAccent, padding: "8px 16px", fontSize: 13 }}
          >
            <Icons.Heart /> Save this search
          </button>
        )}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(340px, 1fr))", gap: 20 }}>
        {loading && freelancers.length === 0 ? (
          Array.from({ length: 6 }).map((_, i) => <FreelancerCardSkeleton key={`skel-${i}`} />)
        ) : (
          filtered.map((f, i) => (
          <div key={f.id} role="button" tabIndex={0} onClick={() => onViewProfile?.(f.id)} onKeyDown={e => e.key === "Enter" && onViewProfile?.(f.id)} className="fade-up" style={{ ...cardStyle, animationDelay: `${i * .05}s`, cursor: "pointer" }}>
            <div style={{ display: "flex", alignItems: "start", gap: 14, marginBottom: 14 }}>
              <div style={{ width: 50, height: 50, borderRadius: 14, background: "linear-gradient(135deg, var(--brand-500), var(--accent))", display: "flex", alignItems: "center", justifyContent: "center", color: "white", fontWeight: 700, fontSize: 15, flexShrink: 0 }}>{f.avatar}</div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ fontSize: 16, fontWeight: 700, color: "var(--gray-900)" }}>{f.name}</span>
                  <span style={{ padding: "2px 8px", borderRadius: var_radius_full, fontSize: 11, fontWeight: 600, background: f.status === "available" ? "var(--success-light)" : "var(--warning-light)", color: f.status === "available" ? "var(--success)" : "var(--warning)" }}>{f.status}</span>
                </div>
                <p style={{ fontSize: 13, color: "var(--gray-500)" }}>{f.title}</p>
              </div>
            </div>
            <p style={{ fontSize: 13, color: "var(--gray-500)", lineHeight: 1.6, marginBottom: 14, overflow: "hidden", textOverflow: "ellipsis", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical" }}>{f.bio}</p>
            <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 14, fontSize: 13, flexWrap: "wrap" }}>
              <span style={{ display: "flex", alignItems: "center", gap: 4, color: "var(--warning)" }}><Icons.Star /> {f.rating} <span style={{ color: "var(--gray-400)" }}>({f.reviewCount})</span></span>
              <span style={{ fontWeight: 600, color: "var(--gray-800)" }}>${f.hourlyRate}/hr</span>
              <span title="Job Success Score" style={{ display: "flex", alignItems: "center", gap: 4, padding: "2px 8px", borderRadius: var_radius_full, fontSize: 11, fontWeight: 700, background: jobSuccessScore(f) >= 85 ? "var(--success-light)" : "var(--brand-50)", color: jobSuccessScore(f) >= 85 ? "var(--success)" : "var(--brand-700)" }}><Icons.BadgeCheck /> {jobSuccessScore(f)}% JSS</span>
              {f.location && <span style={{ display: "flex", alignItems: "center", gap: 4, color: "var(--gray-400)" }}><Icons.MapPin /> {f.location}</span>}
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
              {f.skills.slice(0, 4).map(s => (
                <span key={s} style={{ padding: "3px 10px", background: "var(--gray-100)", color: "var(--gray-600)", fontSize: 11, fontWeight: 600, borderRadius: var_radius_full }}>{s}</span>
              ))}
              {f.skills.length > 4 && <span style={{ padding: "3px 10px", background: "var(--brand-50)", color: "var(--brand-600)", fontSize: 11, fontWeight: 600, borderRadius: var_radius_full }}>+{f.skills.length - 4}</span>}
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 12, flexWrap: "wrap", gap: 8 }}>
              <span style={{ fontSize: 12, fontWeight: 600, color: "var(--brand-600)" }}>View full profile →</span>
              <div style={{ display: "flex", gap: 6 }}>
                <button onClick={e => { e.stopPropagation(); onCompare?.(f.id); }} style={{ ...btnStyle, ...btnSecondary, padding: "6px 10px" }} title="Compare">Compare</button>
                <button onClick={e => { e.stopPropagation(); onToggleSaveFreelancer?.(f.id); }} style={{ ...btnStyle, ...btnSecondary, padding: "6px 10px" }} title={savedFreelancerIds?.includes(f.id) ? "Remove from saved" : "Save"}>
                  {savedFreelancerIds?.includes(f.id) ? <Icons.HeartFilled style={{ color: "var(--error)" }} /> : <Icons.Heart />}
                </button>
              </div>
            </div>
          </div>
          ))
        )}
      </div>
    </div>
  );
}

// ============================================================================
// PROFILE PAGE (full freelancer profile)
// ============================================================================
function ProfilePage({ freelancer, reviews = [], onAddReview, onNavigate, onBack, currentUser, projects = [], onMessage, onSaveProfile }) {
  const [showReviewForm, setShowReviewForm] = useState(false);
  const [reviewRating, setReviewRating] = useState(5);
  const [reviewComment, setReviewComment] = useState("");
  const freelancerReviews = (reviews || []).filter(r => r.freelancerId === freelancer?.id);
  const hasWorkedWith = currentUser?.role === "client" && (projects || []).some(p => p.clientId === currentUser?.id && p.members?.includes(freelancer?.id));
  const hasReviewed = (reviews || []).some(r => r.freelancerId === freelancer?.id && r.clientId === currentUser?.id);

  // Is this freelancer the logged-in user? If so, show the "Edit profile"
  // affordance and allow switching into edit mode.
  const isOwnProfile = !!(freelancer && currentUser && freelancer.id === currentUser.id);

  // Edit-mode state. Draft holds the in-progress edits; on cancel we throw it
  // away, on save we send it to the parent's onSaveProfile and reset.
  const [isEditing, setIsEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [draft, setDraft] = useState(null);
  const [newSkill, setNewSkill] = useState("");

  // When we enter edit mode (or the underlying freelancer changes), seed
  // the draft from the current values. This means each "Edit profile" click
  // starts from a fresh copy of what's currently displayed.
  useEffect(() => {
    if (isEditing && freelancer) {
      setDraft({
        title: freelancer.title || "",
        location: freelancer.location || "",
        hourlyRate: String(freelancer.hourlyRate ?? ""),
        bio: freelancer.bio || "",
        skills: Array.isArray(freelancer.skills) ? [...freelancer.skills] : [],
        status: freelancer.status || "available",
        avatar: freelancer.avatar || "",
      });
      setNewSkill("");
    }
  }, [isEditing, freelancer]);

  const addSkillTag = () => {
    const s = newSkill.trim();
    if (!s || !draft) return;
    // De-dup case-insensitively but preserve the user's casing for display.
    const exists = draft.skills.some(x => x.toLowerCase() === s.toLowerCase());
    if (exists) { setNewSkill(""); return; }
    if (draft.skills.length >= 30) return;
    setDraft({ ...draft, skills: [...draft.skills, s.slice(0, 30)] });
    setNewSkill("");
  };
  const removeSkillTag = (idx) => {
    if (!draft) return;
    setDraft({ ...draft, skills: draft.skills.filter((_, i) => i !== idx) });
  };

  const handleSaveEdits = async () => {
    if (!onSaveProfile || !draft) return;
    setSaving(true);
    try {
      const ok = await onSaveProfile({
        title: draft.title,
        location: draft.location,
        hourlyRate: draft.hourlyRate,
        bio: draft.bio,
        skills: draft.skills,
        status: draft.status,
        avatar: draft.avatar,
      });
      if (ok) setIsEditing(false);
    } catch (e) {
      // Unexpected: handleUpdateProfile catches its own errors internally
      // and returns false. If we end up here something deeper went wrong.
      // eslint-disable-next-line no-console
      console.error("handleSaveEdits threw:", e);
    } finally {
      setSaving(false);
    }
  };

  if (!freelancer) {
    return (
      <div style={{ maxWidth: 800, margin: "0 auto", padding: "48px 24px", textAlign: "center" }}>
        <p style={{ color: "var(--gray-500)", marginBottom: 16 }}>Freelancer not found.</p>
        <button onClick={onBack} style={{ ...btnStyle, ...btnSecondary }}>Back to Find Talent</button>
      </div>
    );
  }
  return (
    <div style={{ maxWidth: 800, margin: "0 auto", padding: "32px 24px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12, marginBottom: 24 }}>
        <button onClick={onBack} style={{ ...btnStyle, ...btnSecondary, padding: "8px 14px", fontSize: 13 }}>← Back to Find Talent</button>
        {isOwnProfile && !isEditing && (
          <button onClick={() => setIsEditing(true)} style={{ ...btnStyle, ...btnPrimary, padding: "8px 16px", fontSize: 13 }}>Edit profile</button>
        )}
      </div>

      {isEditing && draft ? (
        <div className="fade-up" style={{ ...cardStyle, marginBottom: 24, padding: 32 }}>
          <h2 style={{ fontSize: 22, fontWeight: 800, color: "var(--gray-900)", marginBottom: 6 }}>Edit your profile</h2>
          <p style={{ fontSize: 13, color: "var(--gray-500)", marginBottom: 20 }}>Changes save to your account immediately.</p>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 16 }}>
            <label style={{ display: "block" }}>
              <span style={{ display: "block", fontSize: 12, fontWeight: 600, color: "var(--gray-700)", marginBottom: 6 }}>Title</span>
              <input value={draft.title} onChange={e => setDraft({ ...draft, title: e.target.value })} placeholder="e.g. Full Stack Developer" maxLength={80} style={inputStyle} />
            </label>
            <label style={{ display: "block" }}>
              <span style={{ display: "block", fontSize: 12, fontWeight: 600, color: "var(--gray-700)", marginBottom: 6 }}>Location</span>
              <input value={draft.location} onChange={e => setDraft({ ...draft, location: e.target.value })} placeholder="e.g. London, UK" maxLength={80} style={inputStyle} />
            </label>
            <label style={{ display: "block" }}>
              <span style={{ display: "block", fontSize: 12, fontWeight: 600, color: "var(--gray-700)", marginBottom: 6 }}>Hourly rate ($/hr)</span>
              <input type="number" min="0" max="10000" value={draft.hourlyRate} onChange={e => setDraft({ ...draft, hourlyRate: e.target.value })} placeholder="50" style={inputStyle} />
            </label>
            <label style={{ display: "block" }}>
              <span style={{ display: "block", fontSize: 12, fontWeight: 600, color: "var(--gray-700)", marginBottom: 6 }}>Status</span>
              <select value={draft.status} onChange={e => setDraft({ ...draft, status: e.target.value })} style={{ ...inputStyle, cursor: "pointer" }}>
                <option value="available">Available</option>
                <option value="busy">Busy</option>
              </select>
            </label>
            <label style={{ display: "block" }}>
              <span style={{ display: "block", fontSize: 12, fontWeight: 600, color: "var(--gray-700)", marginBottom: 6 }}>Avatar initials (max 2 chars)</span>
              <input value={draft.avatar} onChange={e => setDraft({ ...draft, avatar: e.target.value.toUpperCase().slice(0, 2) })} placeholder="e.g. SC" maxLength={2} style={inputStyle} />
            </label>
          </div>

          <label style={{ display: "block", marginBottom: 16 }}>
            <span style={{ display: "block", fontSize: 12, fontWeight: 600, color: "var(--gray-700)", marginBottom: 6 }}>Bio</span>
            <textarea value={draft.bio} onChange={e => setDraft({ ...draft, bio: e.target.value })} placeholder="Tell clients about your experience, specialisms, and what you're looking for." maxLength={1000} rows={4} style={{ ...inputStyle, resize: "vertical", fontFamily: "inherit" }} />
            <span style={{ display: "block", fontSize: 11, color: "var(--gray-400)", marginTop: 4 }}>{draft.bio.length} / 1000</span>
          </label>

          <div style={{ marginBottom: 20 }}>
            <span style={{ display: "block", fontSize: 12, fontWeight: 600, color: "var(--gray-700)", marginBottom: 6 }}>Skills</span>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 8, minHeight: 32 }}>
              {draft.skills.length === 0 && (
                <span style={{ fontSize: 12, color: "var(--gray-400)", padding: "6px 0" }}>No skills yet. Add some below.</span>
              )}
              {draft.skills.map((s, i) => (
                <span key={`${s}-${i}`} style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "4px 8px 4px 12px", background: "var(--brand-50)", color: "var(--brand-700)", fontSize: 12, fontWeight: 600, borderRadius: var_radius_full }}>
                  {s}
                  <button type="button" onClick={() => removeSkillTag(i)} aria-label={`Remove ${s}`} style={{ background: "transparent", border: "none", cursor: "pointer", color: "var(--brand-700)", padding: 2, display: "flex", alignItems: "center", borderRadius: "50%" }}>
                    <Icons.X />
                  </button>
                </span>
              ))}
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <input
                value={newSkill}
                onChange={e => setNewSkill(e.target.value)}
                onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); addSkillTag(); } }}
                placeholder="Type a skill and press Enter (e.g. React)"
                maxLength={30}
                style={{ ...inputStyle, flex: 1 }}
              />
              <button type="button" onClick={addSkillTag} disabled={!newSkill.trim() || draft.skills.length >= 30} style={{ ...btnStyle, ...btnSecondary, padding: "8px 16px" }}>Add</button>
            </div>
            <span style={{ display: "block", fontSize: 11, color: "var(--gray-400)", marginTop: 4 }}>{draft.skills.length} / 30 skills</span>
          </div>

          <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
            <button onClick={() => setIsEditing(false)} disabled={saving} style={{ ...btnStyle, ...btnSecondary, padding: "10px 18px" }}>Cancel</button>
            <button onClick={handleSaveEdits} disabled={saving} style={{ ...btnStyle, ...btnPrimary, padding: "10px 20px" }}>
              {saving ? "Saving..." : "Save changes"}
            </button>
          </div>
        </div>
      ) : (
      <div className="fade-up" style={{ ...cardStyle, marginBottom: 24, padding: 32 }}>
        <div style={{ display: "flex", alignItems: "flex-start", gap: 24, flexWrap: "wrap" }}>
          <div style={{ width: 96, height: 96, borderRadius: 20, background: "linear-gradient(135deg, var(--brand-500), var(--accent))", display: "flex", alignItems: "center", justifyContent: "center", color: "white", fontWeight: 700, fontSize: 32, flexShrink: 0 }}>{freelancer.avatar}</div>
          <div style={{ flex: 1, minWidth: 200 }}>
            <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 8, marginBottom: 6 }}>
              <h1 style={{ fontSize: 28, fontWeight: 800, color: "var(--gray-900)" }}>{freelancer.name}</h1>
              {freelancer.identityVerified && <span style={{ display: "inline-flex", alignItems: "center", gap: 4, padding: "2px 8px", borderRadius: var_radius_full, fontSize: 11, fontWeight: 600, background: "var(--success-light)", color: "var(--success)" }}><Icons.BadgeCheck /> Identity verified</span>}
              {freelancer.topRated && <span style={{ display: "inline-flex", alignItems: "center", padding: "2px 8px", borderRadius: var_radius_full, fontSize: 11, fontWeight: 600, background: "var(--warning-light)", color: "var(--warning)" }}>Top Rated</span>}
            </div>
            <p style={{ fontSize: 17, color: "var(--gray-600)", marginBottom: 12 }}>{freelancer.title}</p>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 16, alignItems: "center", fontSize: 14 }}>
              <span style={{ display: "flex", alignItems: "center", gap: 4, color: "var(--warning)" }}><Icons.Star /> {freelancer.rating} ({freelancer.reviewCount} reviews)</span>
              <span style={{ fontWeight: 700, color: "var(--gray-800)", fontFamily: "var(--font-mono)" }}>${freelancer.hourlyRate}/hr</span>
              {freelancer.location && <span style={{ display: "flex", alignItems: "center", gap: 4, color: "var(--gray-500)" }}><Icons.MapPin /> {freelancer.location}</span>}
              <span style={{ padding: "4px 10px", borderRadius: var_radius_full, fontSize: 12, fontWeight: 600, background: freelancer.status === "available" ? "var(--success-light)" : "var(--warning-light)", color: freelancer.status === "available" ? "var(--success)" : "var(--warning)" }}>{freelancer.status}</span>
            </div>
            {(freelancer.verifiedSkills || []).length > 0 && (
              <div style={{ marginTop: 12, display: "flex", flexWrap: "wrap", gap: 6, alignItems: "center" }}>
                <span style={{ fontSize: 12, color: "var(--gray-500)" }}>Verified skills:</span>
                {freelancer.verifiedSkills.map(s => <span key={s} style={{ display: "inline-flex", alignItems: "center", gap: 4, padding: "2px 8px", borderRadius: var_radius_full, fontSize: 11, fontWeight: 600, background: "var(--brand-50)", color: "var(--brand-700)" }}><Icons.BadgeCheck /> {s}</span>)}
              </div>
            )}
          </div>
          <div style={{ flexShrink: 0, textAlign: "center", padding: "16px 20px", borderRadius: var_radius_lg, background: jobSuccessScore(freelancer) >= 85 ? "var(--success-light)" : "var(--brand-50)", minWidth: 120 }}>
            <div style={{ fontSize: 32, fontWeight: 800, fontFamily: "var(--font-mono)", color: jobSuccessScore(freelancer) >= 85 ? "var(--success)" : "var(--brand-700)", lineHeight: 1 }}>{jobSuccessScore(freelancer)}%</div>
            <div style={{ fontSize: 11, fontWeight: 600, color: "var(--gray-500)", marginTop: 6, textTransform: "uppercase", letterSpacing: ".05em" }}>Job Success</div>
          </div>
        </div>
      </div>
      )}
      <div className="fade-up" style={{ ...cardStyle, marginBottom: 24 }}>
        <h3 style={{ fontSize: 16, fontWeight: 700, color: "var(--gray-900)", marginBottom: 12 }}>About</h3>
        <p style={{ fontSize: 15, color: "var(--gray-600)", lineHeight: 1.7 }}>{freelancer.bio || "No bio provided."}</p>
      </div>
      <div className="fade-up" style={{ ...cardStyle, marginBottom: 24 }}>
        <h3 style={{ fontSize: 16, fontWeight: 700, color: "var(--gray-900)", marginBottom: 12 }}>Skills</h3>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
          {freelancer.skills?.map(s => (
            <span key={s} style={{ display: "inline-flex", alignItems: "center", gap: 4, padding: "6px 14px", background: "var(--gray-100)", color: "var(--gray-700)", fontSize: 13, fontWeight: 500, borderRadius: var_radius_full }}>{freelancer.verifiedSkills?.includes(s) && <Icons.BadgeCheck />}{s}</span>
          ))}
        </div>
      </div>
      {(freelancer.portfolio || []).length > 0 && (
        <div className="fade-up" style={{ ...cardStyle, marginBottom: 24 }}>
          <h3 style={{ fontSize: 16, fontWeight: 700, color: "var(--gray-900)", marginBottom: 12 }}>Portfolio / Work samples</h3>
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {freelancer.portfolio.map(item => (
              <div key={item.id} style={{ padding: 14, background: "var(--gray-50)", borderRadius: var_radius_lg, border: "1px solid var(--gray-200)" }}>
                <div style={{ fontSize: 14, fontWeight: 600, color: "var(--gray-900)" }}>{item.title}</div>
                <div style={{ fontSize: 13, color: "var(--gray-500)", marginTop: 4 }}>{item.description}</div>
                {item.link && <a href={item.link} style={{ fontSize: 12, color: "var(--brand-600)", marginTop: 6, display: "inline-block" }}>View →</a>}
              </div>
            ))}
          </div>
        </div>
      )}
      <div className="fade-up" style={{ ...cardStyle, marginBottom: 24 }}>
        <h3 style={{ fontSize: 16, fontWeight: 700, color: "var(--gray-900)", marginBottom: 12 }}>Reviews & Testimonials</h3>
        {freelancerReviews.length === 0 && !showReviewForm && <p style={{ fontSize: 14, color: "var(--gray-500)" }}>No reviews yet.</p>}
        {freelancerReviews.map(r => (
          <div key={r.id} style={{ padding: "12px 0", borderBottom: "1px solid var(--gray-100)" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
              <span style={{ fontSize: 14, fontWeight: 600, color: "var(--gray-800)" }}>{r.clientName}</span>
              <span style={{ display: "flex", alignItems: "center", gap: 2, color: "var(--warning)" }}>{Array.from({ length: 5 }).map((_, i) => <Icons.Star key={i} style={{ opacity: i < r.rating ? 1 : 0.3 }} />)}</span>
            </div>
            <p style={{ fontSize: 13, color: "var(--gray-600)", lineHeight: 1.5 }}>{r.comment}</p>
          </div>
        ))}
        {hasWorkedWith && !hasReviewed && !showReviewForm && (
          <button onClick={() => setShowReviewForm(true)} style={{ ...btnStyle, ...btnSecondary, marginTop: 12, padding: "8px 16px", fontSize: 13 }}>Leave a review</button>
        )}
        {showReviewForm && (
          <div style={{ marginTop: 16, padding: 16, background: "var(--gray-50)", borderRadius: var_radius_lg }}>
            <label style={labelStyle}>Rating (1-5)</label>
            <select value={reviewRating} onChange={e => setReviewRating(Number(e.target.value))} style={{ ...inputStyle, width: 80, marginBottom: 10 }}>
              {[1,2,3,4,5].map(n => <option key={n} value={n}>{n} stars</option>)}
            </select>
            <label style={labelStyle}>Comment</label>
            <textarea value={reviewComment} onChange={e => setReviewComment(e.target.value)} placeholder="Share your experience..." rows={3} style={{ ...inputStyle, marginBottom: 10 }} />
            <div style={{ display: "flex", gap: 8 }}>
              <button onClick={() => { onAddReview?.(freelancer.id, reviewRating, reviewComment); setShowReviewForm(false); setReviewComment(""); }} style={{ ...btnStyle, ...btnPrimary }}>Submit review</button>
              <button onClick={() => setShowReviewForm(false)} style={{ ...btnStyle, ...btnSecondary }}>Cancel</button>
            </div>
          </div>
        )}
      </div>
      {currentUser && currentUser.id !== freelancer.id && (
        <button onClick={() => onMessage?.(freelancer.id)} style={{ ...btnStyle, ...btnPrimary, padding: "12px 24px" }}>
          <Icons.MessageCircle /> Message
        </button>
      )}
    </div>
  );
}

// ============================================================================
// MESSAGES PAGE (Chat)
// ============================================================================
function MessagesPage({ currentUser, conversations, users, freelancers, selectedConversationId, onSelectConversation, onSendMessage, getOrCreateConversation, onNavigate }) {
  const [messageInput, setMessageInput] = useState("");
  const myConversations = (conversations || []).filter(c => c.participantIds?.includes(currentUser?.id));
  const selectedConv = myConversations.find(c => c.id === selectedConversationId);

  const getParticipantName = (conv) => {
    const otherId = conv.participantIds?.find(id => id !== currentUser?.id);
    const u = users?.find(x => x.id === otherId);
    const f = freelancers?.find(x => x.id === otherId);
    return u?.name || f?.name || "Unknown";
  };

  const handleSend = () => {
    if (!selectedConv || !messageInput.trim()) return;
    onSendMessage(selectedConv.id, messageInput);
    setMessageInput("");
  };

  return (
    <div style={{ maxWidth: 1000, margin: "0 auto", padding: "24px", display: "flex", gap: 0, minHeight: "calc(100vh - 120px)", flexDirection: "column" }}>
      <h1 style={{ fontSize: 24, fontWeight: 800, color: "var(--gray-900)", marginBottom: 20 }}>Messages</h1>
      <div style={{ display: "flex", flex: 1, minHeight: 400, border: "1px solid var(--gray-200)", borderRadius: var_radius_xl, overflow: "hidden", background: "white" }}>
        <div style={{ width: 280, borderRight: "1px solid var(--gray-200)", overflowY: "auto" }}>
          {myConversations.length === 0 ? (
            <div style={{ padding: 24, fontSize: 14, color: "var(--gray-400)", textAlign: "center" }}>No conversations yet. Message a freelancer from their profile to start.</div>
          ) : (
            myConversations.map(conv => (
              <button key={conv.id} onClick={() => onSelectConversation(conv.id)} style={{ width: "100%", padding: "14px 16px", border: "none", borderBottom: "1px solid var(--gray-100)", background: selectedConversationId === conv.id ? "var(--brand-50)" : "white", cursor: "pointer", textAlign: "left" }}>
                <div style={{ fontSize: 14, fontWeight: 600, color: "var(--gray-900)" }}>{getParticipantName(conv)}</div>
                <div style={{ fontSize: 12, color: "var(--gray-500)", marginTop: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {(conv.messages || [])[conv.messages?.length - 1]?.text || "No messages yet"}
                </div>
              </button>
            ))
          )}
        </div>
        <div style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0 }}>
          {selectedConv ? (
            <>
              <div style={{ padding: "12px 16px", borderBottom: "1px solid var(--gray-200)", fontSize: 14, fontWeight: 600, color: "var(--gray-900)" }}>{getParticipantName(selectedConv)}</div>
              <div style={{ flex: 1, overflowY: "auto", padding: 16, display: "flex", flexDirection: "column", gap: 12 }}>
                {(selectedConv.messages || []).map(m => (
                  <div key={m.id} style={{ alignSelf: m.senderId === currentUser?.id ? "flex-end" : "flex-start", maxWidth: "80%", padding: "10px 14px", borderRadius: var_radius_lg, background: m.senderId === currentUser?.id ? "var(--brand-500)" : "var(--gray-100)", color: m.senderId === currentUser?.id ? "white" : "var(--gray-800)", fontSize: 14 }}>{m.text}</div>
                ))}
              </div>
              <div style={{ padding: 12, borderTop: "1px solid var(--gray-200)", display: "flex", gap: 8 }}>
                <input value={messageInput} onChange={e => setMessageInput(e.target.value)} onKeyDown={e => e.key === "Enter" && !e.shiftKey && (e.preventDefault(), handleSend())} placeholder="Type a message..." style={{ ...inputStyle, flex: 1 }} />
                <button onClick={handleSend} style={{ ...btnStyle, ...btnPrimary, padding: "10px 20px" }}><Icons.Send /> Send</button>
              </div>
            </>
          ) : (
            <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", color: "var(--gray-400)", fontSize: 14 }}>Select a conversation or message someone from their profile</div>
          )}
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// JOBS PAGE with BIDDING
// ============================================================================
function JobsPage({ jobs, currentUser, onBid, onAcceptBid, onRejectBid, onNavigate, freelancers, onOpenMessage, savedJobIds = [], onToggleSaveJob, recommendedJobs = [], getRecommendedFreelancers, onSaveSearch }) {
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("all");
  const [budgetMin, setBudgetMin] = useState("");
  const [budgetMax, setBudgetMax] = useState("");
  const [skillFilter, setSkillFilter] = useState("");
  const [sortBy, setSortBy] = useState("newest");
  const [bidJobId, setBidJobId] = useState(null);
  const [bidAmount, setBidAmount] = useState("");
  const [bidMessage, setBidMessage] = useState("");

  const filtered = useMemo(() => {
    let list = jobs.filter(j => {
      const matchSearch = j.title.toLowerCase().includes(search.toLowerCase()) || (j.skills || []).some(s => s.toLowerCase().includes(search.toLowerCase()));
      const matchCategory = category === "all" || j.category === category;
      const matchBudgetMin = !budgetMin || (j.budgetMax != null && j.budgetMax >= Number(budgetMin));
      const matchBudgetMax = !budgetMax || (j.budgetMin != null && j.budgetMin <= Number(budgetMax));
      const matchSkill = !skillFilter || (j.skills || []).some(s => s.toLowerCase() === skillFilter.toLowerCase());
      return matchSearch && matchCategory && matchBudgetMin && matchBudgetMax && matchSkill && j.status === "open";
    });
    if (sortBy === "newest") list = [...list].sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
    else if (sortBy === "budget-high") list = [...list].sort((a, b) => (b.budgetMax || 0) - (a.budgetMax || 0));
    else if (sortBy === "budget-low") list = [...list].sort((a, b) => (a.budgetMin || 0) - (b.budgetMin || 0));
    else if (sortBy === "deadline") list = [...list].sort((a, b) => (a.deadline || 0) - (b.deadline || 0));
    return list;
  }, [jobs, search, category, budgetMin, budgetMax, skillFilter, sortBy]);

  const submitBid = (jobId) => {
    if (!currentUser) { onNavigate("login"); return; }
    if (!bidAmount) return;
    onBid(jobId, { amount: Number(bidAmount), message: bidMessage, timeline: "As specified" });
    setBidJobId(null);
    setBidAmount("");
    setBidMessage("");
  };

  return (
    <div style={{ maxWidth: 1200, margin: "0 auto", padding: "32px 24px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "start", marginBottom: 32, flexWrap: "wrap", gap: 16 }}>
        <div>
          <h1 style={{ fontSize: 32, fontWeight: 800, color: "var(--gray-900)", letterSpacing: "-.02em", marginBottom: 8 }}>Browse Jobs</h1>
          <p style={{ fontSize: 15, color: "var(--gray-500)" }}>Find your next opportunity</p>
        </div>
        {currentUser?.role === "client" && (
          <button onClick={() => onNavigate("post-job")} style={{ ...btnStyle, ...btnPrimary }}><Icons.Plus /> Post a Job</button>
        )}
      </div>

      <div style={{ display: "flex", flexWrap: "wrap", gap: 12, marginBottom: 28 }}>
        <div style={{ flex: "1 1 200px", minWidth: 200, position: "relative" }}>
          <div style={{ position: "absolute", left: 14, top: "50%", transform: "translateY(-50%)", color: "var(--gray-400)" }}><Icons.Search /></div>
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search jobs..." style={{ ...inputStyle, paddingLeft: 42 }} />
        </div>
        <select value={category} onChange={e => setCategory(e.target.value)} style={{ ...inputStyle, width: "auto", minWidth: 160, cursor: "pointer" }}>
          <option value="all">All Categories</option>
          {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
        <select value={skillFilter} onChange={e => setSkillFilter(e.target.value)} style={{ ...inputStyle, width: "auto", minWidth: 140, cursor: "pointer" }}>
          <option value="">All Skills</option>
          {INITIAL_SKILLS.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
        <input type="number" value={budgetMin} onChange={e => setBudgetMin(e.target.value)} placeholder="Min $" style={{ ...inputStyle, width: 90 }} />
        <input type="number" value={budgetMax} onChange={e => setBudgetMax(e.target.value)} placeholder="Max $" style={{ ...inputStyle, width: 90 }} />
        <select value={sortBy} onChange={e => setSortBy(e.target.value)} style={{ ...inputStyle, width: "auto", minWidth: 140, cursor: "pointer" }}>
          <option value="newest">Newest first</option>
          <option value="budget-high">Budget: High to Low</option>
          <option value="budget-low">Budget: Low to High</option>
          <option value="deadline">Deadline soon</option>
        </select>
      </div>

      {currentUser?.role === "freelancer" && recommendedJobs.length > 0 && (
        <div style={{ ...cardStyle, marginBottom: 24, borderLeft: "4px solid var(--brand-500)" }}>
          <h3 style={{ fontSize: 16, fontWeight: 700, color: "var(--gray-900)", marginBottom: 8 }}>Recommended for you</h3>
          <p style={{ fontSize: 13, color: "var(--gray-500)", marginBottom: 12 }}>Jobs matching your skills</p>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            {recommendedJobs.slice(0, 3).map(j => (
              <button key={j.id} onClick={() => onNavigate("jobs")} style={{ padding: "10px 14px", background: "var(--brand-50)", border: "1px solid var(--brand-200)", borderRadius: 8, fontSize: 13, color: "var(--brand-700)", cursor: "pointer", textAlign: "left" }}>{j.title} · ${j.budgetMin?.toLocaleString()}+</button>
            ))}
          </div>
        </div>
      )}

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 10, marginBottom: 16 }}>
        <p style={{ fontSize: 14, color: "var(--gray-400)" }}>Showing {filtered.length} open job{filtered.length !== 1 && "s"}</p>
        {onSaveSearch && (search || (category && category !== "all") || budgetMin || budgetMax || skillFilter) && (
          <button
            onClick={() => onSaveSearch("jobs", search || skillFilter || (category !== "all" ? category : "Job search"), { search, category, budgetMin, budgetMax, skillFilter, sortBy })}
            style={{ ...btnStyle, ...btnAccent, padding: "8px 16px", fontSize: 13 }}
          >
            <Icons.Heart /> Save this search
          </button>
        )}
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        {filtered.map((j, i) => {
          const hasBid = currentUser && j.bids.some(b => b.freelancerId === currentUser.id);
          return (
            <div key={j.id} className="fade-up" style={{ ...cardStyle, animationDelay: `${i * .05}s` }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "start", gap: 16, flexWrap: "wrap", marginBottom: 12 }}>
                <div>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                    <h3 style={{ fontSize: 18, fontWeight: 700, color: "var(--gray-900)" }}>{j.title}</h3>
                    {j.teamSize > 1 && <span style={{ padding: "3px 10px", borderRadius: var_radius_full, fontSize: 11, fontWeight: 600, background: "var(--accent-light)", color: "var(--accent)", display: "inline-flex", alignItems: "center", gap: 4 }}><Icons.Users /> Team of {j.teamSize}</span>}
                  </div>
                  <p style={{ fontSize: 13, color: "var(--gray-500)" }}>{j.clientName}</p>
                </div>
                <div style={{ textAlign: "right" }}>
                  <div style={{ fontSize: 18, fontWeight: 800, color: "var(--brand-600)", fontFamily: "var(--font-mono)" }}>
                    ${j.budgetMin?.toLocaleString()} - ${j.budgetMax?.toLocaleString()}
                    {j.budgetType === "hourly" && <span style={{ fontSize: 12, fontWeight: 500 }}>/hr</span>}
                  </div>
                  <span style={{ fontSize: 11, color: "var(--gray-400)", textTransform: "uppercase", letterSpacing: ".04em" }}>{j.category}</span>
                </div>
              </div>

              <p style={{ fontSize: 14, color: "var(--gray-600)", lineHeight: 1.6, marginBottom: 14 }}>{j.description}</p>

              <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 14 }}>
                {j.skills.map(s => <span key={s} style={{ padding: "3px 10px", background: "var(--gray-100)", color: "var(--gray-600)", fontSize: 11, fontWeight: 600, borderRadius: var_radius_full }}>{s}</span>)}
              </div>

              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12 }}>
                <div style={{ display: "flex", gap: 16, fontSize: 13, color: "var(--gray-400)" }}>
                  <span style={{ display: "flex", alignItems: "center", gap: 4 }}><Icons.MapPin /> {j.location}</span>
                  <span style={{ display: "flex", alignItems: "center", gap: 4 }}><Icons.Users /> {j.bids.length} bid{j.bids.length !== 1 && "s"}</span>
                </div>
                <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                  <button onClick={() => onToggleSaveJob?.(j.id)} style={{ ...btnStyle, ...btnSecondary, padding: "8px 10px" }} title={savedJobIds?.includes(j.id) ? "Remove from saved" : "Save job"}>
                    {savedJobIds?.includes(j.id) ? <Icons.HeartFilled style={{ color: "var(--error)" }} /> : <Icons.Heart />}
                  </button>
                  {currentUser?.role === "freelancer" && !hasBid && (
                    <button onClick={() => setBidJobId(bidJobId === j.id ? null : j.id)} style={{ ...btnStyle, ...btnPrimary, padding: "8px 18px", fontSize: 13 }}>
                      <Icons.Send /> Place Bid
                    </button>
                  )}
                  {hasBid && <span style={{ padding: "8px 14px", fontSize: 13, fontWeight: 600, color: "var(--success)", display: "flex", alignItems: "center", gap: 4 }}><Icons.Check /> Bid Submitted</span>}
                  {currentUser?.role === "client" && j.clientId === currentUser.id && (
                    <span style={{ fontSize: 13, color: "var(--gray-500)" }}>{j.bids.length} bid{j.bids.length !== 1 && "s"} received</span>
                  )}
                </div>
              </div>

              {/* Bid form */}
              {bidJobId === j.id && (
                <div style={{ marginTop: 16, padding: 20, background: "var(--gray-50)", borderRadius: var_radius_lg, border: "1px solid var(--gray-200)" }}>
                  <h4 style={{ fontSize: 15, fontWeight: 700, color: "var(--gray-900)", marginBottom: 14 }}>Submit Your Bid</h4>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 12 }}>
                    <div>
                      <label style={labelStyle}>Your Bid Amount ($)</label>
                      <input type="number" value={bidAmount} onChange={e => setBidAmount(e.target.value)} placeholder="e.g. 5000" style={inputStyle} />
                    </div>
                    <div>
                      <label style={labelStyle}>Delivery Timeline</label>
                      <input placeholder="e.g. 4 weeks" style={inputStyle} />
                    </div>
                  </div>
                  <div style={{ marginBottom: 12 }}>
                    <label style={labelStyle}>Cover Letter</label>
                    <textarea value={bidMessage} onChange={e => setBidMessage(e.target.value)} placeholder="Why are you the best fit for this job?" rows={3} style={{ ...inputStyle, resize: "vertical" }} />
                  </div>
                  {Number(bidAmount) > 0 && (
                    <div style={{ marginBottom: 12, padding: "12px 14px", background: "white", borderRadius: var_radius_md, border: "1px solid var(--gray-200)", fontSize: 13 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", color: "var(--gray-500)" }}>
                        <span>Your bid</span><span>{formatMoney(bidAmount)}</span>
                      </div>
                      <div style={{ display: "flex", justifyContent: "space-between", color: "var(--gray-500)", marginTop: 4 }}>
                        <span>Platform fee (flat 5%)</span><span>−{formatMoney(Number(bidAmount) - netAfterFee(bidAmount))}</span>
                      </div>
                      <div style={{ display: "flex", justifyContent: "space-between", fontWeight: 700, color: "var(--gray-900)", marginTop: 8, paddingTop: 8, borderTop: "1px solid var(--gray-200)" }}>
                        <span>You receive</span><span style={{ fontFamily: "var(--font-mono)" }}>{formatMoney(netAfterFee(bidAmount))}</span>
                      </div>
                    </div>
                  )}
                  <div style={{ display: "flex", gap: 10 }}>
                    <button onClick={() => submitBid(j.id)} style={{ ...btnStyle, ...btnPrimary, padding: "9px 20px", fontSize: 13 }}>Submit Bid</button>
                    <button onClick={() => setBidJobId(null)} style={{ ...btnStyle, ...btnSecondary, padding: "9px 20px", fontSize: 13 }}>Cancel</button>
                  </div>
                </div>
              )}

              {/* Show bids to client with Accept/Reject */}
              {currentUser?.role === "client" && j.clientId === currentUser.id && j.bids.length > 0 && (
                <div style={{ marginTop: 16, padding: 16, background: "var(--gray-50)", borderRadius: var_radius_lg }}>
                  <h4 style={{ fontSize: 14, fontWeight: 700, color: "var(--gray-900)", marginBottom: 10 }}>Bids Received</h4>
                  {j.bids.map(b => {
                    const fl = freelancers.find(f => f.id === b.freelancerId);
                    const status = b.status || "pending";
                    const isPending = status === "pending";
                    return (
                      <div key={b.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8, padding: "12px 0", borderBottom: "1px solid var(--gray-200)" }}>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                            <span style={{ fontSize: 14, fontWeight: 600, color: "var(--gray-800)" }}>{b.freelancerName}</span>
                            {fl && <span style={{ fontSize: 12, color: "var(--gray-400)" }}>⭐ {fl.rating}</span>}
                            <span style={{ padding: "2px 8px", borderRadius: var_radius_full, fontSize: 11, fontWeight: 600, background: status === "accepted" ? "var(--success-light)" : status === "rejected" ? "var(--error-light)" : "var(--warning-light)", color: status === "accepted" ? "var(--success)" : status === "rejected" ? "var(--error)" : "var(--warning)" }}>{status}</span>
                          </div>
                          {b.message && <p style={{ fontSize: 12, color: "var(--gray-500)", marginTop: 4 }}>{b.message}</p>}
                        </div>
                        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                          <span style={{ fontSize: 15, fontWeight: 700, color: "var(--brand-600)", fontFamily: "var(--font-mono)" }}>${b.amount?.toLocaleString()}</span>
                          {isPending && j.status === "open" && (
                            <>
                              <button onClick={() => onAcceptBid?.(j.id, b.id)} style={{ ...btnStyle, ...btnPrimary, padding: "6px 12px", fontSize: 12 }}>Accept</button>
                              <button onClick={() => onRejectBid?.(j.id, b.id)} style={{ ...btnStyle, ...btnSecondary, padding: "6px 12px", fontSize: 12 }}>Reject</button>
                            </>
                          )}
                          <button onClick={() => onOpenMessage?.(b.freelancerId)} style={{ ...btnStyle, ...btnSecondary, padding: "6px 12px", fontSize: 12 }}><Icons.MessageCircle /> Message</button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ============================================================================
// POST JOB PAGE
// ============================================================================
function PostJobPage({ onPost, onNavigate }) {
  const [data, setData] = useState({ title: "", description: "", category: "Web Development", skills: [], budgetMin: "", budgetMax: "", budgetType: "fixed", location: "Remote", teamSize: 1, deadline: "" });
  const [skillInput, setSkillInput] = useState("");

  const addSkill = () => { if (skillInput.trim() && !data.skills.includes(skillInput.trim())) { setData(d => ({ ...d, skills: [...d.skills, skillInput.trim()] })); setSkillInput(""); } };

  return (
    <div style={{ maxWidth: 640, margin: "0 auto", padding: "32px 24px" }}>
      <h1 style={{ fontSize: 28, fontWeight: 800, color: "var(--gray-900)", marginBottom: 8 }}>Post a Job</h1>
      <p style={{ fontSize: 15, color: "var(--gray-500)", marginBottom: 32 }}>Find the perfect freelancer or build a team</p>

      <form onSubmit={e => { e.preventDefault(); onPost({ ...data, budgetMin: Number(data.budgetMin), budgetMax: Number(data.budgetMax), deadline: data.deadline ? new Date(data.deadline).getTime() : Date.now() + 86400000 * 30 }); }} style={{ ...cardStyle, display: "flex", flexDirection: "column", gap: 20 }}>
        <div>
          <label style={labelStyle}>Job Title *</label>
          <input value={data.title} onChange={e => setData(d => ({ ...d, title: e.target.value }))} placeholder="e.g. Full Stack Developer for E-commerce" style={inputStyle} required />
        </div>
        <div>
          <label style={labelStyle}>Description *</label>
          <textarea value={data.description} onChange={e => setData(d => ({ ...d, description: e.target.value }))} placeholder="Describe the project, requirements, and deliverables..." rows={4} style={{ ...inputStyle, resize: "vertical" }} required />
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
          <div>
            <label style={labelStyle}>Category</label>
            <select value={data.category} onChange={e => setData(d => ({ ...d, category: e.target.value }))} style={{ ...inputStyle, cursor: "pointer" }}>
              {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div>
            <label style={labelStyle}>Team Size</label>
            <select value={data.teamSize} onChange={e => setData(d => ({ ...d, teamSize: Number(e.target.value) }))} style={{ ...inputStyle, cursor: "pointer" }}>
              {[1, 2, 3, 4, 5].map(n => <option key={n} value={n}>{n === 1 ? "Solo (1 person)" : `Team of ${n}`}</option>)}
            </select>
          </div>
        </div>
        <div>
          <label style={labelStyle}>Required Skills</label>
          <div style={{ display: "flex", gap: 8 }}>
            <input value={skillInput} onChange={e => setSkillInput(e.target.value)} onKeyDown={e => e.key === "Enter" && (e.preventDefault(), addSkill())} placeholder="Type a skill, press Enter" style={{ ...inputStyle, flex: 1 }} list="job-skills" />
            <datalist id="job-skills">{INITIAL_SKILLS.map(s => <option key={s} value={s} />)}</datalist>
            <button type="button" onClick={addSkill} style={{ ...btnStyle, ...btnSecondary, padding: "8px 14px" }}><Icons.Plus /></button>
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 8 }}>
            {data.skills.map(s => (
              <span key={s} style={{ display: "inline-flex", alignItems: "center", gap: 4, padding: "4px 10px", background: "var(--brand-50)", color: "var(--brand-700)", fontSize: 12, fontWeight: 600, borderRadius: var_radius_full }}>
                {s} <button type="button" onClick={() => setData(d => ({ ...d, skills: d.skills.filter(sk => sk !== s) }))} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--brand-400)", fontSize: 14, lineHeight: 1 }}>&times;</button>
              </span>
            ))}
          </div>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 14 }}>
          <div>
            <label style={labelStyle}>Min Budget ($)</label>
            <input type="number" value={data.budgetMin} onChange={e => setData(d => ({ ...d, budgetMin: e.target.value }))} placeholder="1000" style={inputStyle} />
          </div>
          <div>
            <label style={labelStyle}>Max Budget ($)</label>
            <input type="number" value={data.budgetMax} onChange={e => setData(d => ({ ...d, budgetMax: e.target.value }))} placeholder="5000" style={inputStyle} />
          </div>
          <div>
            <label style={labelStyle}>Budget Type</label>
            <select value={data.budgetType} onChange={e => setData(d => ({ ...d, budgetType: e.target.value }))} style={{ ...inputStyle, cursor: "pointer" }}>
              <option value="fixed">Fixed Price</option>
              <option value="hourly">Hourly Rate</option>
            </select>
          </div>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
          <div>
            <label style={labelStyle}>Location</label>
            <select value={data.location} onChange={e => setData(d => ({ ...d, location: e.target.value }))} style={{ ...inputStyle, cursor: "pointer" }}>
              <option value="Remote">Remote</option>
              <option value="On-site">On-site</option>
              <option value="Hybrid">Hybrid</option>
            </select>
          </div>
          <div>
            <label style={labelStyle}>Deadline</label>
            <input type="date" value={data.deadline} onChange={e => setData(d => ({ ...d, deadline: e.target.value }))} style={inputStyle} />
          </div>
        </div>
        <button type="submit" style={{ ...btnStyle, ...btnPrimary, width: "100%", justifyContent: "center", padding: "13px 0", fontSize: 15, marginTop: 4 }}>Post Job</button>
      </form>
    </div>
  );
}

// ============================================================================
// PROJECTS PAGE
// ============================================================================
function ProjectsPage({ projects, freelancers, currentUser, onCreate, onNavigate, onReleaseEscrow, disputes = {}, onRaiseDispute, onResolveDispute, getInvoiceSummary }) {
  const [showCreate, setShowCreate] = useState(false);
  const [data, setData] = useState({ title: "", description: "", budget: "", category: "Web Development", members: [] });
  const [disputeProjectId, setDisputeProjectId] = useState(null);
  const [disputeReason, setDisputeReason] = useState("");

  const handleCreate = (e) => {
    e.preventDefault();
    onCreate({ ...data, budget: Number(data.budget) });
    setShowCreate(false);
    setData({ title: "", description: "", budget: "", category: "Web Development", members: [] });
  };

  const toggleMember = (fId) => {
    setData(d => ({
      ...d,
      members: d.members.includes(fId) ? d.members.filter(m => m !== fId) : d.members.length < 4 ? [...d.members, fId] : d.members
    }));
  };

  return (
    <div style={{ maxWidth: 1200, margin: "0 auto", padding: "32px 24px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "start", marginBottom: 32, flexWrap: "wrap", gap: 16 }}>
        <div>
          <h1 style={{ fontSize: 32, fontWeight: 800, color: "var(--gray-900)", letterSpacing: "-.02em", marginBottom: 8 }}>Projects</h1>
          <p style={{ fontSize: 15, color: "var(--gray-500)" }}>Manage team projects and collaborations</p>
        </div>
        {currentUser?.role === "client" && (
          <button onClick={() => setShowCreate(!showCreate)} style={{ ...btnStyle, ...btnPrimary }}><Icons.Plus /> New Project</button>
        )}
      </div>

      {/* Create project form */}
      {showCreate && (
        <div className="fade-up" style={{ ...cardStyle, marginBottom: 24, border: "2px solid var(--brand-200)" }}>
          <h3 style={{ fontSize: 18, fontWeight: 700, color: "var(--gray-900)", marginBottom: 20 }}>Create a Project</h3>
          <form onSubmit={handleCreate} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 14 }}>
              <div><label style={labelStyle}>Project Title *</label><input value={data.title} onChange={e => setData(d => ({ ...d, title: e.target.value }))} placeholder="e.g. Enterprise Dashboard Rebuild" style={inputStyle} required /></div>
              <div><label style={labelStyle}>Budget ($)</label><input type="number" value={data.budget} onChange={e => setData(d => ({ ...d, budget: e.target.value }))} placeholder="10000" style={inputStyle} /></div>
            </div>
            <div><label style={labelStyle}>Description</label><textarea value={data.description} onChange={e => setData(d => ({ ...d, description: e.target.value }))} placeholder="Describe the project..." rows={3} style={{ ...inputStyle, resize: "vertical" }} /></div>
            <div>
              <label style={labelStyle}>Select Team Members (up to 4)</label>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))", gap: 10, marginTop: 8 }}>
                {freelancers.slice(0, 8).map(f => (
                  <button key={f.id} type="button" onClick={() => toggleMember(f.id)} style={{
                    display: "flex", alignItems: "center", gap: 10, padding: "10px 14px", borderRadius: var_radius_lg, cursor: "pointer", textAlign: "left",
                    border: data.members.includes(f.id) ? "2px solid var(--brand-500)" : "2px solid var(--gray-200)",
                    background: data.members.includes(f.id) ? "var(--brand-50)" : "white", fontFamily: "var(--font-sans)"
                  }}>
                    <div style={{ width: 36, height: 36, borderRadius: 10, background: "linear-gradient(135deg, var(--brand-500), var(--accent))", display: "flex", alignItems: "center", justifyContent: "center", color: "white", fontWeight: 700, fontSize: 12, flexShrink: 0 }}>{f.avatar}</div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 600, color: "var(--gray-800)" }}>{f.name}</div>
                      <div style={{ fontSize: 11, color: "var(--gray-400)" }}>{f.title}</div>
                    </div>
                    {data.members.includes(f.id) && <div style={{ color: "var(--brand-600)" }}><Icons.Check /></div>}
                  </button>
                ))}
              </div>
              <p style={{ fontSize: 12, color: "var(--gray-400)", marginTop: 6 }}>{data.members.length}/4 members selected</p>
            </div>
            <div style={{ display: "flex", gap: 10 }}>
              <button type="submit" style={{ ...btnStyle, ...btnPrimary }}>Create Project</button>
              <button type="button" onClick={() => setShowCreate(false)} style={{ ...btnStyle, ...btnSecondary }}>Cancel</button>
            </div>
          </form>
        </div>
      )}

      {/* Projects list */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(360px, 1fr))", gap: 20 }}>
        {projects.map((p, i) => (
          <div key={p.id} className="fade-up" style={{ ...cardStyle, animationDelay: `${i * .05}s` }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "start", marginBottom: 12 }}>
              <div>
                <h3 style={{ fontSize: 17, fontWeight: 700, color: "var(--gray-900)", marginBottom: 4 }}>{p.title}</h3>
                <p style={{ fontSize: 13, color: "var(--gray-500)" }}>{p.clientName}</p>
              </div>
              <span style={{ padding: "4px 10px", borderRadius: var_radius_full, fontSize: 11, fontWeight: 600, background: p.status === "active" ? "var(--success-light)" : "var(--gray-100)", color: p.status === "active" ? "var(--success)" : "var(--gray-500)" }}>{p.status}</span>
            </div>
            <p style={{ fontSize: 13, color: "var(--gray-500)", lineHeight: 1.6, marginBottom: 16 }}>{p.description}</p>
            {p.budget && <div style={{ fontSize: 15, fontWeight: 700, color: "var(--brand-600)", marginBottom: 14, fontFamily: "var(--font-mono)" }}>${p.budget.toLocaleString()}</div>}
            <div style={{ marginBottom: 12 }}>
              <span style={{ fontSize: 12, fontWeight: 600, color: "var(--gray-400)", textTransform: "uppercase", letterSpacing: ".04em", marginBottom: 8, display: "block" }}>Team ({p.members?.length || 0})</span>
              <div style={{ display: "flex", gap: 6 }}>
                {p.members?.map(mId => {
                  const f = freelancers.find(fl => fl.id === mId);
                  return f ? (
                    <div key={mId} title={f.name} style={{ width: 34, height: 34, borderRadius: "50%", background: "linear-gradient(135deg, var(--brand-500), var(--accent))", display: "flex", alignItems: "center", justifyContent: "center", color: "white", fontWeight: 700, fontSize: 11, border: "2px solid white" }}>{f.avatar}</div>
                  ) : null;
                })}
              </div>
            </div>
            {currentUser?.role === "client" && p.clientId === currentUser.id && (
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 8, alignItems: "center" }}>
                {!p.escrowReleased && (
                  <button onClick={() => onReleaseEscrow?.(p.id)} style={{ ...btnStyle, ...btnPrimary, padding: "8px 14px", fontSize: 12 }}>Release payment (Escrow)</button>
                )}
                {p.escrowReleased && <span style={{ fontSize: 12, color: "var(--success)", fontWeight: 600 }}>Payment released</span>}
                <button onClick={() => window.open("data:text/plain;charset=utf-8," + encodeURIComponent(getInvoiceSummary?.(p) || ""), "_blank")} style={{ ...btnStyle, ...btnSecondary, padding: "8px 14px", fontSize: 12 }}>Download invoice</button>
                {!(disputes[p.id]?.status === "raised" || disputes[p.id]?.status === "resolved") && (
                  <button onClick={() => setDisputeProjectId(disputeProjectId === p.id ? null : p.id)} style={{ ...btnStyle, ...btnSecondary, padding: "8px 14px", fontSize: 12, color: "var(--error)" }}>Raise dispute</button>
                )}
                {disputes[p.id]?.status === "raised" && <span style={{ fontSize: 12, color: "var(--warning)" }}>Dispute raised</span>}
                {disputes[p.id]?.status === "resolved" && <span style={{ fontSize: 12, color: "var(--success)" }}>Resolved</span>}
              </div>
            )}
            {disputeProjectId === p.id && (
              <div style={{ marginTop: 12, padding: 12, background: "var(--gray-50)", borderRadius: 8 }}>
                <input value={disputeReason} onChange={e => setDisputeReason(e.target.value)} placeholder="Reason for dispute..." style={{ ...inputStyle, marginBottom: 8 }} />
                <div style={{ display: "flex", gap: 8 }}>
                  <button onClick={() => { onRaiseDispute?.(p.id, disputeReason); setDisputeProjectId(null); setDisputeReason(""); }} style={{ ...btnStyle, ...btnPrimary, padding: "6px 12px", fontSize: 12 }}>Submit</button>
                  <button onClick={() => { setDisputeProjectId(null); setDisputeReason(""); }} style={{ ...btnStyle, ...btnSecondary, padding: "6px 12px", fontSize: 12 }}>Cancel</button>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
      {projects.length === 0 && (
        <div style={{ textAlign: "center", padding: 48, color: "var(--gray-400)" }}>
          <Icons.Folder />
          <p style={{ marginTop: 12, fontSize: 15 }}>No projects yet</p>
        </div>
      )}
    </div>
  );
}

// ============================================================================
// ABOUT PAGE
// ============================================================================
function AboutPage({ onNavigate }) {
  return (
    <div style={{ maxWidth: 800, margin: "0 auto", padding: "48px 24px" }}>
      <h1 style={{ fontSize: 36, fontWeight: 800, color: "var(--gray-900)", marginBottom: 16 }}>About BridgeofTalent</h1>
      <p style={{ fontSize: 17, color: "var(--gray-500)", lineHeight: 1.7, marginBottom: 32 }}>
        BridgeofTalent is a modern freelancing platform connecting talented professionals with clients worldwide. Whether you're a freelancer looking to showcase your expertise or a client seeking the right talent, we make it easy to connect, bid, build teams, and deliver exceptional work.
      </p>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 20, marginBottom: 48 }}>
        {[
          { icon: <Icons.Shield />, title: "Secure", desc: "Protected transactions and verified profiles" },
          { icon: <Icons.Globe />, title: "Global", desc: "Talent from around the world, working remotely" },
          { icon: <Icons.Zap />, title: "Fast", desc: "Quick matching and efficient collaboration" },
        ].map((f, i) => (
          <div key={i} style={{ ...cardStyle }}>
            <div style={{ color: "var(--brand-600)", marginBottom: 12 }}>{f.icon}</div>
            <h3 style={{ fontSize: 16, fontWeight: 700, color: "var(--gray-900)", marginBottom: 6 }}>{f.title}</h3>
            <p style={{ fontSize: 14, color: "var(--gray-500)" }}>{f.desc}</p>
          </div>
        ))}
      </div>
      <div style={{ textAlign: "center" }}>
        <button onClick={() => onNavigate("register")} style={{ ...btnStyle, ...btnPrimary, padding: "13px 32px", fontSize: 15 }}>Join BridgeofTalent</button>
      </div>
    </div>
  );
}

// ============================================================================
// SAVED PAGE (favorited jobs and freelancers)
// ============================================================================
function SavedPage({ savedJobIds = [], savedFreelancerIds = [], jobs, freelancers, onNavigate, onViewProfile, onToggleSaveJob, onToggleSaveFreelancer, savedSearches = [], onRemoveSavedSearch }) {
  const savedJobs = (jobs || []).filter(j => savedJobIds.includes(j.id));
  const savedFreelancers = (freelancers || []).filter(f => savedFreelancerIds.includes(f.id));
  return (
    <div style={{ maxWidth: 1200, margin: "0 auto", padding: "32px 24px" }}>
      <h1 style={{ fontSize: 32, fontWeight: 800, color: "var(--gray-900)", letterSpacing: "-.02em", marginBottom: 8 }}>Saved</h1>
      <p style={{ fontSize: 15, color: "var(--gray-500)", marginBottom: 28 }}>Your favorited jobs and freelancers</p>
      {savedJobs.length > 0 && (
        <div style={{ marginBottom: 32 }}>
          <h2 style={{ fontSize: 18, fontWeight: 700, color: "var(--gray-900)", marginBottom: 16 }}>Saved Jobs ({savedJobs.length})</h2>
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {savedJobs.map(j => (
              <div key={j.id} style={{ ...cardStyle, display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12 }}>
                <div>
                  <div style={{ fontSize: 16, fontWeight: 600, color: "var(--gray-900)" }}>{j.title}</div>
                  <div style={{ fontSize: 13, color: "var(--gray-500)" }}>{j.clientName} · ${j.budgetMin?.toLocaleString()}-${j.budgetMax?.toLocaleString()}</div>
                </div>
                <div style={{ display: "flex", gap: 8 }}>
                  <button onClick={() => onNavigate("jobs")} style={{ ...btnStyle, ...btnSecondary, padding: "8px 14px", fontSize: 13 }}>View</button>
                  <button onClick={() => onToggleSaveJob?.(j.id)} style={{ ...btnStyle, ...btnSecondary, padding: "8px" }} title="Remove from saved"><Icons.HeartFilled style={{ color: "var(--error)" }} /></button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
      {savedFreelancers.length > 0 && (
        <div>
          <h2 style={{ fontSize: 18, fontWeight: 700, color: "var(--gray-900)", marginBottom: 16 }}>Saved Freelancers ({savedFreelancers.length})</h2>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: 16 }}>
            {savedFreelancers.map(f => (
              <div key={f.id} style={{ ...cardStyle, display: "flex", justifyContent: "space-between", alignItems: "start" }}>
                <div style={{ display: "flex", gap: 12, flex: 1, minWidth: 0 }} onClick={() => onViewProfile?.(f.id)} role="button" tabIndex={0} onKeyDown={e => e.key === "Enter" && onViewProfile?.(f.id)}>
                  <div style={{ width: 44, height: 44, borderRadius: 12, background: "linear-gradient(135deg, var(--brand-500), var(--accent))", display: "flex", alignItems: "center", justifyContent: "center", color: "white", fontWeight: 700, fontSize: 14, flexShrink: 0 }}>{f.avatar}</div>
                  <div>
                    <div style={{ fontSize: 15, fontWeight: 600, color: "var(--gray-900)" }}>{f.name}</div>
                    <div style={{ fontSize: 13, color: "var(--gray-500)" }}>{f.title} · ${f.hourlyRate}/hr</div>
                  </div>
                </div>
                <button onClick={() => onToggleSaveFreelancer?.(f.id)} style={{ ...btnStyle, ...btnSecondary, padding: "6px" }} title="Remove from saved"><Icons.HeartFilled style={{ color: "var(--error)" }} /></button>
              </div>
            ))}
          </div>
        </div>
      )}
      {savedSearches.length > 0 && (
        <div style={{ marginBottom: 32 }}>
          <h2 style={{ fontSize: 18, fontWeight: 700, color: "var(--gray-900)", marginBottom: 16 }}>Saved Searches ({savedSearches.length})</h2>
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {savedSearches.map(s => (
              <div key={s.id} style={{ ...cardStyle, display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12 }}>
                <div>
                  <div style={{ fontSize: 15, fontWeight: 600, color: "var(--gray-900)", display: "flex", alignItems: "center", gap: 8 }}>
                    <span style={{ padding: "2px 8px", borderRadius: var_radius_full, fontSize: 11, fontWeight: 700, background: "var(--brand-50)", color: "var(--brand-700)", textTransform: "capitalize" }}>{s.scope}</span>
                    {s.label}
                  </div>
                  <div style={{ fontSize: 12, color: "var(--gray-400)", marginTop: 4 }}>Saved {new Date(s.createdAt).toLocaleDateString()}</div>
                </div>
                <div style={{ display: "flex", gap: 8 }}>
                  <button onClick={() => onNavigate(s.scope)} style={{ ...btnStyle, ...btnSecondary, padding: "8px 14px", fontSize: 13 }}>Open</button>
                  <button onClick={() => onRemoveSavedSearch?.(s.id)} style={{ ...btnStyle, ...btnSecondary, padding: "8px" }} title="Remove saved search"><Icons.X /></button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
      {savedJobs.length === 0 && savedFreelancers.length === 0 && savedSearches.length === 0 && (
        <p style={{ fontSize: 15, color: "var(--gray-500)", textAlign: "center", padding: 48 }}>No saved items yet. Save jobs and freelancers by clicking the heart icon.</p>
      )}
    </div>
  );
}

// ============================================================================
// SHORTCUTS PAGE
// ============================================================================
function ShortcutsPage({ onNavigate }) {
  const shortcuts = [
    { keys: "Ctrl + G", action: "Go to Jobs" },
    { keys: "Ctrl + F", action: "Go to Find Talent" },
    { keys: "Ctrl + M", action: "Go to Messages" },
    { keys: "? or Ctrl + /", action: "Show this shortcuts help" },
  ];
  return (
    <div style={{ maxWidth: 600, margin: "0 auto", padding: "48px 24px" }}>
      <h1 style={{ fontSize: 28, fontWeight: 800, color: "var(--gray-900)", marginBottom: 8 }}>Keyboard shortcuts</h1>
      <p style={{ fontSize: 15, color: "var(--gray-500)", marginBottom: 24 }}>Use these shortcuts to navigate faster.</p>
      <div style={{ ...cardStyle }}>
        {shortcuts.map((s, i) => (
          <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 0", borderBottom: i < shortcuts.length - 1 ? "1px solid var(--gray-100)" : "none" }}>
            <span style={{ fontSize: 14, color: "var(--gray-700)" }}>{s.action}</span>
            <kbd style={{ padding: "4px 10px", background: "var(--gray-100)", borderRadius: 6, fontSize: 13, fontFamily: "var(--font-mono)" }}>{s.keys}</kbd>
          </div>
        ))}
      </div>
      <button onClick={() => onNavigate("jobs")} style={{ ...btnStyle, ...btnSecondary, marginTop: 24 }}>Back</button>
    </div>
  );
}

// ============================================================================
// COMPARE PAGE
// ============================================================================
function ComparePage({ freelancers, compareIds, onClear, onNavigate, onViewProfile }) {
  const toCompare = (freelancers || []).filter(f => compareIds.includes(f.id));
  if (toCompare.length === 0) {
    return (
      <div style={{ maxWidth: 800, margin: "0 auto", padding: "48px 24px", textAlign: "center" }}>
        <p style={{ color: "var(--gray-500)", marginBottom: 16 }}>No freelancers selected to compare. Add up to 2 from Find Talent.</p>
        <button onClick={() => onNavigate("freelancers")} style={{ ...btnStyle, ...btnPrimary }}>Find Talent</button>
      </div>
    );
  }
  return (
    <div style={{ maxWidth: 1000, margin: "0 auto", padding: "32px 24px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24, flexWrap: "wrap", gap: 12 }}>
        <h1 style={{ fontSize: 28, fontWeight: 800, color: "var(--gray-900)" }}>Compare freelancers</h1>
        <div style={{ display: "flex", gap: 8 }}>
          <button onClick={() => onNavigate("freelancers")} style={{ ...btnStyle, ...btnSecondary }}>Add more</button>
          <button onClick={onClear} style={{ ...btnStyle, ...btnSecondary }}>Clear</button>
        </div>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: `repeat(${toCompare.length}, 1fr)`, gap: 24 }}>
        {toCompare.map(f => (
          <div key={f.id} style={{ ...cardStyle, padding: 24 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
              <div style={{ width: 56, height: 56, borderRadius: 14, background: "linear-gradient(135deg, var(--brand-500), var(--accent))", display: "flex", alignItems: "center", justifyContent: "center", color: "white", fontWeight: 700, fontSize: 18 }}>{f.avatar}</div>
              <div>
                <div style={{ fontSize: 18, fontWeight: 700, color: "var(--gray-900)" }}>{f.name}</div>
                <div style={{ fontSize: 14, color: "var(--gray-500)" }}>{f.title}</div>
              </div>
            </div>
            <div style={{ fontSize: 14, color: "var(--gray-600)", marginBottom: 12 }}>${f.hourlyRate}/hr · ⭐ {f.rating} ({f.reviewCount} reviews)</div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
              {(f.skills || []).slice(0, 6).map(s => (
                <span key={s} style={{ padding: "4px 10px", background: "var(--gray-100)", borderRadius: 9999, fontSize: 12, fontWeight: 500 }}>{s}</span>
              ))}
            </div>
            <button onClick={() => onViewProfile?.(f.id)} style={{ ...btnStyle, ...btnPrimary, width: "100%", justifyContent: "center", marginTop: 16 }}>View profile</button>
          </div>
        ))}
      </div>
    </div>
  );
}

// ============================================================================
// FOOTER
// ============================================================================
function Footer({ onNavigate }) {
  return (
    <footer style={{ background: "var(--gray-900)", color: "var(--gray-400)", padding: "64px 24px 32px" }}>
      <div style={{ maxWidth: 1200, margin: "0 auto" }}>
        <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr 1fr", gap: 40, marginBottom: 40 }}>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
              <div style={{ width: 36, height: 36, borderRadius: var_radius_lg, background: "linear-gradient(135deg, var(--brand-500), var(--brand-400))", display: "flex", alignItems: "center", justifyContent: "center", color: "white", fontWeight: 700, fontSize: 13, fontFamily: "var(--font-mono)" }}>BT</div>
              <span style={{ fontWeight: 700, fontSize: 18, color: "white" }}>BridgeofTalent</span>
            </div>
            <p style={{ fontSize: 14, lineHeight: 1.6, maxWidth: 280 }}>Connecting talented freelancers with opportunities worldwide.</p>
          </div>
          {[
            { title: "Freelancers", links: [["Browse Jobs", "jobs"], ["Create Profile", "register"]] },
            { title: "Clients", links: [["Find Talent", "freelancers"], ["Post a Job", "post-job"]] },
            { title: "Company", links: [["About", "about"], ["Shortcuts (?)", "shortcuts"]] },
          ].map((col, i) => (
            <div key={i}>
              <h4 style={{ fontSize: 12, fontWeight: 700, color: "var(--gray-300)", textTransform: "uppercase", letterSpacing: ".06em", marginBottom: 16 }}>{col.title}</h4>
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {col.links.map(([label, page]) => (
                  <button key={label} onClick={() => onNavigate(page)} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 14, color: "var(--gray-400)", textAlign: "left", fontFamily: "var(--font-sans)", padding: 0 }}>{label}</button>
                ))}
              </div>
            </div>
          ))}
        </div>
        <div style={{ borderTop: "1px solid var(--gray-800)", paddingTop: 24, textAlign: "center", fontSize: 13 }}>
          &copy; 2026 BridgeofTalent. All rights reserved.
        </div>
      </div>
    </footer>
  );
}
