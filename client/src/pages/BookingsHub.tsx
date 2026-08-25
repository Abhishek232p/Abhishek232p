import { useAuth } from "@/_core/hooks/useAuth";
import { AccessDenied, LearnerShell } from "@/components/DrivenowShell";
import { cn } from "@/lib/utils";
import { trpc } from "@/lib/trpc";
import { ArrowRight, Check, Clock3, CreditCard, Loader2 } from "lucide-react";
import { Link } from "wouter";

const currency = new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 });

export default function BookingsHub() {
  const { isAuthenticated, loading } = useAuth();
  const { data: rows = [], isLoading } = trpc.marketplace.learn.myBookings.useQuery(undefined, { enabled: isAuthenticated });
  if (loading) return <div className="grid min-h-screen place-items-center bg-[#e5e6e3] text-[10px] font-bold tracking-[0.18em]">LOADING BOOKINGS</div>;
  if (!isAuthenticated) return <div className="min-h-screen bg-[#e5e6e3]"><AccessDenied /></div>;
  return <LearnerShell title="My bookings">{isLoading ? <div className="border border-black/15 bg-[#f5f5f2] p-5 text-sm text-black/55">Loading your booking route…</div> : rows.length === 0 ? <div className="border-2 border-black bg-[#f5f5f2] p-7"><p className="eyebrow">NO BOOKINGS YET</p><h2 className="mt-2 font-display text-3xl font-extrabold tracking-[-0.07em]">YOUR FIRST LESSON STARTS WITH A LOCAL MATCH.</h2><Link href="/learn" className="btn-primary mt-6">Discover instructors <ArrowRight className="h-4 w-4" /></Link></div> : <div className="space-y-3">{rows.map(({ booking, instructorName }) => <Link key={booking.id} href={`/learn/bookings/${booking.id}`} className="group block border border-black/15 bg-[#f5f5f2] p-4 transition hover:border-black hover:bg-white"><div className="flex flex-wrap items-start justify-between gap-3"><div><p className="eyebrow">{booking.bookingStatus.replaceAll("_", " ")}</p><h2 className="mt-1 font-display text-xl font-bold tracking-[-0.05em]">{booking.packageName}</h2><p className="mt-1 text-sm text-black/60">with {instructorName}</p></div><span className={cn("inline-flex items-center gap-1 border px-2 py-1 text-[9px] font-bold tracking-[0.11em]", booking.paymentStatus === "paid" ? "border-[#3d6854]/30 bg-[#d8e6d9] text-[#23412f]" : booking.paymentStatus === "failed" || booking.paymentStatus === "refunded" ? "border-red-700/25 bg-red-50 text-red-800" : "border-amber-700/30 bg-amber-50 text-amber-900")}><CreditCard className="h-3 w-3" />{booking.paymentStatus}</span></div><div className="mt-4 flex items-center justify-between border-t border-black/10 pt-3 text-xs text-black/60"><span className="inline-flex items-center gap-2"><Clock3 className="h-3.5 w-3.5" />{new Date(booking.scheduledStart).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })}</span><span className="inline-flex items-center gap-2 font-bold text-black">View timeline <ArrowRight className="h-4 w-4 transition group-hover:translate-x-1" /></span></div></Link>)}</div>}</LearnerShell>;
}
