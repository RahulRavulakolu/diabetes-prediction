import { Activity, Heart } from 'lucide-react';

export const generateDiabetesDashboardProps = (input: any, score: number, level: string) => {
  const factors: string[] = [];
  const shapFeatures: any[] = [];
  let summary = "";
  
  if (input.HighBP) {
    factors.push("High BP");
    shapFeatures.push({ name: "High BP", impact: 0.35, direction: "up" });
  } else {
    shapFeatures.push({ name: "Normal BP", impact: -0.15, direction: "down" });
  }

  if (input.HighChol) {
    factors.push("High Cholesterol");
    shapFeatures.push({ name: "High Cholesterol", impact: 0.25, direction: "up" });
  }

  if (input.BMI > 30) {
    factors.push(`BMI ${input.BMI} (Obese)`);
    shapFeatures.push({ name: "BMI", impact: 0.28, direction: "up" });
  } else if (input.BMI > 25) {
    factors.push(`BMI ${input.BMI} (Overweight)`);
    shapFeatures.push({ name: "BMI", impact: 0.15, direction: "up" });
  } else if (input.BMI < 18.5) {
    factors.push(`BMI ${input.BMI} (Underweight)`);
    shapFeatures.push({ name: "BMI", impact: 0.1, direction: "up" });
  } else {
    shapFeatures.push({ name: "Healthy BMI", impact: -0.2, direction: "down" });
  }

  if (input.GenHlth >= 4) {
    factors.push("Poor Gen Health");
    shapFeatures.push({ name: "General Health", impact: 0.4, direction: "up" });
  } else if (input.GenHlth <= 2) {
    shapFeatures.push({ name: "Good Gen Health", impact: -0.3, direction: "down" });
  }

  if (input.Stroke) {
    factors.push("Stroke History");
    shapFeatures.push({ name: "Stroke History", impact: 0.2, direction: "up" });
  }
  if (input.HeartDiseaseorAttack) {
    factors.push("Heart Disease");
    shapFeatures.push({ name: "Heart Disease", impact: 0.25, direction: "up" });
  }
  if (!input.PhysActivity) {
    factors.push("Low Activity");
    shapFeatures.push({ name: "Low Activity", impact: 0.18, direction: "up" });
  } else {
    shapFeatures.push({ name: "Physically Active", impact: -0.15, direction: "down" });
  }
  
  shapFeatures.sort((a, b) => Math.abs(b.impact) - Math.abs(a.impact));

  if (score > 50) {
    summary = `High risk primarily driven by ${factors.slice(0,3).join(", ")}.`;
  } else {
    summary = `Low risk profile. Favorable indicators: ${shapFeatures.filter(f => f.direction === 'down').slice(0,2).map(f => f.name).join(", ")}.`;
  }

  const radarData = [
    { category: "Metabolic", value: input.BMI * 2 + (input.HighChol ? 20 : 0), fullMark: 100 },
    { category: "Cardiovascular", value: (input.HighBP ? 40 : 10) + (input.HeartDiseaseorAttack ? 50 : 0) + (input.Stroke ? 30 : 0), fullMark: 100 },
    { category: "Lifestyle", value: (!input.PhysActivity ? 40 : 10) + (input.HvyAlcoholConsump ? 40 : 10), fullMark: 100 },
    { category: "General Health", value: input.GenHlth * 20, fullMark: 100 },
    { category: "Demographic", value: input.Age * 10, fullMark: 100 },
  ].map(d => ({...d, value: Math.min(100, Math.max(10, d.value))}));

  const radarBreakdown = [
    { category: "Cardiovascular", score: radarData[1].value, color: "#f43f5e", icon: Heart },
    { category: "Metabolic", score: radarData[0].value, color: "#3b82f6", icon: Activity },
    { category: "Lifestyle", score: radarData[2].value, color: "#10b981", icon: Activity },
  ];

  return {
    shapExplanation: { summary, features: shapFeatures.slice(0, 5) },
    patientRiskFactors: factors.length > 0 ? factors : ["No major risk factors"],
    radarData,
    radarBreakdown,
    globalFeatureImportance: [
      { name: "High BP", weight: 0.25 },
      { name: "General Health", weight: 0.22 },
      { name: "High Cholesterol", weight: 0.15 },
      { name: "Difficulty Walking", weight: 0.07 },
      { name: "BMI", weight: 0.07 },
      { name: "Age", weight: 0.06 },
    ],
    driftWarning: {
      detected: input.BMI > 45 || input.BMI < 15,
      message: "BMI input is outside standard training distribution bounds.",
      metrics: [`BMI: ${input.BMI}`]
    }
  };
};

