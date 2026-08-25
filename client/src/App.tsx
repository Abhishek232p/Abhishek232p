import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { Route, Switch } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import Home from "./pages/Home";
import Start from "./pages/Start";
import { Checkout, InstructorDetail, LearnerBookings, LearnerDiscover, LearnerOnboarding } from "./pages/Learner";
import LocationMap from "./pages/LocationMap";
import Profile from "./pages/Profile";
import BookingDetail from "./pages/BookingDetail";
import InstructorBooking from "./pages/InstructorBooking";
import PayoutLedger from "./pages/PayoutLedger";
import BookingsHub from "./pages/BookingsHub";
import { InstructorAvailability, InstructorDashboard, InstructorEarnings, InstructorOnboarding } from "./pages/Instructor";
import AdminVerification from "./pages/Admin";

function Router() {
  // make sure to consider if you need authentication for certain routes
  return (
    <Switch>
      <Route path={"/"} component={Home} />
      <Route path={"/start"} component={Start} />
      <Route path={"/learn"} component={LearnerDiscover} />
      <Route path={"/learn/onboarding"} component={LearnerOnboarding} />
      <Route path={"/learn/map"} component={LocationMap} />
      <Route path={"/learn/instructor/:id"} component={InstructorBooking} />
      <Route path={"/learn/checkout/:id"} component={Checkout} />
      <Route path={"/learn/bookings"} component={BookingsHub} />
      <Route path={"/learn/bookings/:id"} component={BookingDetail} />
      <Route path={"/profile"} component={Profile} />
      <Route path={"/teach"} component={InstructorDashboard} />
      <Route path={"/teach/onboarding"} component={InstructorOnboarding} />
      <Route path={"/teach/availability"} component={InstructorAvailability} />
      <Route path={"/teach/earnings"} component={PayoutLedger} />
      <Route path={"/admin"} component={AdminVerification} />
      <Route path={"/404"} component={NotFound} />
      {/* Final fallback route */}
      <Route component={NotFound} />
    </Switch>
  );
}

// NOTE: About Theme
// - First choose a default theme according to your design style (dark or light bg), than change color palette in index.css
//   to keep consistent foreground/background color across components
// - If you want to make theme switchable, pass `switchable` ThemeProvider and use `useTheme` hook

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider
        defaultTheme="light"
        // switchable
      >
        <TooltipProvider>
          <Toaster />
          <Router />
        </TooltipProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
