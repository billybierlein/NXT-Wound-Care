import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useAuth } from "@/hooks/useAuth";
import Landing from "@/pages/landing";
import Home from "@/pages/home";
import AddPatient from "@/pages/add-patient";
import EditPatient from "@/pages/edit-patient";
import ManagePatients from "@/pages/manage-patients";
import PatientTreatments from "@/pages/patient-treatments";
import SalesReports from "@/pages/sales-reports";
import ManageSalesReps from "@/pages/manage-sales-reps";
import ManageProviders from "@/pages/manage-providers";
import ProviderProfile from "@/pages/provider-profile";
import ManageReferralSources from "@/pages/manage-referral-sources";
import ReferralSourceProfile from "@/pages/referral-source-profile";

import PatientTimeline from "@/pages/patient-timeline";
import PatientProfile from "@/pages/patient-profile";
import Calculator from "@/pages/calculator";
import PublicCalculator from "@/pages/public-calculator";
import AIAssistant from "@/pages/ai-assistant";
import ProviderOrderForm from "@/pages/provider-order-form";
import OrderSuccess from "@/pages/order-success";
import PublicProviderOrderForm from "@/pages/public-provider-order-form";
import PublicOrderSuccess from "@/pages/public-order-success";
import AuthPage from "@/pages/auth-page";
import ChangePassword from "@/pages/change-password";
import ManageInvitations from "@/pages/manage-invitations";
import Register from "@/pages/register";
import NotFound from "@/pages/not-found";

// Admin-only route component
function AdminRoute({ component: Component }: { component: () => React.JSX.Element }) {
  const { user } = useAuth();
  
  if (!user || (user as any)?.role !== 'admin') {
    return <NotFound />;
  }
  
  return <Component />;
}

// Sales rep-only route component  
function SalesRepRoute({ component: Component }: { component: () => React.JSX.Element }) {
  const { user } = useAuth();
  
  if (!user || (user as any)?.role !== 'sales_rep') {
    return <NotFound />;
  }
  
  return <Component />;
}

function Router() {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <Switch>
      {/* Public routes - accessible without authentication */}
      <Route path="/calculator" component={PublicCalculator} />
      <Route path="/public-order-form" component={PublicProviderOrderForm} />
      <Route path="/public-order-success" component={PublicOrderSuccess} />
      <Route path="/register/:token" component={Register} />
      
      {!isAuthenticated ? (
        <>
          <Route path="/" component={Landing} />
          <Route path="/auth" component={AuthPage} />
        </>
      ) : (
        <>
          <Route path="/" component={Home} />
          <Route path="/add-patient" component={AddPatient} />
          <Route path="/edit-patient/:id" component={EditPatient} />
          <Route path="/manage-patients" component={ManagePatients} />
          <Route path="/patient-treatments" component={PatientTreatments} />
          <Route path="/sales-reports" component={SalesReports} />
          <Route path="/internal-calculator" component={Calculator} />
          <Route path="/ai-assistant" component={AIAssistant} />
          <Route path="/provider-order-form" component={ProviderOrderForm} />
          <Route path="/order-success" component={OrderSuccess} />
          <Route path="/manage-sales-reps" component={() => <AdminRoute component={ManageSalesReps} /> as any} />
          <Route path="/manage-invitations" component={() => <AdminRoute component={ManageInvitations} /> as any} />
          <Route path="/manage-providers" component={ManageProviders} />
          <Route path="/provider-profile/:id" component={ProviderProfile} />
          <Route path="/manage-referral-sources" component={ManageReferralSources} />
          <Route path="/referral-sources/:id" component={ReferralSourceProfile} />
          <Route path="/patient-timeline/:patientId" component={PatientTimeline} />
          <Route path="/patient-profile/:patientId" component={PatientProfile} />
          <Route path="/change-password" component={ChangePassword} />
        </>
      )}
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Router />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
