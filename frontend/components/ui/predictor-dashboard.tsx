import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { 
  BarChart, 
  Activity, 
  AlertTriangle, 
  Sparkles, 
  ShieldAlert, 
  Utensils, 
  Stethoscope, 
  HeartPulse,
  TrendingUp,
  FileText
} from 'lucide-react';
import { 
  Radar, 
  RadarChart, 
  PolarGrid, 
  PolarAngleAxis, 
  PolarRadiusAxis, 
  ResponsiveContainer 
} from 'recharts';

export interface PredictorDashboardProps {
  modelType: "diabetes" | "heart";
  modelName: string;
  riskScore: number;
  riskLevel: string;
  confidenceScore: number;
  shapExplanation: {
    summary: string;
    features: { name: string; impact: number; direction: "up" | "down" }[];
  };
  radarData: { category: string; value: number; fullMark: number }[];
  radarBreakdown: { category: string; score: number; color: string; icon: React.ComponentType<any> }[];
  driftWarning: {
    detected: boolean;
    message: string;
    metrics: string[];
  };
  patientRiskFactors: string[];
  globalFeatureImportance: { name: string; weight: number }[];
  
  // Guidance
  aiReport: string;
  loadingAI: boolean;
  onFetchAI: () => void;
  dietPlan: string[];
  precautions: string[];
}

