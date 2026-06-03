import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI } from "@google/genai";
import dotenv from "dotenv";

dotenv.config();

const app = express();
const PORT = 3000;

app.use(express.json());

// Lazy-evaluation of the Google GenAI SDK client
let genAIInstance: GoogleGenAI | null = null;
function getAI() {
  if (!genAIInstance) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey || apiKey === "MY_GEMINI_API_KEY") {
      console.warn("GEMINI_API_KEY environment variable is not set. Falling back to simulated clinical analysis.");
      return null;
    }
    genAIInstance = new GoogleGenAI({
      apiKey: apiKey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        }
      }
    });
  }
  return genAIInstance;
}

// Endpoint 1: Clinician Symptom Analyzer using Gemini
app.post("/api/analyze-symptoms", async (req, res) => {
  try {
    const { symptoms } = req.body;
    if (!symptoms || symptoms.trim() === "") {
      return res.status(400).json({ error: "No client symptoms provided." });
    }

    const ai = getAI();
    if (!ai) {
      // High-fidelity local simulation if key is missing
      const mockResult = generateFallbackSymptomResponse(symptoms);
      return res.json({ response: mockResult, fallback: true });
    }

    const prompt = `You are an expert AI Physician and clinical triage assistant.
Provide a high-quality diagnostic triage assessment of the following symptoms:
"${symptoms}"

Structure your response clearly with markdown and return:
1. **Clinical Triage Level**: Green (Regular care/home-rest), Yellow (Unscheduled outpatient check-up), or Red (Urgent emergency care).
2. **Pathophysiological Considerations**: List 2-3 clinical conditions that might present this way. Give concise textbook details of why.
3. **Primary Diagnostic Questions**: List 3 key screening questions a clinician should ask during examination.
4. **Actionable Patient Safeguards**: Plain instructions for what the patient can track right now (e.g. blood glucose, hydration levels, heart rate) and under what conditions they must check into a local emergency room immediately.

Keep your tone clinical, professional, helpful, and highly clear. Add a disclaimer that we represent a medical AI model.`;

    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: prompt,
      config: {
        systemInstruction: "You are an expert medical triage advisor assisting clinical staff with model verification guidance.",
      }
    });

    res.json({ response: response.text, fallback: false });
  } catch (error: any) {
    console.error("Gemini API Error in symptoms check:", error);
    res.status(500).json({ error: error.message || "Failed to query medical ai." });
  }
});

// Endpoint 2: Advanced Clinical Profile & SHAP explanation narratives
app.post("/api/predict-explain", async (req, res) => {
  try {
    const { type, patientData } = req.body; // type is 'diabetes' or 'heart'
    const ai = getAI();

    if (!ai) {
      const mockExplain = generateFallbackModelExplanation(type, patientData);
      return res.json({ response: mockExplain, fallback: true });
    }

    let reportDetail = "";
    if (type === "diabetes") {
      reportDetail = `Patient Profile:
      - Blood Glucose Level: ${patientData.glucose} mg/dL (Reference Normal: < 100 mg/dL, Diabetic: > 125 mg/dL)
      - Body Mass Index (BMI): ${patientData.bmi} (Reference Normal: 18.5 - 24.9)
      - Age: ${patientData.age} years
      - Blood Pressure: ${patientData.bloodPressure} mm Hg
      - Insulin: ${patientData.insulin} mu U/ml
      - Pregnancies: ${patientData.pregnancies}`;
    } else {
      reportDetail = `Patient Profile:
      - ECG Chest Pain Type: Level ${patientData.chestPain} out of 4
      - Blood Pressure (Resting): ${patientData.restingBP} mm Hg
      - Serum Cholesterol: ${patientData.cholesterol} mg/dL (Reference Normal: < 200 mg/dL)
      - Max Heart Rate Achieved: ${patientData.maxHR} bpm
      - ST depression (ECG readout): ${patientData.stDepression}
      - Exercise Induced Angina: ${patientData.exerciseAngina ? "Yes" : "No"}`;
    }

    const prompt = `You are a molecular medical researcher and expert clinician.
Verify this patient profile and generate a comprehensive clinical explanation narrative:
${reportDetail}

Explain:
1. **Critical High-Risk Identifiers**: Which of these telemetry features contribute most to the risk mathematically. Refer to biochemical thresholds.
2. **Pathology Mechanisms**: Explain the intracellular or physiological reasons how these values combined aggravate this patient's ${type === "diabetes" ? "insulin resistance / type-2 diabetes risk" : "ischemic cardiac disease / coronary hazard"}.
3. **Proactive Intervention Advice**: Highly detailed behavioral, dietary (e.g. low glycemic, complex limits, heart-healthy lipids), and screening steps recommended to avert progression.

Return this output in pristine medical markdown. Let's make it look like a real professional specialist consult.`;

    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: prompt,
    });

    res.json({ response: response.text, fallback: false });
  } catch (error: any) {
    console.error("Gemini API Error in prediction review:", error);
    res.status(500).json({ error: error.message || "Failed to generate diagnostic report." });
  }
});

