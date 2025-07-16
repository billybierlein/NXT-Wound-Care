import { useAuth } from "@/hooks/useAuth";
import { useEffect } from "react";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { insertPatientSchema, type InsertPatient, type SalesRep, type Provider } from "@shared/schema";
import { useMutation, useQuery } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useLocation } from "wouter";
import { User, Hospital, Save, X } from "lucide-react";
import Navigation from "@/components/ui/navigation";
import { isUnauthorizedError } from "@/lib/authUtils";

const formSchema = insertPatientSchema.extend({
  dateOfBirth: insertPatientSchema.shape.dateOfBirth
    .refine((val) => {
      if (!val) return false;
      // Check if date is in MM/DD/YYYY format
      const match = val.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
      if (!match) return false;
      
      const [, month, day, year] = match;
      const monthNum = parseInt(month, 10);
      const dayNum = parseInt(day, 10);
      const yearNum = parseInt(year, 10);
      
      // Basic validation
      if (monthNum < 1 || monthNum > 12) return false;
      if (dayNum < 1 || dayNum > 31) return false;
      if (yearNum < 1900 || yearNum > new Date().getFullYear()) return false;
      
      return true;
    }, { message: "Please enter a valid date in MM/DD/YYYY format" })
    .transform((val) => {
      if (typeof val === 'string') {
        // Convert MM/DD/YYYY to YYYY-MM-DD for backend
        const match = val.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
        if (match) {
          const [, month, day, year] = match;
          return `${year}-${month}-${day}`;
        }
        return val;
      }
      return val?.toISOString().split('T')[0];
    }),
}).refine((data) => {
  // Require customInsurance when insurance is "other"
  if (data.insurance === "other" && !data.customInsurance?.trim()) {
    return false;
  }
  return true;
}, {
  message: "Please specify the insurance provider",
  path: ["customInsurance"],
});

