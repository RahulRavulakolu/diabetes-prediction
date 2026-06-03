import React, { useState } from "react";
import { motion } from "motion/react";
import { 
  Heart, 
  Layers, 
  Cpu, 
  ShieldAlert, 
  Activity, 
  CheckCircle,
  HelpCircle,
  Sliders
} from "lucide-react";

interface HeartParams {
  chestPain: number;
  restingBP: number;
  cholesterol: number;
  maxHR: number;
  stDepression: number;
  exerciseAngina: boolean;
}

interface ThreeDHeartViewerProps {
  heartInput: HeartParams;
  heartRiskScore: number;
  heartRiskLevel: string;
}

export function ThreeDHeartViewer({ heartInput, heartRiskScore, heartRiskLevel }: ThreeDHeartViewerProps) {
  const [activeTab, setActiveTab] = useState<"visualizer" | "anatomy">("visualizer");
  const [selectedRegion, setSelectedRegion] = useState<string | null>(null);

  // Derive clinical condition notices based on current live form model inputs
  const bpStatus = heartInput.restingBP > 140 ? "Hypertensive Burden" : heartInput.restingBP > 120 ? "Elevated Afterload" : "Optimal Workload";
  const cholStatus = heartInput.cholesterol > 240 ? "High Atherogenic Risk" : heartInput.cholesterol > 200 ? "Borderline Accumulation" : "Normal Lipids";
  const stStatus = heartInput.stDepression > 1.5 ? "Subendocardial Ischemia" : heartInput.stDepression > 0.5 ? "Borderline Depolarization" : "Normal ST Segment";

  // Dynamic color highlights matching risk severity
  const themeColor = heartRiskScore > 60 ? "rose-500" : "emerald-400";
  const themeBg = heartRiskScore > 60 ? "bg-rose-500/10 text-rose-400" : "bg-emerald-500/10 text-emerald-400";
  const themeBorder = heartRiskScore > 60 ? "border-rose-500/30" : "border-emerald-500/20";

  // Descriptive info card details for each region
  const anatomyRegions = [
    {
      id: "myocardium",
      name: "Myocardium (Cardiac Muscle)",
      impact: stStatus,
      description: "Responsible for heart contractions, pumping oxygenated blood to the body. Ischemic changes represented by ST depression typically manifest as myocardial strain.",
      status: heartInput.stDepression > 1.5 ? "warning" : "ok"
    },
    {
      id: "coronary",
      name: "Coronary Artery Trunks",
      impact: cholStatus,
      description: "Provides nutrient-rich perfusion to cardiac tissue. High lipid levels (>200 mg/dL) can precipitate chronic atheroma development within the left anterior descending arteriole.",
      status: heartInput.cholesterol > 220 ? "warning" : "ok"
    },
    {
      id: "chambers",
      name: "Ventricular System (Chambers)",
      impact: bpStatus,
      description: "Generates systemic systolic pressure. Increased blood pressure requires higher peak wall-stress to empty ventricles, increasing chronic microvascular strain.",
      status: heartInput.restingBP > 135 ? "warning" : "ok"
    },
    {
      id: "conduction",
      name: "Sinoatrial Conduction Net",
      impact: `Peak rate capacity: ${heartInput.maxHR} bpm`,
      description: "Controls pacemaking chronotropic responses. Restrictions in peak heart rate limits of symptomatic patients are evaluated for diagnostic ischemic ischemia warnings.",
      status: heartInput.maxHR < 120 ? "warning" : "ok"
    }
  ];

  return (
    <div className="bg-[#14171c] border border-slate-800 rounded-3xl p-6 shadow-2xl relative overflow-hidden transition-all duration-300">
      
      {/* Dynamic ambient halo background */}
      <div className={`absolute top-0 right-0 w-32 h-32 opacity-10 rounded-full blur-3xl transition-colors duration-500 ${
        heartRiskScore > 60 ? "bg-rose-500" : "bg-emerald-500"
      }`} />

      {/* Header section */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between pb-4 mb-5 border-b border-slate-800/60 gap-3">
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-xl bg-slate-900 border border-slate-800 text-rose-505">
            <Heart className={`size-5 text-rose-500 ${heartRiskScore > 50 ? "animate-pulse" : ""}`} />
          </div>
          <div>
            <h4 className="font-serif italic font-medium text-white text-base">3D Interactive Cardiology Hub</h4>
            <p className="text-[10px] text-slate-500 font-mono uppercase tracking-widest mt-0.5">Beating Heart Anatomical Reference Mapping</p>
          </div>
        </div>

        {/* Console Nav Tabs */}
        <div className="flex rounded-lg bg-slate-950 p-1 border border-slate-800 text-[11px] font-mono select-none">
          <button
            onClick={() => setActiveTab("visualizer")}
            className={`px-3 py-1.5 rounded-md transition-all cursor-pointer ${
              activeTab === "visualizer"
                ? "bg-[#14171c] text-white font-bold border border-slate-850 shadow-md"
                : "text-slate-450 hover:text-slate-200"
            }`}
          >
            3D Model
          </button>
          <button
            onClick={() => setActiveTab("anatomy")}
            className={`px-3 py-1.5 rounded-md transition-all cursor-pointer ${
              activeTab === "anatomy"
                ? "bg-[#14171c] text-white font-bold border border-slate-850 shadow-md"
                : "text-slate-450 hover:text-slate-200"
            }`}
          >
            Diagnostics Link
          </button>
        </div>
      </div>

      {activeTab === "visualizer" ? (
        <div className="space-y-4">
          
          {/* Sketchfab iframe embed container */}
          <div className="relative rounded-2xl overflow-hidden bg-[#0a0b0e] border border-slate-800/80 group">
            
            {/* Embedded Sketchfab Iframe */}
            <iframe 
              title="Beating Heart - Anatomical Reference Model" 
              src="https://sketchfab.com/models/d9845afb1ee64ad094adc96320c67d98/embed?autostart=1&preload=1&ui_controls=0&ui_infos=0&ui_watermark=0&ui_theme=dark&ui_hint=2"
              className="w-full h-[320px] sm:h-[350px] border-none block relative z-10"
              allowFullScreen
              allow="autoplay; fullscreen; xr-spatial-tracking"
              referrerPolicy="no-referrer"
            />
            
            {/* Absolute positioning of current Risk Coefficient overlay */}
            <div className="absolute top-3 left-3 bg-[#0a0b0e]/90 border border-slate-800 backdrop-blur-md px-3 py-2 rounded-xl z-20 flex items-center gap-2">
              <span className={`w-2 h-2 rounded-full ${heartRiskScore > 60 ? "bg-rose-500 animate-ping" : "bg-emerald-400"}`} />
              <div className="text-left">
                <span className="text-[9px] text-slate-500 font-mono block leading-none">RISK LEVEL INDICATOR</span>
                <span className={`text-xs font-bold font-mono tracking-tight ${heartRiskScore > 60 ? "text-rose-400" : "text-emerald-400"}`}>
                  {heartRiskLevel} ({heartRiskScore}%)
                </span>
              </div>
            </div>

            {/* Quick interactive note */}
            <div className="absolute bottom-3 right-3 bg-[#0a0b0e]/85 backdrop-blur-md px-3 py-1.5 rounded-lg z-20 border border-slate-800/80 text-[10px] text-slate-400 font-mono">
              ★ Left-click + drag to orbit. Scroll to zoom.
            </div>
          </div>

          {/* Quick interactive dashboard feedback bar */}
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3 pt-1">
            <div className="p-3 rounded-xl bg-slate-900/50 border border-slate-800/60">
              <span className="text-[9px] text-slate-500 font-mono uppercase block">Chamber Pressure</span>
              <span className={`text-[11px] font-bold ${heartInput.restingBP > 135 ? "text-rose-400" : "text-emerald-400"}`}>
                {bpStatus}
              </span>
            </div>
            <div className="p-3 rounded-xl bg-slate-900/50 border border-slate-800/60">
              <span className="text-[9px] text-slate-500 font-mono uppercase block">Lipid Plaque Threat</span>
              <span className={`text-[11px] font-bold ${heartInput.cholesterol > 210 ? "text-rose-400" : "text-emerald-400"}`}>
                {cholStatus}
              </span>
            </div>
            <div className="p-3 rounded-xl bg-slate-900/50 border border-slate-800/60 col-span-2 md:col-span-1">
              <span className="text-[9px] text-slate-500 font-mono uppercase block">Perfusion Segment</span>
              <span className={`text-[11px] font-bold ${heartInput.stDepression > 1.0 ? "text-rose-400" : "text-emerald-400"}`}>
                {stStatus}
              </span>
            </div>
          </div>

        </div>
      ) : (
        <div className="space-y-4 animate-fade-in">
          
          {/* Diagnostic telemetry mapping list */}
          <div className="p-4 rounded-2xl bg-slate-950 border border-slate-900 text-xs text-slate-400 leading-relaxed font-sans mb-3">
            <span className="font-mono text-emerald-400 text-[10px] uppercase font-bold tracking-wider block mb-2">★ Live Telemetry Mapping</span>
            Your cardiovascular features push the 3D anatomical layout bounds dynamically. Select a critical region to review detailed physiological impacts of active form parameters:
          </div>

          <div className="grid grid-cols-1 gap-2.5">
            {anatomyRegions.map((region) => (
              <div 
                key={region.id}
                onClick={() => setSelectedRegion(selectedRegion === region.id ? null : region.id)}
                className={`p-3 rounded-2xl border transition-all duration-300 cursor-pointer ${
                  selectedRegion === region.id 
                    ? "bg-[#1d222b] border-slate-700" 
                    : region.status === "warning"
                      ? "bg-rose-500/[0.02] hover:bg-rose-500/[0.04] border-rose-500/10"
                      : "bg-[#0f1116] hover:bg-slate-900 border-slate-800/70"
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className={`p-1.5 rounded-lg ${
                      region.status === "warning" ? "bg-rose-500/10 text-rose-400" : "bg-emerald-500/10 text-emerald-400"
                    }`}>
                      {region.status === "warning" ? (
                        <ShieldAlert className="size-3.5" />
                      ) : (
                        <CheckCircle className="size-3.5" />
                      )}
                    </div>
                    <span className="font-medium text-white text-xs">{region.name}</span>
                  </div>
                  <span className={`text-[10px] uppercase font-mono font-bold px-2 py-0.5 rounded ${
                    region.status === "warning" ? "bg-rose-500/10 text-rose-450" : "bg-slate-800 text-slate-400"
                  }`}>
                    {region.impact}
                  </span>
                </div>

                {selectedRegion === region.id && (
                  <motion.p 
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    className="text-[11px] text-slate-400 leading-relaxed mt-2 pt-2 border-t border-slate-800/50"
                  >
                    {region.description}
                  </motion.p>
                )}
              </div>
            ))}
          </div>

        </div>
      )}

      {/* Embedded credit referencing jalmer */}
      <div className="flex items-center justify-between text-[9px] text-slate-500 font-mono mt-4 pt-3 border-t border-slate-800/40">
        <span>MODEL ID: #D9845AFB</span>
        <span>
          MODEL BY{" "}
          <a
            href="https://sketchfab.com/jalmer"
            target="_blank"
            rel="noreferrer noopener"
            className="hover:text-emerald-400 underline font-semibold"
          >
            JALMER
          </a>
        </span>
      </div>

    </div>
  );
}