// Mock Fallback generators for high-quality robustness
function generateFallbackSymptomResponse(symptoms: string) {
  return `### 🩺 Simulated Clinical Triage Report
*Warning: Running in clinical simulation mode because GEMINI_API_KEY option is missing. Real-world API evaluation is recommended.*

#### 1. **Clinical Triage Level**: **Yellow** (Unscheduled Outpatient Follow-up)

#### 2. **Pathophysiological Considerations**:
- **Metabolic Imbalance (Clinical Type I/II)**: Given reports of "${symptoms}", glycemic checking is indicated if thirsty or experiencing fatigue.
- **Microvascular/Neurological anomaly**: Minor peripheral triggers may account for sensory or microvascular stress in cardiovascular frameworks.

#### 3. **Primary Diagnostic Questions**:
- "When did you first notice the onset of these symptoms, and are they exacerbated by food or exercise?"
- "Is there a documented familial history of endocrine or ischemic cardiovascular abnormalities?"
- "Have you lately experienced sudden, unexplained changes in weight, fluid intake, or localized pressures?"

#### 4. **Actionable Patient Safeguards & Self-Tracking**:
- Daily metrics: Document morning fasting blood glucose (Target < 100 mg/dL) and daily blood pressure.
- Emergency triggers: Immediately seek **Red Level (Emergency Care)** should you experience severe shortness of breath, crushing retrosternal pressure, or extreme confusional states.`;
}

function generateFallbackModelExplanation(type: string, patientData: any) {
  if (type === "diabetes") {
    const isHighGlue = Number(patientData.glucose) > 125;
    const isHighBmi = Number(patientData.bmi) > 25.0;
    return `### 📊 Simulated Medical Explainability Report (SHAP Verifier)
*Notice: Running in clinic validator fallback. Set a real GEMINI_API_KEY to test modern LLM reasoning.*

Based on patient profile (Glucose: **${patientData.glucose} mg/dL**, BMI: **${patientData.bmi}**, Age: **${patientData.age}**):

1. **Critical High-Risk Identifiers**:
   - **Glucose Input (${patientData.glucose} mg/dL)**: Is mathematically contributing a positive SHAP value of **+0.32** because it is ${isHighGlue ? "above the diabetic clinical index (>125 mg/dL)" : "within reasonable range but correlates with dynamic parameters"}.
   - **BMI Input (${patientData.bmi})**: Elevates baseline hazard by **+0.18** SHAP force value ${isHighBmi ? "due to standard overweight metabolic metrics" : "reflecting active adipocyte stress baseline"}.

2. **Pathology Mechanisms**:
   - Excess blood glucose prompts relative pancreatic strain, raising insulin output and worsening muscle tissue receptor fatigue.
   - The age index of **${patientData.age} years** is a static metabolic deceleration vector contributing **+0.05** SHAP.

3. **Proactive Intervention Advice**:
   - **Dietary Safeguards**: Initiate complex low-glycemic dietary transitions, substituting processed sugars with complex fiber.
   - **Action items**: Conduct formal HbA1c screening (clinical standard) and secure scheduled lipid profiling.`;
  } else {
    const isHighBP = Number(patientData.restingBP) > 130;
    const isHighChol = Number(patientData.cholesterol) > 200;
    return `### 📊 Simulated Cardiology Model Report (SHAP Verifier)
*Notice: Running in heart validator fallback. Set a real GEMINI_API_KEY to test modern cardiology model analysis.*

Review of Cardiac parameters (ECG type: **Level ${patientData.chestPain}**, BP: **${patientData.restingBP} mm Hg**, Cholesterol: **${patientData.cholesterol} mg/dL**):

1. **Critical High-Risk Identifiers**:
   - **Serum Cholesterol (${patientData.cholesterol} mg/dL)**: Exposes positive SHAP strength of **+0.28** ${isHighChol ? "correlating with atherogenic risks" : "showing normal lipid parameters"}.
   - **Resting Blood Pressure (${patientData.restingBP} mm Hg)**: Contributes **+0.15** SHAP ${isHighBP ? "denoting systemic arterial resistance" : "signaling normotensive states"}.

2. **Pathology Mechanisms**:
   - High resting BP and arterial pressures increase ventricular workload, triggering hypertrophy over long periods. 
   - Exercise angina status of **${patientData.exerciseAngina ? "Yes" : "No"}** adds a SHAP value force of **${patientData.exerciseAngina ? "+0.35" : "-0.10"}**.

3. **Clinical Action Items**:
   - Focus on dietary sodium regulation (<1500mg/day) and incorporate aerobic metabolic conditioning (30 mins daily).
   - Arrange an outpatient stress echocardiogram to clinically cross-verify models.`;
  }
}