export default function AddPatient() {
  const { isAuthenticated, isLoading } = useAuth();
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

  // Fetch sales reps
  const { data: salesReps = [] } = useQuery({
    queryKey: ["/api/sales-reps"],
    retry: false,
    enabled: isAuthenticated,
  });

  const { data: providers = [] } = useQuery<Provider[]>({
    queryKey: ["/api/providers"],
    enabled: isAuthenticated,
  });

  const form = useForm<InsertPatient>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      firstName: "",
      lastName: "",
      dateOfBirth: "",
      phoneNumber: "",
      insurance: "",
      customInsurance: "",
      referralSource: "",
      salesRep: "",
      woundType: "",
      woundSize: "",
      notes: "",
    },
  });

  const createPatientMutation = useMutation({
    mutationFn: async (patient: InsertPatient) => {
      const response = await apiRequest("POST", "/api/patients", patient);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/patients"] });
      toast({
        title: "Success",
        description: "Patient saved successfully!",
      });
      form.reset();
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
    createPatientMutation.mutate(data);
  };

  const handleClearForm = () => {
    form.reset();
    toast({
      title: "Form Cleared",
      description: "All form fields have been reset",
    });
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
            <Form {...form}>
              <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-6">
                {/* Patient Information Section */}
                <div>
                  <h3 className="text-lg font-medium text-gray-900 mb-4 border-b border-gray-200 pb-2 flex items-center">
                    <User className="h-5 w-5 mr-2 text-primary" />
                    Patient Information
                  </h3>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="firstName"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>First Name *</FormLabel>
                          <FormControl>
                            <Input placeholder="Enter first name" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    
                    <FormField
                      control={form.control}
                      name="lastName"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Last Name *</FormLabel>
                          <FormControl>
                            <Input placeholder="Enter last name" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    
                    <FormField
                      control={form.control}
                      name="dateOfBirth"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Date of Birth *</FormLabel>
                          <FormControl>
                            <Input 
                              placeholder="MM/DD/YYYY" 
                              {...field}
                              onChange={(e) => {
                                let value = e.target.value.replace(/\D/g, '');
                                if (value.length >= 2) {
                                  value = value.substring(0, 2) + '/' + value.substring(2);
                                }
                                if (value.length >= 5) {
                                  value = value.substring(0, 5) + '/' + value.substring(5, 9);
                                }
                                field.onChange(value);
                              }}
                              maxLength={10}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    
                    <FormField
                      control={form.control}
                      name="phoneNumber"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Phone Number *</FormLabel>
                          <FormControl>
                            <Input placeholder="(555) 123-4567" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    
                    <FormField
                      control={form.control}
                      name="insurance"
                      render={({ field }) => (
                        <FormItem className="md:col-span-2">
                          <FormLabel>Patient Insurance *</FormLabel>
                          <Select onValueChange={(value) => {
                            field.onChange(value);
                            // Clear custom insurance if switching away from "other"
                            if (value !== "other") {
                              form.setValue("customInsurance", "");
                            }
                          }} defaultValue={field.value}>
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Select Insurance Provider" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="medicare">Medicare</SelectItem>
                              <SelectItem value="medicaid">Medicaid</SelectItem>
                              <SelectItem value="aetna">Aetna</SelectItem>
                              <SelectItem value="bluecross">Blue Cross Blue Shield</SelectItem>
                              <SelectItem value="cigna">Cigna</SelectItem>
                              <SelectItem value="humana">Humana</SelectItem>
                              <SelectItem value="united">United Healthcare</SelectItem>
                              <SelectItem value="unitedhealthcare-ma">UnitedHealthcare Medicare Advantage</SelectItem>
                              <SelectItem value="aetna-ma">Aetna Medicare Advantage</SelectItem>
                              <SelectItem value="cigna-ma">Cigna Medicare Advantage</SelectItem>
                              <SelectItem value="humana-ma">Humana Medicare Advantage</SelectItem>
                              <SelectItem value="wellcare-ma">WellCare Medicare Advantage</SelectItem>
                              <SelectItem value="other">Other</SelectItem>
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    {/* Show custom insurance field when "other" is selected */}
                    {form.watch("insurance") === "other" && (
                      <FormField
                        control={form.control}
                        name="customInsurance"
                        render={({ field }) => (
                          <FormItem className="md:col-span-2">
                            <FormLabel>Please specify insurance provider *</FormLabel>
                            <FormControl>
                              <Input placeholder="Enter insurance provider name" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    )}
                  </div>
                </div>

                {/* Referral Information Section */}
                <div>
                  <h3 className="text-lg font-medium text-gray-900 mb-4 border-b border-gray-200 pb-2 flex items-center">
                    <Hospital className="h-5 w-5 mr-2 text-primary" />
                    Referral Information
                  </h3>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="referralSource"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Referral Source (Facility) *</FormLabel>
                          <FormControl>
                            <Input placeholder="St. Mary's Hospital" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    
                    <FormField
                      control={form.control}
                      name="salesRep"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Assigned Sales Rep *</FormLabel>
                          <Select onValueChange={field.onChange} defaultValue={field.value}>
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Select Sales Rep" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {salesReps.map((salesRep: SalesRep) => (
                                <SelectItem key={salesRep.id} value={salesRep.name}>
                                  {salesRep.name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="provider"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Acting Provider</FormLabel>
                          <Select onValueChange={field.onChange} defaultValue={field.value}>
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Select Provider" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="none">No Provider</SelectItem>
                              {providers.map((provider: Provider) => (
                                <SelectItem key={provider.id} value={provider.name}>
                                  {provider.name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    
                    <FormField
                      control={form.control}
                      name="patientStatus"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Patient Status</FormLabel>
                          <Select onValueChange={field.onChange} defaultValue={field.value || "Evaluation Stage"}>
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Select Patient Status" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="Evaluation Stage">Evaluation Stage</SelectItem>
                              <SelectItem value="IVR Requested">IVR Requested</SelectItem>
                              <SelectItem value="IVR Denied">IVR Denied</SelectItem>
                              <SelectItem value="IVR Approved">IVR Approved</SelectItem>
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    
                    <FormField
                      control={form.control}
                      name="woundType"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Wound Type *</FormLabel>
                          <Select onValueChange={field.onChange} value={field.value}>
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Select Wound Type" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="pressure-ulcer">Pressure Ulcer</SelectItem>
                              <SelectItem value="diabetic-ulcer">Diabetic Ulcer</SelectItem>
                              <SelectItem value="venous-ulcer">Venous Ulcer</SelectItem>
                              <SelectItem value="arterial-ulcer">Arterial Ulcer</SelectItem>
                              <SelectItem value="surgical-wound">Surgical Wound</SelectItem>
                              <SelectItem value="traumatic-wound">Traumatic Wound</SelectItem>
                              <SelectItem value="burn">Burn</SelectItem>
                              <SelectItem value="other">Other</SelectItem>
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    
                    <FormField
                      control={form.control}
                      name="woundSize"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Wound Size *</FormLabel>
                          <FormControl>
                            <div className="flex items-center space-x-2">
                              <Input 
                                type="number" 
                                placeholder="12" 
                                min="0" 
                                step="0.1"
                                className="flex-1"
                                {...field} 
                              />
                              <span className="text-sm text-gray-500 font-medium">sq cm</span>
                            </div>
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    
                    <FormField
                      control={form.control}
                      name="notes"
                      render={({ field }) => (
                        <FormItem className="md:col-span-2">
                          <FormLabel>Notes</FormLabel>
                          <FormControl>
                            <Textarea
                              placeholder="Additional information about the patient..."
                              className="resize-none"
                              rows={4}
                              {...field}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                </div>

                <div className="flex justify-end space-x-4">
                  <Button 
                    type="button" 
                    variant="outline"
                    onClick={handleClearForm}
                    disabled={createPatientMutation.isPending}
                  >
                    <X className="h-4 w-4 mr-2" />
                    Clear Form
                  </Button>
                  <Button 
                    type="submit"
                    disabled={createPatientMutation.isPending}
                  >
                    {createPatientMutation.isPending ? (
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                    ) : (
                      <Save className="h-4 w-4 mr-2" />
                    )}
                    Save Patient
                  </Button>
                </div>
              </form>
            </Form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
