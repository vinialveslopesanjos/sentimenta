import React from "react";
import { Outlet } from "react-router";
import { TabBar } from "./TabBar";

export function MobileLayout() {
  return (
    <div className="w-full min-h-screen flex justify-center bg-slate-100">
      <div
        className="relative w-full max-w-[430px] min-h-screen bg-[#FDFBFF] overflow-hidden"
        style={{
          backgroundImage:
            "radial-gradient(circle at 5% 5%, rgba(103, 232, 249, 0.06) 0%, transparent 40%), radial-gradient(circle at 95% 95%, rgba(167, 139, 250, 0.06) 0%, transparent 40%)",
        }}
      >
        <Outlet />
        <TabBar />
      </div>
    </div>
  );
}
