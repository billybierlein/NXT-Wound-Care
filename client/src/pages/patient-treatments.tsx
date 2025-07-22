import { useAuth } from "@/hooks/useAuth";
import { useEffect, useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Link } from "wouter";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Check, ChevronsUpDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { 
  Search, 
  Download, 
  Edit, 
  Trash2, 
  Clock, 
  DollarSign,
  TrendingUp,
  Users,
  Activity,
  FolderOpen,
  Calendar,
  Plus,
  ArrowUpDown,
  ArrowUp,
  ArrowDown
} from "lucide-react";
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip } from "recharts";
import Navigation from "@/components/ui/navigation";
import { isUnauthorizedError } from "@/lib/authUtils";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { Patient, SalesRep, Provider, PatientTreatment, InsertPatientTreatment } from "@shared/schema";
import { insertPatientTreatmentSchema } from "@shared/schema";
import { format, startOfYear, startOfMonth, isAfter, isBefore, parseISO } from "date-fns";

export default function PatientTreatments() {
  const { user, isAuthenticated, isLoading } = useAuth();
  const { toast } = useToast();

  // Graft options with ASP pricing and manufacturers
  const graftOptions = [
    { manufacturer: "Biolab", name: "Membrane Wrap", asp: 1190.44, qCode: "Q4205-Q3" },
    { manufacturer: "Biolab", name: "Membrane Hydro", asp: 1864.71, qCode: "Q4290-Q3" },
    { manufacturer: "Biolab", name: "Membrane Tri Layer", asp: 2689.48, qCode: "Q4344-Q3" },
    { manufacturer: "Dermabind", name: "Dermabind", asp: 3337.23, qCode: "Q4313-Q2" },
    { manufacturer: "Dermabind", name: "Dermabind", asp: 3520.69, qCode: "Q4313-Q3" },
    { manufacturer: "Revogen", name: "Revoshield", asp: 1468.11, qCode: "Q4289-Q3" },
    { manufacturer: "Evolution", name: "Esano", asp: 2675.48, qCode: "Q4275-Q3" },
    { manufacturer: "Evolution", name: "Simplimax", asp: 3071.28, qCode: "Q4341-Q3" },
    { manufacturer: "AmchoPlast", name: "AmchoPlast", asp: 4415.97, qCode: "Q4316-Q3" },
    { manufacturer: "Encoll", name: "Helicoll", asp: 1640.93, qCode: "Q4164-Q3" },
  ];
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [invoiceStatusFilter, setInvoiceStatusFilter] = useState("all");
  const [dateFilter, setDateFilter] = useState("all");
  const [customStartDate, setCustomStartDate] = useState("");
  const [customEndDate, setCustomEndDate] = useState("");
  const [isAddTreatmentDialogOpen, setIsAddTreatmentDialogOpen] = useState(false);
  const [patientSearchOpen, setPatientSearchOpen] = useState(false);
  
  // Sorting state
  const [sortField, setSortField] = useState<string | null>(null);
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');

  // Handle sorting
  const handleSort = (field: string) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  // Redirect to login if not authenticated
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

  // Fetch patients for treatment association
  const { data: allPatients = [] } = useQuery<Patient[]>({
    queryKey: ["/api/patients"],
    retry: false,
    enabled: isAuthenticated,
  });

  // Fetch all treatments
  const { data: allTreatments = [], refetch: refetchTreatments } = useQuery<PatientTreatment[]>({
    queryKey: ["/api/treatments/all"],
    queryFn: async () => {
      const response = await fetch("/api/treatments/all", { credentials: "include" });
      if (!response.ok) {
        throw new Error(`${response.status}: ${response.statusText}`);
      }
      return response.json();
    },
    retry: false,
    enabled: isAuthenticated,
    refetchInterval: 10000, // Refetch every 10 seconds for real-time updates
  });

  // Fetch sales reps for treatment form
  const { data: salesReps = [] } = useQuery<SalesRep[]>({
    queryKey: ["/api/sales-reps"],
    retry: false,
    enabled: isAuthenticated,
  });

  // Fetch providers for treatment form  
  const { data: providers = [] } = useQuery<Provider[]>({
    queryKey: ["/api/providers"],
    retry: false,
    enabled: isAuthenticated,
  });

  // Form setup for Add Treatment
  const form = useForm<InsertPatientTreatment>({
    resolver: zodResolver(insertPatientTreatmentSchema.omit({ userId: true })),
    defaultValues: {
      treatmentDate: new Date(),
      treatmentNumber: 1,
      skinGraftType: "",
      qCode: "",
      pricePerSqCm: "0",
      woundSizeAtTreatment: "0",
      totalRevenue: "0",
      invoiceTotal: "0",
      nxtCommission: "0",
      salesRepCommissionRate: "0",
      salesRepCommission: "0",
      status: "active",
      invoiceStatus: "open",
      invoiceDate: "", // Leave blank for sales reps to fill
      invoiceNo: "",
      payableDate: "",
      actingProvider: "",
      notes: "",
    },
  });

  // Auto-populate sales rep for sales rep users when data loads
  useEffect(() => {
    if (user && "role" in user && user.role === "sales_rep" && salesReps.length > 0) {
      const currentUserSalesRep = salesReps.find(rep => rep.name === (user as any).salesRepName);
      if (currentUserSalesRep) {
        form.setValue("salesRepCommissionRate", currentUserSalesRep.commissionRate?.toString() || "0");
      }
    }
  }, [user, salesReps, form]);

  // Helper function to filter treatments by date range
  const filterTreatmentsByDate = (treatments: PatientTreatment[]) => {
    if (dateFilter === "all") return treatments;
    
    const now = new Date();
    let startDate: Date;
    let endDate = now;
    
    if (dateFilter === "ytd") {
      startDate = startOfYear(now);
    } else if (dateFilter === "mtd") {
      startDate = startOfMonth(now);
    } else if (dateFilter === "custom" && customStartDate && customEndDate) {
      startDate = parseISO(customStartDate);
      endDate = parseISO(customEndDate);
    } else {
      return treatments;
    }
    
    return treatments.filter(treatment => {
      const treatmentDate = parseISO(treatment.treatmentDate.toString());
      return isAfter(treatmentDate, startDate) && isBefore(treatmentDate, endDate);
    });
  };

  // Filter treatments based on search, status, invoice status, and date filters
  const filteredTreatments = allTreatments.filter(treatment => {
    // Get patient info for this treatment
    const patient = allPatients.find(p => p.id === treatment.patientId);
    const patientName = patient ? `${patient.firstName} ${patient.lastName}`.toLowerCase() : "";
    
    // Search filter
    const matchesSearch = !searchTerm || 
      patientName.includes(searchTerm.toLowerCase()) ||
      treatment.skinGraftType?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      treatment.qCode?.toLowerCase().includes(searchTerm.toLowerCase());
    
    // Status filter
    const matchesStatus = statusFilter === "all" || treatment.status === statusFilter;
    
    // Invoice status filter
    const matchesInvoiceStatus = invoiceStatusFilter === "all" || treatment.invoiceStatus === invoiceStatusFilter;
    
    return matchesSearch && matchesStatus && matchesInvoiceStatus;
  });

  // Apply date filter
  const dateFilteredTreatments = filterTreatmentsByDate(filteredTreatments);
  
  // Apply sorting
  const treatments = [...dateFilteredTreatments].sort((a, b) => {
    if (!sortField) return 0;
    
    let aValue: any, bValue: any;
    
    if (sortField === 'treatmentDate') {
      aValue = new Date(a.treatmentDate);
      bValue = new Date(b.treatmentDate);
    } else if (sortField === 'invoiceDate') {
      aValue = a.invoiceDate ? new Date(a.invoiceDate) : null;
      bValue = b.invoiceDate ? new Date(b.invoiceDate) : null;
      
      // Handle null values (put them at the end)
      if (!aValue && !bValue) return 0;
      if (!aValue) return 1;
      if (!bValue) return -1;
    }
    
    if (aValue < bValue) return sortDirection === 'asc' ? -1 : 1;
    if (aValue > bValue) return sortDirection === 'asc' ? 1 : -1;
    return 0;
  });

  const deleteTreatmentMutation = useMutation({
    mutationFn: async (treatmentId: number) => {
      await apiRequest("DELETE", `/api/treatments/${treatmentId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/treatments/all"] });
      toast({
        title: "Success",
        description: "Treatment deleted successfully!",
      });
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
        description: error.message || "Failed to delete treatment",
        variant: "destructive",
      });
    },
  });

  // Update treatment status mutation
  const updateTreatmentStatusMutation = useMutation({
    mutationFn: async ({ treatmentId, field, value }: { treatmentId: number; field: string; value: string }) => {
      await apiRequest("PUT", `/api/treatments/${treatmentId}/status`, { [field]: value });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/treatments/all"] });
      toast({
        title: "Success",
        description: "Status updated successfully!",
      });
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
        description: error.message || "Failed to update status",
        variant: "destructive",
      });
    },
  });

  // Create treatment mutation
  const createTreatmentMutation = useMutation({
    mutationFn: async (treatmentData: any) => {
      const res = await apiRequest("POST", `/api/patients/${treatmentData.patientId}/treatments`, treatmentData);
      return await res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/treatments/all"] });
      setIsAddTreatmentDialogOpen(false);
      form.reset();
      toast({
        title: "Success",
        description: "Treatment created successfully!",
      });
    },
    onError: (error: Error) => {
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
        description: error.message || "Failed to create treatment",
        variant: "destructive",
      });
    },
  });

  const handleDeleteTreatment = (treatmentId: number) => {
    if (window.confirm("Are you sure you want to delete this treatment?")) {
      deleteTreatmentMutation.mutate(treatmentId);
    }
  };

  const handleDownloadCSV = async () => {
    try {
      // Create CSV content from filtered treatments
      const csvHeaders = [
        "Patient Name", "Treatment Date", "Invoice No", "Invoice Status", "Invoice Date", "Payable Date",
        "Graft Used", "Q Code", "Wound Size (sq cm)", "ASP Price", "Revenue", "Invoice (60%)", 
        "Sales Rep Commission", ...((user as any)?.role === 'admin' ? ["NXT Commission"] : []),
        "Sales Rep", "Status", "Acting Provider"
      ];
      
      const csvRows = treatments.map(treatment => {
        const patient = allPatients.find(p => p.id === treatment.patientId);
        const patientName = patient ? `${patient.firstName} ${patient.lastName}` : "Unknown";
        
        const baseRow = [
          patientName,
          format(parseISO(treatment.treatmentDate.toString()), "MM/dd/yyyy"),
          treatment.invoiceNo || "",
          treatment.invoiceStatus || "open",
          treatment.invoiceDate ? format(new Date(treatment.invoiceDate), "MM/dd/yyyy") : "",
          treatment.payableDate ? format(new Date(treatment.payableDate), "MM/dd/yyyy") : "",
          treatment.skinGraftType || "",
          treatment.qCode || "",
          treatment.woundSizeAtTreatment || "",
          `$${Number(treatment.pricePerSqCm || 0).toFixed(2)}`,
          `$${Number(treatment.totalRevenue || 0).toFixed(2)}`,
          `$${Number(treatment.invoiceTotal || 0).toFixed(2)}`,
          `$${Number(treatment.salesRepCommission || 0).toFixed(2)}`,
        ];
        
        // Add NXT Commission for admin users
        if ((user as any)?.role === 'admin') {
          baseRow.push(`$${Number(treatment.nxtCommission || 0).toFixed(2)}`);
        }
        
        // Add common fields
        baseRow.push(
          patient?.salesRep || "Not assigned",
          treatment.status || "",
          treatment.actingProvider || ""
        );
        
        return baseRow;
      });
      
      const csvContent = [csvHeaders, ...csvRows]
        .map(row => row.map(field => `"${field}"`).join(","))
        .join("\n");
      
      const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'patient-treatments.csv';
      a.click();
      window.URL.revokeObjectURL(url);
      
      toast({
        title: "Success",
        description: "Treatments CSV downloaded successfully!",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to download CSV",
        variant: "destructive",
      });
    }
  };

  const getPatientStatusBadgeColor = (status: string) => {
    switch (status?.toLowerCase()) {
      case 'evaluation stage':
        return 'bg-yellow-100 text-yellow-800';
      case 'ivr requested':
        return 'bg-blue-100 text-blue-800';
      case 'ivr denied':
        return 'bg-red-100 text-red-800';
      case 'ivr approved':
        return 'bg-green-100 text-green-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getInsuranceBadgeColor = (insurance: string) => {
    const colors: Record<string, string> = {
      medicare: "bg-blue-100 text-blue-800",
      medicaid: "bg-green-100 text-green-800",
      aetna: "bg-purple-100 text-purple-800",
      "blue cross blue shield": "bg-blue-100 text-blue-800",
      bluecross: "bg-blue-100 text-blue-800",
      cigna: "bg-red-100 text-red-800",
      humana: "bg-yellow-100 text-yellow-800",
      "united healthcare": "bg-purple-100 text-purple-800",
      united: "bg-purple-100 text-purple-800",
      "unitedhealthcare-ma": "bg-indigo-100 text-indigo-800",
      "aetna-ma": "bg-purple-100 text-purple-800",
      "cigna-ma": "bg-red-100 text-red-800", 
      "humana-ma": "bg-yellow-100 text-yellow-800",
      "wellcare-ma": "bg-teal-100 text-teal-800",
    };
    return colors[insurance.toLowerCase()] || "bg-gray-100 text-gray-800";
  };

  // Calculate invoice totals by status (using invoiceStatus from treatments)
  const invoiceTotals = {
    open: treatments.filter(treatment => treatment.invoiceStatus === 'open').reduce((sum, treatment) => sum + parseFloat(treatment.invoiceTotal || '0'), 0),
    payable: treatments.filter(treatment => treatment.invoiceStatus === 'payable').reduce((sum, treatment) => sum + parseFloat(treatment.invoiceTotal || '0'), 0),
    closed: treatments.filter(treatment => treatment.invoiceStatus === 'closed').reduce((sum, treatment) => sum + parseFloat(treatment.invoiceTotal || '0'), 0),
  };

  // Prepare treatment size data for bar chart by month
  const treatmentSizeByMonth = treatments.reduce((acc, treatment) => {
    const date = new Date(treatment.treatmentDate);
    const monthYear = `${date.getMonth() + 1}/${date.getFullYear()}`;
    
    if (!acc[monthYear]) {
      acc[monthYear] = 0;
    }
    acc[monthYear] += parseFloat(treatment.woundSizeAtTreatment || '0');
    return acc;
  }, {} as Record<string, number>);

  // Convert to array for recharts
  const chartData = Object.entries(treatmentSizeByMonth)
    .map(([month, size]) => ({ month, size }))
    .sort((a, b) => {
      const [aMonth, aYear] = a.month.split('/').map(Number);
      const [bMonth, bYear] = b.month.split('/').map(Number);
      return aYear - bYear || aMonth - bMonth;
    });

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
    }).format(amount);
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
      
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Patient Treatments</h1>
          <p className="text-gray-600 mt-2">Track and manage patient treatment records</p>
        </div>

        {/* Dashboard Summary Cards - Admin Only */}
        {(user as any)?.role === 'admin' && (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
            <div className="md:col-span-3">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* Open Invoices */}
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Open Invoices</CardTitle>
                    <DollarSign className="h-4 w-4 text-yellow-600" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold text-yellow-600">
                      {formatCurrency(invoiceTotals.open)}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {treatments.filter(t => t.invoiceStatus === 'open').length} invoice(s)
                    </p>
                  </CardContent>
                </Card>

                {/* Payable Invoices */}
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Payable Invoices</CardTitle>
                    <DollarSign className="h-4 w-4 text-blue-600" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold text-blue-600">
                      {formatCurrency(invoiceTotals.payable)}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {treatments.filter(t => t.invoiceStatus === 'payable').length} invoice(s)
                    </p>
                  </CardContent>
                </Card>

                {/* Closed Invoices */}
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Closed Invoices</CardTitle>
                    <DollarSign className="h-4 w-4 text-green-600" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold text-green-600">
                      {formatCurrency(invoiceTotals.closed)}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {treatments.filter(t => t.invoiceStatus === 'closed').length} invoice(s)
                    </p>
                  </CardContent>
                </Card>
              </div>
            </div>

            {/* Treatment Size Bar Chart */}
            <Card>
              <CardHeader>
                <CardTitle className="text-sm font-medium">Squares</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis 
                      dataKey="month" 
                      tick={{ fontSize: 10 }}
                      angle={-45}
                      textAnchor="end"
                      height={60}
                    />
                    <YAxis tick={{ fontSize: 10 }} />
                    <Tooltip 
                      formatter={(value) => [`${value} sq cm`, 'Size']}
                      labelFormatter={(label) => `Month: ${label}`}
                    />
                    <Bar dataKey="size" fill="#8884d8" />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>
        )}

        <Card>
          <CardHeader>
            <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between">
              <CardTitle className="text-xl font-semibold text-gray-900 mb-4 lg:mb-0">
                Patient Treatments & Revenue Forecast
              </CardTitle>
              
              <div className="flex flex-col sm:flex-row space-y-2 sm:space-y-0 sm:space-x-4">
                <Dialog open={isAddTreatmentDialogOpen} onOpenChange={setIsAddTreatmentDialogOpen}>
                  <DialogTrigger asChild>
                    <Button 
                      onClick={() => {
                        form.reset();
                      }}
                      className="bg-blue-600 hover:bg-blue-700"
                    >
                      <Plus className="h-4 w-4 mr-2" />
                      Add Treatment
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
                    <DialogHeader>
                      <DialogTitle>Add New Treatment</DialogTitle>
                    </DialogHeader>
                    <Form {...form}>
                      <form onSubmit={form.handleSubmit((data) => {
                        if (!data.patientId) {
                          toast({
                            title: "Error",
                            description: "Please select a patient",
                            variant: "destructive",
                          });
                          return;
                        }
                        createTreatmentMutation.mutate(data);
                      })} className="space-y-6">
                        
                        {/* Top Row - Invoice Info */}
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                          <FormField
                            control={form.control}
                            name="invoiceStatus"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel className="text-sm font-medium text-gray-700">Invoice Status</FormLabel>
                                <Select value={field.value} onValueChange={field.onChange}>
                                  <FormControl>
                                    <SelectTrigger className="mt-1">
                                      <SelectValue placeholder="Select status" />
                                    </SelectTrigger>
                                  </FormControl>
                                  <SelectContent>
                                    <SelectItem value="open">Open</SelectItem>
                                    <SelectItem value="payable">Payable</SelectItem>
                                    <SelectItem value="closed">Closed</SelectItem>
                                  </SelectContent>
                                </Select>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                          
                          <FormField
                            control={form.control}
                            name="invoiceDate"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel className="text-sm font-medium text-gray-700">Invoice Date</FormLabel>
                                <FormControl>
                                  <Input
                                    type="date"
                                    className="mt-1"
                                    value={field.value || ""}
                                    onChange={(e) => {
                                      const invoiceDate = e.target.value;
                                      field.onChange(invoiceDate);
                                      
                                      // Calculate payable date (invoice date + 30 days)
                                      if (invoiceDate) {
                                        const payableDate = new Date(invoiceDate);
                                        payableDate.setDate(payableDate.getDate() + 30);
                                        form.setValue("payableDate", payableDate.toISOString().split('T')[0]);
                                      }
                                    }}
                                    required
                                  />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                          
                          <FormField
                            control={form.control}
                            name="invoiceNo"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel className="text-sm font-medium text-gray-700">Invoice Number</FormLabel>
                                <FormControl>
                                  <Input
                                    value={field.value || ""}
                                    onChange={field.onChange}
                                    placeholder="INV-001"
                                    className="mt-1"
                                  />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                        </div>

                        {/* Second Row - Dates & Treatment Number */}
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                          <FormField
                            control={form.control}
                            name="treatmentNumber"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel className="text-sm font-medium text-gray-700">Treatment Number</FormLabel>
                                <FormControl>
                                  <Input
                                    type="number"
                                    min="1"
                                    max="8"
                                    value={field.value}
                                    onChange={(e) => field.onChange(parseInt(e.target.value))}
                                    required
                                    className="mt-1"
                                  />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                          
                          <FormField
                            control={form.control}
                            name="payableDate"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel className="text-sm font-medium text-gray-700">Payable Date</FormLabel>
                                <FormControl>
                                  <Input
                                    type="date"
                                    value={field.value || ""}
                                    onChange={field.onChange}
                                    className="mt-1 bg-blue-50 border-blue-200"
                                  />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                          
                          <FormField
                            control={form.control}
                            name="treatmentDate"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel className="text-sm font-medium text-gray-700">Treatment Start Date</FormLabel>
                                <FormControl>
                                  <Input
                                    type="date"
                                    value={field.value instanceof Date ? field.value.toISOString().split('T')[0] : field.value}
                                    onChange={(e) => field.onChange(new Date(e.target.value))}
                                    required
                                    className="mt-1"
                                  />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                        </div>

                        {/* Third Row - Patient & Sales Rep */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <FormField
                            control={form.control}
                            name="patientId"
                            render={({ field }) => (
                              <FormItem className="flex flex-col">
                                <FormLabel className="text-sm font-medium text-gray-700">Patient Name</FormLabel>
                                <Popover open={patientSearchOpen} onOpenChange={setPatientSearchOpen}>
                                  <PopoverTrigger asChild>
                                    <FormControl>
                                      <Button
                                        variant="outline"
                                        role="combobox"
                                        className={cn(
                                          "w-full justify-between mt-1",
                                          !field.value && "text-muted-foreground"
                                        )}
                                      >
                                        {field.value
                                          ? (() => {
                                              const patient = allPatients.find(p => p.id === field.value);
                                              return patient ? `${patient.firstName} ${patient.lastName}` : "Select patient...";
                                            })()
                                          : "Select patient..."}
                                        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                                      </Button>
                                    </FormControl>
                                  </PopoverTrigger>
                                  <PopoverContent className="w-full p-0">
                                    <Command>
                                      <CommandInput placeholder="Search patients..." />
                                      <CommandEmpty>No patient found.</CommandEmpty>
                                      <CommandGroup>
                                        <CommandList>
                                          {allPatients
                                            .filter(patient => patient.patientStatus?.toLowerCase() === 'ivr approved')
                                            .map((patient) => (
                                            <CommandItem
                                              key={patient.id}
                                              value={`${patient.firstName} ${patient.lastName}`}
                                              onSelect={() => {
                                                form.setValue("patientId", patient.id);
                                                setPatientSearchOpen(false);
                                              }}
                                            >
                                              <Check
                                                className={cn(
                                                  "mr-2 h-4 w-4",
                                                  patient.id === field.value
                                                    ? "opacity-100"
                                                    : "opacity-0"
                                                )}
                                              />
                                              {patient.firstName} {patient.lastName}
                                            </CommandItem>
                                          ))}
                                        </CommandList>
                                      </CommandGroup>
                                    </Command>
                                  </PopoverContent>
                                </Popover>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                          
                          <FormField
                            control={form.control}
                            name="salesRepCommissionRate"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel className="text-sm font-medium text-gray-700">Sales Rep</FormLabel>
                                <Select 
                                  value={field.value?.toString() || ""} 
                                  onValueChange={(value) => {
                                    const selectedRep = salesReps.find(rep => rep.commissionRate?.toString() === value);
                                    if (selectedRep) {
                                      field.onChange(value);
                                      
                                      // Recalculate rep commission with new rate
                                      const invoiceTotal = parseFloat(form.getValues("invoiceTotal") || "0");
                                      const repCommission = invoiceTotal * (parseFloat(value) / 100);
                                      form.setValue("salesRepCommission", repCommission.toFixed(2));
                                    }
                                  }}
                                >
                                  <FormControl>
                                    <SelectTrigger className="mt-1">
                                      <SelectValue placeholder="Select sales rep" />
                                    </SelectTrigger>
                                  </FormControl>
                                  <SelectContent>
                                    {salesReps.map((rep: SalesRep) => (
                                      <SelectItem key={rep.id} value={rep.commissionRate?.toString() || "0"}>
                                        {rep.name} ({rep.commissionRate || 0}%)
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                        </div>

                        {/* Fourth Row - Provider & Treatment Status */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <FormField
                            control={form.control}
                            name="actingProvider"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel className="text-sm font-medium text-gray-700">Provider</FormLabel>
                                <Select value={field.value || ""} onValueChange={field.onChange}>
                                  <FormControl>
                                    <SelectTrigger className="mt-1">
                                      <SelectValue placeholder="Select provider" />
                                    </SelectTrigger>
                                  </FormControl>
                                  <SelectContent>
                                    <SelectItem value="none">Select provider</SelectItem>
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
                            name="status"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel className="text-sm font-medium text-gray-700">Treatment Status</FormLabel>
                                <Select value={field.value} onValueChange={field.onChange}>
                                  <FormControl>
                                    <SelectTrigger className="mt-1">
                                      <SelectValue placeholder="Select status" />
                                    </SelectTrigger>
                                  </FormControl>
                                  <SelectContent>
                                    <SelectItem value="active">Active</SelectItem>
                                    <SelectItem value="completed">Completed</SelectItem>
                                    <SelectItem value="cancelled">Cancelled</SelectItem>
                                  </SelectContent>
                                </Select>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                        </div>

                        {/* Fifth Row - Graft & Product Info */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <FormField
                            control={form.control}
                            name="skinGraftType"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel className="text-sm font-medium text-gray-700">Graft</FormLabel>
                                <Select 
                                  value={field.value} 
                                  onValueChange={(value) => {
                                    field.onChange(value);
                                    const selectedGraft = graftOptions.find(g => g.name === value);
                                    if (selectedGraft) {
                                      form.setValue("qCode", selectedGraft.qCode);
                                      form.setValue("pricePerSqCm", selectedGraft.asp.toString());
                                      
                                      // Recalculate values
                                      const woundSize = parseFloat(form.getValues("woundSizeAtTreatment") || "0");
                                      const revenue = woundSize * selectedGraft.asp;
                                      const invoiceTotal = revenue * 0.6;
                                      const nxtCommission = invoiceTotal * 0.3;
                                      
                                      form.setValue("totalRevenue", revenue.toFixed(2));
                                      form.setValue("invoiceTotal", invoiceTotal.toFixed(2));
                                      form.setValue("nxtCommission", nxtCommission.toFixed(2));
                                      
                                      // Recalculate rep commission if rate is already set
                                      const repRate = parseFloat(form.getValues("salesRepCommissionRate") || "0");
                                      if (repRate > 0) {
                                        const repCommission = invoiceTotal * (repRate / 100);
                                        form.setValue("salesRepCommission", repCommission.toFixed(2));
                                      }
                                    }
                                  }}
                                >
                                  <FormControl>
                                    <SelectTrigger className="mt-1">
                                      <SelectValue placeholder="Select graft type" />
                                    </SelectTrigger>
                                  </FormControl>
                                  <SelectContent>
                                    {graftOptions.map((graft) => (
                                      <SelectItem key={graft.name} value={graft.name}>
                                        {graft.name} - ${graft.asp.toLocaleString()}
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
                            name="woundSizeAtTreatment"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel className="text-sm font-medium text-gray-700">Size (sq cm)</FormLabel>
                                <FormControl>
                                  <Input
                                    type="number"
                                    step="0.1"
                                    placeholder="0"
                                    value={field.value || "0"}
                                    onChange={(e) => {
                                      const size = e.target.value;
                                      field.onChange(size);
                                      
                                      // Recalculate values when wound size changes
                                      const pricePerSqCm = parseFloat(form.getValues("pricePerSqCm") || "0");
                                      const revenue = parseFloat(size) * pricePerSqCm;
                                      const invoiceTotal = revenue * 0.6;
                                      const nxtCommission = invoiceTotal * 0.3;
                                      
                                      form.setValue("totalRevenue", revenue.toFixed(2));
                                      form.setValue("invoiceTotal", invoiceTotal.toFixed(2));
                                      form.setValue("nxtCommission", nxtCommission.toFixed(2));
                                      
                                      // Recalculate rep commission if rate is already set
                                      const repRate = parseFloat(form.getValues("salesRepCommissionRate") || "0");
                                      if (repRate > 0) {
                                        const repCommission = invoiceTotal * (repRate / 100);
                                        form.setValue("salesRepCommission", repCommission.toFixed(2));
                                      }
                                    }}
                                    required
                                    className="mt-1"
                                  />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                        </div>

                        {/* Sixth Row - Product Code & Price */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <FormField
                            control={form.control}
                            name="qCode"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel className="text-sm font-medium text-gray-700">Product Code</FormLabel>
                                <FormControl>
                                  <Input
                                    value={field.value || ''}
                                    placeholder="Q4205-Q3"
                                    readOnly
                                    className="mt-1 bg-gray-50"
                                  />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                          
                          <FormField
                            control={form.control}
                            name="pricePerSqCm"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel className="text-sm font-medium text-gray-700">ASP Price per sq cm</FormLabel>
                                <FormControl>
                                  <Input
                                    type="number"
                                    step="0.01"
                                    value={field.value || "0"}
                                    required
                                    className="mt-1 bg-gray-50"
                                    readOnly
                                  />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                        </div>

                        {/* Auto-calculated Financial Fields */}
                        {form.watch("woundSizeAtTreatment") && form.watch("pricePerSqCm") && (
                          <>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                              <div>
                                <FormLabel className="text-sm font-medium text-gray-700">Total Billable (Auto-calculated)</FormLabel>
                                <div className="mt-1 p-3 bg-gray-50 border border-gray-300 rounded-md">
                                  <span className="text-lg font-semibold">
                                    {(() => {
                                      const woundSize = parseFloat(form.watch("woundSizeAtTreatment") || "0");
                                      const pricePerSqCm = parseFloat(form.watch("pricePerSqCm") || "0");
                                      return `$${(woundSize * pricePerSqCm).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
                                    })()}
                                  </span>
                                </div>
                              </div>
                              <div>
                                <FormLabel className="text-sm font-medium text-gray-700">Total Invoice (60% of Billable)</FormLabel>
                                <div className="mt-1 p-3 bg-purple-50 border border-purple-300 rounded-md">
                                  <span className="text-lg font-semibold text-purple-700">
                                    {(() => {
                                      const woundSize = parseFloat(form.watch("woundSizeAtTreatment") || "0");
                                      const pricePerSqCm = parseFloat(form.watch("pricePerSqCm") || "0");
                                      const totalRevenue = woundSize * pricePerSqCm;
                                      const invoiceTotal = totalRevenue * 0.6;
                                      return `$${invoiceTotal.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
                                    })()}
                                  </span>
                                </div>
                              </div>
                            </div>
                            
                            <div className={`grid gap-4 ${(user as any)?.role === 'admin' ? 'grid-cols-1 md:grid-cols-2' : 'grid-cols-1'}`}>
                              <div>
                                <FormLabel className="text-sm font-medium text-gray-700">Sales Rep Commission</FormLabel>
                                <div className="mt-1 p-3 bg-green-50 border border-green-300 rounded-md">
                                  <span className="text-lg font-semibold text-green-700">
                                    {(() => {
                                      const woundSize = parseFloat(form.watch("woundSizeAtTreatment") || "0");
                                      const pricePerSqCm = parseFloat(form.watch("pricePerSqCm") || "0");
                                      const repRate = parseFloat(form.watch("salesRepCommissionRate") || "0");
                                      const totalRevenue = woundSize * pricePerSqCm;
                                      const invoiceTotal = totalRevenue * 0.6;
                                      const repCommission = invoiceTotal * (repRate / 100);
                                      return `$${repCommission.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} (${repRate}%)`;
                                    })()}
                                  </span>
                                </div>
                              </div>
                              {(user as any)?.role === 'admin' && (
                                <div>
                                  <FormLabel className="text-sm font-medium text-gray-700">NXT Commission</FormLabel>
                                  <div className="mt-1 p-3 bg-orange-50 border border-orange-300 rounded-md">
                                    <span className="text-lg font-semibold text-orange-700">
                                      {(() => {
                                        const woundSize = parseFloat(form.watch("woundSizeAtTreatment") || "0");
                                        const pricePerSqCm = parseFloat(form.watch("pricePerSqCm") || "0");
                                        const repRate = parseFloat(form.watch("salesRepCommissionRate") || "0");
                                        const totalRevenue = woundSize * pricePerSqCm;
                                        const invoiceTotal = totalRevenue * 0.6;
                                        const totalCommission = invoiceTotal * 0.3;
                                        const repCommission = invoiceTotal * (repRate / 100);
                                        const nxtCommission = totalCommission - repCommission;
                                        return `$${nxtCommission.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
                                      })()}
                                    </span>
                                  </div>
                                </div>
                              )}
                            </div>
                          </>
                        )}

                        {/* Notes */}
                        <FormField
                          control={form.control}
                          name="notes"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel className="text-sm font-medium text-gray-700">Notes</FormLabel>
                              <FormControl>
                                <Input
                                  value={field.value || ""}
                                  onChange={field.onChange}
                                  placeholder="Treatment notes..."
                                  className="mt-1"
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        <div className="flex justify-end space-x-2 pt-4">
                          <Button
                            type="button"
                            variant="outline"
                            onClick={() => setIsAddTreatmentDialogOpen(false)}
                          >
                            Cancel
                          </Button>
                          <Button 
                            type="submit" 
                            disabled={createTreatmentMutation.isPending}
                            className="px-6 bg-blue-600 hover:bg-blue-700"
                          >
                            {createTreatmentMutation.isPending ? (
                              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                            ) : null}
                            Create Treatment
                          </Button>
                        </div>
                      </form>
                    </Form>
                  </DialogContent>
                </Dialog>
                <Button 
                  onClick={handleDownloadCSV}
                  className="bg-green-600 hover:bg-green-700"
                  disabled={treatments.length === 0}
                >
                  <Download className="h-4 w-4 mr-2" />
                  Download CSV
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {/* Search and Filter Controls */}
            <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-6">
              <div>
                <label className="block text-sm font-medium text-gray-900 mb-2">
                  Search Treatments
                </label>
                <div className="relative">
                  <Input
                    placeholder="Search by patient name, graft, Q code..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10"
                  />
                  <Search className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
                </div>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-900 mb-2">
                  Treatment Status
                </label>
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger>
                    <SelectValue placeholder="All treatments" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Treatments</SelectItem>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="completed">Completed</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-900 mb-2">
                  Invoice Status
                </label>
                <Select value={invoiceStatusFilter} onValueChange={setInvoiceStatusFilter}>
                  <SelectTrigger>
                    <SelectValue placeholder="All invoices" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Invoices</SelectItem>
                    <SelectItem value="open">Open</SelectItem>
                    <SelectItem value="payable">Payable</SelectItem>
                    <SelectItem value="closed">Closed</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-900 mb-2">
                  Date Range
                </label>
                <Select value={dateFilter} onValueChange={setDateFilter}>
                  <SelectTrigger>
                    <SelectValue placeholder="All dates" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Dates</SelectItem>
                    <SelectItem value="ytd">Year to Date</SelectItem>
                    <SelectItem value="mtd">Month to Date</SelectItem>
                    <SelectItem value="custom">Custom Range</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              {dateFilter === "custom" && (
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-sm font-medium text-gray-900 mb-2">
                      Start Date
                    </label>
                    <Input
                      type="date"
                      value={customStartDate}
                      onChange={(e) => setCustomStartDate(e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-900 mb-2">
                      End Date
                    </label>
                    <Input
                      type="date"
                      value={customEndDate}
                      onChange={(e) => setCustomEndDate(e.target.value)}
                    />
                  </div>
                </div>
              )}
              
            </div>

            {/* Treatment Results Summary */}
            <div className="mb-4 text-sm text-gray-600">
              Showing {treatments.length} treatments 
              {statusFilter !== "all" && ` (${statusFilter})`}
              {invoiceStatusFilter !== "all" && ` (${invoiceStatusFilter} invoices)`}
              {dateFilter !== "all" && ` (${dateFilter})`}
            </div>

            {/* Treatments Table */}
            {treatments.length === 0 ? (
              <div className="text-center py-12">
                <FolderOpen className="h-16 w-16 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">No treatments found</h3>
                <p className="text-gray-600 mb-4">
                  {searchTerm || statusFilter !== "all" || invoiceStatusFilter !== "all" || dateFilter !== "all"
                    ? "Try adjusting your search filters"
                    : "Patient treatments will appear here once they are created"}
                </p>
                <Link href="/manage-patients">
                  <Button>
                    <Users className="h-4 w-4 mr-2" />
                    Manage Patients
                  </Button>
                </Link>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Patient Name</TableHead>
                      <TableHead 
                        className="cursor-pointer hover:bg-gray-50"
                        onClick={() => handleSort('treatmentDate')}
                      >
                        <div className="flex items-center space-x-1">
                          <span>Treatment Date</span>
                          {sortField === 'treatmentDate' ? (
                            sortDirection === 'asc' ? <ArrowUp className="h-4 w-4" /> : <ArrowDown className="h-4 w-4" />
                          ) : (
                            <ArrowUpDown className="h-4 w-4 opacity-50" />
                          )}
                        </div>
                      </TableHead>
                      <TableHead>Treatment Status</TableHead>
                      <TableHead>Invoice No</TableHead>
                      <TableHead>Invoice Status</TableHead>
                      <TableHead 
                        className="cursor-pointer hover:bg-gray-50"
                        onClick={() => handleSort('invoiceDate')}
                      >
                        <div className="flex items-center space-x-1">
                          <span>Invoice Date</span>
                          {sortField === 'invoiceDate' ? (
                            sortDirection === 'asc' ? <ArrowUp className="h-4 w-4" /> : <ArrowDown className="h-4 w-4" />
                          ) : (
                            <ArrowUpDown className="h-4 w-4 opacity-50" />
                          )}
                        </div>
                      </TableHead>
                      <TableHead>Payable Date</TableHead>
                      <TableHead>Graft Used</TableHead>
                      <TableHead>Q Code</TableHead>
                      <TableHead>Wound Size</TableHead>
                      <TableHead>ASP Price</TableHead>
                      <TableHead>Revenue</TableHead>
                      <TableHead>Invoice (60%)</TableHead>
                      <TableHead>Sales Rep Commission</TableHead>
                      {(user as any)?.role === 'admin' && <TableHead>NXT Commission</TableHead>}
                      <TableHead>Sales Rep</TableHead>
                      <TableHead>Acting Provider</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {treatments.map((treatment: PatientTreatment) => {
                      const patient = allPatients.find(p => p.id === treatment.patientId);
                      const patientName = patient ? `${patient.firstName} ${patient.lastName}` : "Unknown Patient";
                      const invoiceAmount = (Number(treatment.totalRevenue) || 0) * 0.6;
                      
                      return (
                        <TableRow key={treatment.id} className="hover:bg-gray-50">
                          <TableCell>
                            <div className="font-medium text-gray-900">
                              <Link 
                                href={`/patient-profile/${treatment.patientId}`}
                                className="text-blue-600 hover:text-blue-800 hover:underline cursor-pointer"
                              >
                                {patientName}
                              </Link>
                            </div>
                          </TableCell>
                          <TableCell>
                            {format(parseISO(treatment.treatmentDate.toString()), "MM/dd/yyyy")}
                          </TableCell>
                          <TableCell>
                            <Select
                              value={treatment.status || 'active'}
                              onValueChange={(value) => updateTreatmentStatusMutation.mutate({
                                treatmentId: treatment.id,
                                field: 'status',
                                value: value
                              })}
                              disabled={updateTreatmentStatusMutation.isPending}
                            >
                              <SelectTrigger className={`w-[120px] h-8 ${
                                treatment.status === 'active' ? 'bg-blue-50 text-blue-800 border-blue-200' :
                                treatment.status === 'completed' ? 'bg-green-50 text-green-800 border-green-200' :
                                treatment.status === 'cancelled' ? 'bg-red-50 text-red-800 border-red-200' :
                                'bg-gray-50 text-gray-800 border-gray-200'
                              }`}>
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="active">Active</SelectItem>
                                <SelectItem value="completed">Completed</SelectItem>
                                <SelectItem value="cancelled">Cancelled</SelectItem>
                              </SelectContent>
                            </Select>
                          </TableCell>
                          <TableCell>
                            <span className="text-sm text-gray-900 font-medium">
                              {treatment.invoiceNo || 'Not assigned'}
                            </span>
                          </TableCell>
                          <TableCell>
                            <Select
                              value={treatment.invoiceStatus || 'open'}
                              onValueChange={(value) => updateTreatmentStatusMutation.mutate({
                                treatmentId: treatment.id,
                                field: 'invoiceStatus',
                                value: value
                              })}
                              disabled={updateTreatmentStatusMutation.isPending}
                            >
                              <SelectTrigger className={`w-[120px] h-8 ${
                                treatment.invoiceStatus === 'open' ? 'bg-yellow-50 text-yellow-800 border-yellow-200' :
                                treatment.invoiceStatus === 'payable' ? 'bg-blue-50 text-blue-800 border-blue-200' :
                                treatment.invoiceStatus === 'closed' ? 'bg-green-50 text-green-800 border-green-200' :
                                'bg-gray-50 text-gray-800 border-gray-200'
                              }`}>
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="open">Open</SelectItem>
                                <SelectItem value="payable">Payable</SelectItem>
                                <SelectItem value="closed">Closed</SelectItem>
                              </SelectContent>
                            </Select>
                          </TableCell>
                          <TableCell>
                            <span className="text-sm text-gray-900">
                              {treatment.invoiceDate ? format(new Date(treatment.invoiceDate), "MM/dd/yyyy") : 'Not set'}
                            </span>
                          </TableCell>
                          <TableCell>
                            <span className="text-sm text-gray-900">
                              {treatment.payableDate ? format(new Date(treatment.payableDate), "MM/dd/yyyy") : 'Not set'}
                            </span>
                          </TableCell>
                          <TableCell>
                            <span className="text-sm text-gray-900 font-medium">
                              {treatment.skinGraftType || 'Not specified'}
                            </span>
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">
                              {treatment.qCode || 'Not assigned'}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <span className="text-sm text-gray-900">
                              {treatment.woundSizeAtTreatment ? `${treatment.woundSizeAtTreatment} sq cm` : 'Not specified'}
                            </span>
                          </TableCell>
                          <TableCell>
                            <span className="text-sm font-medium text-green-600">
                              ${(Number(treatment.pricePerSqCm) || 0).toFixed(2)}
                            </span>
                          </TableCell>
                          <TableCell>
                            <span className="text-sm font-medium text-green-600">
                              ${(Number(treatment.totalRevenue) || 0).toFixed(2)}
                            </span>
                          </TableCell>
                          <TableCell>
                            <span className="text-sm font-medium text-purple-600">
                              ${(Number(treatment.invoiceTotal) || 0).toFixed(2)}
                            </span>
                          </TableCell>
                          <TableCell>
                            <span className="text-sm font-medium text-green-600">
                              ${(Number(treatment.salesRepCommission) || 0).toFixed(2)}
                            </span>
                          </TableCell>
                          {(user as any)?.role === 'admin' && (
                            <TableCell>
                              <span className="text-sm font-medium text-orange-600">
                                ${(Number(treatment.nxtCommission) || 0).toFixed(2)}
                              </span>
                            </TableCell>
                          )}
                          <TableCell>
                            <span className="text-sm text-gray-900">
                              {patient?.salesRep || 'Not assigned'}
                            </span>
                          </TableCell>
                          <TableCell>
                            <span className="text-sm text-gray-900">
                              {treatment.actingProvider || 'Not assigned'}
                            </span>
                          </TableCell>
                          <TableCell>
                            <div className="flex space-x-2">
                              <Link href={`/patient-profile/${treatment.patientId}`}>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  className="text-blue-600 hover:text-blue-700"
                                  title="View patient profile"
                                >
                                  <Edit className="h-4 w-4" />
                                </Button>
                              </Link>
                              <Button
                                size="sm"
                                variant="ghost"
                                className="text-red-600 hover:text-red-700"
                                onClick={() => handleDeleteTreatment(treatment.id)}
                                disabled={deleteTreatmentMutation.isPending}
                                title="Delete treatment"
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            )}
            
            {/* Pagination Info */}
            {treatments.length > 0 && (
              <div className="flex items-center justify-between mt-6">
                <div className="text-sm text-gray-500">
                  Showing 1 to {treatments.length} of {treatments.length} treatments
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}