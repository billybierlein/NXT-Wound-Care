import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useRoute, useLocation } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  Edit2, 
  Save, 
  X, 
  User, 
  Phone, 
  Mail, 
  MapPin, 
  Building, 
  FileText, 
  Calendar,
  DollarSign,
  TrendingUp,
  Users,
  Activity,
  ArrowLeft
} from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { insertProviderSchema, type InsertProvider, type Provider, type Patient, type PatientTreatment } from "@shared/schema";
import Navigation from "@/components/ui/navigation";
import { format, parseISO } from "date-fns";

type ProviderWithStats = Provider & {
  patientCount: number;
  activeTreatments: number;
  completedTreatments: number;
};

type Treatment = PatientTreatment;

export default function ProviderProfile() {
  const [match, params] = useRoute("/provider-profile/:id");
  const [isEditing, setIsEditing] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [, setLocation] = useLocation();
  const providerId = params?.id;

  // Fetch provider data
  const { data: provider, isLoading: providerLoading } = useQuery<ProviderWithStats>({
    queryKey: ["/api/providers", providerId],
    enabled: !!providerId,
    staleTime: 30 * 1000,
    refetchInterval: 10 * 1000,
  });

  // Fetch patients for this provider
  const { data: patients = [] } = useQuery<Patient[]>({
    queryKey: ["/api/patients"],
    staleTime: 30 * 1000,
  });

  // Fetch treatments for this provider
  const { data: treatments = [] } = useQuery<Treatment[]>({
    queryKey: ["/api/treatments/all"],
    staleTime: 30 * 1000,
  });

  // Filter patients and treatments for this provider
  const providerPatients = patients.filter(p => p.provider === provider?.name);
  const providerTreatments = treatments.filter(t => {
    const patient = patients.find(p => p.id === t.patientId);
    return patient?.provider === provider?.name;
  });
  const activeTreatments = providerTreatments.filter(t => t.status === 'active');
  const completedTreatments = providerTreatments.filter(t => t.status === 'completed');

  const form = useForm<InsertProvider>({
    resolver: zodResolver(insertProviderSchema),
    defaultValues: {
      name: provider?.name || "",
      taxIdNumber: provider?.taxIdNumber || "",
      practiceName: provider?.practiceName || "",
      shipToAddress: provider?.shipToAddress || "",
      city: provider?.city || "",
      state: provider?.state || "",
      zipCode: provider?.zipCode || "",
      contactName: provider?.contactName || "",
      phoneNumber: provider?.phoneNumber || "",
      email: provider?.email || "",
      practicePhone: provider?.practicePhone || "",
      practiceFax: provider?.practiceFax || "",
      practiceEmail: provider?.practiceEmail || "",
      individualNpi: provider?.individualNpi || "",
      groupNpi: provider?.groupNpi || "",
      ptan: provider?.ptan || "",
      billToName: provider?.billToName || "",
      billToCity: provider?.billToCity || "",
      billToState: provider?.billToState || "",
      billToZip: provider?.billToZip || "",
      apContactName: provider?.apContactName || "",
      apPhone: provider?.apPhone || "",
      apEmail: provider?.apEmail || "",
      isActive: provider?.isActive ?? true,
    },
  });

  // Update form when provider data loads
  useEffect(() => {
    if (provider) {
      form.reset({
        name: provider.name || "",
        taxIdNumber: provider.taxIdNumber || "",
        practiceName: provider.practiceName || "",
        shipToAddress: provider.shipToAddress || "",
        city: provider.city || "",
        state: provider.state || "",
        zipCode: provider.zipCode || "",
        contactName: provider.contactName || "",
        phoneNumber: provider.phoneNumber || "",
        email: provider.email || "",
        practicePhone: provider.practicePhone || "",
        practiceFax: provider.practiceFax || "",
        practiceEmail: provider.practiceEmail || "",
        individualNpi: provider.individualNpi || "",
        groupNpi: provider.groupNpi || "",
        ptan: provider.ptan || "",
        billToName: provider.billToName || "",
        billToCity: provider.billToCity || "",
        billToState: provider.billToState || "",
        billToZip: provider.billToZip || "",
        apContactName: provider.apContactName || "",
        apPhone: provider.apPhone || "",
        apEmail: provider.apEmail || "",
        isActive: provider.isActive ?? true,
      });
    }
  }, [provider, form]);

  // Update provider mutation
  const updateMutation = useMutation({
    mutationFn: async (data: InsertProvider) => {
      const res = await apiRequest("PUT", `/api/providers/${providerId}`, data);
      return await res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/providers"] });
      queryClient.invalidateQueries({ queryKey: ["/api/providers/stats"] });
      setIsEditing(false);
      toast({
        title: "Success",
        description: "Provider updated successfully",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: InsertProvider) => {
    updateMutation.mutate(data);
  };

  const formatDateSafe = (dateValue: string | Date | null | undefined): string => {
    if (!dateValue) return "Not set";
    
    try {
      let date: Date;
      if (typeof dateValue === 'string') {
        date = parseISO(dateValue);
      } else {
        date = dateValue;
      }
      
      if (isNaN(date.getTime())) {
        return "Invalid date";
      }
      
      // Extract date components directly from Date object to avoid timezone issues
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      const year = date.getFullYear();
      
      return `${month}/${day}/${year}`;
    } catch (error) {
      return "Invalid date";
    }
  };

  if (!match) {
    return <div>Provider not found</div>;
  }

  if (providerLoading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Navigation />
        <div className="container mx-auto px-6 py-8">
          <div className="flex items-center justify-center min-h-[400px]">
            <div className="text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
              <p className="mt-2 text-gray-600">Loading provider profile...</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!provider) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Navigation />
        <div className="container mx-auto px-6 py-8">
          <div className="text-center">
            <h1 className="text-2xl font-bold text-gray-900">Provider Not Found</h1>
            <p className="text-gray-600 mt-2">The provider you're looking for doesn't exist.</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Navigation />
      <div className="container mx-auto px-6 py-8">
        {/* Back to Providers Button */}
        <div className="mb-4">
          <Button
            variant="ghost"
            onClick={() => setLocation("/providers")}
            className="flex items-center gap-2 text-gray-600 hover:text-gray-900"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Providers
          </Button>
        </div>
        
        <div className="mb-6 flex items-center justify-between">
          <h1 className="text-3xl font-bold text-gray-900">Provider Profile</h1>
          <div className="flex gap-2">
            {!isEditing ? (
              <Button onClick={() => setIsEditing(true)} className="flex items-center gap-2">
                <Edit2 className="h-4 w-4" />
                Edit Provider
              </Button>
            ) : (
              <div className="flex gap-2">
                <Button
                  onClick={() => setIsEditing(false)}
                  variant="outline"
                  className="flex items-center gap-2"
                >
                  <X className="h-4 w-4" />
                  Cancel
                </Button>
                <Button
                  onClick={form.handleSubmit(onSubmit)}
                  disabled={updateMutation.isPending}
                  className="flex items-center gap-2"
                >
                  <Save className="h-4 w-4" />
                  Save Changes
                </Button>
              </div>
            )}
          </div>
        </div>

        <Tabs defaultValue="overview" className="space-y-6">
          <TabsList>
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="patients">Patients ({providerPatients.length})</TabsTrigger>
            <TabsTrigger value="treatments">Treatments ({providerTreatments.length})</TabsTrigger>
            <TabsTrigger value="invoices">Invoices ({providerTreatments.length})</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-6">
            {/* Statistics Cards */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
              <Card>
                <CardContent className="p-6">
                  <div className="flex items-center">
                    <Users className="h-8 w-8 text-blue-600 mr-3" />
                    <div>
                      <p className="text-sm font-medium text-blue-600">Total Patients</p>
                      <p className="text-2xl font-bold text-blue-900">{providerPatients.length}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-6">
                  <div className="flex items-center">
                    <Activity className="h-8 w-8 text-green-600 mr-3" />
                    <div>
                      <p className="text-sm font-medium text-green-600">Active Treatments</p>
                      <p className="text-2xl font-bold text-green-900">{activeTreatments.length}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-6">
                  <div className="flex items-center">
                    <TrendingUp className="h-8 w-8 text-purple-600 mr-3" />
                    <div>
                      <p className="text-sm font-medium text-purple-600">Completed Treatments</p>
                      <p className="text-2xl font-bold text-purple-900">{completedTreatments.length}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-6">
                  <div className="flex items-center">
                    <DollarSign className="h-8 w-8 text-orange-600 mr-3" />
                    <div>
                      <p className="text-sm font-medium text-orange-600">Total Revenue</p>
                      <p className="text-2xl font-bold text-orange-900">
                        ${providerTreatments.reduce((sum, t) => sum + (Number(t.totalRevenue) || 0), 0).toLocaleString()}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Provider Information Form */}
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                {/* Basic Provider Information */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <User className="h-5 w-5" />
                      Basic Provider Information
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <FormField
                        control={form.control}
                        name="name"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Provider Name *</FormLabel>
                            <FormControl>
                              <Input {...field} disabled={!isEditing} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="taxIdNumber"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Tax ID Number</FormLabel>
                            <FormControl>
                              <Input {...field} value={field.value || ""} disabled={!isEditing} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                  </CardContent>
                </Card>

                {/* Practice Information */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Building className="h-5 w-5" />
                      Practice Information
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <FormField
                        control={form.control}
                        name="practiceName"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Practice Name</FormLabel>
                            <FormControl>
                              <Input {...field} value={field.value || ""} disabled={!isEditing} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="shipToAddress"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Ship To Address</FormLabel>
                            <FormControl>
                              <Textarea {...field} value={field.value || ""} disabled={!isEditing} rows={2} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="city"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>City</FormLabel>
                            <FormControl>
                              <Input {...field} value={field.value || ""} disabled={!isEditing} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="state"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>State</FormLabel>
                            <FormControl>
                              <Input {...field} value={field.value || ""} disabled={!isEditing} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="zipCode"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>ZIP Code</FormLabel>
                            <FormControl>
                              <Input {...field} value={field.value || ""} disabled={!isEditing} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                  </CardContent>
                </Card>

                {/* Contact Information */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Phone className="h-5 w-5" />
                      Contact Information
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <FormField
                        control={form.control}
                        name="contactName"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Contact Name</FormLabel>
                            <FormControl>
                              <Input {...field} value={field.value || ""} disabled={!isEditing} />
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
                            <FormLabel>Contact Phone</FormLabel>
                            <FormControl>
                              <Input {...field} disabled={!isEditing} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="email"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Contact Email</FormLabel>
                            <FormControl>
                              <Input {...field} disabled={!isEditing} type="email" />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="practicePhone"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Practice Phone</FormLabel>
                            <FormControl>
                              <Input {...field} disabled={!isEditing} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="practiceFax"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Practice Fax</FormLabel>
                            <FormControl>
                              <Input {...field} disabled={!isEditing} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="practiceEmail"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Practice Email</FormLabel>
                            <FormControl>
                              <Input {...field} disabled={!isEditing} type="email" />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                  </CardContent>
                </Card>

                {/* Billing NPI Information */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <FileText className="h-5 w-5" />
                      Billing NPI Information
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                      <FormField
                        control={form.control}
                        name="individualNpi"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Individual NPI</FormLabel>
                            <FormControl>
                              <Input {...field} disabled={!isEditing} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="groupNpi"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Group NPI</FormLabel>
                            <FormControl>
                              <Input {...field} disabled={!isEditing} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="ptan"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>PTAN</FormLabel>
                            <FormControl>
                              <Input {...field} disabled={!isEditing} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                  </CardContent>
                </Card>

                {/* Bill To Information */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <MapPin className="h-5 w-5" />
                      Bill To Information
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <FormField
                        control={form.control}
                        name="billToName"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Bill To</FormLabel>
                            <FormControl>
                              <Input {...field} disabled={!isEditing} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="billToCity"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Bill To City</FormLabel>
                            <FormControl>
                              <Input {...field} disabled={!isEditing} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="billToState"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Bill To State</FormLabel>
                            <FormControl>
                              <Input {...field} disabled={!isEditing} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="billToZip"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Bill To ZIP</FormLabel>
                            <FormControl>
                              <Input {...field} disabled={!isEditing} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                  </CardContent>
                </Card>

                {/* Accounts Payable Contact */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Mail className="h-5 w-5" />
                      Accounts Payable Contact
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                      <FormField
                        control={form.control}
                        name="apContactName"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Accounts Payable Contact Name</FormLabel>
                            <FormControl>
                              <Input {...field} disabled={!isEditing} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="apPhone"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Accounts Payable Phone</FormLabel>
                            <FormControl>
                              <Input {...field} disabled={!isEditing} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="apEmail"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Accounts Payable Email</FormLabel>
                            <FormControl>
                              <Input {...field} disabled={!isEditing} type="email" />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                  </CardContent>
                </Card>
              </form>
            </Form>
          </TabsContent>

          <TabsContent value="patients" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Patients Assigned to {provider.name}</CardTitle>
                <p className="text-sm text-muted-foreground">
                  All patients currently assigned to this provider
                </p>
              </CardHeader>
              <CardContent>
                {providerPatients.length > 0 ? (
                  <div className="border rounded-lg overflow-hidden">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Patient</TableHead>
                          <TableHead>Date Added</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead>Wound Type</TableHead>
                          <TableHead>Initial Wound Size</TableHead>
                          <TableHead>Insurance</TableHead>
                          <TableHead>Sales Rep</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {providerPatients.map((patient) => (
                          <TableRow key={patient.id} className="hover:bg-gray-50">
                            <TableCell className="font-medium">
                              {patient.firstName} {patient.lastName}
                            </TableCell>
                            <TableCell>{formatDateSafe(patient.createdAt)}</TableCell>
                            <TableCell>
                              <Badge className="bg-blue-100 text-blue-800 border-blue-300">
                                {patient.patientStatus || 'Evaluation Stage'}
                              </Badge>
                            </TableCell>
                            <TableCell>{patient.woundType || 'Not specified'}</TableCell>
                            <TableCell>{patient.woundSize ? `${patient.woundSize} sq cm` : 'Not specified'}</TableCell>
                            <TableCell>{patient.customInsurance || patient.insurance || 'Not specified'}</TableCell>
                            <TableCell>{patient.salesRep || 'Not assigned'}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                ) : (
                  <div className="text-center py-8">
                    <Users className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                    <p className="text-gray-600">No patients assigned to this provider yet.</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="treatments" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Treatments for {provider.name} Patients</CardTitle>
                <p className="text-sm text-muted-foreground">
                  All treatments performed on patients assigned to this provider
                </p>
              </CardHeader>
              <CardContent>
                {providerTreatments.length > 0 ? (
                  <div className="border rounded-lg overflow-hidden">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Patient</TableHead>
                          <TableHead>Treatment Date</TableHead>
                          <TableHead>Graft Type</TableHead>
                          <TableHead>Wound Size</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead>Revenue</TableHead>
                          <TableHead>Invoice Total</TableHead>
                          <TableHead>Sales Rep</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {providerTreatments.map((treatment) => {
                          const patient = patients.find(p => p.id === treatment.patientId);
                          return (
                            <TableRow key={treatment.id} className="hover:bg-gray-50">
                              <TableCell className="font-medium">
                                {patient ? `${patient.firstName} ${patient.lastName}` : 'Unknown'}
                              </TableCell>
                              <TableCell>{formatDateSafe(treatment.treatmentDate)}</TableCell>
                              <TableCell>{treatment.skinGraftType || 'Not specified'}</TableCell>
                              <TableCell>{treatment.woundSizeAtTreatment ? `${treatment.woundSizeAtTreatment} sq cm` : 'Not specified'}</TableCell>
                              <TableCell>
                                <Badge className={
                                  treatment.status === 'active' ? 'bg-blue-100 text-blue-800 border-blue-300' :
                                  treatment.status === 'completed' ? 'bg-green-100 text-green-800 border-green-300' :
                                  'bg-red-100 text-red-800 border-red-300'
                                }>
                                  {treatment.status || 'active'}
                                </Badge>
                              </TableCell>
                              <TableCell className="font-medium text-green-600">
                                ${(Number(treatment.totalRevenue) || 0).toFixed(2)}
                              </TableCell>
                              <TableCell className="font-medium text-purple-600">
                                ${(Number(treatment.invoiceTotal) || 0).toFixed(2)}
                              </TableCell>
                              <TableCell>{patient?.salesRep || 'Not assigned'}</TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </div>
                ) : (
                  <div className="text-center py-8">
                    <Activity className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                    <p className="text-gray-600">No treatments recorded for this provider's patients yet.</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="invoices" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Invoices for {provider.name} Patients</CardTitle>
                <p className="text-sm text-muted-foreground">
                  All invoices for treatments performed on patients assigned to this provider
                </p>
              </CardHeader>
              <CardContent>
                {providerTreatments.length > 0 ? (
                  <div className="border rounded-lg overflow-hidden">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Invoice Number</TableHead>
                          <TableHead>Invoice Date</TableHead>
                          <TableHead>Payable Date</TableHead>
                          <TableHead>Invoice Status</TableHead>
                          <TableHead>Invoice Total</TableHead>
                          <TableHead>Patient Name</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {providerTreatments.map((treatment) => {
                          const patient = patients.find(p => p.id === treatment.patientId);
                          return (
                            <TableRow key={treatment.id} className="hover:bg-gray-50">
                              <TableCell className="font-medium">
                                {treatment.invoiceNo || 'Not assigned'}
                              </TableCell>
                              <TableCell>{formatDateSafe(treatment.invoiceDate)}</TableCell>
                              <TableCell>{formatDateSafe(treatment.payableDate)}</TableCell>
                              <TableCell>
                                <Badge className={
                                  treatment.invoiceStatus === 'open' ? 'bg-yellow-100 text-yellow-800 border-yellow-300' :
                                  treatment.invoiceStatus === 'payable' ? 'bg-blue-100 text-blue-800 border-blue-300' :
                                  treatment.invoiceStatus === 'closed' ? 'bg-green-100 text-green-800 border-green-300' :
                                  'bg-gray-100 text-gray-800 border-gray-300'
                                }>
                                  {treatment.invoiceStatus || 'open'}
                                </Badge>
                              </TableCell>
                              <TableCell className="font-medium text-purple-600">
                                ${(Number(treatment.invoiceTotal) || 0).toFixed(2)}
                              </TableCell>
                              <TableCell className="font-medium">
                                {patient ? `${patient.firstName} ${patient.lastName}` : 'Unknown'}
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </div>
                ) : (
                  <div className="text-center py-8">
                    <Activity className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                    <p className="text-gray-600">No invoices recorded for this provider's patients yet.</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}