export const generateHeartDashboardProps = (input: any, score: number, level: string) => {
  const factors: string[] = [];
  const shapFeatures: any[] = [];
  let summary = "";
  
  if (input.ap_hi >= 140 || input.ap_lo >= 90) {
    factors.push(`High BP (${input.ap_hi}/${input.ap_lo})`);
    shapFeatures.push({ name: "Blood Pressure", impact: 0.45, direction: "up" });
  } else {
    shapFeatures.push({ name: "Normal BP", impact: -0.2, direction: "down" });
  }

  if (input.cholesterol >= 2) {
    factors.push("High Cholesterol");
    shapFeatures.push({ name: "Cholesterol", impact: 0.3, direction: "up" });
  }

  if (input.bmi > 30) {
    factors.push(`BMI ${input.bmi} (Obese)`);
    shapFeatures.push({ name: "BMI", impact: 0.25, direction: "up" });
  } else {
    shapFeatures.push({ name: "BMI", impact: -0.1, direction: "down" });
  }

  if (input.age_years >= 60) {
    factors.push("Age > 60");
    shapFeatures.push({ name: "Age", impact: 0.2, direction: "up" });
  }
  
  if (input.smoke) {
    factors.push("Smoker");
    shapFeatures.push({ name: "Smoking", impact: 0.15, direction: "up" });
  }
  
  if (!input.active) {
    factors.push("Low Activity");
    shapFeatures.push({ name: "Physical Activity", impact: 0.1, direction: "up" });
  } else {
    shapFeatures.push({ name: "Active Lifestyle", impact: -0.15, direction: "down" });
  }

  shapFeatures.sort((a, b) => Math.abs(b.impact) - Math.abs(a.impact));

  if (score > 50) {
    summary = `Cardiac risk primarily driven by ${factors.slice(0,3).join(", ")}.`;
  } else {
    summary = `Favorable cardiac profile. Protective indicators: ${shapFeatures.filter(f => f.direction === 'down').slice(0,2).map(f => f.name).join(", ")}.`;
  }

  const radarData = [
    { category: "Blood Pressure", value: (input.ap_hi > 130 ? 80 : 30) + (input.ap_lo > 85 ? 20 : 0), fullMark: 100 },
    { category: "Metabolic", value: input.bmi * 2 + (input.gluc === 3 ? 30 : 0), fullMark: 100 },
    { category: "Lifestyle", value: (input.smoke ? 40 : 10) + (!input.active ? 30 : 10) + (input.alco ? 20 : 0), fullMark: 100 },
    { category: "Biometric", value: (input.cholesterol * 30), fullMark: 100 },
    { category: "Demographic", value: input.age_years, fullMark: 100 },
  ].map(d => ({...d, value: Math.min(100, Math.max(10, d.value))}));

  const radarBreakdown = [
    { category: "Blood Pressure", score: radarData[0].value, color: "#f43f5e", icon: Heart },
    { category: "Biometric", score: radarData[3].value, color: "#8b5cf6", icon: Activity },
    { category: "Lifestyle", score: radarData[2].value, color: "#10b981", icon: Activity },
  ];

  return {
    shapExplanation: { summary, features: shapFeatures.slice(0, 5) },
    patientRiskFactors: factors.length > 0 ? factors : ["No major risk factors"],
    radarData,
    radarBreakdown,
    globalFeatureImportance: [
      { name: "Systolic BP", weight: 0.35 },
      { name: "Age", weight: 0.25 },
      { name: "Cholesterol", weight: 0.15 },
      { name: "Weight", weight: 0.10 },
      { name: "Diastolic BP", weight: 0.08 },
      { name: "Glucose", weight: 0.05 },
    ],
    driftWarning: {
      detected: input.ap_hi > 180 || input.ap_hi < 80,
      message: "Systolic Blood Pressure input is outside standard training bounds.",
      metrics: [`Systolic BP: ${input.ap_hi}`]
    }
  };
};
