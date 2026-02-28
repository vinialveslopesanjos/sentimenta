import React, { useState } from "react";
import { useNavigate } from "react-router";
import { motion } from "motion/react";
import { StatusBar } from "./StatusBar";
import { FogBackground } from "./FogBackground";
import { Eye, EyeOff, Mail, Lock, ArrowRight } from "lucide-react";
import { api } from "../../lib/api";

const ease = [0.22, 1, 0.36, 1] as const;

export function LoginScreen() {
  const navigate = useNavigate();
  const [isLogin, setIsLogin] = useState(true);
  const [showPassword, setShowPassword] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async () => {
    try {
      setLoading(true);
      setError("");
      if (isLogin) {
        const res = await api.auth.login(email, password);
        localStorage.setItem("sentimenta_access_token", res.access_token);
      } else {
        const res = await api.auth.register(email, password, "");
        localStorage.setItem("sentimenta_access_token", res.access_token);
      }
      navigate("/dashboard");
    } catch (err: any) {
      setError(err.message || "Something went wrong.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="w-full min-h-screen flex justify-center bg-[#FDFBFF]">
      <div className="relative w-full max-w-[430px] min-h-screen overflow-hidden flex flex-col">

        {/* Fog canvas — full background */}
        <FogBackground />

        <StatusBar />

        {/* Top branding — above the glass card */}
        <motion.div
          className="relative z-10 px-8 pt-10 pb-6 flex flex-col items-center text-center"
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, ease }}
        >
          {/* Logo mark */}
          <div
            className="w-14 h-14 rounded-[20px] mb-5 flex items-center justify-center"
            style={{
              background: "linear-gradient(135deg, #22D3EE 0%, #8B5CF6 100%)",
              boxShadow: "0 8px 32px rgba(139,92,246,0.28)",
            }}
          >
            <svg width="26" height="26" viewBox="0 0 26 26" fill="none">
              <path
                d="M2 14 C5 9, 9 18, 13 13 C17 8, 21 17, 24 12"
                stroke="white"
                strokeWidth="2.8"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </div>

          <span
            style={{
              fontFamily: "'Outfit', sans-serif",
              fontSize: "22px",
              fontWeight: 600,
              color: "#334155",
              letterSpacing: "-0.3px",
            }}
          >
            sentimenta
          </span>

          <motion.h1
            className="mt-5"
            style={{
              fontFamily: "'Outfit', sans-serif",
              fontSize: "28px",
              fontWeight: 700,
              color: "#1E293B",
              lineHeight: 1.22,
              letterSpacing: "-0.5px",
            }}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.12, ease }}
          >
            {isLogin ? "Escute o que\no mundo sente." : "Transforme ruido\nem clareza."}
          </motion.h1>

          <motion.p
            className="mt-2"
            style={{ fontSize: "14px", color: "#64748B", lineHeight: 1.5 }}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.22, duration: 0.5 }}
          >
            {isLogin
              ? "Clareza emocional em tempo real."
              : "Comece a entender seu publico agora."}
          </motion.p>
        </motion.div>

        {/* Frosted glass form panel */}
        <motion.div
          className="relative z-10 mx-4 mb-8 flex-1"
          initial={{ opacity: 0, y: 32 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.65, delay: 0.18, ease }}
        >
          <div
            className="rounded-[32px] p-6"
            style={{
              background: "rgba(255, 255, 255, 0.75)",
              backdropFilter: "blur(28px)",
              WebkitBackdropFilter: "blur(28px)",
              border: "1px solid rgba(255, 255, 255, 0.65)",
              boxShadow:
                "0 16px 64px rgba(196,181,253,0.22), 0 2px 8px rgba(139,92,246,0.08), inset 0 1px 0 rgba(255,255,255,0.8)",
            }}
          >
            {/* Toggle */}
            <div
              className="flex p-1 mb-6 rounded-2xl"
              style={{ background: "rgba(248, 250, 252, 0.8)" }}
            >
              {[
                { label: "Entrar", val: true },
                { label: "Criar conta", val: false },
              ].map(({ label, val }) => (
                <button
                  key={label}
                  onClick={() => setIsLogin(val)}
                  className="flex-1 py-2.5 rounded-xl transition-all"
                  style={{
                    fontFamily: "'Outfit', sans-serif",
                    fontSize: "14px",
                    fontWeight: 500,
                    background: isLogin === val ? "white" : "transparent",
                    color: isLogin === val ? "#7C3AED" : "#94A3B8",
                    boxShadow:
                      isLogin === val ? "0 2px 8px rgba(196,181,253,0.25)" : "none",
                  }}
                >
                  {label}
                </button>
              ))}
            </div>

            {/* Inputs */}
            <div className="space-y-3 mb-4">
              <div className="relative">
                <Mail
                  size={16}
                  className="absolute left-4 top-1/2 -translate-y-1/2"
                  style={{ color: "#C4B5FD" }}
                />
                <input
                  type="email"
                  placeholder="Seu email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full pl-11 pr-4 py-4 rounded-2xl text-slate-700 placeholder-slate-300 outline-none transition-all"
                  style={{
                    fontSize: "15px",
                    background: "rgba(248,250,252,0.7)",
                    border: "1.5px solid rgba(196,181,253,0.2)",
                  }}
                  onFocus={(e) =>
                    (e.target.style.borderColor = "rgba(139,92,246,0.4)")
                  }
                  onBlur={(e) =>
                    (e.target.style.borderColor = "rgba(196,181,253,0.2)")
                  }
                />
              </div>

              <div className="relative">
                <Lock
                  size={16}
                  className="absolute left-4 top-1/2 -translate-y-1/2"
                  style={{ color: "#C4B5FD" }}
                />
                <input
                  type={showPassword ? "text" : "password"}
                  placeholder="Sua senha"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full pl-11 pr-12 py-4 rounded-2xl text-slate-700 placeholder-slate-300 outline-none transition-all"
                  style={{
                    fontSize: "15px",
                    background: "rgba(248,250,252,0.7)",
                    border: "1.5px solid rgba(196,181,253,0.2)",
                  }}
                  onFocus={(e) =>
                    (e.target.style.borderColor = "rgba(139,92,246,0.4)")
                  }
                  onBlur={(e) =>
                    (e.target.style.borderColor = "rgba(196,181,253,0.2)")
                  }
                />
                <button
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-4 top-1/2 -translate-y-1/2"
                  style={{ color: "#C4B5FD" }}
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>

              {!isLogin && (
                <motion.div
                  className="relative"
                  initial={{ opacity: 0, y: -8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3 }}
                >
                  <Lock
                    size={16}
                    className="absolute left-4 top-1/2 -translate-y-1/2"
                    style={{ color: "#C4B5FD" }}
                  />
                  <input
                    type="password"
                    placeholder="Confirme sua senha"
                    className="w-full pl-11 pr-4 py-4 rounded-2xl text-slate-700 placeholder-slate-300 outline-none transition-all"
                    style={{
                      fontSize: "15px",
                      background: "rgba(248,250,252,0.7)",
                      border: "1.5px solid rgba(196,181,253,0.2)",
                    }}
                  />
                </motion.div>
              )}
            </div>

            {isLogin && (
              <button
                className="block mb-5"
                style={{ fontSize: "13px", color: "#8B5CF6", fontWeight: 500 }}
              >
                Esqueceu a senha?
              </button>
            )}

            {/* CTA */}
            <motion.button
              onClick={handleSubmit}
              className="w-full py-4 rounded-2xl text-white flex items-center justify-center gap-2.5 mb-5"
              style={{
                fontFamily: "'Outfit', sans-serif",
                fontSize: "16px",
                fontWeight: 600,
                background: "linear-gradient(135deg, #8B5CF6 0%, #22D3EE 100%)",
                boxShadow:
                  "0 8px 28px rgba(139,92,246,0.35), 0 2px 8px rgba(103,232,249,0.2), inset 0 1px 0 rgba(255,255,255,0.2)",
              }}
              whileTap={{ scale: 0.97 }}
            >
              {isLogin ? "Conectar" : "Criar conta"}
              <ArrowRight size={18} />
            </motion.button>

            {/* Divider */}
            <div className="flex items-center gap-3 mb-5">
              <div className="flex-1 h-px" style={{ background: "rgba(196,181,253,0.25)" }} />
              <span style={{ fontSize: "12px", color: "#94A3B8" }}>ou continue com</span>
              <div className="flex-1 h-px" style={{ background: "rgba(196,181,253,0.25)" }} />
            </div>

            {/* Google */}
            <motion.button
              className="w-full py-3.5 rounded-2xl flex items-center justify-center gap-3"
              style={{
                fontSize: "15px",
                color: "#475569",
                fontWeight: 500,
                background: "rgba(255,255,255,0.8)",
                border: "1.5px solid rgba(196,181,253,0.2)",
              }}
              whileTap={{ scale: 0.97 }}
            >
              <svg width="18" height="18" viewBox="0 0 24 24">
                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4" />
                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
              </svg>
              Google
            </motion.button>
          </div>

          <p
            className="text-center mt-4"
            style={{ fontSize: "11px", color: "#94A3B8" }}
          >
            Ao continuar, voce aceita nossos Termos e Politica de Privacidade.
          </p>
        </motion.div>
      </div>
    </div>
  );
}