// Endpoint 3: Interactive Diagnostic Chatbot using Gemini
app.post("/api/chat", async (req, res) => {
  try {
    const { messages } = req.body;
    if (!messages || !Array.isArray(messages)) {
      return res.status(400).json({ error: "No messages array provided." });
    }

    const ai = getAI();
    if (!ai) {
      // Robust clinical local simulation mode
      const lastUserMsg = messages[messages.length - 1]?.content || "";
      const simulatedResult = getChatbotFallbackResponse(lastUserMsg, messages);
      return res.json({ response: simulatedResult, fallback: true });
    }

    // Format conversation history into standard chat representation
    const formattedHistory = messages.map(msg => {
      const roleName = msg.role === "user" ? "User/Clinician" : "HealthGuard Assistant";
      return `${roleName}: ${msg.content}`;
    }).join("\n");

    const prompt = `You are HealthGuard's expert medical AI assistant.
Answer questions regarding clinical models, patient telemetry indicators, SHAP explanatory vectors, and MLOps concept drift.
Keep your response concise, using bullets where applicable. Include a disclaimer that you are an AI assistant.

Existing Dialogue History:
${formattedHistory}

HealthGuard Assistant:`;

    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: prompt,
      config: {
        systemInstruction: "You are HealthGuard's expert explainable clinical telemetry advisor and virtual copilot. Answer clinical query prompts professionally and concisely."
      }
    });

    res.json({ response: response.text, fallback: false });
  } catch (error: any) {
    console.error("Gemini API Error in chatbot route:", error);
    res.status(500).json({ error: error.message || "Failed to process dialogue session." });
  }
});

function getChatbotFallbackResponse(message: string, history: any[]) {
  const msgLower = message.toLowerCase();
  
  if (msgLower.includes("hello") || msgLower.includes("hi") || msgLower.includes("hey")) {
    return `Hello! 🩺 I am **HealthGuard's AI Assistant**. I'm currently running in explainable clinical simulation mode.

I can guide you through our diagnostic modules:
- **SHAP values**: Game-theory explanations of model predictions.
- **Diabetes/Cardiac predictor form values**: Clinical thresholds and metabolic impact.
- **MLOps Drift Console**: Monitoring Kolmogorov-Smirnov drift indicators.

How can I assist your clinical triage process today?`;
  }
  
  if (msgLower.includes("shap") || msgLower.includes("interpret") || msgLower.includes("game-theory")) {
    return `### 📊 Understanding SHAP (Shapley Additive exPlanations)
In the HealthGuard platform, we utilize game-theory calculations to avoid complete black-box AI estimations!

- **How it works**: Every patient metric (e.g., Blood Glucose, Resting Blood Pressure) acts as a player in a game. The algorithm calculates the change in prediction by adding and removing that player.
- **Directional push**: 
  - **Positive SHAP (Rose alerts)**: Pushes risk predictions higher.
  - **Negative SHAP (Emerald indicators)**: Lowers predicted risk, reflecting patient metabolic resilience.
  
Do you have a specific patient profile you'd like to evaluate?`;
  }

  if (msgLower.includes("heart") || msgLower.includes("cardiac") || msgLower.includes("cholesterol") || msgLower.includes("bp")) {
    return `### 🫀 Beating Heart Diagnostic Framework
The **Cardiac Predictor** is mapped directly to our live **3D Interactive Cardiology Hub** powered by the **Beating Heart reference model** by jalmer.

- **Fasting BP Target**: Normal is < 120/80 mm Hg. High risk is > 140 mm Hg.
- **Serum Cholesterol Target**: High atherogenic risk is flagged at values > 240 mg/dL.
- **ST depression (ECG readout)**: High ischemic indicators are triggered above 1.5 units.

Ensure you check out the interactive 3D model orbit under the **Cardiac** diagnostic workspace!`;
  }

  if (msgLower.includes("diabetes") || msgLower.includes("glucose") || msgLower.includes("bmi")) {
    return `### 🩸 Diabetes & Metabolic Predictive Interface
The **Diabetes Predictor** evaluates metabolic biomarkers dynamically:

- **Fasting Blood Glucose**: Diabetic threshold starts above > 125 mg/dL.
- **Insulin**: High fasting insulin (> 200 mu U/ml) can signify chronic tissue receptiveness fatigue.
- **Body Mass Index (BMI)**: Ideal range is 18.5 - 24.9.

Each calculation will produce distinct real-time explainability bars to assist clinicians.`;
  }

  return `Thank you for your inquiry! 🩺 

I am programmed to assist with clinical triage procedures. Here are some quick things we can search:
1. Explain how **SHAP value** contributions are measured.
2. Outline standard clinical limits for **Resting Blood Pressure** and **Cholesterol**.
3. Clarify the purpose of our **MLOps Model Retraining console** under demographic shifts.

*Note: Set your GEMINI_API_KEY secret to fully unlock the adaptive reasoning power of the Gemini 3.5 model.*`;
}

// Vite integration middleware
async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`HealthGuard AI Full-stack server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
