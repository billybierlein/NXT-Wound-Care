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

import PatientTimeline from "@/pages/patient-timeline";
import PatientProfile from "@/pages/patient-profile";
import Calculator from "@/pages/calculator";
import AuthPage from "@/pages/auth-page";
import NotFound from "@/pages/not-found";

// Admin-only route component
function AdminRoute({ component: Component }: { component: () => React.JSX.Element }) {
  const { user } = useAuth();
  
  if ((user as any)?.role !== 'admin') {
    return <NotFound />;
  }
  
  return <Component />;
}

// Sales rep-only route component  
function SalesRepRoute({ component: Component }: { component: () => React.JSX.Element }) {
  const { user } = useAuth();
  
  if ((user as any)?.role !== 'sales_rep') {
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
          <Route path="/calculator" component={Calculator} />
          <Route path="/manage-sales-reps">
            {() => <AdminRoute component={ManageSalesReps} />}
          </Route>
          <Route path="/manage-providers" component={() => <AdminRoute component={ManageProviders} />} />
          <Route path="/patient-timeline/:patientId" component={PatientTimeline} />
          <Route path="/patient-profile/:patientId" component={PatientProfile} />
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