export function PredictorDashboard({
  modelType,
  modelName,
  riskScore,
  riskLevel,
  confidenceScore,
  shapExplanation,
  radarData,
  radarBreakdown,
  driftWarning,
  patientRiskFactors,
  globalFeatureImportance,
  aiReport,
  loadingAI,
  onFetchAI,
  dietPlan,
  precautions
}: PredictorDashboardProps) {
  
  const [activeTab, setActiveTab] = useState<"ai" | "diet" | "precautions">("ai");

  const isHighRisk = riskScore > 50;
  const primaryColor = modelType === "diabetes" ? "emerald" : "rose";
  const primaryHex = modelType === "diabetes" ? "#10b981" : "#f43f5e";
  
  // Custom theme colors for dark dashboard
  const panelBg = "bg-[#0f1116]";
  const borderColor = "border-slate-800";

  return (
    <div className="w-full space-y-6 text-slate-200">
      
      {/* 1. HEADER ROW */}
      <div className={`grid grid-cols-1 md:grid-cols-2 gap-6 p-6 rounded-2xl border ${borderColor} ${panelBg}`}>
        <div>
          <p className="text-[10px] font-bold tracking-widest text-slate-500 uppercase mb-1">Prediction Result</p>
          <div className="flex items-center gap-4">
            <h2 className="text-4xl font-serif font-bold text-white tracking-tight">{modelName}</h2>
            <span className={`px-3 py-0.5 text-xs font-black rounded-full uppercase tracking-widest ${
              isHighRisk ? "bg-rose-500/20 text-rose-500 border border-rose-500/30" : "bg-emerald-500/20 text-emerald-500 border border-emerald-500/30"
            }`}>
              {riskLevel}
            </span>
          </div>
        </div>
        <div className="flex flex-col justify-center">
          <div className="flex justify-between items-center mb-2">
            <span className="text-xs font-mono text-slate-400">Confidence Score</span>
            <span className="text-lg font-bold text-white">{confidenceScore}%</span>
          </div>
          <div className="w-full h-2 bg-slate-800 rounded-full overflow-hidden flex">
            <div className="h-full bg-emerald-500" style={{ width: '25%' }}></div>
            <div className="h-full bg-blue-500" style={{ width: '25%' }}></div>
            <div className="h-full bg-purple-500" style={{ width: '18%' }}></div>
            <div className="h-full bg-slate-700" style={{ width: '32%' }}></div>
          </div>
          <div className="mt-2 flex justify-between">
            <span className="text-[9px] text-slate-500 font-mono">GradientBoosting • v1.0.1 • Inference_time: 42ms</span>
          </div>
        </div>
      </div>

      {/* 2. ROW 1: SHAP & GAUGE */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* SHAP EXPLANATION (Takes 2 columns) */}
        <div className={`lg:col-span-2 p-6 rounded-2xl border ${borderColor} ${panelBg} flex flex-col`}>
          <div className="flex justify-between items-center mb-6 border-b border-slate-800 pb-4">
            <div className="flex items-center gap-2">
              <FileText className="size-4 text-indigo-400" />
              <h3 className="font-bold text-lg text-white">SHAP Explanation</h3>
            </div>
            <button className="text-[10px] font-mono font-bold tracking-widest text-slate-400 hover:text-white transition-colors">
              EXPORT JSON
            </button>
          </div>
          
          <div className="bg-slate-800/40 border border-slate-700/50 rounded-xl p-4 mb-6">
            <p className="text-sm text-slate-300 italic font-serif">
              "{shapExplanation.summary}"
            </p>
          </div>

          <div className="space-y-4 flex-1">
            {shapExplanation.features.map((f, i) => (
              <div key={i} className="flex flex-col gap-1.5">
                <div className="flex justify-between items-center text-xs font-mono">
                  <span className="text-slate-300 font-bold">{f.name}</span>
                  <span className={f.direction === "up" ? "text-rose-400" : "text-emerald-400"}>
                    {f.direction === "up" ? "↑" : "↓"} risk {f.impact.toFixed(3)}
                  </span>
                </div>
                <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden">
                  <div 
                    className={`h-full ${f.direction === "up" ? "bg-rose-500/70" : "bg-emerald-500/70"}`} 
                    style={{ width: `${Math.min(100, Math.abs(f.impact) * 100 * 2.5)}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* RISK GAUGE */}
        <div className={`p-6 rounded-2xl border ${borderColor} ${panelBg} flex flex-col items-center relative overflow-hidden`}>
          <div className="w-full flex items-center gap-2 mb-8 border-b border-slate-800 pb-4">
            <Activity className={`size-4 text-${primaryColor}-500`} />
            <h3 className="font-bold text-lg text-white">Risk Gauge</h3>
          </div>
          
          <div className="relative w-48 h-48 flex items-center justify-center mt-4">
            <svg className="absolute inset-0 w-full h-full transform -rotate-180">
              {/* Background semi-circle */}
              <circle cx="96" cy="96" r="80" fill="none" stroke="#1e293b" strokeWidth="16" strokeDasharray="251.2" strokeDashoffset="125.6" />
              {/* Colored segments */}
              <circle cx="96" cy="96" r="80" fill="none" stroke="#10b981" strokeWidth="16" strokeDasharray="251.2" strokeDashoffset="125.6" className="transform origin-center" style={{ strokeDasharray: '62.8 188.4' }} />
              <circle cx="96" cy="96" r="80" fill="none" stroke="#3b82f6" strokeWidth="16" strokeDasharray="251.2" strokeDashoffset="125.6" className="transform origin-center rotate-[45deg]" style={{ strokeDasharray: '62.8 188.4' }} />
              <circle cx="96" cy="96" r="80" fill="none" stroke="#f43f5e" strokeWidth="16" strokeDasharray="251.2" strokeDashoffset="125.6" className="transform origin-center rotate-[90deg]" style={{ strokeDasharray: '62.8 188.4' }} />
              <circle cx="96" cy="96" r="80" fill="none" stroke="#8b5cf6" strokeWidth="16" strokeDasharray="251.2" strokeDashoffset="125.6" className="transform origin-center rotate-[135deg]" style={{ strokeDasharray: '62.8 188.4' }} />
              
              {/* Needle */}
              <g className="transform origin-center transition-all duration-1000 ease-out" style={{ transform: `rotate(${riskScore * 1.8}deg)` }}>
                <circle cx="96" cy="96" r="6" fill="#fff" />
                <line x1="96" y1="96" x2="30" y2="96" stroke="#fff" strokeWidth="3" strokeLinecap="round" />
              </g>
            </svg>
            
            <div className="absolute top-[60%] flex flex-col items-center">
              <span className="text-3xl font-black text-white font-serif">{riskScore}%</span>
              <span className={`text-[9px] font-bold tracking-widest uppercase mt-1 ${isHighRisk ? 'text-rose-500' : 'text-emerald-500'}`}>Probability</span>
            </div>
          </div>
          
          <div className="w-full flex justify-between text-[10px] font-mono font-bold text-slate-500 mt-2 px-4">
            <span>LOW</span>
            <span>MOD</span>
            <span>HIGH</span>
            <span>V.HIGH</span>
          </div>
        </div>
      </div>

      {/* 3. ROW 2: RADAR & DRIFT */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* RISK SCORE BREAKDOWN (Radar) */}
        <div className={`lg:col-span-2 p-6 rounded-2xl border ${borderColor} ${panelBg} grid grid-cols-1 md:grid-cols-2 gap-8`}>
          <div className="col-span-full border-b border-slate-800 pb-4">
            <h3 className="font-bold text-lg text-white flex items-center gap-2">
              <BarChart className="size-4 text-purple-500" />
              Risk Score Breakdown
            </h3>
          </div>
          
          <div className="h-64 flex items-center justify-center">
            <ResponsiveContainer width="100%" height="100%">
              <RadarChart cx="50%" cy="50%" outerRadius="70%" data={radarData}>
                <PolarGrid stroke="#334155" />
                <PolarAngleAxis dataKey="category" tick={{ fill: '#94a3b8', fontSize: 9, fontWeight: 'bold' }} />
                <PolarRadiusAxis angle={30} domain={[0, 100]} tick={false} axisLine={false} />
                <Radar
                  name="Risk Profile"
                  dataKey="value"
                  stroke="#8b5cf6"
                  strokeWidth={2}
                  fill="#8b5cf6"
                  fillOpacity={0.4}
                />
              </RadarChart>
            </ResponsiveContainer>
          </div>
          
          <div className="flex flex-col justify-center space-y-6">
            {radarBreakdown.map((item, idx) => {
              const Icon = item.icon;
              return (
                <div key={idx} className="flex items-center gap-4">
                  <div className={`p-2 rounded-lg bg-slate-800 border border-slate-700`}>
                    <Icon className="size-4 text-slate-300" style={{ color: item.color }} />
                  </div>
                  <div className="flex-1">
                    <div className="flex justify-between text-xs font-bold mb-2">
                      <span className="text-white">{item.category}</span>
                      <span style={{ color: item.color }}>{item.score}%</span>
                    </div>
                    <div className="h-1.5 w-full bg-slate-800 rounded-full overflow-hidden">
                      <div className="h-full" style={{ width: `${item.score}%`, backgroundColor: item.color }} />
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* DRIFT & RISK FACTORS */}
        <div className="flex flex-col gap-6">
          {driftWarning.detected && (
            <div className="p-6 rounded-2xl border border-rose-500/30 bg-rose-500/5 shadow-[0_0_15px_rgba(244,63,94,0.1)]">
              <div className="flex items-center gap-2 text-rose-400 mb-3">
                <AlertTriangle className="size-4" />
                <h4 className="font-bold text-sm tracking-wider uppercase">Data Drift Detected</h4>
              </div>
              <p className="text-xs text-slate-300 leading-relaxed mb-4">
                {driftWarning.message}
              </p>
              <div className="flex flex-wrap gap-2">
                {driftWarning.metrics.map(metric => (
                  <span key={metric} className="px-2 py-1 bg-[#0a0b0e] border border-rose-500/30 rounded-md text-[10px] font-mono text-rose-300">
                    {metric}
                  </span>
                ))}
              </div>
            </div>
          )}

          <div className={`flex-1 p-6 rounded-2xl border ${borderColor} ${panelBg}`}>
            <h4 className="font-bold text-xs text-slate-400 tracking-wider uppercase mb-4">Patient Risk Factors</h4>
            <div className="flex flex-wrap gap-2">
              {patientRiskFactors.map(factor => (
                <span key={factor} className="px-3 py-1.5 bg-slate-800 border border-slate-700 rounded-lg text-xs font-semibold text-slate-200 flex items-center gap-1.5">
                  <div className="w-1.5 h-1.5 rounded-full bg-rose-500" />
                  {factor}
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* 4. ROW 3: GLOBAL FEATURE IMPORTANCE */}
      <div className={`p-6 rounded-2xl border ${borderColor} ${panelBg}`}>
        <h3 className="font-bold text-lg text-white flex items-center gap-2 mb-6 border-b border-slate-800 pb-4">
          <TrendingUp className="size-4 text-blue-400" />
          Global Feature Importance
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-6">
          {globalFeatureImportance.map((f, i) => (
            <div key={i}>
              <div className="flex justify-between text-[10px] font-bold font-mono text-slate-400 uppercase tracking-widest mb-2">
                <span>{f.name}</span>
                <span>{f.weight.toFixed(2)}</span>
              </div>
              <div className="w-full h-1 bg-slate-800 rounded-full overflow-hidden">
                <div className="h-full bg-blue-500/80" style={{ width: `${f.weight * 100}%` }} />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* 5. ROW 4: HEALTH GUIDANCE (AI Insights, Diet, Precautions) */}
      <div className={`p-6 rounded-2xl border ${borderColor} ${panelBg}`}>
        <div className="flex flex-wrap gap-2 border-b border-slate-800 pb-4 mb-6">
          <button 
            onClick={() => setActiveTab("ai")}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${activeTab === "ai" ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30" : "bg-transparent text-slate-400 hover:text-white"}`}
          >
            <Sparkles className="size-4" /> AI Insights
          </button>
          <button 
            onClick={() => setActiveTab("diet")}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${activeTab === "diet" ? "bg-purple-500/20 text-purple-400 border border-purple-500/30" : "bg-transparent text-slate-400 hover:text-white"}`}
          >
            <Utensils className="size-4" /> Diet Plan
          </button>
          <button 
            onClick={() => setActiveTab("precautions")}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${activeTab === "precautions" ? "bg-rose-500/20 text-rose-400 border border-rose-500/30" : "bg-transparent text-slate-400 hover:text-white"}`}
          >
            <ShieldAlert className="size-4" /> Precautions
          </button>
        </div>

        <div className="min-h-[200px]">
          {activeTab === "ai" && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
              <div className="flex justify-between items-center">
                <h4 className="font-serif italic font-bold text-emerald-400 text-lg">Specialist AI Review</h4>
                {!aiReport && (
                  <button 
                    onClick={onFetchAI}
                    disabled={loadingAI}
                    className="bg-emerald-500 hover:bg-emerald-400 text-black text-xs font-bold px-4 py-2 rounded-lg transition-all shadow-lg flex items-center gap-2 disabled:opacity-50"
                  >
                    <Sparkles className="size-4" /> {loadingAI ? "Generating..." : "Generate Analysis"}
                  </button>
                )}
              </div>
              
              {loadingAI ? (
                <div className="space-y-3 pt-4">
                  <div className="h-4 bg-slate-800 rounded animate-pulse w-3/4"></div>
                  <div className="h-4 bg-slate-800 rounded animate-pulse w-5/6"></div>
                  <div className="h-4 bg-slate-800 rounded animate-pulse w-full"></div>
                </div>
              ) : aiReport ? (
                <div className="text-sm text-slate-300 leading-relaxed font-mono whitespace-pre-wrap p-4 bg-[#0a0b0e] border border-slate-800 rounded-xl">
                  {aiReport}
                </div>
              ) : (
                <div className="h-32 flex items-center justify-center text-slate-500 text-sm italic font-serif">
                  Click 'Generate Analysis' to receive an expert medical review based on the model's metrics.
                </div>
              )}
            </motion.div>
          )}

          {activeTab === "diet" && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
              <h4 className="font-serif italic font-bold text-purple-400 text-lg">Recommended Nutritional Interventions</h4>
              <ul className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {dietPlan.map((item, idx) => (
                  <li key={idx} className="flex items-start gap-3 p-3 bg-slate-800/30 rounded-xl border border-slate-800">
                    <div className="mt-0.5 p-1 rounded-md bg-purple-500/20 text-purple-400">
                      <Utensils className="size-3" />
                    </div>
                    <span className="text-sm text-slate-300">{item}</span>
                  </li>
                ))}
              </ul>
            </motion.div>
          )}

          {activeTab === "precautions" && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
              <h4 className="font-serif italic font-bold text-rose-400 text-lg">Medical & Lifestyle Precautions</h4>
              <ul className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {precautions.map((item, idx) => (
                  <li key={idx} className="flex items-start gap-3 p-3 bg-slate-800/30 rounded-xl border border-slate-800">
                    <div className="mt-0.5 p-1 rounded-md bg-rose-500/20 text-rose-400">
                      <ShieldAlert className="size-3" />
                    </div>
                    <span className="text-sm text-slate-300">{item}</span>
                  </li>
                ))}
              </ul>
            </motion.div>
          )}
        </div>
      </div>

    </div>
  );
}
