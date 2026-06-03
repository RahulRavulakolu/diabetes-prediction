import React, { useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';

// --- HELPER COMPONENTS (ICONS) ---

const GoogleIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 48 48">
        <path fill="#FFC107" d="M43.611 20.083H42V20H24v8h11.303c-1.649 4.657-6.08 8-11.303 8-6.627 0-12-5.373-12-12s12-5.373 12-12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4 12.955 4 4 12.955 4 24s8.955 20 20 20 20-8.955 20-20c0-2.641-.21-5.236-.611-7.743z" />
        <path fill="#FF3D00" d="M6.306 14.691l6.571 4.819C14.655 15.108 18.961 12 24 12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4 16.318 4 9.656 8.337 6.306 14.691z" />
        <path fill="#4CAF50" d="M24 44c5.166 0 9.86-1.977 13.409-5.192l-6.19-5.238C29.211 35.091 26.715 36 24 36c-5.202 0-9.619-3.317-11.283-7.946l-6.522 5.025C9.505 39.556 16.227 44 24 44z" />
        <path fill="#1976D2" d="M43.611 20.083H42V20H24v8h11.303c-.792 2.237-2.231 4.166-4.087 5.571l6.19 5.238C42.022 35.026 44 30.038 44 24c0-2.641-.21-5.236-.611-7.743z" />
    </svg>
);


// --- TYPE DEFINITIONS ---

export interface Testimonial {
  avatarSrc: string;
  name: string;
  handle: string;
  text: string;
}

interface SignInPageProps {
  title?: React.ReactNode;
  description?: React.ReactNode;
  heroImageSrc?: string;
  testimonials?: Testimonial[];
  onSignIn?: (event: React.FormEvent<HTMLFormElement>) => void;
  onGoogleSignIn?: () => void;
  onResetPassword?: () => void;
  onCreateAccount?: (event: React.FormEvent<HTMLFormElement>) => void;
}

// --- SUB-COMPONENTS ---

const GlassInputWrapper = ({ children }: { children: React.ReactNode }) => (
  <div className="rounded-2xl border border-slate-800 bg-[#14171c] transition-colors focus-within:border-emerald-500/50 focus-within:bg-[#14171c]">
    {children}
  </div>
);

const TestimonialCard = ({ testimonial, delay }: { testimonial: Testimonial, delay: string }) => (
  <div className={`animate-testimonial ${delay} flex items-start gap-3 rounded-3xl bg-[#14171c] border border-slate-800 p-5 w-64 shadow-xl shadow-black/80`}>
    <img src={testimonial.avatarSrc} className="h-10 w-10 object-cover rounded-2xl" alt="avatar" />
    <div className="text-sm leading-snug">
      <p className="flex items-center gap-1 font-serif italic text-emerald-400 font-medium">{testimonial.name}</p>
      <p className="text-xs text-slate-500">{testimonial.handle}</p>
      <p className="mt-1 text-slate-300 text-xs">{testimonial.text}</p>
    </div>
  </div>
);

// --- MAIN COMPONENT ---

