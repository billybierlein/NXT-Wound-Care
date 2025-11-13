import { useAuth } from "@/hooks/useAuth";
import { useEffect } from "react";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { insertPatientSchema, type InsertPatient, type ReferralSource } from "@shared/schema";
import { useMutation, useQuery } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useLocation } from "wouter";
import Navigation from "@/components/ui/navigation";
import { isUnauthorizedError } from "@/lib/authUtils";
import { PatientForm } from "@/components/patients/PatientForm";

const formSchema = insertPatientSchema;

export default function AddPatient() {
  const { user, isAuthenticated, isLoading } = useAuth();
  const { toast } = useToast();
  const [, setLocation] = useLocation();

  // Redirect to home if not authenticated
  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      toast({
        title: "Unauthorized",
        description: "You are logged out. Logging in again...",
        variant: "destructive",
      });
      setTimeout(() => {
        window.location.href = "/api/login";
      }, 500);
      return;
    }
  }, [isAuthenticated, isLoading, toast]);

  // Fetch referral sources for mutation
  const { data: referralSources = [] } = useQuery<ReferralSource[]>({
    queryKey: ["/api/referral-sources"],
    enabled: isAuthenticated,
  });

  const createPatientMutation = useMutation({
    mutationFn: async (patient: InsertPatient) => {
      // Find the referral source ID based on the selected facility name
    const selectedReferralSource = referralSources.find(source => source.facilityName === patient.referralSource);
    const patientWithReferralId = {
      ...patient,
      referralSourceId: selectedReferralSource?.id || null,
    };
    const response = await apiRequest("POST", "/api/patients", patientWithReferralId);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/patients"] });
      toast({
        title: "Success",
        description: "Patient saved successfully!",
      });
      setLocation("/manage-patients");
    },
    onError: (error) => {
      if (isUnauthorizedError(error)) {
        toast({
          title: "Unauthorized",
          description: "You are logged out. Logging in again...",
          variant: "destructive",
        });
        setTimeout(() => {
          window.location.href = "/api/login";
        }, 500);
        return;
      }
      toast({
        title: "Error",
        description: error.message || "Failed to save patient",
        variant: "destructive",
      });
    },
  });

  const handleSubmit = (data: InsertPatient) => {
    // For sales reps, override salesRep with current user's name
    // For admin users, use the selected sales rep from the form
    const patientData = {
      ...data,
      salesRep: (user as any)?.role === 'admin' ? data.salesRep : ((user as any)?.salesRepName || '')
    };
    createPatientMutation.mutate(patientData);
  };


  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return null; // Will redirect in useEffect
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Navigation />
      
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Card>
          <CardHeader>
            <CardTitle className="text-xl font-semibold text-gray-900">
              Add New Patient
            </CardTitle>
          </CardHeader>
          <CardContent>
            <PatientForm
              mode="page"
              onSubmit={handleSubmit}
              isPending={createPatientMutation.isPending}
              userRole={(user as any)?.role === 'sales_rep' ? 'salesRep' : (user as any)?.role === 'admin' ? 'admin' : undefined}
              userSalesRepName={(user as any)?.salesRepName || ''}
            />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
