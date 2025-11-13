import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { insertPatientSchema, type InsertPatient, type SalesRep, type Provider, type ReferralSource } from "@shared/schema";
import { useQuery } from "@tanstack/react-query";
import { User, Hospital, Save, X } from "lucide-react";

interface PatientFormProps {
  mode: 'page' | 'dialog';
  initialValues?: Partial<InsertPatient>;
  onSubmit: (data: InsertPatient) => void;
  onCancel?: () => void;
  isPending?: boolean;
  userRole?: 'admin' | 'salesRep';
  userSalesRepName?: string;
}

export function PatientForm({
  mode,
  initialValues,
  onSubmit,
  onCancel,
  isPending = false,
  userRole = 'salesRep',
  userSalesRepName = '',
}: PatientFormProps) {
  // Fetch sales reps
  const { data: salesReps = [] } = useQuery<SalesRep[]>({
    queryKey: ["/api/sales-reps"],
    retry: false,
  });

  const { data: providers = [] } = useQuery<Provider[]>({
    queryKey: ["/api/providers"],
  });

  // Fetch referral sources
  const { data: referralSources = [] } = useQuery<ReferralSource[]>({
    queryKey: ["/api/referral-sources"],
  });

  const form = useForm<InsertPatient>({
    resolver: zodResolver(insertPatientSchema),
    defaultValues: {
      firstName: "",
      lastName: "",
      dateOfBirth: "",
      phoneNumber: "",
      insurance: "",
      customInsurance: "",
      referralSource: "",
      salesRep: userSalesRepName || "",
      woundType: "",
      woundSize: "",
      notes: "",
      ...initialValues,
    },
  });

  // Update form when initialValues change (for dialog mode)
  useEffect(() => {
    if (initialValues) {
      Object.keys(initialValues).forEach((key) => {
        const value = initialValues[key as keyof InsertPatient];
        if (value !== undefined && value !== null) {
          form.setValue(key as keyof InsertPatient, value);
        }
      });
    }
  }, [initialValues, form]);

  const handleClearForm = () => {
    form.reset({
      firstName: "",
      lastName: "",
      dateOfBirth: "",
      phoneNumber: "",
      insurance: "",
      customInsurance: "",
      referralSource: "",
      salesRep: userSalesRepName || "",
      woundType: "",
      woundSize: "",
      notes: "",
      ...initialValues,
    });
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        {/* Patient Information Section */}
        <div>
          <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-4 border-b border-gray-200 dark:border-gray-700 pb-2 flex items-center">
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
                    <Input placeholder="Enter first name" {...field} data-testid="input-first-name" />
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
                    <Input placeholder="Enter last name" {...field} data-testid="input-last-name" />
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
                      data-testid="input-dob"
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
                    <Input placeholder="(555) 123-4567" {...field} data-testid="input-phone" />
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
                  }} value={field.value}>
                    <FormControl>
                      <SelectTrigger data-testid="select-insurance">
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
                      <Input placeholder="Enter insurance provider name" {...field} value={field.value || ''} data-testid="input-custom-insurance" />
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
          <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-4 border-b border-gray-200 dark:border-gray-700 pb-2 flex items-center">
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
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger data-testid="select-referral-source">
                        <SelectValue placeholder="Select Referral Source" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {referralSources.map((source) => (
                        <SelectItem key={source.id} value={source.facilityName}>
                          {source.facilityName}
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
              name="salesRep"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Assigned Sales Rep</FormLabel>
                  <FormControl>
                    {userRole === 'admin' ? (
                      <Select onValueChange={field.onChange} value={field.value}>
                        <SelectTrigger data-testid="select-sales-rep">
                          <SelectValue placeholder="Select Sales Rep" />
                        </SelectTrigger>
                        <SelectContent>
                          {salesReps.map((rep: SalesRep) => (
                            <SelectItem key={rep.id} value={rep.name}>
                              {rep.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    ) : (
                      <Input 
                        value={userSalesRepName || "Not assigned"} 
                        disabled 
                        className="bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400"
                        data-testid="input-sales-rep-disabled"
                      />
                    )}
                  </FormControl>
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
                  <Select onValueChange={field.onChange} value={field.value || undefined}>
                    <FormControl>
                      <SelectTrigger data-testid="select-provider">
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
                  <Select onValueChange={field.onChange} value={field.value || "Evaluation Stage"}>
                    <FormControl>
                      <SelectTrigger data-testid="select-patient-status">
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
                      <SelectTrigger data-testid="select-wound-type">
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
                  <FormLabel>Initial Wound Size (sq cm) *</FormLabel>
                  <FormControl>
                    <Input 
                      type="number" 
                      placeholder="12" 
                      min="0" 
                      step="0.1"
                      {...field} 
                      data-testid="input-wound-size"
                    />
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
                      value={field.value || ''}
                      data-testid="textarea-notes"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
        </div>

        <div className="flex justify-end space-x-4">
          {mode === 'page' && (
            <Button 
              type="button" 
              variant="outline"
              onClick={handleClearForm}
              disabled={isPending}
              data-testid="button-clear-form"
            >
              <X className="h-4 w-4 mr-2" />
              Clear Form
            </Button>
          )}
          {mode === 'dialog' && onCancel && (
            <Button 
              type="button" 
              variant="outline"
              onClick={onCancel}
              disabled={isPending}
              data-testid="button-cancel"
            >
              <X className="h-4 w-4 mr-2" />
              Cancel
            </Button>
          )}
          <Button 
            type="submit"
            disabled={isPending}
            data-testid="button-save-patient"
          >
            {isPending ? (
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
            ) : (
              <Save className="h-4 w-4 mr-2" />
            )}
            {mode === 'dialog' ? 'Create Patient' : 'Save Patient'}
          </Button>
        </div>
      </form>
    </Form>
  );
}