export const SignInPage: React.FC<SignInPageProps> = ({
  title = <span className="font-light text-foreground tracking-tighter">Welcome</span>,
  description = "Access your account and continue your journey with us",
  heroImageSrc,
  testimonials = [],
  onSignIn,
  onGoogleSignIn,
  onResetPassword,
  onCreateAccount,
}) => {
  const [showPassword, setShowPassword] = useState(false);
  const [isSignUp, setIsSignUp] = useState(false);

  return (
    <div className="h-[100dvh] flex flex-col md:flex-row bg-[#0a0b0e] w-[100dvw]">
      {/* Left column: sign-in form */}
      <section className="flex-1 flex items-center justify-center p-8 bg-[#0a0b0e]">
        <div className="w-full max-w-md">
          <div className="flex flex-col gap-6">
            <h1 className="animate-element animate-delay-100 text-3xl md:text-4xl font-serif italic font-semibold leading-tight text-emerald-400">
              {isSignUp ? "Create Account" : title}
            </h1>
            <p className="animate-element animate-delay-200 text-slate-400 text-sm">
              {isSignUp ? "Register for clinical platform access" : description}
            </p>

            <form className="space-y-5" onSubmit={isSignUp ? onCreateAccount : onSignIn}>
              {isSignUp && (
                <div className="animate-element animate-delay-250">
                  <label className="text-xs font-medium text-slate-400 mb-1 block">Full Name</label>
                  <GlassInputWrapper>
                    <input name="name" type="text" placeholder="Dr. John Doe" className="w-full bg-transparent text-sm p-4 rounded-2xl focus:outline-none text-white placeholder-slate-600" required />
                  </GlassInputWrapper>
                </div>
              )}
              <div className="animate-element animate-delay-300">
                <label className="text-xs font-medium text-slate-400 mb-1 block">Email Address</label>
                <GlassInputWrapper>
                  <input name="email" type="email" placeholder="Enter your email address" className="w-full bg-transparent text-sm p-4 rounded-2xl focus:outline-none text-white placeholder-slate-600" />
                </GlassInputWrapper>
              </div>

              <div className="animate-element animate-delay-400">
                <label className="text-xs font-medium text-slate-400 mb-1 block">Password</label>
                <GlassInputWrapper>
                  <div className="relative">
                    <input name="password" type={showPassword ? 'text' : 'password'} placeholder="Enter your password" className="w-full bg-transparent text-sm p-4 pr-12 rounded-2xl focus:outline-none text-white placeholder-slate-600" />
                    <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute inset-y-0 right-3 flex items-center">
                      {showPassword ? <EyeOff className="w-5 h-5 text-slate-400 hover:text-white transition-colors" /> : <Eye className="w-5 h-5 text-slate-400 hover:text-white transition-colors" />}
                    </button>
                  </div>
                </GlassInputWrapper>
              </div>

              {!isSignUp && (
                <div className="animate-element animate-delay-500 flex items-center justify-between text-xs">
                  <label className="flex items-center gap-3 cursor-pointer">
                    <input type="checkbox" name="rememberMe" className="custom-checkbox" />
                    <span className="text-slate-400">Keep me signed in</span>
                  </label>
                  <a href="#" onClick={(e) => { e.preventDefault(); onResetPassword?.(); }} className="hover:underline text-emerald-400 transition-colors">Reset password</a>
                </div>
              )}

              <button type="submit" className="animate-element animate-delay-600 w-full rounded-2xl bg-emerald-500 text-black py-4 font-bold hover:bg-emerald-400 transition-all cursor-pointer">
                {isSignUp ? "Sign Up" : "Sign In"}
              </button>
            </form>

            <div className="animate-element animate-delay-700 relative flex items-center justify-center">
              <span className="w-full border-t border-slate-800"></span>
              <span className="px-4 text-xs text-slate-500 bg-[#0a0b0e] absolute">Or continue with</span>
            </div>

            <button onClick={onGoogleSignIn} className="animate-element animate-delay-800 w-full flex items-center justify-center gap-3 border border-slate-800 rounded-2xl py-4 hover:bg-slate-900 transition-all cursor-pointer text-slate-300 text-sm">
                <GoogleIcon />
                Continue with Google
            </button>

            <p className="animate-element animate-delay-900 text-center text-xs text-slate-500">
              {isSignUp ? (
                <>Already have an account? <a href="#" onClick={(e) => { e.preventDefault(); setIsSignUp(false); }} className="text-emerald-400 hover:underline transition-colors font-medium">Sign In</a></>
              ) : (
                <>New to our platform? <a href="#" onClick={(e) => { e.preventDefault(); setIsSignUp(true); }} className="text-emerald-400 hover:underline transition-colors font-medium">Create Account</a></>
              )}
            </p>
          </div>
        </div>
      </section>

      {/* Right column: hero image + testimonials */}
      {heroImageSrc && (
        <section className="hidden md:block flex-1 relative p-4 bg-[#0f1116] border-l border-slate-800">
          <div className="absolute inset-4 rounded-3xl bg-cover bg-center opacity-30" style={{ backgroundImage: `url(${heroImageSrc})` }}></div>
          {testimonials.length > 0 && (
            <div className="absolute bottom-8 left-1/2 -translate-x-1/2 flex gap-4 px-8 w-full justify-center">
              <TestimonialCard testimonial={testimonials[0]} delay="animate-delay-1000" />
              {testimonials[1] && <div className="hidden xl:flex"><TestimonialCard testimonial={testimonials[1]} delay="animate-delay-1200" /></div>}
              {testimonials[2] && <div className="hidden 2xl:flex"><TestimonialCard testimonial={testimonials[2]} delay="animate-delay-1400" /></div>}
            </div>
          )}
        </section>
      )}
    </div>
  );
};
