import React, { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Send, Bot, MessageCircle, X, Sparkles, Activity } from "lucide-react";

interface Message {
  id: string;
  role: "user" | "model";
  content: string;
  timestamp: Date;
}

export function AIChatbot() {
  const apiBase = import.meta.env.VITE_API_URL || "http://localhost:8000";
  const buildApiUrl = (path: string) => {
    const base = apiBase.replace(/\/$/, "");
    const suffix = path.startsWith("/") ? path : `/${path}`;
    return `${base}${suffix}`;
  };
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([
    {
      id: "init-1",
      role: "model",
      content: "Hello! Welcome to the HealthGuard Explainable AI platform. I can assist you with understanding your patient's diagnostic models, raw SHAP values, and system metrics today.",
      timestamp: new Date(),
    },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [eyeOffset, setEyeOffset] = useState({ x: 0, y: 0 });
  const eyeContainerRef = useRef<HTMLDivElement>(null);

  // Track cursor position to update mascot eye gaze direction
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!eyeContainerRef.current) return;
      
      const rect = eyeContainerRef.current.getBoundingClientRect();
      const eyeCenterX = rect.left + rect.width / 2;
      const eyeCenterY = rect.top + rect.height / 2;
      
      const dx = e.clientX - eyeCenterX;
      const dy = e.clientY - eyeCenterY;
      
      const angle = Math.atan2(dy, dx);
      const distance = Math.sqrt(dx * dx + dy * dy);
      const maxDistance = 400; // Distance threshold for full eye strain gaze
      const maxRange = 3.5; // Limit movement in pixels
      
      const factor = Math.min(distance / maxDistance, 1);
      const moveX = Math.cos(angle) * factor * maxRange;
      const moveY = Math.sin(angle) * factor * maxRange;
      
      setEyeOffset({ x: moveX, y: moveY });
    };

    window.addEventListener("mousemove", handleMouseMove);
    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
    };
  }, []);

  // Auto-scroll to the bottom of the chat list on new messages
  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages]);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || loading) return;

    const userMessage: Message = {
      id: `msg-${Date.now()}-user`,
      role: "user",
      content: input,
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    setLoading(true);

    try {
      const response = await fetch(buildApiUrl("/chat"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: userMessage.content,
          context: {
            history: [...messages, userMessage].map((m) => ({
              role: m.role,
              content: m.content,
            })),
          },
        }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.detail || data.error || "Failed to communicate with AI.");
      }

      setMessages((prev) => [
        ...prev,
        {
          id: `msg-${Date.now()}-ai`,
          role: "model",
          content: data.response || "No reply from clinical intelligence.",
          timestamp: new Date(),
        },
      ]);
    } catch (err: any) {
      console.error(err);
      setMessages((prev) => [
        ...prev,
        {
          id: `msg-${Date.now()}-err`,
          role: "model",
          content: "⚠️ Connection failure or empty API response. Configure OPENROUTER_API_KEY in the backend to enable live clinical assistance.",
          timestamp: new Date(),
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  // Helper to parse simple markdown bold & lists for cleaner typography
  const renderMessageContent = (content: string) => {
    return content.split("\n").map((line, idx) => {
      let trimmed = line.trim();
      
      // Simple list items
      if (trimmed.startsWith("- ") || trimmed.startsWith("* ")) {
        const text = trimmed.substring(2);
        return (
          <li key={idx} className="ml-4 list-disc text-[12.5px] text-slate-705 mt-1 leading-relaxed">
            {parseBoldText(text)}
          </li>
        );
      }
      
      if (trimmed.startsWith("### ")) {
        return (
          <h5 key={idx} className="font-sans font-bold text-slate-900 border-b border-slate-100 pb-1 mt-3 mb-1 text-[13px] first:mt-0">
            {trimmed.substring(4)}
          </h5>
        );
      }

      if (trimmed.startsWith("#### ")) {
        return (
          <h6 key={idx} className="font-sans font-semibold text-slate-800 mt-2 mb-0.5 text-[12.5px]">
            {trimmed.substring(5)}
          </h6>
        );
      }

      return (
        <p key={idx} className="text-[12.5px] leading-relaxed text-slate-700 mb-1 last:mb-0">
          {parseBoldText(trimmed)}
        </p>
      );
    });
  };

  const parseBoldText = (text: string) => {
    const parts = text.split(/(\*\*.*?\*\*)/g);
    return parts.map((part, i) => {
      if (part.startsWith("**") && part.endsWith("**")) {
        return <strong key={i} className="font-bold text-slate-900">{part.slice(2, -2)}</strong>;
      }
      return part;
    });
  };

  return (
    <>
      {/* Floating Chatbot Mascot Button (Orb Icon Matching Image 1) */}
      <div 
        id="chatbot-floating-mascot"
        className="fixed bottom-6 right-6 z-[999]"
      >
        <button
          onClick={() => setIsOpen(!isOpen)}
          aria-label="Toggle AI Clinical Assistant Chatbot"
          className="relative w-16 h-16 rounded-full flex items-center justify-center cursor-pointer group active:scale-95 transition-transform duration-200"
          style={{
            background: "conic-gradient(from 140deg, #f97316 0%, #ef4444 15%, #ec4899 35%, #8b5cf6 55%, #3b82f6 75%, #10b981 90%, #f97316 100%)",
            boxShadow: "0 8px 30px rgba(0, 0, 0, 0.4), inset 0 2px 4px rgba(255, 255, 255, 0.2)"
          }}
        >
          {/* Inner dark center with mascot eyes */}
          <div className="w-[82%] h-[82%] rounded-full bg-[#030712] flex items-center justify-center relative shadow-[inset_0_4px_10px_rgba(0,0,0,0.6)]">
            {/* Mascot Eyes Container with cursor-tracking position shifting */}
            <motion.div 
              ref={eyeContainerRef}
              style={{ x: eyeOffset.x, y: eyeOffset.y }}
              className="flex items-center gap-[4px] relative"
            >
              <motion.div 
                className="w-[4px] h-[10px] bg-white rounded-full"
                animate={{
                  scaleY: [1, 1, 0.1, 1, 1],
                  height: ["10px", "10px", "2px", "10px", "10px"]
                }}
                transition={{
                  repeat: Infinity,
                  duration: 4,
                  repeatDelay: 2
                }}
              />
              <motion.div 
                className="w-[4px] h-[10px] bg-white rounded-full"
                animate={{
                  scaleY: [1, 1, 0.1, 1, 1],
                  height: ["10px", "10px", "2px", "10px", "10px"]
                }}
                transition={{
                  repeat: Infinity,
                  duration: 4,
                  repeatDelay: 2.1
                }}
              />
            </motion.div>

            {/* Glowing ring highlight overlay */}
            <div className="absolute inset-0 rounded-full bg-transparent border border-white/5 pointer-events-none" />
          </div>

          {/* Prompt/Pulse Badge */}
          {!isOpen && (
            <span className="absolute -top-1 -right-1 flex h-3.5 w-3.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-3.5 w-3.5 bg-emerald-500 border border-[#030712]"></span>
            </span>
          )}
        </button>
      </div>

      {/* Chat window overlay (Matching Image 2 in pristine UI layout) */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            id="chatbot-window-overlay"
            initial={{ opacity: 0, scale: 0.9, y: 30 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 30 }}
            transition={{ type: "spring", damping: 25, stiffness: 350 }}
            className="fixed bottom-24 right-4 sm:right-6 w-[92vw] sm:w-[420px] max-h-[600px] h-[78vh] bg-[#f8fafc] backdrop-blur-md rounded-3xl shadow-[0_24px_50px_rgba(0,0,0,0.3)] border border-slate-200/80 flex flex-col overflow-hidden z-[9999]"
          >
            {/* Top Header Row styled after Image 2 with Mac Controls & Center Title */}
            <div className="flex items-center justify-between px-5 py-3.5 bg-white border-b border-slate-100 select-none">
              
              {/* macOS three dot controls (Left side, matching Image 2) */}
              <div className="flex items-center gap-1.5 w-1/4">
                <div className="w-3 h-3 rounded-full bg-[#ff5f56]" />
                <div className="w-3 h-3 rounded-full bg-[#ffbd2e]" />
                <div className="w-3 h-3 rounded-full bg-[#27c93f]" />
              </div>

              {/* Centered chatbot name (matching Image 2 style) */}
              <div className="text-center flex-1">
                <span className="font-sans font-extrabold text-[15px] tracking-tight text-slate-850">
                  AI Chatbot
                </span>
                <span className="inline-block w-1.5 h-1.5 bg-emerald-500 rounded-full ml-1.5 align-middle animate-pulse" />
              </div>

              {/* Close Button or trailing status on right */}
              <div className="w-1/4 flex justify-end">
                <button 
                  onClick={() => setIsOpen(false)}
                  className="p-1 px-1.5 rounded-lg hover:bg-slate-100 transition-colors text-slate-400 hover:text-slate-600 cursor-pointer"
                >
                  <X className="size-4" />
                </button>
              </div>

            </div>

            {/* Live Message Area */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-[#f8fafc] scrollbar-thin scrollbar-thumb-slate-200">
              
              {messages.map((message) => {
                const isBot = message.role === "model";
                
                return (
                  <div 
                    key={message.id} 
                    className={`flex items-start gap-2.5 max-w-full ${isBot ? "" : "justify-end"}`}
                  >
                    {/* Bot Avatar (Left, styled matching Image 2) */}
                    {isBot && (
                      <div className="w-9 h-9 rounded-full bg-white flex items-center justify-center shadow-sm border border-slate-205 flex-shrink-0">
                        {/* Bot head blue SVG or Icon */}
                        <div className="w-7 h-7 rounded-full bg-gradient-to-tr from-blue-100 to-indigo-105 flex items-center justify-center text-blue-600">
                          <Bot className="size-4" />
                        </div>
                      </div>
                    )}

                    {/* Chat Bubble Container */}
                    <div 
                      className={`relative px-4 py-3 rounded-2xl max-w-[80%] text-[13px] leading-relaxed shadow-sm font-sans ${
                        isBot 
                          ? "bg-gradient-to-br from-indigo-50/90 via-blue-50/90 to-cyan-50/90 text-slate-850 border border-slate-205 rounded-tl-sm text-left" 
                          : "bg-white text-slate-800 border border-slate-100 rounded-tr-sm text-left ml-auto"
                      }`}
                    >
                      <div className="space-y-1">
                        {renderMessageContent(message.content)}
                      </div>
                      <span className="text-[9px] text-slate-400 block mt-1.5 font-mono text-right opacity-80 select-none">
                        {message.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>

                    {/* User Avatar (Right side of user bubble, matching Image 2 profile layout) */}
                    {!isBot && (
                      <div className="w-9 h-9 rounded-full bg-slate-200 border border-slate-300 overflow-hidden flex-shrink-0 flex items-center justify-center shadow-sm">
                        {/* Circular photo representation or clean user head contour */}
                        <img 
                          src="https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&fit=crop&q=80" 
                          alt="User Portrait"
                          className="w-full h-full object-cover"
                          referrerPolicy="no-referrer"
                          onError={(e) => {
                            // Fallback if avatar fails to load
                            (e.target as any).style.display = 'none';
                          }}
                        />
                      </div>
                    )}

                  </div>
                );
              })}

              {/* Bot thinking bubble */}
              {loading && (
                <div className="flex items-start gap-2.5">
                  <div className="w-9 h-9 rounded-full bg-white flex items-center justify-center shadow-sm border border-slate-205 flex-shrink-0">
                    <div className="w-7 h-7 rounded-full bg-gradient-to-tr from-blue-100 to-indigo-105 flex items-center justify-center text-blue-600">
                      <Bot className="size-4" />
                    </div>
                  </div>
                  <div className="bg-gradient-to-br from-indigo-50/90 via-blue-50/90 to-cyan-50/90 border border-slate-205 text-[13px] text-slate-800 rounded-2xl rounded-tl-sm p-3 shadow-sm flex items-center gap-1 px-4">
                    <span className="w-1.5 h-1.5 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
                    <span className="w-1.5 h-1.5 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
                    <span className="w-1.5 h-1.5 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
                  </div>
                </div>
              )}

              <div ref={messagesEndRef} />
            </div>

            {/* Input Submission Footer Form */}
            <form 
              onSubmit={handleSendMessage}
              className="px-4 py-3 bg-white border-t border-slate-100 flex items-center gap-2"
            >
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Ask model explanation advice..."
                className="flex-1 bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-[13px] text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-indigo-500/50 focus:border-indigo-500 focus:bg-white transition-all font-sans"
              />
              <button
                type="submit"
                disabled={!input.trim() || loading}
                className="p-2.5 rounded-xl bg-gradient-to-r from-teal-500 to-emerald-500 hover:from-teal-600 hover:to-emerald-600 text-white disabled:opacity-40 disabled:cursor-not-allowed shadow transition-colors cursor-pointer flex-shrink-0"
              >
                <Send className="size-4" />
              </button>
            </form>

          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
