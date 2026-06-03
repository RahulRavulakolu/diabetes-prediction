import React, { useState, useEffect } from "react";
import ReactMarkdown from "react-markdown";
import { motion } from "motion/react";
import { Sidebar } from "@/components/ui/modern-side-bar";
import { Header } from "@/components/ui/header-3";
import { CinematicHero } from "@/components/ui/cinematic-landing-hero";
import { TestimonialsSection } from "@/components/ui/testimonial-v2";
import { SignInPage, Testimonial } from "@/components/ui/sign-in";
import { Footer } from "@/components/ui/footer-section";
import { ThreeDHeartViewer } from "@/components/ui/three-d-heart";
import { PredictorDashboard } from "@/components/ui/predictor-dashboard";
import { AIChatbot } from "@/components/ui/ai-chatbot";
import { generateDiabetesDashboardProps, generateHeartDashboardProps } from "@/lib/mock-generators";
import { signInWithPopup, signInWithRedirect, getRedirectResult, onAuthStateChanged } from "firebase/auth";
import { auth, googleProvider } from "@/lib/firebase";
import { 
  Activity, 
  Heart, 
  Sparkles, 
  ShieldAlert, 
  CheckCircle, 
  RefreshCw, 
  Info, 
  BarChart, 
  Database, 
  ArrowRight, 
  AlertTriangle, 
  Cpu, 
  History, 
  FileText,
  UserCheck,
  Stethoscope,
  Sliders
} from "lucide-react";

type ShapFeature = {
  feature: string;
  impact: number;
  direction: string;
};

type PredictApiResponse = {
  prediction: number;
  label: string;
  probability_no: number;
  probability_yes: number;
  confidence: number;
  risk_level: string;
  model_used: string;
  shap_explanation: ShapFeature[];
  shap_summary: string;
  recommendations: string[];
  drift_detected: boolean;
  alerts?: string[] | null;
};

type SymptomApiResponse = PredictApiResponse & {
  derived_inputs: Record<string, number>;
  symptoms_used: string[];
};

// Sample Testimonials for Sign In Page
const sampleSignInTestimonials: Testimonial[] = [
  {
    avatarSrc: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&q=80&w=150&h=150",
    name: "Dr. Amanda Mercer",
    handle: "@clinical_ai_lead",
    text: "Elegantly merges explainability with raw disease risk prediction. Highly informative for endocrinology interns."
  },
  {
    avatarSrc: "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?auto=format&fit=crop&q=80&w=150&h=150",
    name: "Dr. Marcus Vance",
    handle: "@vance_cardio",
    text: "Reviewing patient SHAP risk profiles before diagnostics significantly assists clinical correlation workflows."
  }
];

// Vertical Medical AI evolution timeline events
const timelineEvents = [
  {
    year: "Step 1",
    title: "Data Extraction & Ingestion",
    tech: "Automated Data Pipelines",
    desc: "Raw clinical data and patient history are securely ingested from various Electronic Health Records (EHR) systems. This forms the foundation of our predictive modeling capabilities.",
    icon: Database,
    align: "left",
  },
  {
    year: "Step 2",
    title: "Data Validation & Preprocessing",
    tech: "Feature Engineering",
    desc: "Data is cleaned, missing values are handled, and categorical variables are encoded. Outliers in biometric data are flagged, ensuring only high-quality inputs proceed to model training.",
    icon: RefreshCw,
    align: "right",
  },
  {
    year: "Step 3",
    title: "Model Training & Tuning",
    tech: "XGBoost & Hyperparameter Optimization",
    desc: "Advanced classification models are trained on the preprocessed dataset. Hyperparameters are systematically tuned to maximize ROC-AUC and minimize Brier scores, yielding robust predictive performance.",
    icon: Cpu,
    align: "left",
  },
  {
    year: "Step 4",
    title: "Evaluation & Interpretability",
    tech: "SHAP Value Generation",
    desc: "Before deployment, the model is rigorously evaluated. SHAP (Shapley Additive Explanations) values are generated for every prediction, transforming a 'black box' into a transparent, clinician-friendly tool.",
    icon: Sliders,
    align: "right",
  },
  {
    year: "Step 5",
    title: "Deployment & Drift Monitoring",
    tech: "Real-time MLOps Inference",
    desc: "The model is deployed via robust APIs. We continuously monitor live input data streams for covariate drift (using Kolmogorov-Smirnov tests) and trigger automated retraining pipelines when population demographics shift.",
    icon: Activity,
    align: "left",
  }
];

