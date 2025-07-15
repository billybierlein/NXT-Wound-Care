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
import ManageSalesReps from "@/pages/manage-sales-reps";
import NotFound from "@/pages/not-found";

function Router() {
  const { isAuthenticated, isLoading } = useAuth();

  return (
    <Switch>
      {isLoading || !isAuthenticated ? (
        <Route path="/" component={Landing} />
      ) : (
        <>
          <Route path="/" component={Home} />
          <Route path="/add-patient" component={AddPatient} />
          <Route path="/edit-patient/:id" component={EditPatient} />
          <Route path="/manage-patients" component={ManagePatients} />
          <Route path="/manage-sales-reps" component={ManageSalesReps} />
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
