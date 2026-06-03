"use client";
import React, { useState, useEffect } from 'react';
import { 
  Home, 
  User, 
  Settings, 
  LogOut, 
  Menu, 
  X, 
  ChevronLeft, 
  ChevronRight,
  BarChart3,
  FileText,
  Bell,
  Search,
  HelpCircle,
  Activity,
  Heart,
  TrendingUp,
  Sliders,
  Flame
} from 'lucide-react';

interface NavigationItem {
  id: string;
  name: string;
  icon: React.ComponentType<{ className?: string }>;
  href: string;
  badge?: string;
}

interface SidebarProps {
  className?: string;
  activeTab?: string;
  onTabChange?: (tabId: string) => void;
  userEmail?: string;
  userName?: string;
}

const navigationItems: NavigationItem[] = [
  { id: "dashboard", name: "Quick Overview", icon: Home, href: "#" },
  { id: "diabetes", name: "Diabetes Predictor", icon: Activity, href: "#" },
  { id: "heart", name: "Heart Predictor", icon: Heart, href: "#" },
  { id: "symptoms", name: "Symptom Analyzer", icon: Sliders, href: "#" },
  { id: "shap", name: "SHAP Explainability", icon: BarChart3, href: "#" },
  { id: "drift", name: "Data Drift & Insights", icon: TrendingUp, href: "#" },
];

