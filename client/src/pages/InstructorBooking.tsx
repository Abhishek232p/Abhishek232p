import { useAuth } from "@/_core/hooks/useAuth";
import { AccessDenied, LearnerShell } from "@/components/DrivenowShell";
import { MapView } from "@/components/Map";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { trpc } from "@/lib/trpc";
import { ArrowLeft, ArrowRight, Check, Clock3, CreditCard, Loader2, MapPin, ShieldCheck } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Link, useLocation, useRoute } from "wouter";

type PickupPoint = { address: string; lat: number; lng: number };
const days = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const currency = new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 });
const inr = (paise: number) => currency.format(paise / 100);

function nextDateForDay(day: number, time: string) {
  const date = new Date();
  const offset = (day - date.getDay() + 7) % 7 || 7;
  date.setDate(date.getDate() + offset);
  const [hours, minutes] = time.split(":").map(Number);
  date.setHours(hours, minutes, 0, 0);
  return date;
}

export default function InstructorBooking() {
  const { isAuthenticated, loading } = useAuth();
  const [, params] = useRoute("/learn/instructor/:id");
  const instructorUserId = Number(params?.id);
  const profile = trpc.marketplace.learn.instructor.useQuery({ instructorUserId }, { enabled: Number.isInteger(instructorUserId) && instructorUserId > 0 });
  const createBooking = trpc.marketplace.learn.createBooking.useMutation();
  const [, navigate] = useLocation();
  const [packageCode, setPackageCode] = useState<"trial" | "starter" | "license_path">("trial");
  const [slotId, setSlotId] = useState<number | null>(null);
  const [pickup, setPickup] = useState<PickupPoint>({ address: "", lat: 0, lng: 0 });
  const [note, setNote] = useState("");
  const selectedSlot = profile.data?.slots.find(slot => slot.id === slotId) || profile.data?.slots[0];
  const selectedPackage = profile.data?.packages.find(item => item.code === packageCode) || profile.data?.packages[0];
  useEffect(() => {
    if (profile.data?.slots.length && slotId === null) setSlotId(profile.data.slots[0].id);
  }, [profile.data?.slots, slotId]);
  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem("drivenow-pickup-point") || "null") as PickupPoint;
      if (saved?.address) setPickup(saved);
    } catch { /* Map selection is optional. */ }
  }, []);
  if (loading) return <div className="grid min-h-screen place-items-center bg-[#e5e6e3] text-[10px] font-bold tracking-[0.18em]">LOADING BOOKING</div>;
  if (!isAuthenticated) return <div className="min-h-screen bg-[#e5e6e3]"><AccessDenied /></div>;
  if (profile.isLoading || !profile.data) return <LearnerShell title="Book a lesson"><p className="text-sm text-black/55">Loading verified instructor availability…</p></LearnerShell>;
  const { profile: instructor, packages, slots } = profile.data;
  if (!slots.length) return <LearnerShell title="Book a lesson"><Link href="/learn" className="btn-quiet"><ArrowLeft className="h-4 w-4" /> Back to discovery</Link><div className="mt-6 border-2 border-black bg-[#f5f5f2] p-6"><p className="eyebrow">AVAILABILITY</p><h2 className="mt-2 font-display text-3xl font-extrabold tracking-[-0.07em]">NO OPEN WEEKLY WINDOWS YET.</h2><p className="mt-3 text-sm leading-6 text-black/60">This instructor has not published a bookable schedule. Choose another local instructor or check again later.</p></div></LearnerShell>;
  const scheduledStart = selectedSlot ? nextDateForDay(selectedSlot.dayOfWeek ?? 1, selectedSlot.startTime) : null;
  const fee = selectedPackage ? Math.round(selectedPackage.pricePaise * 0.18) : 0;
  return <LearnerShell title="Build your booking"><Link href="/learn" className="mb-5 inline-flex items-center gap-2 text-[10px] font-extrabold tracking-[0.15em] text-black/55"><ArrowLeft className="h-3.5 w-3.5" /> DISCOVER</Link><section className="border-2 border-black bg-[#f5f5f2] p-5"><div className="flex flex-wrap items-start justify-between gap-4"><div><p className="eyebrow">VERIFIED INSTRUCTOR</p><h2 className="mt-2 font-display text-4xl font-extrabold tracking-[-0.08em]">{instructor.fullName}</h2><p className="mt-2 text-sm text-black/60">{instructor.serviceAreas || instructor.city}</p></div><span className="inline-flex items-center gap-1 bg-[#d8e6d9] px-2 py-1 text-[9px] font-bold text-[#23412f]"><ShieldCheck className="h-3 w-3" /> VERIFIED</span></div></section><div className="mt-5 grid gap-5 lg:grid-cols-[1fr_.9fr]"><div className="space-y-5"><section className="border border-black/15 bg-[#f5f5f2] p-5"><p className="eyebrow">01 / PACKAGE</p><div className="mt-4 grid gap-2">{packages.map(item => <button key={item.code} onClick={() => setPackageCode(item.code as typeof packageCode)} className={cn("flex items-center justify-between border p-4 text-left", item.code === packageCode ? "border-black bg-[#141414] text-white" : "border-black/15 bg-white")}><span><strong className="block font-display text-lg tracking-[-0.05em]">{item.title}</strong><span className={cn("text-[10px] font-bold tracking-[0.12em]", item.code === packageCode ? "text-white/60" : "text-black/45")}>{item.lessons} LESSONS</span></span><span className="font-bold">{inr(item.pricePaise)}</span></button>)}</div></section><section className="border border-black/15 bg-[#f5f5f2] p-5"><p className="eyebrow">02 / AVAILABLE WINDOW</p><p className="mt-2 text-sm leading-6 text-black/60">Choose a window published by this instructor. drivenow reserves the first upcoming matching date for the request.</p><div className="mt-4 grid gap-2">{slots.map(slot => { const start = nextDateForDay(slot.dayOfWeek ?? 1, slot.startTime); return <button key={slot.id} onClick={() => setSlotId(slot.id)} className={cn("flex items-center justify-between border p-4 text-left", slot.id === selectedSlot?.id ? "border-black bg-[#d8e6d9]" : "border-black/15 bg-white")}><span><strong className="block text-sm">{days[slot.dayOfWeek ?? 1]}</strong><span className="mt-1 block text-xs text-black/55">{start.toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short" })}</span></span><span className="inline-flex items-center gap-2 text-sm font-bold"><Clock3 className="h-4 w-4" />{slot.startTime}–{slot.endTime}</span></button>; })}</div></section></div><aside className="border-2 border-black bg-[#141414] p-5 text-white"><p className="eyebrow text-white/50">03 / PICKUP POINT</p><p className="mt-2 text-sm leading-6 text-white/65">Click the map to select the point you will meet. You may also type a clearer landmark.</p><label className="mt-4 block text-[10px] font-bold tracking-[0.13em] text-white/60">MEETING ADDRESS<Input value={pickup?.address || ""} onChange={event => setPickup(current => ({ address: event.target.value, lat: current?.lat || 0, lng: current?.lng || 0 }))} className="mt-2 border-white/20 bg-white/10 text-white placeholder:text-white/35" placeholder="Choose a point or add a landmark" /></label><div className="mt-4 overflow-hidden border border-white/20"><MapView className="h-52 grayscale contrast-75" initialCenter={{ lat: 12.9716, lng: 77.5946 }} initialZoom={12} onMapReady={map => { let marker: google.maps.Marker | undefined; const geocoder = new google.maps.Geocoder(); map.addListener("click", (event: google.maps.MapMouseEvent) => { const value = event.latLng; if (!value) return; const position = { lat: value.lat(), lng: value.lng() }; marker?.setMap(null); marker = new google.maps.Marker({ map, position }); geocoder.geocode({ location: position }, (results, status) => setPickup({ ...position, address: status === "OK" && results?.[0]?.formatted_address ? results[0].formatted_address : `Selected point ${position.lat.toFixed(5)}, ${position.lng.toFixed(5)}` })); }); }} /></div>{pickup?.lat && pickup?.lng ? <p className="mt-2 inline-flex items-center gap-1 text-[10px] font-bold text-[#a6d4b0]"><Check className="h-3.5 w-3.5" /> MAP COORDINATES SAVED</p> : <p className="mt-2 text-[10px] text-white/50">Click the map for precise coordinates.</p>}<label className="mt-4 block text-[10px] font-bold tracking-[0.13em] text-white/60">NOTE FOR INSTRUCTOR<Textarea value={note} onChange={event => setNote(event.target.value)} className="mt-2 min-h-20 border-white/20 bg-white/10 text-white placeholder:text-white/35" placeholder="Optional pickup note" /></label><div className="mt-5 border-y border-white/20 py-4"><div className="flex justify-between text-sm"><span className="text-white/60">{selectedPackage?.title}</span><span>{selectedPackage ? inr(selectedPackage.pricePaise) : "—"}</span></div><div className="mt-2 flex justify-between text-xs text-white/55"><span>Platform fee</span><span>{inr(fee)}</span></div><div className="mt-4 flex justify-between font-display text-xl font-bold"><span>Total</span><span>{selectedPackage ? inr(selectedPackage.pricePaise + fee) : "—"}</span></div></div><Button className="mt-5 w-full border-2 border-[#a6d4b0] bg-[#a6d4b0] text-xs font-extrabold tracking-[0.11em] text-[#141414] hover:bg-white" disabled={!pickup?.address || !scheduledStart || createBooking.isPending} onClick={() => selectedSlot && selectedPackage && createBooking.mutate({ instructorUserId, packageCode, scheduledStart, pickupAddress: pickup.address, pickupLat: pickup.lat || undefined, pickupLng: pickup.lng || undefined, learnerNote: note || undefined }, { onSuccess: result => navigate(`/learn/checkout/${result.bookingId}`) })}>{createBooking.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <>Continue to secure checkout <CreditCard className="h-4 w-4" /></>}</Button>{createBooking.error && <p className="mt-3 text-xs text-red-300">{createBooking.error.message}</p>}</aside></div></LearnerShell>;
}
