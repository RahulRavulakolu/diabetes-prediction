import React, { useState, useEffect } from 'react';
import { motion } from "framer-motion";
import { Sun, Moon } from 'lucide-react';

// --- Types ---
interface Testimonial {
  text: string;
  image: string;
  name: string;
  role: string;
}

// --- Data (Clinical & Research Focused) ---
const testimonials: Testimonial[] = [
  {
    text: "The SHAP explanation interface has changed how our clinical interns approach predictive modeling. Transparent patient parameters are accessible in seconds.",
    image: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&q=80&w=150&h=150",
    name: "Dr. Amanda Mercer",
    role: "Chief Clinical Informaticist",
  },
  {
    text: "Implementing standard heart risk predictions can be risky without drift metrics. This portal's interactive clinical timelines and drift warnings are outstanding.",
    image: "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?auto=format&fit=crop&q=80&w=150&h=150",
    name: "Dr. Marcus Vance",
    role: "Director of Cardiovascular Research",
  },
  {
    text: "The symptom checker leverages LLM integration cleanly. Patients receive reassuring clinic routing guidance rather than immediate panic suggestions.",
    image: "https://images.unsplash.com/photo-1438761681033-6461ffad8d80?auto=format&fit=crop&q=80&w=150&h=150",
    name: "Saman Malik",
    role: "Lead Nurse Practitioner",
  },
  {
    text: "MLOps metrics are usually buried in logs. Visualizing data drift alongside interactive prediction widgets makes real-world diagnostic validation highly clear.",
    image: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&q=80&w=150&h=150",
    name: "Prof. Omar Raza",
    role: "AI Healthcare Hub Director, Stanford",
  },
  {
    text: "Our research departments use the SHAP feature mapping to verify patient parameters like Age, Blood Pressure, and LDL vs. Model Confidence values.",
    image: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&q=80&w=150&h=150",
    name: "Dr. Zainab Hussain",
    role: "Clinical Data Analyst",
  },
  {
    text: "I was skeptical about automated diabetes indicators, but the visual confidence levels paired with actual biochemical references are stellar.",
    image: "https://images.unsplash.com/photo-1517841905240-472988babdf9?auto=format&fit=crop&q=80&w=150&h=150",
    name: "Dr. Evelyn Cartwright",
    role: "Consultant Endocrinologist",
  },
  {
    text: "We used the custom drift indicators to simulate clinical changes over months. The UI responsive layout is both elegant and technically sound.",
    image: "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&q=80&w=150&h=150",
    name: "Dr. Farhan Siddiqui",
    role: "Lead Systems Architect, HealthSys",
  },
  {
    text: "A beautiful display of model interpretability. Finally, a tool that does not treat deep learning models as a complete black box.",
    image: "https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&q=80&w=150&h=150",
    name: "Sarah Sheikh",
    role: "Epidemiological Lead",
  },
  {
    text: "We integrated the interactive prediction wizard into our nurse practitioner simulation. The usability metrics have increased significantly.",
    image: "https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?auto=format&fit=crop&q=80&w=150&h=150",
    name: "Hassan Ali",
    role: "E-Health Consultant",
  },
];

const firstColumn = testimonials.slice(0, 2);
const secondColumn = testimonials.slice(2, 4);
const thirdColumn = testimonials.slice(4, 6);
const fourthColumn = testimonials.slice(6, 9);

// --- Sub-Components ---
const TestimonialsColumn = (props: {
  className?: string;
  testimonials: Testimonial[];
  duration?: number;
}) => {
  return (
    <div className={props.className}>
      <motion.ul
        animate={{
          translateY: "-50%",
        }}
        transition={{
          duration: props.duration || 10,
          repeat: Infinity,
          repeatType: "loop",
          ease: "linear",
        }}
        className="flex flex-col gap-6 pb-6 bg-transparent list-none m-0 p-0"
      >
        {[
          ...new Array(2).fill(0).map((_, index) => (
            <React.Fragment key={index}>
              {props.testimonials.map(({ text, image, name, role }, i) => (
                <motion.li 
                  key={`${index}-${i}`}
                  aria-hidden={index === 1 ? "true" : "false"}
                  tabIndex={index === 1 ? -1 : 0}
                  whileHover={{ 
                    scale: 1.02,
                    y: -4,
                    boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.5)",
                    transition: { type: "spring", stiffness: 400, damping: 17 }
                  }}
                  className="p-8 rounded-3xl border border-slate-800 shadow-2xl max-w-sm md:max-w-md w-full bg-[#14171c] transition-all duration-300 cursor-default select-none group focus:outline-none focus:ring-2 focus:ring-emerald-500/30" 
                >
                  <blockquote className="m-0 p-0">
                    <p className="text-slate-400 text-sm leading-relaxed font-normal m-0 transition-colors duration-300">
                      "{text}"
                    </p>
                    <footer className="flex items-center gap-3 mt-6">
                      <img
                        width={40}
                        height={40}
                        src={image}
                        alt={`Avatar of ${name}`}
                        className="h-10 w-10 rounded-full object-cover ring-2 ring-slate-800 group-hover:ring-emerald-400 transition-all duration-300 ease-in-out"
                      />
                      <div className="flex flex-col leading-tight">
                        <cite className="font-serif italic font-bold not-italic text-sm text-white">
                          {name}
                        </cite>
                        <span className="text-xs font-mono text-emerald-400 mt-1">
                          {role}
                        </span>
                      </div>
                    </footer>
                  </blockquote>
                </motion.li>
              ))}
            </React.Fragment>
          )),
        ]}
      </motion.ul>
    </div>
  );
};

export const TestimonialsSection = () => {
  return (
    <section 
      aria-labelledby="testimonials-heading"
      className="bg-transparent py-16 relative overflow-hidden border-t border-slate-800"
    >
      <div className="px-4 z-10 mx-auto w-full max-w-[1600px]">
        <motion.div 
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: false, margin: "-80px" }}
          transition={{ duration: 0.6 }}
          className="flex flex-col items-center justify-center max-w-[640px] mx-auto mb-12"
        >
          <div className="flex justify-center">
            <div className="border border-slate-800 py-1 px-4 rounded-full text-[10px] font-bold tracking-widest uppercase text-emerald-400 bg-[#0a0b0e] font-mono">
              Expert Peer Reviews
            </div>
          </div>

          <h2 id="testimonials-heading" className="text-3xl md:text-4xl font-serif italic font-medium tracking-tight mt-6 text-center text-white">
            Clinical Peer Evaluations & Validation
          </h2>
          <p className="text-center mt-3 text-slate-400 text-xs leading-relaxed max-w-md">
            See how clinicians, medical AI researchers, and staff physicians rate the HealthGuard explainable diagnostic suite.
          </p>
        </motion.div>

        <motion.div 
          initial={{ opacity: 0, y: 40 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: false, margin: "-80px" }}
          transition={{ duration: 0.7 }}
          className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-6 mt-8 [mask-image:linear-gradient(to_bottom,transparent,black_10%,black_90%,transparent)] max-h-[620px] overflow-hidden"
          role="region"
          aria-label="Scrolling Clinical Testimonials"
        >
          <TestimonialsColumn testimonials={firstColumn} duration={24} className="w-full flex justify-center" />
          <TestimonialsColumn testimonials={secondColumn} className="hidden sm:flex w-full justify-center" duration={28} />
          <TestimonialsColumn testimonials={thirdColumn} className="hidden md:flex w-full justify-center" duration={22} />
          <TestimonialsColumn testimonials={fourthColumn} className="hidden xl:flex w-full justify-center" duration={26} />
        </motion.div>
      </div>
    </section>
  );
};
