import React from "react";

export function StatusBar() {
  const now = new Date();
  const time = now.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });

  return (
    <div className="flex items-center justify-between px-6 pt-3 pb-1" style={{ fontFamily: "'Outfit', sans-serif" }}>
      <span className="text-[15px] text-slate-700" style={{ fontWeight: 600 }}>{time}</span>
      <div className="flex items-center gap-1">
        <div className="flex gap-[2px] items-end">
          <div className="w-[3px] h-[6px] bg-slate-700 rounded-sm" />
          <div className="w-[3px] h-[8px] bg-slate-700 rounded-sm" />
          <div className="w-[3px] h-[10px] bg-slate-700 rounded-sm" />
          <div className="w-[3px] h-[12px] bg-slate-300 rounded-sm" />
        </div>
        <svg width="16" height="12" viewBox="0 0 16 12" className="ml-1">
          <path d="M8 3.6C9.7 3.6 11.2 4.3 12.3 5.4L13.7 4C12.2 2.5 10.2 1.6 8 1.6C5.8 1.6 3.8 2.5 2.3 4L3.7 5.4C4.8 4.3 6.3 3.6 8 3.6Z" fill="#334155"/>
          <path d="M8 7.2C9 7.2 9.9 7.6 10.6 8.2L12 6.8C10.9 5.8 9.5 5.2 8 5.2C6.5 5.2 5.1 5.8 4 6.8L5.4 8.2C6.1 7.6 7 7.2 8 7.2Z" fill="#334155"/>
          <circle cx="8" cy="10" r="1.5" fill="#334155"/>
        </svg>
        <div className="ml-1 w-[22px] h-[10px] border border-slate-700 rounded-[3px] relative">
          <div className="absolute inset-[1px] right-[3px] bg-slate-700 rounded-[1px]" />
          <div className="absolute right-[-3px] top-[2px] w-[2px] h-[5px] bg-slate-700 rounded-r-sm" />
        </div>
      </div>
    </div>
  );
}
