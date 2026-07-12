import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { Navigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";
import {
  Sparkles,
  Zap,
  Clock,
  CheckCircle2,
  Rocket,
  ShieldCheck,
  ArrowRight,
  Loader2,
  Lock,
  Mail,
  Eye,
  EyeOff,
  Coffee,
  Target
} from "lucide-react";

export default function Login() {
  const { user, login } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  if (user) return <Navigate to="/" replace />;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const ok = await login(email.trim(), password);
      if (ok) toast.success("Good to see you! Let's have a great day.");
      else toast.error("Quick check: The email or password doesn't match.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative min-h-screen w-full overflow-x-hidden bg-[#050A15] font-sans selection:bg-indigo-500/30">
      {/* Dynamic Background — scales down on smaller laptops */}
      <div className="absolute inset-0 z-0">
        <div className="absolute top-[-5%] right-[-5%] h-[min(600px,90vw)] w-[min(600px,90vw)] max-lg:h-[420px] max-lg:w-[420px] rounded-full bg-indigo-600/10 blur-[120px] lg:blur-[100px]" />
        <div className="absolute bottom-[5%] left-[-5%] h-[min(500px,80vw)] w-[min(500px,80vw)] max-lg:h-[360px] max-lg:w-[360px] rounded-full bg-violet-600/10 blur-[100px] lg:blur-[80px]" />
      </div>

      <div
        className="relative z-10 mx-auto flex w-full max-w-7xl min-w-0 flex-col items-center justify-center gap-8 px-4 py-8 sm:gap-10 sm:px-6 sm:py-10 md:gap-12 md:py-12 lg:min-h-screen lg:flex-row lg:items-center lg:justify-between lg:gap-6 lg:px-6 lg:py-8 xl:gap-10 xl:px-10 xl:py-10 2xl:gap-14 2xl:px-12 [@media(max-height:700px)]:lg:py-5 [@media(max-height:700px)]:lg:gap-5"
      >
        {/* Left Side: Employee Motivation & Value */}
        <motion.div
          initial={{ opacity: 0, x: -30 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.8, ease: "easeOut" }}
          className="flex w-full min-w-0 flex-1 flex-col justify-center text-white lg:max-w-[min(100%,36rem)] lg:pr-2 xl:max-w-xl xl:pr-4 2xl:max-w-2xl [@media(max-height:700px)]:lg:max-w-none"
        >
          <div className="mb-4 flex items-center gap-3 sm:mb-6">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-500 to-violet-600 shadow-xl shadow-indigo-500/20 sm:h-12 sm:w-12">
              <Rocket className="h-5 w-5 text-white sm:h-6 sm:w-6" />
            </div>
            <div className="min-w-0">
              <span className="block text-[10px] font-bold uppercase tracking-[0.2em] text-indigo-400 sm:text-xs">
                Your Workspace
              </span>
              <span className="text-lg font-bold tracking-tight sm:text-xl">CRM</span>
            </div>
          </div>

          <h1 className="text-[2rem] font-extrabold leading-[1.12] tracking-tight sm:text-4xl sm:leading-tight md:text-5xl lg:text-[2.75rem] lg:leading-[1.08] xl:text-5xl xl:leading-[1.08] 2xl:text-6xl 2xl:leading-[1.06] [@media(max-height:700px)]:lg:text-[2.25rem] min-[1600px]:text-7xl min-[1600px]:leading-[1.1]">
            Build your <br />
            <span className="bg-gradient-to-r from-indigo-300 via-white to-violet-300 bg-clip-text text-transparent">
              best work today.
            </span>
          </h1>

          <p className="mt-5 max-w-xl text-base leading-relaxed text-slate-400 sm:mt-6 sm:text-lg lg:mt-6 lg:max-w-none lg:text-base xl:mt-8 xl:text-lg 2xl:max-w-xl 2xl:text-xl [@media(max-height:700px)]:mt-4 [@media(max-height:700px)]:lg:text-sm">
            Bring deals, contacts, companies, and tasks into one CRM—so your team sees the full customer
            story, stays on top of follow-ups, and keeps HR and finance in sync without jumping between
            tools.
          </p>

          {/* Productivity Stats — compact cards */}
          <div className="mt-5 grid w-full min-w-0 max-w-xl grid-cols-2 gap-2.5 sm:mt-6 sm:gap-3 lg:mt-6 lg:max-w-lg xl:max-w-xl 2xl:max-w-xl [@media(max-height:700px)]:mt-4 [@media(max-height:700px)]:lg:max-w-md">
            {[
              { 
                icon: Clock, 
                title: "Save 2h Daily", 
                desc: "Automated logging means no more manual data entry at EOD.",
                color: "text-emerald-400" 
              },
              { 
                icon: Target, 
                title: "Clear Priorities", 
                desc: "Your top 3 tasks are always front and center when you log in.",
                color: "text-amber-400"
              },
              { 
                icon: Sparkles, 
                title: "Seamless Flow", 
                desc: "Switch between CRM and HR tasks without losing your place.",
                color: "text-indigo-400"
              },
              { 
                icon: Coffee, 
                title: "Focus Mode", 
                desc: "Notification filtering helps you stay in the deep-work zone.",
                color: "text-rose-400"
              },
            ].map((item, i) => (
              <div
                key={i}
                className="group relative rounded-lg border border-white/5 bg-white/[0.02] p-3 transition-all hover:bg-white/[0.05] sm:rounded-xl sm:p-3.5"
              >
                <item.icon className={`mb-1.5 h-4 w-4 sm:mb-2 sm:h-[1.125rem] sm:w-[1.125rem] ${item.color}`} />
                <h3 className="text-xs font-semibold leading-tight text-slate-100 sm:text-[13px]">{item.title}</h3>
                <p className="mt-1 line-clamp-3 text-[11px] leading-snug text-slate-500 sm:text-xs sm:leading-relaxed">
                  {item.desc}
                </p>
              </div>
            ))}
          </div>

          <div className="mt-6 flex flex-wrap items-center gap-3 text-xs font-medium text-slate-400 sm:mt-8 sm:gap-4 sm:text-sm lg:mt-7 xl:mt-10 xl:gap-6 [@media(max-height:700px)]:mt-5">
            <span className="flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 shrink-0 text-indigo-400" /> SSO Protected
            </span>
            <span className="flex items-center gap-2">
              <Zap className="h-4 w-4 shrink-0 text-indigo-400" /> Lightning Fast
            </span>
          </div>
        </motion.div>

        {/* Right Side: Clean Login Card */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5, delay: 0.2 }}
          className="w-full min-w-0 shrink-0 max-w-md lg:w-[min(100%,24rem)] lg:max-w-none xl:w-[min(100%,28rem)] 2xl:max-w-md"
        >
          <div className="relative rounded-3xl border border-white/10 bg-[#0A1222]/80 p-6 shadow-3xl backdrop-blur-2xl sm:rounded-[2rem] sm:p-8 lg:p-7 xl:rounded-[2.5rem] xl:p-9 2xl:p-10 [@media(max-height:700px)]:p-5 [@media(max-height:700px)]:lg:p-6">
            <div className="mb-6 text-center sm:mb-8 lg:mb-7 xl:mb-10 [@media(max-height:700px)]:mb-5">
              <h2 className="text-2xl font-bold text-white sm:text-3xl lg:text-2xl xl:text-3xl [@media(max-height:700px)]:text-xl">
                Ready to start?
              </h2>
              <p className="mt-2 text-sm text-slate-400 sm:mt-3 sm:text-base lg:text-sm xl:text-base [@media(max-height:700px)]:mt-1.5 [@media(max-height:700px)]:text-xs">
                Sign in to access your daily mission.
              </p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4 sm:space-y-5 lg:space-y-4 xl:space-y-6 [@media(max-height:700px)]:space-y-3">
              <div className="space-y-2">
                <Label htmlFor="email" className="text-sm font-medium text-slate-300 ml-1">Work Email</Label>
                <div className="group relative">
                  <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500 transition-colors group-focus-within:text-indigo-400 sm:left-4 sm:h-5 sm:w-5" />
                  <Input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="name@company.com"
                    className="h-12 rounded-xl border-white/5 bg-white/[0.03] pl-11 text-base text-white transition-all focus:border-indigo-500/50 focus:ring-indigo-500/20 sm:h-14 sm:rounded-2xl sm:pl-12 lg:h-12 lg:text-[15px] xl:h-14 xl:text-base"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between px-1">
                  <Label htmlFor="password" className="text-sm font-medium text-slate-300">Password</Label>
                </div>
                <div className="group relative">
                  <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500 transition-colors group-focus-within:text-indigo-400 sm:left-4 sm:h-5 sm:w-5" />
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="h-12 rounded-xl border-white/5 bg-white/[0.03] pl-11 pr-11 text-base text-white transition-all focus:border-indigo-500/50 focus:ring-indigo-500/20 sm:h-14 sm:rounded-2xl sm:pl-12 sm:pr-12 lg:h-12 lg:text-[15px] xl:h-14 xl:text-base"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-white sm:right-4"
                  >
                    {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                  </button>
                </div>
              </div>

              <div className="flex items-center justify-between px-1">
                <div className="flex items-center space-x-2">
                  <Checkbox id="remember" className="rounded-md border-white/20 data-[state=checked]:bg-indigo-600" />
                  <label htmlFor="remember" className="text-sm text-slate-400 cursor-pointer select-none">Keep me signed in</label>
                </div>
                <button type="button" className="text-sm font-medium text-indigo-400 hover:text-indigo-300">Forgot password?</button>
              </div>

              <Button
                type="submit"
                disabled={loading}
                className="h-12 w-full rounded-xl bg-indigo-600 text-base font-bold text-white transition-all hover:bg-indigo-500 hover:shadow-lg hover:shadow-indigo-500/25 active:scale-[0.98] sm:h-14 sm:rounded-2xl sm:text-lg lg:h-12 lg:text-base xl:h-14 xl:text-lg"
              >
                {loading ? (
                  <div className="flex items-center gap-2">
                    <Loader2 className="h-5 w-5 animate-spin" /> Preparing workspace...
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    Start My Day <ArrowRight className="h-5 w-5" />
                  </div>
                )}
              </Button>
            </form>
          </div>
        </motion.div>
      </div>
    </div>
  );
}