import { useAuth } from "@/_core/hooks/useAuth";
import { AccessDenied, LearnerShell } from "@/components/DrivenowShell";
import { MapView } from "@/components/Map";
import { Button } from "@/components/ui/button";
import { trpc } from "@/lib/trpc";
import { Check, Compass, MapPin, Navigation, Search } from "lucide-react";
import { useState } from "react";
import { Link } from "wouter";

type PickedPoint = { address: string; lat: number; lng: number } | null;

export default function LocationMap() {
  const { isAuthenticated, loading } = useAuth();
  const { data: profile } = trpc.marketplace.profile.me.useQuery(undefined, { enabled: isAuthenticated });
  const { data: instructors = [] } = trpc.marketplace.learn.discover.useQuery({ city: profile?.city || undefined, vehicle: "either" });
  const [picked, setPicked] = useState<PickedPoint>(null);
  if (loading) return <div className="grid min-h-screen place-items-center bg-[#e5e6e3] text-[10px] font-bold tracking-[0.18em]">LOADING MAP</div>;
  if (!isAuthenticated) return <div className="min-h-screen bg-[#e5e6e3]"><AccessDenied title="Sign in to use the map" description="Location discovery and meeting-point selection are available from a secure learner account." /></div>;
  return <LearnerShell title="Map discovery" action={<Link href="/learn" className="text-[10px] font-extrabold tracking-[0.14em] underline underline-offset-4">LIST VIEW</Link>}><div className="grid gap-5 lg:grid-cols-[1fr_.43fr]"><section className="relative min-h-[560px] overflow-hidden border-2 border-black bg-[#141414]"><MapView className="h-[560px] grayscale contrast-75" initialCenter={{ lat: 12.9716, lng: 77.5946 }} initialZoom={11} onMapReady={map => {
    const bounds = new google.maps.LatLngBounds();
    let hasInstructorPoints = false;
    instructors.forEach(instructor => {
      const lat = Number(instructor.serviceLat);
      const lng = Number(instructor.serviceLng);
      if (Number.isFinite(lat) && Number.isFinite(lng)) {
        hasInstructorPoints = true;
        const position = { lat, lng };
        new google.maps.Marker({ map, position, title: instructor.fullName, label: "D" });
        bounds.extend(position);
      }
    });
    if (hasInstructorPoints) map.fitBounds(bounds, 72);
    let pickupMarker: google.maps.Marker | undefined;
    const geocoder = new google.maps.Geocoder();
    map.addListener("click", (event: google.maps.MapMouseEvent) => {
      const selected = event.latLng;
      if (!selected) return;
      const position = { lat: selected.lat(), lng: selected.lng() };
      pickupMarker?.setMap(null);
      pickupMarker = new google.maps.Marker({ map, position, title: "Proposed meeting point", label: "P" });
      geocoder.geocode({ location: position }, (result, status) => {
        const address = status === "OK" && result?.[0]?.formatted_address ? result[0].formatted_address : `Selected map point ${position.lat.toFixed(5)}, ${position.lng.toFixed(5)}`;
        setPicked({ ...position, address });
        localStorage.setItem("eazyservx-pickup-point", JSON.stringify({ ...position, address }));
      });
    });
  }} /><div className="pointer-events-none absolute left-3 top-3 border border-white/25 bg-[#141414]/95 px-3 py-2 text-[10px] font-bold tracking-[0.12em] text-white/70"><span className="text-[#a6d4b0]">D</span> VERIFIED INSTRUCTOR AREA <span className="ml-3 text-[#a6d4b0]">P</span> PICKUP PIN</div></section><aside className="border-2 border-black bg-[#f5f5f2] p-5"><p className="eyebrow">LOCATION WORKSPACE</p><h2 className="mt-2 font-display text-3xl font-extrabold tracking-[-0.07em]">MATCH + MEET.</h2><p className="mt-3 text-sm leading-6 text-black/60">Explore available instructor service points. Click the map to propose a pickup or meeting point for your next booking.</p><div className="mt-6 border-y border-black/15 py-5"><p className="text-[10px] font-bold tracking-[0.14em] text-black/50">SELECTED POINT</p>{picked ? <><p className="mt-2 text-sm font-bold leading-6">{picked.address}</p><p className="mt-2 text-[10px] text-black/50">{picked.lat.toFixed(5)}, {picked.lng.toFixed(5)}</p><div className="mt-4 inline-flex items-center gap-2 text-xs font-bold text-[#23412f]"><Check className="h-4 w-4" /> SAVED FOR YOUR NEXT BOOKING</div></> : <p className="mt-2 text-sm leading-6 text-black/55">No point selected. Click anywhere on the map to add a proposal.</p>}</div><div className="mt-5 space-y-3"><div className="flex items-start gap-3 text-sm"><Navigation className="mt-0.5 h-4 w-4 shrink-0 text-[#3d6854]" /><span>{instructors.length ? `${instructors.length} verified instructor${instructors.length === 1 ? "" : "s"} match your current filters.` : "No instructor matches are active for your current filters."}</span></div><Link href="/learn" className="btn-primary w-full">Back to instructor list <Search className="h-4 w-4" /></Link></div></aside></div></LearnerShell>;
}
