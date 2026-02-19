import Link from "next/link";

interface LogoProps {
  size?: "sm" | "md" | "lg";
  linkTo?: string;
}

export default function Logo({ size = "md", linkTo = "/" }: LogoProps) {
  const sizes = {
    sm: { box: "w-8 h-8 rounded-xl", icon: 18, text: "text-xl" },
    md: { box: "w-10 h-10 rounded-2xl", icon: 22, text: "text-2xl" },
    lg: { box: "w-12 h-12 rounded-2xl", icon: 26, text: "text-3xl" },
  };
  const s = sizes[size];

  const content = (
    <div className="flex items-center gap-3">
      <div
        className={`${s.box} bg-gradient-to-tr from-cyan-200 to-violet-300 flex items-center justify-center shadow-lg shadow-violet-100 shrink-0`}
      >
        <svg
          fill="none"
          height={s.icon}
          stroke="white"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="2.5"
          viewBox="0 0 24 24"
          width={s.icon}
        >
          <path d="M3 17C3 17 7 22 12 19C17 16 18 10 22 8" />
        </svg>
      </div>
      <span className={`${s.text} font-sans font-medium tracking-tight text-slate-700`}>
        sentimenta
      </span>
    </div>
  );

  if (linkTo) {
    return <Link href={linkTo}>{content}</Link>;
  }
  return content;
}