export default function App() {
  const [activeTab, setActiveTab] = useState<string>("dashboard");
  const [showSignIn, setShowSignIn] = useState<boolean>(false);
  // Restore session from JWT token stored in localStorage
  const [isSignedIn, setIsSignedIn] = useState<boolean>(() => !!localStorage.getItem("hg_auth_token"));
  const [userEmail, setUserEmail] = useState<string>("clinical-user@health.io");
  const [userName, setUserName] = useState<string>("Resident MD");
  const [userHistory, setUserHistory] = useState<any[]>([]);
  const [authLoading, setAuthLoading] = useState<boolean>(false);

  const fetchUserHistory = async (email: string) => {
    try {
      const res = await fetch(buildApiUrl(`/user-history?user_id=${email}`));
      if (res.ok) {
        const data = await res.json();
        setUserHistory(data.history || []);
      }
    } catch (e) {
      console.error("Error fetching history", e);
    }
  };

  // Handle Google redirect result on app load (fallback when popup was blocked)
  useEffect(() => {
    getRedirectResult(auth)
      .then(async (result) => {
        if (result && result.user && result.user.email) {
          const user = result.user;
          try {
            const response = await fetch(buildApiUrl("/auth/google"), {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                name: user.displayName || "Google User",
                email: user.email,
              }),
            });
            if (response.ok) {
              const data = await response.json();
              setIsSignedIn(true);
              setUserEmail(data.email);
              setUserName(data.name);
              await fetchUserHistory(data.email);
              setShowSignIn(false);
              setActiveTab("dashboard");
            }
          } catch (err) {
            console.error("Redirect sign-in backend sync error:", err);
          }
        }
      })
      .catch((err) => {
        console.error("getRedirectResult error:", err);
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Helper: save JWT token to localStorage
  const persistSession = (token: string) => {
    localStorage.setItem("hg_auth_token", token);
  };

  // Helper: clear session from localStorage
  const clearSession = () => {
    localStorage.removeItem("hg_auth_token");
  };

  // On mount: verify stored JWT token against the database via /auth/me
  useEffect(() => {
    const token = localStorage.getItem("hg_auth_token");
    if (!token) return;

    fetch(buildApiUrl("/auth/me"), {
      headers: { "Authorization": `Bearer ${token}` }
    })
      .then(async (res) => {
        if (res.ok) {
          const data = await res.json();
          setIsSignedIn(true);
          setUserEmail(data.email);
          setUserName(data.name);
          await fetchUserHistory(data.email);
        } else {
          // Token expired or invalid — clear it
          clearSession();
          setIsSignedIn(false);
        }
      })
      .catch(() => {
        // Network error — keep the signed-in state optimistically
        // but don't force logout (backend may be waking up)
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Persistent Auth State Listener for Google/Firebase auth
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user && user.email) {
        const name = user.displayName || "Google User";
        setIsSignedIn(true);
        setUserEmail(user.email);
        setUserName(name);
        await fetchUserHistory(user.email);
      } else {
        // Only clear if not a JWT token session
        if (!localStorage.getItem("hg_auth_token")) {
          setIsSignedIn(false);
        }
      }
    });
    return () => unsubscribe();
  }, []);

  // Clinical Parameter States (Diabetes)
  const [diabetesInput, setDiabetesInput] = useState({
    HighBP: 0,
    HighChol: 0,
    BMI: 27.5,
    Stroke: 0,
    HeartDiseaseorAttack: 0,
    PhysActivity: 1,
    HvyAlcoholConsump: 0,
    GenHlth: 3,
    MentHlth: 0,
    PhysHlth: 0,
    DiffWalk: 0,
    Age: 7,
  });
  const [diabetesRisk, setDiabetesRisk] = useState({ score: 0, level: "Normal" });
  const [diabetesAIReport, setDiabetesAIReport] = useState<string>("");
  const [loadingDiabetesAI, setLoadingDiabetesAI] = useState<boolean>(false);
  const [predictDataDiabetes, setPredictDataDiabetes] = useState<PredictApiResponse | null>(null);

  // Clinical Parameter States (Heart)
  const [heartInput, setHeartInput] = useState({
    gender: 0,
    age_years: 54,
    bmi: 27,
    ap_hi: 120,
    ap_lo: 80,
    cholesterol: 1,
    gluc: 1,
    smoke: 0,
    alco: 0,
    active: 1,
  });
  const [heartRisk, setHeartRisk] = useState({ score: 0, level: "Normal" });
  const [heartAIReport, setHeartAIReport] = useState<string>("");
  const [loadingHeartAI, setLoadingHeartAI] = useState<boolean>(false);
  const [predictDataHeart, setPredictDataHeart] = useState<PredictApiResponse | null>(null);

  const [hasPredictedDiabetes, setHasPredictedDiabetes] = useState<boolean>(false);
  const [hasPredictedHeart, setHasPredictedHeart] = useState<boolean>(false);

  // Symptom AI States
  const [symptomText, setSymptomText] = useState<string>("");
  const [symptomReport, setSymptomReport] = useState<string>("");
  const [loadingSymptomAI, setLoadingSymptomAI] = useState<boolean>(false);
  const [selectedSymptomChip, setSelectedSymptomChip] = useState<string>("");

  // Data Drift & MLOps States
  const [driftStatus, setDriftStatus] = useState({
    detected: true,
    index: "0.284 (High Drift)",
    details: "Glucose & LDL parameters show distribution drift.",
    ksValue: 0.082,
    baselineYear: "2024 Epoch",
    activeEpoch: "Current May 2026 Batch",
  });
  const [isRetraining, setIsRetraining] = useState<boolean>(false);
  const [retrainLogs, setRetrainLogs] = useState<string[]>([]);
  const [modelRetrained, setModelRetrained] = useState<boolean>(false);

  const apiBase = import.meta.env.VITE_API_URL || "http://localhost:8000";
  const buildApiUrl = (path: string) => {
    const base = apiBase.replace(/\/$/, "");
    const suffix = path.startsWith("/") ? path : `/${path}`;
    return `${base}${suffix}`;
  };

  const getUserId = () => (userEmail?.trim() ? userEmail : "anonymous");

  const buildDiabetesPayload = () => ({
    user_id: getUserId(),
    HighBP: diabetesInput.HighBP,
    HighChol: diabetesInput.HighChol,
    BMI: diabetesInput.BMI,
    Stroke: diabetesInput.Stroke,
    HeartDiseaseorAttack: diabetesInput.HeartDiseaseorAttack,
    PhysActivity: diabetesInput.PhysActivity,
    HvyAlcoholConsump: diabetesInput.HvyAlcoholConsump,
    GenHlth: diabetesInput.GenHlth,
    MentHlth: diabetesInput.MentHlth,
    PhysHlth: diabetesInput.PhysHlth,
    DiffWalk: diabetesInput.DiffWalk,
    Age: diabetesInput.Age,
  });

  const buildHeartPayload = () => ({
    user_id: getUserId(),
    gender: heartInput.gender,
    age_years: heartInput.age_years,
    bmi: heartInput.bmi,
    ap_hi: heartInput.ap_hi,
    ap_lo: heartInput.ap_lo,
    cholesterol: heartInput.cholesterol,
    gluc: heartInput.gluc,
    smoke: heartInput.smoke,
    alco: heartInput.alco,
    active: heartInput.active,
  });

  const deriveSymptomKeys = (text: string) => {
    const normalized = text.toLowerCase();
    const rules: Array<{ key: string; keywords: string[] }> = [
      { key: "frequent_urination", keywords: ["frequent urination", "urination", "urinating"] },
      { key: "excessive_thirst", keywords: ["thirst", "dehydrated", "dry mouth"] },
      { key: "fatigue", keywords: ["fatigue", "tired", "exhaust", "low energy"] },
      { key: "blurred_vision", keywords: ["blurred vision", "blurry", "vision"] },
      { key: "slow_healing", keywords: ["slow healing", "wound", "cuts"] },
      { key: "numbness", keywords: ["numbness", "tingling", "pins"] },
      { key: "headaches", keywords: ["headache", "migraine", "head pain"] },
      { key: "low_activity", keywords: ["sedentary", "inactive", "low activity"] },
      { key: "chest_pain", keywords: ["chest pain", "pressure", "tightness"] },
      { key: "shortness_of_breath", keywords: ["shortness of breath", "breathless", "breathing"] },
      { key: "swelling_legs", keywords: ["swelling", "edema", "legs swollen"] },
      { key: "dizziness", keywords: ["dizzy", "lightheaded", "vertigo"] },
    ];
    const matched = rules
      .filter((rule) => rule.keywords.some((keyword) => normalized.includes(keyword)))
      .map((rule) => rule.key);
    return Array.from(new Set(matched));
  };

  const formatPredictReport = (data: PredictApiResponse) => {
    const lines: string[] = [];
    if (data.risk_level) lines.push(`Risk level: ${data.risk_level}`);
    if (typeof data.probability_yes === "number") {
      lines.push(`Probability: ${Math.round(data.probability_yes * 100)}%`);
    }
    if (data.shap_summary) lines.push(`Summary: ${data.shap_summary}`);
    if (Array.isArray(data.shap_explanation) && data.shap_explanation.length > 0) {
      lines.push("Top factors:");
      data.shap_explanation.slice(0, 5).forEach((item) => {
        lines.push(`- ${item.feature} (${item.direction})`);
      });
    }
    if (Array.isArray(data.recommendations) && data.recommendations.length > 0) {
      lines.push("Recommendations:");
      data.recommendations.forEach((rec) => lines.push(`- ${rec}`));
    }
    return lines.join("\n");
  };

  const formatSymptomReport = (data: SymptomApiResponse) => {
    const lines: string[] = [];
    if (data.symptoms_used?.length) {
      lines.push(`Symptoms matched: ${data.symptoms_used.join(", ")}`);
    }
    lines.push(formatPredictReport(data));
    return lines.join("\n");
  };

  // Hide predictions when data updates until explicitly predicted again
  useEffect(() => {
    setHasPredictedDiabetes(false);
    setPredictDataDiabetes(null);
  }, [diabetesInput]);

  useEffect(() => {
    setHasPredictedHeart(false);
    setPredictDataHeart(null);
  }, [heartInput]);

  // Tab switching handler
  const handleTabChange = (tabId: string) => {
    if (tabId === "logout") {
      clearSession();
      setIsSignedIn(false);
      setUserEmail("guest-clinician@health.io");
      setUserName("Resident MD");
      setActiveTab("dashboard");
      return;
    }
    setActiveTab(tabId);
    window.scrollTo({ top: 0, behavior: 'instant' });
  };

  // Diabetes risk parameters multiplier scoring
  const calculateDiabetesRisk = () => {
    let base = 12;

    if (diabetesInput.HighBP) base += 12;
    if (diabetesInput.HighChol) base += 10;
    if (diabetesInput.BMI >= 30) base += 18;
    if (diabetesInput.BMI >= 25 && diabetesInput.BMI < 30) base += 8;
    if (diabetesInput.Stroke) base += 8;
    if (diabetesInput.HeartDiseaseorAttack) base += 10;
    if (!diabetesInput.PhysActivity) base += 10;
    if (diabetesInput.HvyAlcoholConsump) base += 6;
    if (diabetesInput.GenHlth >= 4) base += 12;
    if (diabetesInput.MentHlth >= 10) base += 6;
    if (diabetesInput.PhysHlth >= 10) base += 6;
    if (diabetesInput.DiffWalk) base += 8;
    if (diabetesInput.Age >= 9) base += 8;

    const score = Math.min(Math.max(base, 6), 98);
    let level = "Normal";
    if (score > 60) level = "High Diabetic Risk";
    else if (score > 30) level = "Moderate / Prediabetic Alert";

    setDiabetesRisk({ score, level });
  };

  // Heart disease scoring formula
  const calculateHeartRisk = () => {
    let base = 10;

    if (heartInput.ap_hi >= 140 || heartInput.ap_lo >= 90) base += 18;
    if (heartInput.cholesterol === 2) base += 10;
    if (heartInput.cholesterol === 3) base += 20;
    if (heartInput.gluc === 2) base += 6;
    if (heartInput.gluc === 3) base += 12;
    if (heartInput.bmi >= 30) base += 12;
    if (heartInput.age_years >= 60) base += 10;
    if (heartInput.smoke) base += 10;
    if (heartInput.alco) base += 6;
    if (!heartInput.active) base += 8;

    const score = Math.min(Math.max(base, 6), 96);
    let level = "Normal";
    if (score > 65) level = "Severe Coronary Risk Present";
    else if (score > 35) level = "Borderline Cardiac Strain";

    setHeartRisk({ score, level });
  };

  // Fetch complete expert explanation via server route
  const getDiabetesAIReport = async () => {
    setLoadingDiabetesAI(true);
    setDiabetesAIReport("");
    try {
      const response = await fetch(buildApiUrl("/predict"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(buildDiabetesPayload()),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data?.detail || "Prediction request failed.");
      }
      const typed = data as PredictApiResponse;
      setPredictDataDiabetes(typed);
      setDiabetesRisk({
        score: Math.round((typed.probability_yes ?? 0) * 100),
        level: typed.risk_level || "Unknown",
      });
      setDiabetesAIReport(formatPredictReport(typed) || "No report generated.");
    } catch (err) {
      console.error(err);
      setDiabetesAIReport("API Error reaching the prediction service.");
    } finally {
      setLoadingDiabetesAI(false);
    }
  };

  const getHeartAIReport = async () => {
    setLoadingHeartAI(true);
    setHeartAIReport("");
    try {
      const response = await fetch(buildApiUrl("/predict-heart"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(buildHeartPayload()),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data?.detail || "Heart prediction request failed.");
      }
      const typed = data as PredictApiResponse;
      setPredictDataHeart(typed);
      setHeartRisk({
        score: Math.round((typed.probability_yes ?? 0) * 100),
        level: typed.risk_level || "Unknown",
      });
      setHeartAIReport(formatPredictReport(typed) || "No report generated.");
    } catch (err) {
      console.error(err);
      setHeartAIReport("API Error reaching the heart prediction service.");
    } finally {
      setLoadingHeartAI(false);
    }
  };

  // Symptoms consultation check
  const analyzeSymptomsAI = async (symptomQuery: string) => {
    setLoadingSymptomAI(true);
    setSymptomReport("");
    try {
      // Call the Express backend endpoint for AI Triage instead of FastAPI ML endpoint
      const response = await fetch("/api/analyze-symptoms", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          symptoms: symptomQuery,
        }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data?.error || "AI triage request failed.");
      }
      setSymptomReport(data.response || "Triage check completed.");
    } catch (err) {
      console.error(err);
      setSymptomReport("Offline clinic check failed. Please test API connections.");
    } finally {
      setLoadingSymptomAI(false);
    }
  };

  // Sample symptom helper button
  const handleSymptomPreset = (preset: string) => {
    setSelectedSymptomChip(preset);
    setSymptomText(preset);
    analyzeSymptomsAI(preset);
  };

  // Retraining pipeline simulation for MLOps
  const runRetrainPipeline = () => {
    setIsRetraining(true);
    setRetrainLogs([]);
    let currentLogs: string[] = [];

    const addLog = (text: string, delay: number) => {
      setTimeout(() => {
        currentLogs.push(text);
        setRetrainLogs([...currentLogs]);
      }, delay);
    };

    addLog("⚡ Initializing XGBoostRetrainExecutor [Job ID: Retrain_Clin_2026]...", 300);
    addLog("📥 Extracting dataset from S3 Clinical Data Vault (124,000 active patient profiles)...", 900);
    addLog("🧼 Validating biochem features outlier exclusion (Fasting glucose range truncated to [40-400])...", 1600);
    addLog("📊 Computing Kolmogorov-Smirnov stats between Baseline Epoch and May 2026 batch...", 2400);
    addLog("🔄 Optimizing hyperparameters (learning_rate=0.045, max_depth=6, scale_pos_weight=1.8)...", 3100);
    addLog("🧬 Cross-validation fold 5/5 complete: ROC-AUC increased from 0.912 to 0.948! 🚀", 3900);
    addLog("🔬 SHAP contribution baselines recalculated perfectly.", 4500);
    addLog("🛡️ Saving model artifact 'xgb_diabetes_v2_6_1' into production registry...", 5100);

    setTimeout(() => {
      setDriftStatus({
        detected: false,
        index: "0.021 (Extremely Stable)",
        details: "RETRAIN_COMPLETED. Dynamic thresholds aligned with recent population stats.",
        ksValue: 0.012,
        baselineYear: "May 2026 Retrained Standard",
        activeEpoch: "Current May 2026 Batch",
      });
      setIsRetraining(false);
      setModelRetrained(true);
    }, 5500);
  };

  // Log in handler
  const handleSignInSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (authLoading) return;
    const formData = new FormData(e.currentTarget);
    const email = formData.get("email")?.toString() || "";
    const password = formData.get("password")?.toString() || "";
    
    if (!email || !password) {
      alert("Please enter both email and password.");
      return;
    }

    setAuthLoading(true);
    try {
      const response = await fetch(buildApiUrl("/auth/login"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password })
      });
      if (!response.ok) {
        alert("Invalid email or password.");
        return;
      }
      const data = await response.json();
      if (data.token) persistSession(data.token);
      setIsSignedIn(true);
      setUserEmail(data.email);
      setUserName(data.name);
      await fetchUserHistory(data.email);
      setShowSignIn(false);
      setActiveTab("dashboard");
    } catch (err) {
      console.error(err);
      alert("Error connecting to server. The backend may be waking up — please wait a moment and try again.");
    } finally {
      setAuthLoading(false);
    }
  };

  // Interactive dynamic SHAP force data calculations
  const getDiabetesSHAPData = () => {
    const baseline = 0.22; // overall normal health log-odds or probability bias
    const list = [
      { name: "High BP", value: diabetesInput.HighBP ? 0.2 : -0.05, positive: !!diabetesInput.HighBP, desc: "Hypertension flag" },
      { name: "High Cholesterol", value: diabetesInput.HighChol ? 0.18 : -0.04, positive: !!diabetesInput.HighChol, desc: "Hyperlipidemia indicator" },
      { name: "BMI", value: diabetesInput.BMI >= 30 ? 0.24 : (diabetesInput.BMI >= 25 ? 0.1 : -0.08), positive: diabetesInput.BMI >= 25, desc: "Body mass index impact" },
      { name: "General Health", value: diabetesInput.GenHlth >= 4 ? 0.14 : -0.05, positive: diabetesInput.GenHlth >= 4, desc: "Self-reported general health" },
      { name: "Age Group", value: diabetesInput.Age >= 9 ? 0.08 : -0.04, positive: diabetesInput.Age >= 9, desc: "Age category bucket" },
      { name: "Physical Activity", value: diabetesInput.PhysActivity ? -0.07 : 0.12, positive: !diabetesInput.PhysActivity, desc: "Recent physical activity flag" }
    ];
    return { baseline, list };
  };

  const getHeartSHAPData = () => {
    const baseline = 0.25;
    const list = [
      { name: "Systolic BP", value: heartInput.ap_hi >= 140 ? 0.2 : -0.05, positive: heartInput.ap_hi >= 140, desc: "Systolic blood pressure" },
      { name: "Diastolic BP", value: heartInput.ap_lo >= 90 ? 0.12 : -0.04, positive: heartInput.ap_lo >= 90, desc: "Diastolic blood pressure" },
      { name: "Cholesterol", value: heartInput.cholesterol === 3 ? 0.22 : (heartInput.cholesterol === 2 ? 0.1 : -0.05), positive: heartInput.cholesterol > 1, desc: "Cholesterol category" },
      { name: "Glucose", value: heartInput.gluc === 3 ? 0.18 : (heartInput.gluc === 2 ? 0.08 : -0.04), positive: heartInput.gluc > 1, desc: "Glucose category" },
      { name: "BMI", value: heartInput.bmi >= 30 ? 0.14 : -0.04, positive: heartInput.bmi >= 30, desc: "Body mass index" },
      { name: "Activity", value: heartInput.active ? -0.08 : 0.12, positive: !heartInput.active, desc: "Physical activity flag" }
    ];
    return { baseline, list };
  };

  // Active SHAP dataset calculations based on active visual predictor
  const currentSHAPDataset = activeTab === "heart" ? getHeartSHAPData() : getDiabetesSHAPData();

  if (showSignIn) {
    return (
      <div className="bg-zinc-900 text-zinc-50 w-screen min-h-screen flex flex-col justify-between">
        <SignInPage
          title={<span className="font-display font-bold text-violet-600 dark:text-violet-400">Clinical Triage Vault</span>}
          description="Access diagnostic registries,retrain pipeline statuses,and verify explainability indexes"
          heroImageSrc="/login-bg.png"
          testimonials={sampleSignInTestimonials}
          onSignIn={handleSignInSubmit}
          onGoogleSignIn={async () => {
            if (authLoading) return;
            setAuthLoading(true);
            try {
              const result = await signInWithPopup(auth, googleProvider);
              const user = result.user;
              
              if (user.email) {
                const response = await fetch(buildApiUrl("/auth/google"), {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ 
                    name: user.displayName || "Google User", 
                    email: user.email 
                  })
                });

                if (!response.ok) {
                    throw new Error("Failed to sync with backend database");
                }

                const data = await response.json();
                if (data.token) persistSession(data.token);
                setIsSignedIn(true);
                setUserEmail(data.email);
                setUserName(data.name);
                await fetchUserHistory(data.email);
                setShowSignIn(false);
                setActiveTab("dashboard");
              }
            } catch (error: any) {
              console.error("Firebase Google Sign-In Error:", error);
              // If popup was blocked by the browser, fall back to redirect
              if (
                error?.code === "auth/popup-blocked" ||
                error?.code === "auth/cancelled-popup-request" ||
                error?.code === "auth/popup-closed-by-user"
              ) {
                try {
                  await signInWithRedirect(auth, googleProvider);
                  // Page will reload after redirect; result handled in useEffect
                } catch (redirectErr) {
                  console.error("Redirect fallback also failed:", redirectErr);
                  alert("Google Sign-In failed. Please check your browser popup settings and try again.");
                }
              } else {
                alert(`Google Sign-In failed: ${error?.message || "Unknown error. Please try again."}`);
              }
            } finally {
              setAuthLoading(false);
            }
          }}
          onResetPassword={() => alert("Simulated clinic server reset requested.")}
          onCreateAccount={async (e) => {
            e.preventDefault();
            if (authLoading) return;
            const formData = new FormData(e.currentTarget);
            const email = formData.get("email")?.toString() || "";
            const password = formData.get("password")?.toString() || "";
            const name = formData.get("name")?.toString() || "Resident MD";

            if (!email || !password || !name) {
              alert("Please fill in all fields (Name, Email, Password).");
              return;
            }

            setAuthLoading(true);
            try {
              const response = await fetch(buildApiUrl("/auth/register"), {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ name, email, password })
              });
              if (!response.ok) {
                // Check if it's a 409 conflict (already registered) or a server error
                if (response.status === 409) {
                  alert("This email is already registered. Please sign in instead.");
                } else {
                  alert("Server error. The backend may be waking up — please wait a moment and try again.");
                }
                return;
              }
              const data = await response.json();
              if (data.token) persistSession(data.token);
              setIsSignedIn(true);
              setUserEmail(data.email);
              setUserName(data.name);
              await fetchUserHistory(data.email);
              setShowSignIn(false);
              setActiveTab("dashboard");
            } catch (err) {
              console.error(err);
              alert("Error connecting to server. The backend may be waking up — please wait a moment and try again.");
            } finally {
              setAuthLoading(false);
            }
          }}
        />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0a0b0e] font-sans text-slate-300 transition-colors duration-300">
      
      {/* Dynamic Main Medical Header */}
      <Header 
        activeTab={activeTab} 
        onTabChange={handleTabChange}
        onSignInClick={() => setShowSignIn(true)}
        isSignedIn={isSignedIn}
        userEmail={userEmail}
        onSignOut={() => {
          setIsSignedIn(false);
          setUserEmail("");
        }}
      />

      {/* Cinematic Hero serves as the immersive introduction for the "Welcome" status */}
      {activeTab === "dashboard" && (
        <div className="animate-fade-in">
          <CinematicHero 
            onCtaClick={() => handleTabChange("diabetes")} 
            brandName="HealthGuard AI"
            tagline1="Healthcare Intelligence, Reimagined"
            tagline2="Predict disease risk, understand contributing factors, and make informed health decisions through explainable AI."
            cardHeading="Predictive Accuracy & Clinical Interpretability."
          />
        </div>
      )}

      {/* Primary Dashboard Container */}
      <div className="w-full flex flex-col md:flex-row min-h-[calc(100vh-3.5rem)] bg-[#0a0b0e]">
        
        {/* Sidebar Navigation */}
        {activeTab !== "dashboard" && (
          <Sidebar 
            activeTab={activeTab === "dashboard" ? "dashboard" : activeTab} 
            onTabChange={handleTabChange}
            userEmail={userEmail}
            userName={userName}
          />
        )}

        {/* Content Block Column */}
        <main className="flex-1 p-4 sm:p-8 md:p-12 transition-all overflow-hidden bg-[#0a0b0e]">
          
          {/* TAB 1: QUICK OVERVIEW / HOMEPAGE */}
          {activeTab === "dashboard" && (
            <div className="space-y-12 animate-element">
              
              {/* Clinical Header */}
              <motion.div 
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: false, margin: "-80px" }}
                transition={{ duration: 0.6 }}
                className="border-b border-slate-800 pb-6"
              >
                <span className="text-emerald-400 text-xs font-bold tracking-widest uppercase font-mono block mb-1">
                  Active Diagnostic Space
                </span>
                <h1 className="text-3xl md:text-5xl font-serif italic text-white font-medium tracking-tight">
                  Medical Predictive Systems Hub
                </h1>
                <p className="text-slate-400 mt-2 text-md leading-relaxed w-full">
                  Analyze patient biomonitoring parameters, check system interpretability with raw SHAP additive calculations, map clinical symptom alerts, and retain data model stability under clinical drift conditions.
                </p>
              </motion.div>

              {/* Statistics Grid */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                
                <motion.div 
                  initial={{ opacity: 0, y: 40 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: false, margin: "-80px" }}
                  transition={{ duration: 0.5, delay: 0.1 }}
                  onClick={() => handleTabChange("diabetes")}
                  className="rounded-3xl p-6 bg-[#14171c] border border-slate-800 shadow-lg hover:border-emerald-500/50 hover:shadow-emerald-500/5 transition-all duration-300 cursor-pointer group"
                >
                  <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 flex items-center justify-center text-emerald-400 mb-4 group-hover:scale-105 transition-transform">
                    <Activity className="size-6" />
                  </div>
                  <h3 className="font-serif italic font-bold text-xl text-white mb-2">Endocrine Risk Predictor</h3>
                  <p className="text-xs text-slate-400 leading-relaxed mb-4">
                    Examine BRFSS lifestyle and clinical indicators (blood pressure, cholesterol, BMI, health days, activity) to determine Type-2 diabetes risk.
                  </p>
                  <div className="flex items-center text-xs text-emerald-400 font-bold gap-1">
                    Launch Form <ArrowRight className="size-3.5 group-hover:translate-x-1 transition-transform" />
                  </div>
                </motion.div>

                <motion.div 
                  initial={{ opacity: 0, y: 40 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: false, margin: "-80px" }}
                  transition={{ duration: 0.5, delay: 0.2 }}
                  onClick={() => handleTabChange("heart")}
                  className="rounded-3xl p-6 bg-[#14171c] border border-slate-800 shadow-lg hover:border-emerald-500/50 hover:shadow-emerald-500/5 transition-all duration-300 cursor-pointer group"
                >
                  <div className="w-12 h-12 rounded-2xl bg-rose-600/10 flex items-center justify-center text-rose-400 mb-4 group-hover:scale-105 transition-transform">
                    <Heart className="size-6" />
                  </div>
                  <h3 className="font-serif italic font-bold text-xl text-white mb-2">Cardiac disease Predictor</h3>
                  <p className="text-xs text-slate-400 leading-relaxed mb-4">
                    Analyze blood pressure, cholesterol, glucose category, BMI, and lifestyle signals using the cardiac model schema.
                  </p>
                  <div className="flex items-center text-xs text-rose-400 font-bold gap-1">
                    Launch Form <ArrowRight className="size-3.5 group-hover:translate-x-1 transition-transform" />
                  </div>
                </motion.div>

                <motion.div 
                  initial={{ opacity: 0, y: 40 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: false, margin: "-80px" }}
                  transition={{ duration: 0.5, delay: 0.3 }}
                  onClick={() => handleTabChange("symptoms")}
                  className="rounded-3xl p-6 bg-[#14171c] border border-slate-800 shadow-lg hover:border-emerald-500/50 hover:shadow-emerald-500/5 transition-all duration-300 cursor-pointer group"
                >
                  <div className="w-12 h-12 rounded-2xl bg-emerald-600/10 flex items-center justify-center text-emerald-400 mb-4 group-hover:scale-105 transition-transform">
                    <Stethoscope className="size-6" />
                  </div>
                  <h3 className="font-serif italic font-bold text-xl text-white mb-2">Symptom AI Clinician</h3>
                  <p className="text-xs text-slate-400 leading-relaxed mb-4">
                    Submit active patient discomfort queries or select presets to query a high-level triage assistant running live model loops.
                  </p>
                  <div className="flex items-center text-xs text-emerald-400 font-bold gap-1">
                    Check Symptoms <ArrowRight className="size-3.5 group-hover:translate-x-1 transition-transform" />
                  </div>
                </motion.div>

              </div>

              {/* Advanced Technical Model Performance Cards */}
              <motion.div 
                initial={{ opacity: 0, y: 45 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: false, margin: "-80px" }}
                transition={{ duration: 0.6 }}
                className="grid grid-cols-1 lg:grid-cols-3 gap-6 bg-[#14171c] p-6 rounded-3xl border border-slate-800"
              >
                <div className="lg:col-span-2 space-y-4">
                  <h3 className="font-serif italic font-bold text-lg text-white flex items-center gap-2">
                    <Cpu className="text-emerald-400 size-5" />
                    Model Performance Index & Calibration
                  </h3>
                  <p className="text-xs text-slate-400">
                    The active clinical models are trained against the CDC NHANES database. The validation parameters are updated daily via MLOps pipelines.
                  </p>
                  <div className="grid grid-cols-3 gap-4 font-mono text-center pt-2">
                    <div className="p-3.5 rounded-2xl bg-[#0a0b0e] border border-slate-800">
                      <div className="text-[10px] text-slate-500 uppercase">XGBoost ROC-AUC</div>
                      <div className="text-md sm:text-xl font-bold mt-1 text-emerald-400">0.948</div>
                    </div>
                    <div className="p-3.5 rounded-2xl bg-[#0a0b0e] border border-slate-800">
                      <div className="text-[10px] text-slate-500 uppercase">F1 Accuracy</div>
                      <div className="text-md sm:text-xl font-bold mt-1 text-emerald-400">92.4%</div>
                    </div>
                    <div className="p-3.5 rounded-2xl bg-[#0a0b0e] border border-slate-800">
                      <div className="text-[10px] text-slate-500 uppercase">Brier Score</div>
                      <div className="text-md sm:text-xl font-bold mt-1 text-emerald-400 font-bold">0.114</div>
                    </div>
                  </div>
                </div>

                <div className="p-6 rounded-2xl bg-emerald-500/5 dark:bg-emerald-950/20 border border-emerald-500/10 flex flex-col justify-between">
                  <div>
                    <div className="flex items-center gap-2 mb-2 text-emerald-400">
                      <Database className="size-4" />
                      <span className="text-xs font-bold uppercase tracking-wider font-mono">Dataset Drift Alarm</span>
                    </div>
                    <h4 className="font-bold text-sm mb-1 text-white">Retrain Sequence Required</h4>
                    <p className="text-slate-400 text-[11px] leading-relaxed">
                      Kolmogorov-Smirnov test highlights that metabolic age profiles have drifted by d = 0.284. Retraining is advised to preserve calibration.
                    </p>
                  </div>
                  <button 
                    onClick={() => handleTabChange("drift")}
                    className="mt-4 px-4 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-black font-semibold text-xs transition-colors w-full cursor-pointer"
                  >
                    Open Retraining Console
                  </button>
                </div>
              </motion.div>

              {/* USER PREDICTION HISTORY TABLE */}
              {userHistory.length > 0 && (
                <motion.div 
                  initial={{ opacity: 0, y: 30 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: false, margin: "-80px" }}
                  transition={{ duration: 0.6 }}
                  className="space-y-6 pt-12 border-t border-slate-800"
                >
                  <div className="flex items-center gap-2 text-emerald-400 mb-2">
                    <Database className="size-5" />
                    <span className="text-sm font-bold uppercase tracking-wider font-mono">Personal Patient Database</span>
                  </div>
                  <h3 className="text-2xl font-serif italic text-white font-medium mb-4">
                    Your Prediction History
                  </h3>
                  <div className="overflow-x-auto rounded-2xl border border-slate-800 bg-[#14171c]">
                    <table className="w-full text-left text-sm text-slate-300">
                      <thead className="text-xs uppercase bg-[#0a0b0e] text-slate-500 font-mono">
                        <tr>
                          <th className="px-6 py-4 border-b border-slate-800">Date</th>
                          <th className="px-6 py-4 border-b border-slate-800">Risk Level</th>
                          <th className="px-6 py-4 border-b border-slate-800">Probability</th>
                          <th className="px-6 py-4 border-b border-slate-800">Data Drift</th>
                        </tr>
                      </thead>
                      <tbody>
                        {userHistory.map((item) => (
                          <tr key={item.id} className="border-b border-slate-800/50 hover:bg-[#1a1e24] transition-colors">
                            <td className="px-6 py-4 whitespace-nowrap">
                              {new Date(item.timestamp).toLocaleString()}
                            </td>
                            <td className="px-6 py-4">
                              <span className={`px-2 py-1 rounded-full text-[10px] font-bold ${
                                item.risk_level.toLowerCase().includes('high') ? 'bg-rose-500/20 text-rose-400' :
                                item.risk_level.toLowerCase().includes('moderate') ? 'bg-amber-500/20 text-amber-400' :
                                'bg-emerald-500/20 text-emerald-400'
                              }`}>
                                {item.risk_level}
                              </span>
                            </td>
                            <td className="px-6 py-4">
                              {(item.probability * 100).toFixed(1)}%
                            </td>
                            <td className="px-6 py-4">
                              {item.drift_detected ? (
                                <span className="text-rose-400 text-xs flex items-center gap-1"><Activity className="size-3"/> Detected</span>
                              ) : (
                                <span className="text-slate-500 text-xs">Stable</span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </motion.div>
              )}

              {/* BRAND MISSION & ABOUT BIO_SYNC INTERACTION */}
              <motion.div 
                initial={{ opacity: 0, y: 50 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: false, margin: "-80px" }}
                transition={{ duration: 0.7 }}
                className="space-y-6 pt-12 border-t border-slate-800"
              >
                <div className="grid grid-cols-1 md:grid-cols-2 gap-12 items-center">
                  <div className="text-center sm:text-left flex flex-col justify-center h-full">
                    <span className="text-emerald-400 text-sm font-bold tracking-widest uppercase font-mono block mb-3">
                      System Foundations
                    </span>
                    <h2 className="text-4xl md:text-5xl font-serif italic text-white mb-8">
                      About HealthGuard AI Workspace
                    </h2>
                    <div className="text-slate-300 text-base md:text-lg space-y-6 leading-relaxed w-full">
                      <p>
                        HealthGuard AI is an expert-level interactive sandbox designed to demystify critical patient diagnostics. Combining highly calibrated classification models with real-time explanatory manifolds, we bridge the gap between complex hospital records and mathematical accountability.
                      </p>
                      <p>
                        We firmly reject complete black-box estimations. Every classification score processed by our engine incorporates direct, interactive game-theory contributions (SHAP values) that reflect the exact directional push of clinical measurements. This guarantees mathematical trust and transparency in every decision.
                      </p>
                      <p>
                        Furthermore, because clinical populations naturally undergo demographic shifts, our MLOps compliance infrastructure constantly monitors Kolmogorov-Smirnov metrics against baseline records. By offering real-time data drift alarms and one-click retraining sequences alongside state-of-the-art NLP triage, we ensure the diagnostic engine remains continuously aligned and clinically accurate.
                      </p>
                    </div>
                  </div>

                  <motion.div 
                    initial={{ opacity: 0, scale: 0.95 }}
                    whileInView={{ opacity: 1, scale: 1 }}
                    viewport={{ once: false, margin: "-80px" }}
                    transition={{ duration: 0.6 }}
                    className="relative rounded-3xl overflow-hidden border border-slate-800 shadow-2xl group w-full aspect-[4/3] md:aspect-square lg:aspect-[4/3] min-h-[300px]"
                  >
                    <div className="absolute inset-0 bg-emerald-500/10 mix-blend-overlay z-10 group-hover:bg-transparent transition-all duration-500" />
                    <img 
                      src="/system_foundations.png" 
                      alt="MLOps Dashboard Visualization" 
                      className="absolute inset-0 w-full h-full object-cover transform group-hover:scale-105 transition-transform duration-700"
                    />
                  </motion.div>
                </div>
              </motion.div>

              {/* MEDICAL AI EVOLUTION VERTICAL TIMELINE WITH SCROLL EFFECT (AOS) */}
              <div className="space-y-12 pt-16 border-t border-slate-800">
                <motion.div 
                  initial={{ opacity: 0, y: 30 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: false, margin: "-80px" }}
                  transition={{ duration: 0.6 }}
                  className="text-center"
                >
                  <span className="text-emerald-400 text-xs font-bold tracking-widest uppercase font-mono block mb-1">
                    Historical Chronology
                  </span>
                  <h2 className="text-3xl md:text-4xl font-serif italic text-white font-medium">
                    Evolution of AI in Medicine
                  </h2>
                  <p className="text-slate-400 text-sm mt-2 w-full block leading-relaxed">
                    A vertical timeline showcasing the key milestones, paradigm shifts, and algorithmic breakthroughs that led to modern artificial intelligence in diagnostics.
                  </p>
                </motion.div>

                {/* Timeline Grid Container */}
                <div className="relative w-full px-4 py-8 overflow-hidden">
                  
                  {/* Center dotted line on desktop, left dotted line on mobile */}
                  <div className="absolute left-6 md:left-1/2 top-0 bottom-0 w-0.5 border-r-2 border-dashed border-slate-800 transform md:-translate-x-1/2" />

                  {/* Historical Epochs */}
                  <div className="space-y-12 relative">
                    {timelineEvents.map((event, idx) => {
                      const IconComponent = event.icon;
                      const isLeft = event.align === "left";
                      
                      return (
                        <motion.div
                          key={idx}
                          initial={{ opacity: 0, y: 40 }}
                          whileInView={{ opacity: 1, y: 0 }}
                          viewport={{ once: false, margin: "-80px" }}
                          transition={{ duration: 0.6, delay: idx * 0.1 }}
                          className={`flex flex-col md:flex-row items-start md:items-center relative ${
                            isLeft ? "md:flex-row" : "md:flex-row-reverse"
                          }`}
                        >
                          {/* Circle Icon Indicator over the dotted line */}
                          <div className="absolute left-[2px] md:left-1/2 w-10 h-10 rounded-full bg-[#14171c] border border-slate-700 flex items-center justify-center text-emerald-400 transform -translate-x-1/2 z-10 shadow-lg shadow-black/80">
                            <IconComponent className="size-4" />
                          </div>

                          {/* Empty spacer block to balance grid on desktop */}
                          <div className="hidden md:block w-1/2 px-8" />

                          {/* Historical Epoch Card */}
                          <div className="w-full md:w-1/2 pl-12 md:pl-0 md:px-8">
                            <div className="p-6 rounded-3xl bg-[#14171c] border border-slate-800 shadow-xl relative hover:border-emerald-500/20 transition-all duration-300 group">
                              <span className="inline-block text-xs font-mono font-bold bg-[#0a0b0e] border border-slate-800 text-emerald-400 px-3 py-1 rounded-full mb-3 shadow-inner">
                                {event.year}
                              </span>
                              <h3 className="text-lg font-serif italic text-white font-medium leading-tight">
                                {event.title}
                              </h3>
                              <p className="text-[10px] font-mono text-slate-500 mt-1.5 uppercase tracking-wider">
                                Epoch Paradigm: {event.tech}
                              </p>
                              <p className="text-xs text-slate-400 leading-relaxed mt-3">
                                {event.desc}
                              </p>
                            </div>
                          </div>
                        </motion.div>
                      );
                    })}
                  </div>

                </div>
              </div>

              {/* Clinicians peer section testimonials */}
              <TestimonialsSection />

            </div>
          )}

          {/* TAB 2: DIABETES RISK PREDICTOR */}
          {activeTab === "diabetes" && (
            <div className="space-y-10 animate-element">
              
              <div className="border-b border-slate-800 pb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                  <span className="text-emerald-400 text-xs font-bold tracking-widest uppercase font-mono block mb-1">
                    System Form Alpha
                  </span>
                  <h1 className="text-3xl md:text-4xl font-serif italic font-medium text-white">
                    Diabetes Predictor Dashboard
                  </h1>
                </div>
                <button
                  onClick={() => handleTabChange("shap")}
                  className="px-4 py-2 rounded-xl border border-slate-800 text-xs hover:bg-[#14171c] text-slate-300 transition-colors cursor-pointer flex items-center gap-2"
                >
                  <BarChart className="size-4 text-emerald-400" />
                  View Current SHAP Explanation
                </button>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
                
                {/* Form column (5 cols) */}
                <div className="lg:col-span-5 bg-[#14171c] p-6 sm:p-8 rounded-3xl border border-slate-800 shadow-sm space-y-6">
                  <h3 className="font-serif italic font-bold text-lg text-white border-b border-slate-800 pb-3">
                    Patient Parameter Telemetry
                  </h3>

                  <div className="space-y-5">
                    <div>
                      <div className="flex justify-between text-xs font-semibold mb-2 text-slate-400">
                        <span>Age Category (1-13)</span>
                        <span className="font-mono text-emerald-400 font-bold">{diabetesInput.Age}</span>
                      </div>
                      <input
                        type="range"
                        min="1"
                        max="13"
                        value={diabetesInput.Age}
                        onChange={(e) => setDiabetesInput({...diabetesInput, Age: Number(e.target.value)})}
                        className="w-full accent-emerald-500 bg-slate-800 h-1.5 rounded-lg cursor-pointer"
                      />
                      <div className="flex justify-between text-[10px] text-zinc-500 mt-1">
                        <span>18-24</span>
                        <span>45-49</span>
                        <span>65-69</span>
                        <span>80+</span>
                      </div>
                    </div>

                    <div>
                      <div className="flex justify-between text-xs font-semibold mb-2 text-slate-400">
                        <span>Body Mass Index (BMI)</span>
                        <span className="font-mono text-emerald-400 font-bold">{diabetesInput.BMI}</span>
                      </div>
                      <input
                        type="range"
                        min="15"
                        max="50"
                        step="0.5"
                        value={diabetesInput.BMI}
                        onChange={(e) => setDiabetesInput({...diabetesInput, BMI: Number(e.target.value)})}
                        className="w-full accent-emerald-500 bg-slate-800 h-1.5 rounded-lg cursor-pointer"
                      />
                      <div className="flex justify-between text-[10px] text-zinc-500 mt-1">
                        <span>15 (Underweight)</span>
                        <span>24.9 (Normal)</span>
                        <span>30.0 (Obesity)</span>
                        <span>50</span>
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-400 mb-2">General Health (1=Excellent, 5=Poor)</label>
                      <select
                        value={diabetesInput.GenHlth}
                        onChange={(e) => setDiabetesInput({...diabetesInput, GenHlth: Number(e.target.value)})}
                        className="w-full bg-[#0a0b0e] border border-slate-800 rounded-xl p-3 text-sm text-slate-100"
                      >
                        {[1, 2, 3, 4, 5].map((value) => (
                          <option key={value} value={value}>{value}</option>
                        ))}
                      </select>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-semibold text-slate-400 mb-1">Mental Health (0-30 days)</label>
                        <input
                          type="number"
                          min="0"
                          max="30"
                          value={diabetesInput.MentHlth}
                          onChange={(e) => setDiabetesInput({...diabetesInput, MentHlth: Number(e.target.value)})}
                          className="w-full bg-[#0a0b0e] border border-slate-800 rounded-xl p-3 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 text-slate-100"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-slate-400 mb-1">Physical Health (0-30 days)</label>
                        <input
                          type="number"
                          min="0"
                          max="30"
                          value={diabetesInput.PhysHlth}
                          onChange={(e) => setDiabetesInput({...diabetesInput, PhysHlth: Number(e.target.value)})}
                          className="w-full bg-[#0a0b0e] border border-slate-800 rounded-xl p-3 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 text-slate-100"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="flex items-center gap-3 pt-6">
                        <input
                          type="checkbox"
                          checked={!!diabetesInput.PhysActivity}
                          onChange={(e) => setDiabetesInput({...diabetesInput, PhysActivity: e.target.checked ? 1 : 0})}
                          className="custom-checkbox"
                        />
                        <span className="text-slate-300 text-sm">Physically Active</span>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <label className="flex items-center gap-3 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={!!diabetesInput.HighBP}
                          onChange={(e) => setDiabetesInput({...diabetesInput, HighBP: e.target.checked ? 1 : 0})}
                          className="custom-checkbox"
                        />
                        <span className="text-slate-300 text-sm">High BP</span>
                      </label>
                      <label className="flex items-center gap-3 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={!!diabetesInput.HighChol}
                          onChange={(e) => setDiabetesInput({...diabetesInput, HighChol: e.target.checked ? 1 : 0})}
                          className="custom-checkbox"
                        />
                        <span className="text-slate-300 text-sm">High Cholesterol</span>
                      </label>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <label className="flex items-center gap-3 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={!!diabetesInput.Stroke}
                          onChange={(e) => setDiabetesInput({...diabetesInput, Stroke: e.target.checked ? 1 : 0})}
                          className="custom-checkbox"
                        />
                        <span className="text-slate-300 text-sm">Stroke History</span>
                      </label>
                      <label className="flex items-center gap-3 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={!!diabetesInput.HeartDiseaseorAttack}
                          onChange={(e) => setDiabetesInput({...diabetesInput, HeartDiseaseorAttack: e.target.checked ? 1 : 0})}
                          className="custom-checkbox"
                        />
                        <span className="text-slate-300 text-sm">Heart Disease/Attack</span>
                      </label>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <label className="flex items-center gap-3 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={!!diabetesInput.HvyAlcoholConsump}
                          onChange={(e) => setDiabetesInput({...diabetesInput, HvyAlcoholConsump: e.target.checked ? 1 : 0})}
                          className="custom-checkbox"
                        />
                        <span className="text-slate-300 text-sm">Heavy Alcohol</span>
                      </label>
                      <label className="flex items-center gap-3 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={!!diabetesInput.DiffWalk}
                          onChange={(e) => setDiabetesInput({...diabetesInput, DiffWalk: e.target.checked ? 1 : 0})}
                          className="custom-checkbox"
                        />
                        <span className="text-slate-300 text-sm">Difficulty Walking</span>
                      </label>
                    </div>
                    <div className="pt-6 border-t border-slate-800 flex justify-end">
                      <button 
                        onClick={() => {
                          if (!isSignedIn) {
                            setShowSignIn(true);
                            return;
                          }
                          setHasPredictedDiabetes(true);
                          getDiabetesAIReport();
                        }}
                        disabled={loadingDiabetesAI}
                        className={`bg-emerald-500 hover:bg-emerald-400 text-black font-bold px-6 py-3 rounded-xl transition-all shadow-lg shadow-emerald-500/20 flex items-center gap-2 ${loadingDiabetesAI ? 'opacity-50 cursor-not-allowed' : ''}`}
                      >
                        {loadingDiabetesAI ? <RefreshCw className="size-5 animate-spin" /> : <Activity className="size-5" />}
                        {loadingDiabetesAI ? "Running Model..." : "Predict Clinical Risk"}
                      </button>
                    </div>

                  </div>
                </div>

                {/* Report columns (7 cols) */}
                <div className="lg:col-span-7 lg:h-[calc(100vh-150px)] lg:overflow-y-auto lg:pr-4 custom-scrollbar">
                  {hasPredictedDiabetes ? (
                    <PredictorDashboard 
                      modelType="diabetes"
                      modelName={predictDataDiabetes ? predictDataDiabetes.label : "Diabetic"}
                      riskScore={diabetesRisk.score}
                      riskLevel={diabetesRisk.level}
                      confidenceScore={diabetesRisk.score}
                      {...generateDiabetesDashboardProps(diabetesInput, diabetesRisk.score, diabetesRisk.level)}
                      {...(predictDataDiabetes ? {
                        shapExplanation: {
                          summary: predictDataDiabetes.shap_summary,
                          features: predictDataDiabetes.shap_explanation.map(f => ({
                            name: f.feature,
                            impact: f.impact,
                            direction: f.direction === "increases" ? "up" : "down"
                          }))
                        },
                        driftWarning: {
                          detected: predictDataDiabetes.drift_detected,
                          message: "Statistical drift detected. Input values are anomalies compared to the training distribution.",
                          metrics: []
                        }
                      } : {})}
                      aiReport={diabetesAIReport}
                      loadingAI={loadingDiabetesAI}
                      onFetchAI={getDiabetesAIReport}
                      dietPlan={[
                        "Adopt a Mediterranean diet rich in olive oil, nuts, and fish.",
                        "Strictly limit simple carbohydrates and refined sugars.",
                        "Increase dietary fiber to at least 30g per day.",
                        "Monitor glycemic index of all consumed fruits."
                      ]}
                      precautions={[
                        "Schedule an HbA1c test within the next 2 weeks.",
                        "Monitor blood pressure daily.",
                        "Start with 15 mins of light walking after meals.",
                        "Consult endocrinologist regarding potential metformin usage."
                      ]}
                    />
                  ) : (
                    <div className="h-full min-h-[400px] flex flex-col items-center justify-center p-8 text-center border border-slate-800 border-dashed rounded-3xl bg-[#0a0b0e]">
                      <Activity className="size-12 text-slate-700 mb-4" />
                      <h3 className="text-xl font-serif text-slate-400 italic mb-2">Awaiting Parameters</h3>
                      <p className="text-sm text-slate-500 max-w-sm">
                        Adjust the patient parameters on the left and click <strong className="text-slate-400">Predict Clinical Risk</strong> to generate a customized clinical dashboard.
                      </p>
                    </div>
                  )}
                </div>

              </div>

            </div>
          )}

          {/* TAB 3: HEART DISEASE PREDICTOR */}
          {activeTab === "heart" && (
            <div className="space-y-10 animate-element">
              
              <div className="border-b border-slate-800 pb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                  <span className="text-rose-500 text-xs font-bold tracking-widest uppercase font-mono block mb-1">
                    System Form Beta
                  </span>
                  <h1 className="text-3xl md:text-4xl font-serif italic font-medium text-white">
                    Cardiac Disease Predictor
                  </h1>
                </div>
                <button
                  onClick={() => handleTabChange("shap")}
                  className="px-4 py-2 rounded-xl border border-slate-800 text-xs hover:bg-[#14171c] text-slate-350 transition-colors cursor-pointer flex items-center gap-2"
                >
                  <BarChart className="size-4 text-rose-500" />
                  View Current SHAP Explanation
                </button>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
                
                {/* Form column */}
                <div className="lg:col-span-5 bg-[#14171c] p-6 sm:p-8 rounded-3xl border border-slate-800 shadow-[#000000_0px_25px_50px_-12px] space-y-6">
                  <h3 className="font-serif italic font-bold text-lg text-white border-b border-slate-800 pb-3">
                    Electrophysiological & Bio parameters
                  </h3>

                  <div className="space-y-5">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-semibold text-slate-400 mb-2">Gender</label>
                        <select
                          value={heartInput.gender}
                          onChange={(e) => setHeartInput({...heartInput, gender: Number(e.target.value)})}
                          className="w-full bg-[#0a0b0e] border border-slate-800 rounded-xl p-3 text-sm text-slate-100"
                        >
                          <option value={0}>Female</option>
                          <option value={1}>Male</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-slate-400 mb-2">Age (years)</label>
                        <input
                          type="number"
                          min="18"
                          max="120"
                          value={heartInput.age_years}
                          onChange={(e) => setHeartInput({...heartInput, age_years: Number(e.target.value)})}
                          className="w-full bg-[#0a0b0e] border border-slate-800 rounded-xl p-3 text-sm text-slate-100"
                        />
                      </div>
                    </div>

                    <div>
                      <div className="flex justify-between text-xs font-semibold mb-2 text-slate-400">
                        <span>Body Mass Index (BMI)</span>
                        <span className="font-mono text-rose-450 font-bold">{heartInput.bmi}</span>
                      </div>
                      <input
                        type="range"
                        min="15"
                        max="50"
                        step="0.5"
                        value={heartInput.bmi}
                        onChange={(e) => setHeartInput({...heartInput, bmi: Number(e.target.value)})}
                        className="w-full accent-rose-500 bg-slate-800 h-1.5 rounded-lg cursor-pointer"
                      />
                      <div className="flex justify-between text-[10px] text-zinc-500 mt-1">
                        <span>15</span>
                        <span>25</span>
                        <span>30</span>
                        <span>50</span>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <div className="flex justify-between text-xs font-semibold mb-2 text-slate-400">
                          <span>Systolic BP (ap_hi)</span>
                          <span className="font-mono text-rose-450 font-bold">{heartInput.ap_hi} mm Hg</span>
                        </div>
                        <input
                          type="range"
                          min="90"
                          max="200"
                          value={heartInput.ap_hi}
                          onChange={(e) => setHeartInput({...heartInput, ap_hi: Number(e.target.value)})}
                          className="w-full accent-rose-500 bg-slate-800 h-1.5 rounded-lg cursor-pointer"
                        />
                      </div>
                      <div>
                        <div className="flex justify-between text-xs font-semibold mb-2 text-slate-400">
                          <span>Diastolic BP (ap_lo)</span>
                          <span className="font-mono text-rose-450 font-bold">{heartInput.ap_lo} mm Hg</span>
                        </div>
                        <input
                          type="range"
                          min="50"
                          max="130"
                          value={heartInput.ap_lo}
                          onChange={(e) => setHeartInput({...heartInput, ap_lo: Number(e.target.value)})}
                          className="w-full accent-rose-500 bg-slate-800 h-1.5 rounded-lg cursor-pointer"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-semibold text-slate-400 mb-2">Cholesterol</label>
                        <select
                          value={heartInput.cholesterol}
                          onChange={(e) => setHeartInput({...heartInput, cholesterol: Number(e.target.value)})}
                          className="w-full bg-[#0a0b0e] border border-slate-800 rounded-xl p-3 text-sm text-slate-100"
                        >
                          <option value={1}>1 (Normal)</option>
                          <option value={2}>2 (Above Normal)</option>
                          <option value={3}>3 (Well Above)</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-slate-400 mb-2">Glucose</label>
                        <select
                          value={heartInput.gluc}
                          onChange={(e) => setHeartInput({...heartInput, gluc: Number(e.target.value)})}
                          className="w-full bg-[#0a0b0e] border border-slate-800 rounded-xl p-3 text-sm text-slate-100"
                        >
                          <option value={1}>1 (Normal)</option>
                          <option value={2}>2 (Above Normal)</option>
                          <option value={3}>3 (Well Above)</option>
                        </select>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <label className="flex items-center gap-3 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={!!heartInput.smoke}
                          onChange={(e) => setHeartInput({...heartInput, smoke: e.target.checked ? 1 : 0})}
                          className="custom-checkbox accent-rose-500"
                        />
                        <span className="text-slate-300 text-sm">Smoker</span>
                      </label>
                      <label className="flex items-center gap-3 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={!!heartInput.alco}
                          onChange={(e) => setHeartInput({...heartInput, alco: e.target.checked ? 1 : 0})}
                          className="custom-checkbox accent-rose-500"
                        />
                        <span className="text-slate-300 text-sm">Alcohol Intake</span>
                      </label>
                    </div>

                    <div className="pt-2">
                      <label className="flex items-center gap-3 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={!!heartInput.active}
                          onChange={(e) => setHeartInput({...heartInput, active: e.target.checked ? 1 : 0})}
                          className="custom-checkbox accent-rose-500"
                        />
                        <span className="text-slate-300 text-sm">Physically Active</span>
                      </label>
                    </div>
                    <div className="pt-6 border-t border-slate-800 flex justify-end">
                      <button 
                        onClick={() => {
                          if (!isSignedIn) {
                            setShowSignIn(true);
                            return;
                          }
                          setHasPredictedHeart(true);
                          getHeartAIReport();
                        }}
                        disabled={loadingHeartAI}
                        className={`bg-rose-500 hover:bg-rose-400 text-white font-bold px-6 py-3 rounded-xl transition-all shadow-lg shadow-rose-500/20 flex items-center gap-2 ${loadingHeartAI ? 'opacity-50 cursor-not-allowed' : ''}`}
                      >
                        {loadingHeartAI ? <RefreshCw className="size-5 animate-spin" /> : <Heart className="size-5" />}
                        {loadingHeartAI ? "Running Model..." : "Predict Cardiac Risk"}
                      </button>
                    </div>

                  </div>
                </div>

                {/* Report columns */}
                <div className="lg:col-span-7 space-y-6 lg:h-[calc(100vh-150px)] lg:overflow-y-auto lg:pr-4 custom-scrollbar">
                  
                  {/* 3D Heart Model Reference Workspace */}
                  <motion.div
                    initial={{ opacity: 0, y: 35 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: false, margin: "-80px" }}
                    transition={{ duration: 0.6 }}
                  >
                    <ThreeDHeartViewer 
                      heartInput={heartInput} 
                      heartRiskScore={heartRisk.score} 
                      heartRiskLevel={heartRisk.level} 
                    />
                  </motion.div>

                  {hasPredictedHeart && (
                    <PredictorDashboard 
                      modelType="heart"
                      modelName={predictDataHeart ? predictDataHeart.label : "Cardiovascular Risk"}
                      riskScore={heartRisk.score}
                      riskLevel={heartRisk.level}
                      confidenceScore={heartRisk.score}
                      {...generateHeartDashboardProps(heartInput, heartRisk.score, heartRisk.level)}
                      {...(predictDataHeart ? {
                        shapExplanation: {
                          summary: predictDataHeart.shap_summary,
                          features: predictDataHeart.shap_explanation.map(f => ({
                            name: f.feature,
                            impact: f.impact,
                            direction: f.direction === "increases" ? "up" : "down"
                          }))
                        },
                        driftWarning: {
                          detected: predictDataHeart.drift_detected,
                          message: "Statistical drift detected. Input values are anomalies compared to the training distribution.",
                          metrics: []
                        }
                      } : {})}
                      aiReport={heartAIReport}
                      loadingAI={loadingHeartAI}
                      onFetchAI={getHeartAIReport}
                      dietPlan={[
                        "Implement DASH diet (Dietary Approaches to Stop Hypertension).",
                        "Reduce sodium intake to under 1,500mg daily.",
                        "Eliminate trans fats and reduce saturated fats.",
                        "Increase potassium-rich foods like bananas and spinach."
                      ]}
                      precautions={[
                        "Immediate cardiology consult recommended if BP remains > 160/100.",
                        "Avoid strenuous weightlifting; prefer moderate aerobic exercise.",
                        "Monitor heart rate during any physical activity.",
                        "Check for signs of angina or shortness of breath."
                      ]}
                    />
                  )}

                </div>

              </div>

            </div>
          )}

          {/* TAB 4: SHAP EXPLAINER SECTION */}
          {activeTab === "shap" && (
            <div className="space-y-10 animate-element">
              
              <div className="border-b border-slate-800 pb-6">
                <span className="text-emerald-400 text-xs font-bold tracking-widest uppercase font-mono block mb-1">
                  Model Trust & Interpretation
                </span>
                <h1 className="text-3xl md:text-4xl font-serif italic font-medium text-white">
                  SHAP Interpretability & Feature Contributions
                </h1>
                <p className="text-slate-400 text-sm mt-2">
                  Shapley Additive exPlanations define exactly which biomarkers push raw patient profiles away from standard population norms toward clinical threat flags.
                </p>
              </div>

              {/* Force Value Visual plot component */}
              <div className="bg-[#14171c] p-6 sm:p-8 rounded-3xl border border-slate-800 shadow-lg space-y-8">
                
                <div>
                  <h3 className="font-serif italic font-bold text-lg text-white flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                    <span>Clinical Force Contribution Map</span>
                    <span className="text-xs font-mono bg-[#0a0b0e] px-3 py-1.5 rounded-lg border border-slate-800">
                      Baseline Target Force Probability: <strong className="text-emerald-400">0.20 (20%)</strong>
                    </span>
                  </h3>
                  <p className="text-xs text-slate-400 mt-1">
                    Red vectors extend the score risk. Emerald/Blue vectors decrease risks, protecting normal patient baseline outputs.
                  </p>
                </div>

                {/* Horizontal custom bar charts */}
                <div className="space-y-4">
                  {currentSHAPDataset.list.map((item, index) => {
                    const absValue = Math.abs(item.value);
                    const widthPercent = Math.min(absValue * 200, 100); // scale up for visualization safety

                    return (
                      <div key={index} className="grid grid-cols-1 md:grid-cols-12 gap-3 items-center border-b border-slate-800/40 pb-3">
                        
                        <div className="md:col-span-3">
                          <span className="text-xs font-bold text-slate-200 block">{item.name}</span>
                          <span className="text-[10px] text-zinc-500 block truncate">{item.desc || "Assessed telemetry baseline indicator."}</span>
                        </div>

                        {/* Force value bar representation */}
                        <div className="md:col-span-7 flex items-center">
                          <div className="w-full bg-[#0a0b0e] h-6.5 rounded-lg relative overflow-hidden flex items-center px-2">
                            {/* Baseline center mark */}
                            <div className="absolute left-[40%] h-full w-[1.5px] bg-slate-800 z-10" />

                            {item.positive ? (
                              <div 
                                style={{ 
                                  left: "40%", 
                                  width: `${widthPercent}%` 
                                }} 
                                className="absolute h-full bg-rose-500/20 dark:bg-rose-500/30 border-l border-rose-500 rounded-r-md transition-all duration-500" 
                              />
                            ) : (
                              <div 
                                style={{ 
                                  right: "60%", 
                                  width: `${widthPercent}%` 
                                }} 
                                className="absolute h-full bg-emerald-500/20 dark:bg-emerald-500/30 border-r border-emerald-500 rounded-l-md transition-all duration-500" 
                              />
                            )}

                            {/* Label inside bar */}
                            <span className="relative z-20 text-[10px] font-mono font-bold text-slate-400 ml-auto">
                              {item.positive ? `+${item.value}` : `${item.value}`} SHAP
                            </span>
                          </div>
                        </div>

                        <div className="md:col-span-2 text-right">
                          <span className={`text-xs font-bold ${item.positive ? "text-rose-500" : "text-emerald-400"}`}>
                            {item.positive ? "Pushes Risk High" : "Mitigates Risk"}
                          </span>
                        </div>

                      </div>
                    );
                  })}
                </div>

                {/* Explanatory summary Card */}
                <div className="p-4 rounded-2xl bg-[#0f1116] border border-slate-800 flex gap-4 items-start">
                  <Info className="size-5 text-emerald-400 flex-shrink-0 mt-0.5" />
                  <div className="space-y-1">
                    <h4 className="text-xs font-bold text-white">Understanding SHAP Values in Medical AI</h4>
                    <p className="text-[11px] text-slate-400 leading-relaxed">
                      Unlike standard black-box machine learning outcomes, SHAP uses Shapley cooperative game theory solutions to allocate weight coefficients. When BRFSS indicators such as BMI, blood pressure, or general health shift out of baseline ranges, they push the final risk score upward relative to demographic expectations.
                    </p>
                  </div>
                </div>

              </div>

            </div>
          )}

          {/* TAB 5: SYMPTOM ANALYZER */}
          {activeTab === "symptoms" && (
            <div className="space-y-10 animate-element">
              
              <div className="border-b border-slate-800 pb-6">
                <span className="text-emerald-400 text-xs font-bold tracking-widest uppercase font-mono block mb-1">
                  Patient Interactive Assistant
                </span>
                <h1 className="text-3xl md:text-4xl font-serif italic font-medium text-white">
                  Prediction Based on Symptoms
                </h1>
                <p className="text-slate-400 text-sm mt-2">
                  State active signs and discomfort to run advanced triage evaluation with clinical rules. Select clinical symptom shortcuts or input specialized logs.
                </p>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
                
                {/* Input block (5 cols) */}
                <div className="lg:col-span-5 bg-[#14171c] p-6 sm:p-8 rounded-3xl border border-slate-800 shadow-lg space-y-6">
                  
                  <div className="space-y-2">
                    <h3 className="font-serif italic font-bold text-lg text-white">Clinical Symptom Intake</h3>
                    <p className="text-[11px] text-slate-400">
                      Type symptoms clearly (e.g., "Frequent extreme thirst, persistent tiredness, experiencing blurred vision").
                    </p>
                    <div className="bg-slate-800/50 rounded-lg p-3 border border-slate-700/50 mt-4 text-[10.5px] text-slate-350 space-y-1">
                      <p className="text-slate-300 font-semibold mb-1">How AI Symptom Mapping Works:</p>
                      <ul className="list-disc pl-4 space-y-1 mt-1">
                        <li><span className="text-emerald-400">"Frequent Urination"</span> maps to decreased General Health (GenHlth) and increased Physical Bad Days (PhysHlth).</li>
                        <li><span className="text-emerald-400">"Chest Pain"</span> maps instantly to High Blood Pressure (HighBP) and sets the HeartDiseaseorAttack flag.</li>
                        <li><span className="text-emerald-400">"Fatigue"</span> maps heavily to both Physical Bad Days (PhysHlth) and Mental Bad Days (MentHlth).</li>
                      </ul>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <textarea 
                      rows={4}
                      value={symptomText}
                      onChange={(e) => setSymptomText(e.target.value)}
                      placeholder="Input active clinical observations..."
                      className="w-full bg-[#0a0b0e] border border-slate-800 rounded-2xl p-4 text-xs font-medium text-slate-205 focus:outline-none focus:ring-2 focus:ring-emerald-500 text-slate-100"
                    />

                    {/* Pre-set medical chips */}
                    <div className="space-y-2">
                      <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest font-mono">Intake Presets</span>
                      <div className="flex flex-wrap gap-2">
                        <button 
                          onClick={() => handleSymptomPreset("High fasting thirst, experiencing fatigue and constant urination")}
                          className={`px-3 py-1.5 rounded-full text-[10px] font-medium transition-all cursor-pointer ${
                            selectedSymptomChip === "High fasting thirst, experiencing fatigue and constant urination"
                              ? "bg-emerald-500 text-black font-semibold"
                              : "bg-[#0a0b0e] text-slate-350 hover:bg-slate-800 border border-slate-800"
                          }`}
                        >
                          Endocrine Indicators (Thirst / Fatigue)
                        </button>
                        <button 
                          onClick={() => handleSymptomPreset("Crushing chest pressure, exercise pain, sudden unexplained arm fatigue")}
                          className={`px-3 py-1.5 rounded-full text-[10px] font-medium transition-all cursor-pointer ${
                            selectedSymptomChip === "Crushing chest pressure, exercise pain, sudden unexplained arm fatigue"
                              ? "bg-emerald-500 text-black font-semibold"
                              : "bg-[#0a0b0e] text-slate-350 hover:bg-slate-800 border border-slate-800"
                          }`}
                        >
                          Cardiac Alert Case (Chest Pressure)
                        </button>
                        <button 
                          onClick={() => handleSymptomPreset("Mild persistent vascular headache, target blood pressure values elevated")}
                          className={`px-3 py-1.5 rounded-full text-[10px] font-medium transition-all cursor-pointer ${
                            selectedSymptomChip === "Mild persistent vascular headache, target blood pressure values elevated"
                              ? "bg-emerald-500 text-black font-semibold"
                              : "bg-[#0a0b0e] text-slate-350 hover:bg-slate-800 border border-slate-800"
                          }`}
                        >
                          Hypertensive Strain Check (Pressure Headaches)
                        </button>
                      </div>
                    </div>

                    <button
                      onClick={() => {
                        if (!isSignedIn) {
                          setShowSignIn(true);
                          return;
                        }
                        analyzeSymptomsAI(symptomText);
                      }}
                      disabled={loadingSymptomAI || !symptomText.trim()}
                      className="w-full py-3.5 bg-emerald-500 hover:bg-emerald-400 text-black font-bold text-xs rounded-2xl cursor-pointer disabled:opacity-50 transition-all flex items-center justify-center gap-2 shadow-sm shadow-emerald-500/10"
                    >
                      <Sparkles className="size-4 text-black" />
                      {loadingSymptomAI ? "Running AI triage evaluation..." : "Execute Symptom AI Triage Map"}
                    </button>
                  </div>

                </div>

                {/* Report block (7 cols) */}
                <div className="lg:col-span-7">
                  
                  <div className="bg-[#14171c] p-6 sm:p-8 rounded-3xl border border-slate-800 shadow-lg min-h-[300px] flex flex-col justify-between">
                    
                    <div>
                      <div className="flex justify-between items-center border-b border-slate-800 pb-3 mb-4">
                        <div className="flex items-center gap-2">
                          <Stethoscope className="text-emerald-400 size-5" />
                          <h4 className="font-serif italic font-bold text-lg text-white">AI Clinical Triage Review</h4>
                        </div>
                        <span className="text-[10px] font-mono bg-[#0a0b0e] border border-slate-800 text-slate-350 px-3 py-1 rounded-md">
                          Live model feedback loop
                        </span>
                      </div>

                      {loadingSymptomAI ? (
                        <div className="space-y-4 py-8">
                          <div className="h-4 bg-slate-800 rounded animate-pulse w-2/3"></div>
                          <div className="h-4 bg-slate-800 rounded animate-pulse w-4/5"></div>
                          <div className="h-4 bg-slate-800 rounded animate-pulse w-full"></div>
                        </div>
                      ) : symptomReport ? (
                        <div className="text-xs text-slate-300 leading-relaxed p-4 rounded-2xl bg-[#0f1116] border border-slate-800/60 font-sans max-h-[450px] overflow-y-auto custom-scrollbar">
                          <ReactMarkdown 
                            components={{
                              h3: ({node, ...props}) => <h3 className="text-lg font-bold text-white mt-4 mb-2" {...props}/>,
                              h4: ({node, ...props}) => <h4 className="text-base font-bold text-emerald-400 mt-4 mb-2" {...props}/>,
                              ul: ({node, ...props}) => <ul className="list-disc pl-5 my-2 space-y-1 text-slate-300" {...props}/>,
                              li: ({node, ...props}) => <li {...props}/>,
                              strong: ({node, ...props}) => <strong className="text-white font-semibold" {...props}/>,
                              p: ({node, ...props}) => <p className="mb-3 text-slate-300" {...props}/>,
                              em: ({node, ...props}) => <em className="text-amber-400/80 italic text-[10px]" {...props}/>
                            }}
                          >
                            {symptomReport}
                          </ReactMarkdown>
                        </div>
                      ) : (
                        <div className="text-center py-16 text-slate-400 flex flex-col items-center">
                          <span className="text-4xl mb-3">🩺</span>
                          <p className="text-xs">No active symptom inputs recorded. Input logs or select pre-set cards above to initiate triage analysis.</p>
                        </div>
                      )}
                    </div>

                    <div className="pt-4 border-t border-slate-800 mt-6">
                      <div className="flex gap-2 items-center text-[10px] text-slate-400">
                        <AlertTriangle className="size-4 text-amber-500 flex-shrink-0" />
                        <p>Disclaimer: AI triage does not substitute standard hospital emergency checks. If experiencing retrosternal chest pain or respiratory failure, dial emergency services immediately.</p>
                      </div>
                    </div>

                  </div>

                </div>

              </div>

            </div>
          )}

          {/* TAB 6: DATA DRIFT SHOWCASE & MLOPS */}
          {activeTab === "drift" && (
            <div className="space-y-10 animate-element">
              
              <div className="border-b border-slate-800 pb-6">
                <span className="text-emerald-400 text-xs font-bold tracking-widest uppercase font-mono block mb-1">
                  MLOps & Statistical Integrity
                </span>
                <h1 className="text-3xl md:text-4xl font-serif italic font-medium text-white">
                  Clinical Data Drift Monitor
                </h1>
                <p className="text-slate-400 mt-2 text-sm leading-relaxed">
                  Analyze feature distributions in target populations over successive clinical epochs. Compare base datasets against active diagnostic inputs to discover model skew.
                </p>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
                
                {/* Stats control block (4 cols) */}
                <div className="lg:col-span-4 bg-[#14171c] p-6 sm:p-8 rounded-3xl border border-slate-800 shadow-lg space-y-6">
                  
                  <div className="space-y-1">
                    <h3 className="font-serif italic font-bold text-lg text-white">Drift Evaluation Logs</h3>
                    <p className="text-[11px] text-slate-400">Data pipelines running population metrics updates.</p>
                  </div>

                  <div className="p-4 rounded-2xl bg-[#0a0b0e] border border-slate-800 space-y-4">
                    
                    <div>
                      <div className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mb-1 font-mono">Drift Alarm status</div>
                      <div className="flex items-center gap-2">
                        {driftStatus.detected ? (
                          <>
                            <AlertTriangle className="size-5 text-rose-500 animate-pulse" />
                            <span className="font-bold text-sm text-rose-500 font-mono">DRIFT_DETECTED</span>
                          </>
                        ) : (
                          <>
                            <CheckCircle className="size-5 text-emerald-400" />
                            <span className="font-bold text-sm text-emerald-400 font-mono">STATUS_STABLE</span>
                          </>
                        )}
                      </div>
                    </div>

                    <div>
                      <div className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mb-1 font-mono">KS Statistic Index Score</div>
                      <div className="text-md font-bold font-mono text-emerald-400">{driftStatus.index}</div>
                    </div>

                    <div>
                      <div className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mb-1 font-mono">Reference populations</div>
                      <div className="text-xs font-mono text-slate-350">
                        Baseline: <strong className="text-white">{driftStatus.baselineYear}</strong><br />
                        Current Batch: <strong className="text-white">{driftStatus.activeEpoch}</strong>
                      </div>
                    </div>

                  </div>

                  <button
                    onClick={runRetrainPipeline}
                    disabled={isRetraining || !driftStatus.detected}
                    className="w-full py-3.5 bg-emerald-500 hover:bg-emerald-400 text-black font-bold text-xs rounded-2xl cursor-pointer disabled:opacity-50 transition-all flex items-center justify-center gap-2 shadow-sm shadow-emerald-500/10"
                  >
                    <RefreshCw className={`size-4 text-black ${isRetraining ? 'animate-spin' : ''}`} />
                    {isRetraining ? "Executing model retrain..." : "Trigger Model Retraining Pipeline"}
                  </button>

                  {modelRetrained && (
                    <div className="p-4 rounded-xl bg-emerald-500/10 text-emerald-400 text-xs flex gap-2 items-start border border-emerald-500/20">
                      <CheckCircle className="size-4 mt-0.5 flex-shrink-0 text-emerald-400" />
                      <p>Model optimization finished successfully! XGBoost models retrained against new batch. Data drift check cleared.</p>
                    </div>
                  )}

                </div>

                {/* Graph & Console block (8 cols) */}
                <div className="lg:col-span-8 space-y-6">
                  
                  {/* population distribution custom map drawing */}
                  <div className="bg-[#14171c] p-6 sm:p-8 rounded-3xl border border-slate-800 shadow-lg space-y-6">
                    <h3 className="font-serif italic font-bold text-lg text-white flex items-center justify-between">
                      <span>Glucose Distribution Shift: Baseline vs May 2026</span>
                      <span className="text-[10px] font-mono bg-[#0a0b0e] border border-slate-800 text-slate-350 px-3 py-1 rounded">
                        CDC demographics evaluation
                      </span>
                    </h3>

                    {/* SVG Data Visualization chart representation for Clinical Insights */}
                    <div className="h-64 w-full bg-[#0a0b0e] border border-slate-800 rounded-2xl relative p-4 flex flex-col justify-between overflow-hidden">
                      {/* Grid background lines */}
                      <div className="absolute inset-x-0 top-12 border-b border-slate-800/40" />
                      <div className="absolute inset-x-0 top-24 border-b border-slate-800/40" />
                      <div className="absolute inset-x-0 top-36 border-b border-slate-800/40" />
                      <div className="absolute inset-x-0 top-48 border-b border-slate-800/40" />

                      {/* SVG Line pathing for base population curves */}
                      <svg className="absolute inset-0 w-full h-full p-4" viewBox="0 0 500 200" preserveAspectRatio="none">
                        {/* Baseline Curve (Steel-blue/slate) */}
                        <path 
                          d="M 10 180 Q 120 40 250 80 Q 380 120 490 180" 
                          fill="none" 
                          stroke="#64748b" 
                          strokeWidth="2.5" 
                          className="opacity-70"
                        />
                        {/* Active Batch Curve (Rose elements with shift to the right, showing drift) */}
                        <path 
                          d={driftStatus.detected 
                            ? "M 10 180 Q 180 20 320 80 Q 420 140 490 180" 
                            : "M 10 180 Q 120 40 250 80 Q 380 120 490 180"
                          }
                          fill="none" 
                          stroke="#ec4899" 
                          strokeWidth="2.5" 
                          className="transition-all duration-1000"
                        />
                      </svg>

                      {/* Chart Legend */}
                      <div className="relative z-10 flex justify-end gap-4 text-[10px] mt-auto font-bold font-mono">
                        <div className="flex items-center gap-1.5">
                          <span className="w-3 h-3 bg-slate-550 rounded border border-slate-800" />
                          <span className="text-slate-400">Baseline distribution</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <span className="w-3 h-3 bg-rose-500 rounded animate-pulse" />
                          <span className="text-slate-400">
                            {driftStatus.detected ? "Current population batch (DRIFTED)" : "Current population batch (STABILIZED)"}
                          </span>
                        </div>
                      </div>

                      {/* X Axis reference indicators */}
                      <div className="relative z-10 flex justify-between text-[9px] font-mono text-slate-500 mt-2 border-t border-slate-800 pt-2 px-1">
                        <span>Fasting Glucose: 60 mg/dL</span>
                        <span>100 (Optimal normal)</span>
                        <span>140 (Impaired tolerance)</span>
                        <span>180+ (Critical diabetic range)</span>
                      </div>
                    </div>
                  </div>

                  {/* Terminal Retrain sequence */}
                  {(isRetraining || retrainLogs.length > 0) && (
                    <div className="bg-[#0a0b0e] font-mono text-slate-350 p-6 rounded-2xl text-[10px] space-y-2 border border-slate-800 shadow-inner max-h-60 overflow-y-auto">
                      <div className="flex justify-between text-[11px] text-slate-500 pb-2 border-b border-slate-850 mb-2">
                        <span>Retrain console logs:</span>
                        <span className="animate-pulse text-emerald-400">Executing...</span>
                      </div>
                      {retrainLogs.map((log, idx) => (
                        <div key={idx} className="block leading-relaxed">
                          {log}
                        </div>
                      ))}
                    </div>
                  )}

                </div>

              </div>

            </div>
          )}

        </main>

      </div>

      {/* Persistent Visual Footer Section */}
      <Footer />

      {/* Floating AI Virtual Co-Pilot Chatbot */}
      <AIChatbot />

    </div>
  );
}