export function Sidebar({ className = "", activeTab = "dashboard", onTabChange, userEmail = "clinical-user@health.io", userName = "Resident MD" }: SidebarProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [activeItem, setActiveItem] = useState(activeTab);

  useEffect(() => {
    setActiveItem(activeTab);
  }, [activeTab]);

  // Auto-open sidebar on desktop
  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth >= 768) {
        setIsOpen(true);
      } else {
        setIsOpen(false);
      }
    };
    
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const toggleSidebar = () => setIsOpen(!isOpen);
  const toggleCollapse = () => setIsCollapsed(!isCollapsed);

  const handleItemClick = (itemId: string) => {
    setActiveItem(itemId);
    if (onTabChange) {
      onTabChange(itemId);
    }
    if (window.innerWidth < 768) {
      setIsOpen(false);
    }
  };

  return (
    <>
      {/* Mobile hamburger button */}
      <button
        onClick={toggleSidebar}
        className="fixed top-3 left-4 z-50 p-2 rounded-lg bg-zinc-900 text-zinc-50 dark:bg-white dark:text-zinc-900 shadow-md border border-zinc-800 md:hidden hover:opacity-90 transition-all duration-200 cursor-pointer"
        aria-label="Toggle sidebar"
      >
        {isOpen ? 
          <X className="h-5 w-5" /> : 
          <Menu className="h-5 w-5" />
        }
      </button>

      {/* Mobile overlay */}
      {isOpen && (
        <div 
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-35 md:hidden transition-opacity duration-300" 
          onClick={toggleSidebar} 
        />
      )}

      {/* Sidebar */}
      <div
        className={`
          fixed top-0 left-0 h-full md:h-auto bg-[#0f1116] border-r border-slate-800 z-40 transition-all duration-300 ease-in-out flex flex-col
          ${isOpen ? "translate-x-0" : "-translate-x-full"}
          ${isCollapsed ? "w-24" : "w-72"}
          md:translate-x-0 md:static md:z-auto
          ${className}
        `}
      >
        {/* Header with logo and collapse button */}
        <div className="flex items-center justify-between p-5 border-b border-slate-800 bg-[#0f1116]">
          {!isCollapsed && (
            <div className="flex items-center space-x-2.5">
              <div className="w-9 h-9 bg-emerald-500/10 border border-emerald-500/20 rounded-lg flex items-center justify-center shadow-sm">
                <span className="text-emerald-400 font-bold text-base">H</span>
              </div>
              <div className="flex flex-col">
                <span className="font-serif italic text-emerald-400 font-medium tracking-tight text-lg">HealthGuard AI</span>
                <span className="text-xs text-slate-500">Multi-Disease Platform</span>
              </div>
            </div>
          )}

          {isCollapsed && (
            <div className="w-9 h-9 bg-emerald-500/10 border border-emerald-500/20 rounded-lg flex items-center justify-center mx-auto shadow-sm">
              <span className="text-emerald-400 font-bold text-base">H</span>
            </div>
          )}

          {/* Desktop collapse button */}
          <button
            onClick={toggleCollapse}
            className="hidden md:flex p-1.5 rounded-md hover:bg-slate-900 transition-all duration-200 cursor-pointer text-slate-400 hover:text-white"
            aria-label={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            {isCollapsed ? (
              <ChevronRight className="h-4 w-4 text-slate-500" />
            ) : (
              <ChevronLeft className="h-4 w-4 text-slate-500" />
            )}
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-grow px-3 py-4 overflow-y-auto bg-[#0f1116]">
          <p className={`text-[10px] font-bold uppercase tracking-wider text-slate-500 px-3 mb-2 ${isCollapsed ? 'text-center' : ''}`}>
            {isCollapsed ? '🔬' : 'Clinical Features'}
          </p>
          <ul className="space-y-1">
            {navigationItems.map((item) => {
              const Icon = item.icon;
              const isActive = activeItem === item.id;

              return (
                <li key={item.id}>
                  <button
                    onClick={() => handleItemClick(item.id)}
                    className={`
                      w-full flex items-center space-x-2.5 px-3 py-3 rounded-xl text-left transition-all duration-200 group relative cursor-pointer
                      ${isActive
                        ? "bg-emerald-500/10 text-emerald-400 border-l-4 border-emerald-500"
                        : "text-slate-400 hover:bg-slate-900 hover:text-white"
                      }
                      ${isCollapsed ? "justify-center px-1" : ""}
                    `}
                    title={isCollapsed ? item.name : undefined}
                  >
                    <div className="flex items-center justify-center min-w-[24px]">
                      <Icon
                        className={`
                          h-5 w-5 flex-shrink-0
                          ${isActive 
                            ? "text-emerald-400" 
                            : "text-slate-500 group-hover:text-slate-300"
                          }
                        `}
                      />
                    </div>
                    
                    {!isCollapsed && (
                      <div className="flex items-center justify-between w-full">
                        <span className={`text-sm ${isActive ? "font-semibold" : "font-normal"}`}>{item.name}</span>
                        {item.badge && (
                          <span className={`
                            px-1.5 py-0.5 text-xs font-medium rounded-full
                            ${isActive
                              ? "bg-emerald-500/20 text-emerald-400"
                              : "bg-slate-800 text-slate-400"
                            }
                          `}>
                            {item.badge}
                          </span>
                        )}
                      </div>
                    )}

                    {/* Tooltip for collapsed state */}
                    {isCollapsed && (
                      <div className="absolute left-full ml-2 px-2.5 py-1 bg-slate-950 text-white text-xs rounded opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 whitespace-nowrap z-50 shadow-md">
                        {item.name}
                        <div className="absolute left-0 top-1/2 transform -translate-y-1/2 -translate-x-1 w-1.5 h-1.5 bg-slate-950 rotate-45" />
                      </div>
                    )}
                  </button>
                </li>
              );
            })}
          </ul>
        </nav>

        {/* Bottom profile and credentials section */}
        <div className="mt-auto border-t border-slate-800 bg-[#0f1116]">
          <div className={`border-b border-slate-800 ${isCollapsed ? 'py-3 px-1' : 'p-3'}`}>
            {!isCollapsed ? (
              <div className="flex items-center px-3 py-2 rounded-lg bg-[#14171c] border border-slate-850">
                <div className="w-8 h-8 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center justify-center font-medium text-xs uppercase">
                  {userName.substring(0, 2)}
                </div>
                <div className="flex-1 min-w-0 ml-2.5">
                  <p className="text-sm font-semibold text-slate-200 truncate">{userName}</p>
                  <p className="text-[10px] text-slate-500 truncate">{userEmail}</p>
                </div>
                <div className="w-2.5 h-2.5 bg-emerald-500 rounded-full ml-1" title="Clinician online" />
              </div>
            ) : (
              <div className="flex justify-center">
                <div className="relative">
                  <div className="w-9 h-9 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center justify-center font-medium text-sm shadow-md uppercase">
                    {userName.substring(0, 2)}
                  </div>
                  <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-emerald-500 rounded-full border border-[#0f1116]" />
                </div>
              </div>
            )}
          </div>

          {/* Settings / Log Out simulated button */}
          <div className="p-3">
            <button
              onClick={() => handleItemClick("logout")}
              className={`
                w-full flex items-center rounded-xl text-left transition-all duration-200 group cursor-pointer
                text-rose-400 hover:bg-rose-500/10 hover:text-rose-505
                ${isCollapsed ? "justify-center p-2.5" : "space-x-2.5 px-3 py-3"}
              `}
              title={isCollapsed ? "Logout/Switch User" : undefined}
            >
              <div className="flex items-center justify-center min-w-[24px]">
                <LogOut className="h-5 w-5 flex-shrink-0 text-rose-400 group-hover:text-rose-500" />
              </div>
              
              {!isCollapsed && (
                <span className="text-sm font-semibold">Switch User / Access</span>
              )}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
