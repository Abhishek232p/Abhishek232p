import { Link, useLocation } from "wouter";
import { Bell, Compass, LayoutDashboard, Map, ShieldCheck, UserRound } from "lucide-react";
import { ReactNode } from "react";
import { useAuth } from "@/_core/hooks/useAuth";

const nav = [
  { href: "/learn", label: "Discover", icon: Compass },
  { href: "/learn/map", label: "Map", icon: Map },
  { href: "/learn/bookings", label: "Bookings", icon: LayoutDashboard },
  { href: "/profile", label: "Profile", icon: UserRound },
];

export function DrivenowLogo({ inverse = false }: { inverse?: boolean }) {
  return (
    <Link href="/" className={`inline-flex items-center gap-2.5 ${inverse ? "text-white" : "text-[#141414]"}`}>
      <span className="grid h-8 w-8 place-items-center border-2 border-current text-[10px] font-black tracking-[-0.2em]">DN</span>
      <span className="font-display text-xl font-extrabold tracking-[-0.07em]">drivenow</span>
    </Link>
  );
}

export function AppHeader({ eyebrow = "INDIA / ONE METRO" }: { eyebrow?: string }) {
  const { user, isAuthenticated } = useAuth();
  const [location] = useLocation();
  return (
    <header className="sticky top-0 z-40 border-b border-black/10 bg-[#e5e6e3]/90 backdrop-blur-md">
      <div className="container flex h-16 items-center justify-between gap-3">
        <DrivenowLogo />
        <div className="hidden items-center gap-4 text-[10px] font-bold tracking-[0.18em] text-black/55 sm:flex">
          <span>{eyebrow}</span>
          {isAuthenticated && user?.role === "admin" && <Link href="/admin" className={location.startsWith("/admin") ? "text-black" : "hover:text-black"}>ADMIN</Link>}
        </div>
        <Link href={isAuthenticated ? "/profile" : "/start"} className="grid h-9 w-9 place-items-center border border-black/15 bg-white transition hover:border-black">
          {isAuthenticated ? <Bell className="h-4 w-4" /> : <UserRound className="h-4 w-4" />}
        </Link>
      </div>
    </header>
  );
}

export function LearnerShell({ children, title, action }: { children: ReactNode; title?: string; action?: ReactNode }) {
  const [location] = useLocation();
  return (
    <div className="min-h-screen bg-[#e5e6e3] pb-24 text-[#141414]">
      <AppHeader eyebrow="LEARN / LOCAL INSTRUCTORS" />
      <main className="container py-6">
        {(title || action) && <div className="mb-6 flex items-end justify-between gap-3"><div><p className="eyebrow">LEARNER WORKSPACE</p><h1 className="font-display text-3xl font-extrabold tracking-[-0.06em]">{title}</h1></div>{action}</div>}
        {children}
      </main>
      <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-black/10 bg-[#f5f5f2]/95 px-3 pb-[max(0.5rem,env(safe-area-inset-bottom))] pt-2 backdrop-blur-md sm:hidden">
        <div className="mx-auto grid max-w-md grid-cols-4">
          {nav.map(item => {
            const Icon = item.icon;
            const active = location === item.href || (item.href === "/learn" && location.startsWith("/learn/instructor"));
            return <Link href={item.href} key={item.href} className={`flex min-h-12 flex-col items-center justify-center gap-1 text-[10px] font-bold ${active ? "text-black" : "text-black/45"}`}><Icon className="h-4 w-4" /><span>{item.label}</span></Link>;
          })}
        </div>
      </nav>
    </div>
  );
}

export function WorkspaceHeader({ mode, title, children }: { mode: "TEACH" | "ADMIN"; title: string; children?: ReactNode }) {
  return <div className="min-h-screen bg-[#141414] text-[#f5f5f2]">
    <header className="border-b border-white/15"><div className="container flex h-16 items-center justify-between"><DrivenowLogo inverse /><span className="rounded-full border border-white/20 px-3 py-1 text-[10px] font-bold tracking-[0.18em] text-white/70">{mode}</span></div></header>
    <main className="container py-7"><p className="eyebrow text-white/45">{mode} WORKSPACE</p><h1 className="mt-1 font-display text-4xl font-extrabold tracking-[-0.07em]">{title}</h1>{children}</main>
  </div>;
}

export function AccessDenied({ title = "Sign in to continue", description = "Use your drivenow account to access this workspace." }: { title?: string; description?: string }) {
  return <div className="grid min-h-[65vh] place-items-center px-5 text-center"><div className="max-w-sm"><div className="mx-auto mb-5 grid h-14 w-14 place-items-center border-2 border-black"><ShieldCheck className="h-6 w-6" /></div><h1 className="font-display text-3xl font-extrabold tracking-[-0.06em]">{title}</h1><p className="mt-3 text-sm leading-6 text-black/60">{description}</p><Link href="/start" className="btn-primary mt-6">Secure sign in</Link></div></div>;
}
