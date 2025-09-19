import { useAuth } from "@/hooks/useAuth";
import { useEffect, useState, useMemo, useRef } from "react";
import { useToast } from "@/hooks/use-toast";
import { formatUSD, formatMDY, titleCase } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Link } from "wouter";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
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
  Plus,
  ArrowUpDown,
  ArrowUp,
  ArrowDown
} from "lucide-react";
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip } from "recharts";
import Navigation from "@/components/ui/navigation";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Textarea } from "@/components/ui/textarea";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { CalendarIcon } from "lucide-react";

import { isUnauthorizedError } from "@/lib/authUtils";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { Patient, SalesRep, Provider, PatientTreatment, InsertPatientTreatment } from "@shared/schema";
import { format, startOfYear, startOfMonth, isAfter, isBefore, parseISO } from "date-fns";

// Form schema matching TreatmentEditDialog exactly
const treatmentFormSchema = z.object({
  patientId: z.number().optional(),
  providerId: z.number().optional(),
  treatmentNumber: z.string().optional(),
  skinGraftType: z.string().optional(),
  qCode: z.string().optional(),
  woundSizeAtTreatment: z.string().optional(),
  pricePerSqCm: z.string().optional(),
  treatmentDate: z.date(),
  status: z.string(),
  notes: z.string().optional(),
  invoiceStatus: z.string(),
  invoiceDate: z.string().optional(),
  invoiceNo: z.string().optional(),
  payableDate: z.string().optional(),
  paymentDate: z.string().optional(),
  invoiceTotal: z.string().optional(),
  referralSourceId: z.number().optional(),
  commissions: z.array(z.object({
    salesRepId: z.number(),
    salesRepName: z.string(),
    commissionRate: z.string(),
    commissionAmount: z.string(),
  })).optional(),
});

type TreatmentFormData = z.infer<typeof treatmentFormSchema>;

export default function PatientTreatments() {
  const { user, isAuthenticated, isLoading } = useAuth();
  const { toast } = useToast();

  // Graft options with ASP pricing and manufacturers
  const graftOptions = [
    { manufacturer: "Biolab", name: "Membrane Wrap", asp: 1190.44, qCode: "Q4205-Q3" },
    { manufacturer: "Biolab", name: "Membrane Hydro", asp: 1864.71, qCode: "Q4290-Q3" },
    { manufacturer: "Biolab", name: "Membrane Tri Layer", asp: 2689.48, qCode: "Q4344-Q3" },
    { manufacturer: "Dermabind", name: "Dermabind Q2", asp: 3337.23, qCode: "Q4313-Q2" },
    { manufacturer: "Dermabind", name: "Dermabind Q3", asp: 3520.69, qCode: "Q4313-Q3" },
    { manufacturer: "Revogen", name: "Revoshield", asp: 1468.11, qCode: "Q4289-Q3" },
    { manufacturer: "Evolution", name: "Esano", asp: 2675.48, qCode: "Q4275-Q3" },
    { manufacturer: "Evolution", name: "Simplimax", asp: 3071.28, qCode: "Q4341-Q3" },
    { manufacturer: "AmchoPlast", name: "AmchoPlast", asp: 4415.97, qCode: "Q4316-Q3" },
    { manufacturer: "Encoll", name: "Helicoll", asp: 1640.93, qCode: "Q4164-Q3" },
  ];
  // Table-specific filters (don't affect dashboard)
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [invoiceStatusFilter, setInvoiceStatusFilter] = useState("all");
  const [dateFilter, setDateFilter] = useState("all");
  const [salesRepFilter, setSalesRepFilter] = useState<string | undefined>(undefined);
  const [customStartDate, setCustomStartDate] = useState("");
  const [customEndDate, setCustomEndDate] = useState("");

  // Dashboard-specific date range filter
  const [dashboardStartDate, setDashboardStartDate] = useState("");
  const [dashboardEndDate, setDashboardEndDate] = useState("");
  const [dashboardDatePreset, setDashboardDatePreset] = useState("all");
  // Comprehensive edit form state
  const [editOpen, setEditOpen] = useState(false);
  const [selectedId, setSelectedId] = useState<number | undefined>(undefined);
  const [editingTreatment, setEditingTreatment] = useState<PatientTreatment | null>(null);
  const [treatmentCommissions, setTreatmentCommissions] = useState<any[]>([]);
  
  // React Hook Form for treatment editing - matches TreatmentEditDialog
  const form = useForm<TreatmentFormData>({
    resolver: zodResolver(treatmentFormSchema),
    defaultValues: {
      treatmentDate: new Date(),
      status: "active",
      invoiceStatus: "open",
      invoiceDate: "",
      payableDate: "",
      paymentDate: "",
      notes: "",
      commissions: [],
    }
  });

  // Mutation for creating/updating treatments
  const treatmentMutation = useMutation({
    mutationFn: async (data: z.infer<typeof treatmentFormSchema>) => {
      if (editingTreatment) {
        // Update existing treatment
        return apiRequest(`/api/treatments/${editingTreatment.id}`, {
          method: 'PATCH',
          body: JSON.stringify(data),
        });
      } else {
        // Create new treatment
        return apiRequest('/api/treatments', {
          method: 'POST',
          body: JSON.stringify(data),
        });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["treatments", "all"] });
      queryClient.invalidateQueries({ queryKey: ["patients"] });
      setEditOpen(false);
      setEditingTreatment(null);
      form.reset();
      toast({
        title: editingTreatment ? "Treatment Updated" : "Treatment Created",
        description: `Treatment has been ${editingTreatment ? "updated" : "created"} successfully.`,
      });
    },
    onError: (error) => {
      console.error('Treatment save error:', error);
      toast({
        title: "Error",
        description: `Failed to ${editingTreatment ? "update" : "create"} treatment. Please try again.`,
        variant: "destructive",
      });
    },
  });

  // Commission assignment functions
  const addCommissionAssignment = () => {
    setTreatmentCommissions([...treatmentCommissions, {
      salesRepId: 0,
      salesRepName: "",
      commissionRate: "0",
      commissionAmount: "0",
    }]);
  };

  const removeCommissionAssignment = (index: number) => {
    setTreatmentCommissions(treatmentCommissions.filter((_, i) => i !== index));
  };

  const updateCommissionAssignment = (index: number, field: string, value: any) => {
    const updated = [...treatmentCommissions];
    updated[index] = { ...updated[index], [field]: value };
    
    if (field === "salesRepId") {
      const salesRep = (salesReps as any[]).find((rep: any) => rep.id === Number(value));
      if (salesRep) {
        updated[index].salesRepName = salesRep.name;
      }
    }
    
    setTreatmentCommissions(updated);
  };

  // Handle edit button click
  const handleEditTreatment = (treatment: PatientTreatment) => {
    setEditingTreatment(treatment);
    
    form.reset({
      patientId: treatment.patientId,
      providerId: treatment.providerId,
      treatmentNumber: treatment.treatmentNumber || "",
      skinGraftType: treatment.skinGraftType || "",
      qCode: treatment.qCode || "",
      woundSizeAtTreatment: treatment.woundSizeAtTreatment?.toString() || "",
      pricePerSqCm: treatment.pricePerSqCm?.toString() || "",
      treatmentDate: new Date(treatment.treatmentDate),
      status: treatment.status || "active",
      notes: treatment.notes || "",
      invoiceStatus: treatment.invoiceStatus || "open",
      invoiceDate: treatment.invoiceDate ? treatment.invoiceDate.toString().split('T')[0] : "",
      invoiceNo: treatment.invoiceNo || "",
      payableDate: treatment.payableDate ? treatment.payableDate.toString().split('T')[0] : "",
      paymentDate: treatment.paymentDate ? treatment.paymentDate.toString().split('T')[0] : "",
      invoiceTotal: treatment.invoiceTotal?.toString() || "",
      referralSourceId: treatment.referralSourceId || undefined,
    });
    
    setEditOpen(true);
  };


  
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
    staleTime: 30000, // 30 seconds - shorter cache to ensure quicker updates
    refetchInterval: 60000, // Refetch every minute to keep data fresh
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
    staleTime: 30000, // 30 seconds - shorter cache to ensure quicker updates
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
      queryClient.invalidateQueries({ predicate: (query) => Boolean(query.queryKey[0]?.toString().includes("/api/referral-sources") && query.queryKey[1]?.toString().includes("/treatments")) });
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
    mutationFn: async ({ treatmentId, field, value, paymentDate }: { treatmentId: number; field: string; value: string; paymentDate?: string }) => {
      const payload: any = { [field]: value };
      if (paymentDate && field === 'invoiceStatus' && value === 'closed') {
        payload.paymentDate = paymentDate;
      }
      await apiRequest("PUT", `/api/treatments/${treatmentId}/status`, payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/treatments/all"] });
      queryClient.invalidateQueries({ predicate: (query) => Boolean(query.queryKey[0]?.toString().includes("/api/referral-sources") && query.queryKey[1]?.toString().includes("/treatments")) });
      setIsPaymentDialogOpen(false);
      setSelectedTreatment(null);
      setPaymentDate("");
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

  // Handle invoice status change with payment date dialog for closed status
  const handleInvoiceStatusChange = (treatment: PatientTreatment, newStatus: string) => {
    if (newStatus === 'closed') {
      setSelectedTreatment(treatment);
      setPaymentDate(format(new Date(), 'yyyy-MM-dd')); // Default to today
      setIsPaymentDialogOpen(true);
    } else {
      updateTreatmentStatusMutation.mutate({
        treatmentId: treatment.id,
        field: 'invoiceStatus',
        value: newStatus
      });
    }
  };

  // Confirm payment with date
  const confirmPayment = () => {
    if (!selectedTreatment || !paymentDate) return;
    
    updateTreatmentStatusMutation.mutate({
      treatmentId: selectedTreatment.id,
      field: 'invoiceStatus',
      value: 'closed',
      paymentDate: paymentDate
    });
  };

  // Create treatment mutation
  const createTreatmentMutation = useMutation({
    mutationFn: async (treatmentData: any) => {
      // Convert date strings to timezone-safe format for backend
      const dataToSend = {
        ...treatmentData,
        treatmentDate: typeof treatmentData.treatmentDate === 'string' 
          ? treatmentData.treatmentDate + 'T00:00:00'
          : treatmentData.treatmentDate,
        invoiceDate: typeof treatmentData.invoiceDate === 'string' && treatmentData.invoiceDate
          ? treatmentData.invoiceDate + 'T00:00:00'
          : treatmentData.invoiceDate,
        payableDate: typeof treatmentData.payableDate === 'string' && treatmentData.payableDate
          ? treatmentData.payableDate + 'T00:00:00'
          : treatmentData.payableDate,
        // Include commission assignments for multi-rep support
        commissionAssignments: treatmentCommissions.filter(tc => tc.salesRepId && parseFloat(tc.commissionRate || "0") > 0)
      };
      
      // Sending treatment data to API
      
      const res = await apiRequest("POST", `/api/patients/${treatmentData.patientId}/treatments`, dataToSend);
      return await res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/treatments/all"] });
      queryClient.invalidateQueries({ predicate: (query) => Boolean(query.queryKey[0]?.toString().includes("/api/referral-sources") && query.queryKey[1]?.toString().includes("/treatments")) });
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

  // Update treatment mutation
  const updateTreatmentMutation = useMutation({
    mutationFn: async (treatmentData: any) => {
      // Convert date strings to timezone-safe format for backend
      const dataToSend = {
        ...treatmentData,
        treatmentDate: typeof treatmentData.treatmentDate === 'string' 
          ? treatmentData.treatmentDate + 'T00:00:00'
          : treatmentData.treatmentDate,
        invoiceDate: typeof treatmentData.invoiceDate === 'string' && treatmentData.invoiceDate
          ? treatmentData.invoiceDate + 'T00:00:00'
          : treatmentData.invoiceDate,
        payableDate: typeof treatmentData.payableDate === 'string' && treatmentData.payableDate
          ? treatmentData.payableDate + 'T00:00:00'
          : treatmentData.payableDate,
        // Include commission assignments for multi-rep support
        commissionAssignments: treatmentCommissions.filter(tc => tc.salesRepId && parseFloat(tc.commissionRate || "0") > 0)
      };
      
      // Updating treatment data via API
      
      const res = await apiRequest("PUT", `/api/patients/${treatmentData.patientId}/treatments/${editingTreatment?.id}`, dataToSend);
      return await res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/treatments/all"] });
      queryClient.invalidateQueries({ predicate: (query) => Boolean(query.queryKey[0]?.toString().includes("/api/referral-sources") && query.queryKey[1]?.toString().includes("/treatments")) });
      setIsAddTreatmentDialogOpen(false);
      setEditingTreatment(null);
      form.reset();
      toast({
        title: "Success",
        description: "Treatment updated successfully!",
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
      
      console.error('Update treatment error:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to update treatment",
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
          formatDateSafe(treatment.treatmentDate),
          treatment.invoiceNo || "",
          treatment.invoiceStatus || "open",
          formatDateSafe(treatment.invoiceDate),
          formatDateSafe(treatment.payableDate),
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

  // Calculate preset date ranges
  const getPresetDateRange = (preset: string) => {
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth();
    
    switch (preset) {
      case 'last-month': {
        const lastMonth = new Date(currentYear, currentMonth - 1, 1);
        const lastMonthEnd = new Date(currentYear, currentMonth, 0);
        return {
          start: lastMonth.toISOString().split('T')[0],
          end: lastMonthEnd.toISOString().split('T')[0]
        };
      }
      case 'month-to-date': {
        const monthStart = new Date(currentYear, currentMonth, 1);
        const monthEnd = new Date(currentYear, currentMonth + 1, 0); // Last day of current month
        return {
          start: monthStart.toISOString().split('T')[0],
          end: monthEnd.toISOString().split('T')[0]
        };
      }
      case 'year-to-date': {
        const yearStart = new Date(currentYear, 0, 1);
        return {
          start: yearStart.toISOString().split('T')[0],
          end: now.toISOString().split('T')[0]
        };
      }
      default:
        return { start: '', end: '' };
    }
  };

  // Dashboard data - separate from table filtering and affected by dashboard date range only
  const dashboardTreatments = useMemo(() => {
    if (!allTreatments || allTreatments.length === 0) return [];
    
    let filtered = allTreatments;
    let startDate = '';
    let endDate = '';

    if (dashboardDatePreset !== 'all' && dashboardDatePreset !== 'custom') {
      const presetRange = getPresetDateRange(dashboardDatePreset);
      startDate = presetRange.start;
      endDate = presetRange.end;
    } else if (dashboardDatePreset === 'custom') {
      startDate = dashboardStartDate;
      endDate = dashboardEndDate;
    }
    
    if (startDate) {
      filtered = filtered.filter(treatment => {
        const treatmentDate = new Date(treatment.treatmentDate);
        const filterStartDate = new Date(startDate);
        return treatmentDate >= filterStartDate;
      });
    }
    
    if (endDate) {
      filtered = filtered.filter(treatment => {
        const treatmentDate = new Date(treatment.treatmentDate);
        const filterEndDate = new Date(endDate);
        filterEndDate.setHours(23, 59, 59, 999); // Include full end date
        return treatmentDate <= filterEndDate;
      });
    }
    
    return filtered;
  }, [allTreatments, dashboardDatePreset, dashboardStartDate, dashboardEndDate]);

  // Calculate invoice totals by status for dashboard (using dashboard date filtered treatments)
  const invoiceTotals = {
    open: dashboardTreatments.filter(treatment => treatment.invoiceStatus === 'open').reduce((sum, treatment) => sum + parseFloat(treatment.invoiceTotal || '0'), 0),
    payable: dashboardTreatments.filter(treatment => treatment.invoiceStatus === 'payable').reduce((sum, treatment) => sum + parseFloat(treatment.invoiceTotal || '0'), 0),
    closed: dashboardTreatments.filter(treatment => treatment.invoiceStatus === 'closed').reduce((sum, treatment) => sum + parseFloat(treatment.invoiceTotal || '0'), 0),
  };

  // Calculate total NXT Commission across dashboard treatments
  const totalNxtCommission = dashboardTreatments.reduce((sum, treatment) => sum + parseFloat(treatment.nxtCommission || '0'), 0);

  // Prepare treatment size data for bar chart by month (using dashboard filtered data)
  const treatmentSizeByMonth = dashboardTreatments.reduce((acc, treatment) => {
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
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount);
  };

  // Timezone-safe date formatter to prevent date shifting issues
  const formatDateSafe = (dateValue: string | Date | null | undefined) => {
    if (!dateValue) return 'Not set';
    
    let date: Date;
    if (typeof dateValue === 'string') {
      // If it's a string in YYYY-MM-DD format, parse it as a local date
      if (dateValue.match(/^\d{4}-\d{2}-\d{2}$/)) {
        const [year, month, day] = dateValue.split('-').map(Number);
        date = new Date(year, month - 1, day); // Create local date without timezone conversion
      } else {
        date = new Date(dateValue);
      }
    } else {
      date = dateValue;
    }
    
    // Use toLocaleDateString to avoid timezone issues
    return date.toLocaleDateString('en-US', { 
      month: '2-digit', 
      day: '2-digit', 
      year: 'numeric' 
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
      
      <div className="max-w-7xl mx-auto px-2 sm:px-4 lg:px-8 py-4 sm:py-8">
        <div className="mb-4 sm:mb-8">
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">Patient Treatments</h1>
          <p className="text-gray-600 mt-2">Track and manage patient treatment records</p>
        </div>

        {/* Dashboard Summary Cards - Admin Only */}
        {(user as any)?.role === 'admin' && (
          <>
            {/* Dashboard Date Range Filter */}
            <Card className="mb-4">
              <CardHeader className="pb-3">
                <CardTitle className="text-lg font-medium">Dashboard Date Filter</CardTitle>
              </CardHeader>
              <CardContent className="pt-0">
                <div className="flex flex-col sm:flex-row gap-4 items-end">
                  <div className="flex-1">
                    <label className="block text-sm font-medium text-gray-700 mb-1">Date Range</label>
                    <Select 
                      value={dashboardDatePreset} 
                      onValueChange={(value) => {
                        setDashboardDatePreset(value);
                        if (value !== 'custom') {
                          setDashboardStartDate("");
                          setDashboardEndDate("");
                        }
                      }}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select date range" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Time</SelectItem>
                        <SelectItem value="last-month">Last Month</SelectItem>
                        <SelectItem value="month-to-date">Month to Date</SelectItem>
                        <SelectItem value="year-to-date">Year to Date</SelectItem>
                        <SelectItem value="custom">Custom Range</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  
                  {dashboardDatePreset === 'custom' && (
                    <>
                      <div className="flex-1">
                        <label className="block text-sm font-medium text-gray-700 mb-1">Start Date</label>
                        <Input
                          type="date"
                          value={dashboardStartDate}
                          onChange={(e) => setDashboardStartDate(e.target.value)}
                          className="w-full"
                        />
                      </div>
                      <div className="flex-1">
                        <label className="block text-sm font-medium text-gray-700 mb-1">End Date</label>
                        <Input
                          type="date"
                          value={dashboardEndDate}
                          onChange={(e) => setDashboardEndDate(e.target.value)}
                          className="w-full"
                        />
                      </div>
                    </>
                  )}
                  
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setDashboardDatePreset("all");
                        setDashboardStartDate("");
                        setDashboardEndDate("");
                      }}
                      className="whitespace-nowrap"
                    >
                      Clear Filter
                    </Button>
                  </div>
                </div>
                {dashboardDatePreset !== 'all' && (
                  <div className="mt-2 text-sm text-gray-600">
                    Dashboard showing {dashboardTreatments.length} of {allTreatments.length} treatments
                    {dashboardDatePreset === 'last-month' && ' from last month'}
                    {dashboardDatePreset === 'month-to-date' && ' from month to date'}
                    {dashboardDatePreset === 'year-to-date' && ' from year to date'}
                    {dashboardDatePreset === 'custom' && dashboardStartDate && ` from ${format(new Date(dashboardStartDate), "MM/dd/yyyy")}`}
                    {dashboardDatePreset === 'custom' && dashboardEndDate && ` to ${format(new Date(dashboardEndDate), "MM/dd/yyyy")}`}
                  </div>
                )}
              </CardContent>
            </Card>

            <div className="grid grid-cols-1 lg:grid-cols-4 gap-4 lg:gap-6 mb-6 lg:mb-8">
              <div className="lg:col-span-3">
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
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
                      {dashboardTreatments.filter(t => t.invoiceStatus === 'open').length} invoice(s)
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
                      {dashboardTreatments.filter(t => t.invoiceStatus === 'payable').length} invoice(s)
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
                      {dashboardTreatments.filter(t => t.invoiceStatus === 'closed').length} invoice(s)
                    </p>
                  </CardContent>
                </Card>

                {/* NXT Commission Total */}
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">NXT Commission</CardTitle>
                    <TrendingUp className="h-4 w-4 text-orange-600" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold text-orange-600">
                      {formatCurrency(totalNxtCommission)}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Total across {dashboardTreatments.length} treatment(s)
                    </p>
                  </CardContent>
                </Card>
                </div>
              </div>
            </div>

            {/* Treatment Size Bar Chart */}
            <div className="lg:col-span-1">
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
          </>
        )}

        <Card>
          <CardHeader>
            <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between">
              <CardTitle className="text-xl font-semibold text-gray-900 mb-4 lg:mb-0">
                Patient Treatments & Revenue Forecast
              </CardTitle>
              
              <div className="flex flex-col sm:flex-row space-y-2 sm:space-y-0 sm:space-x-4">
                <Button 
                  onClick={() => {
                    setEditingTreatment(null);
                    form.reset();
                    setEditOpen(true);
                  }}
                  className="bg-blue-600 hover:bg-blue-700"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Add Treatment
                </Button>
                
                {/* Comprehensive Treatment Edit Dialog */}
                <Dialog open={editOpen} onOpenChange={setEditOpen}>
                  <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
                    <DialogHeader>
                      <DialogTitle className="text-lg font-semibold">
                        {editingTreatment ? 'Edit Treatment' : 'Add New Treatment'}
                      </DialogTitle>
                    </DialogHeader>
                    <Form {...form}>
                      <form id="treatment-form" onSubmit={form.handleSubmit((data) => {
                        treatmentMutation.mutate(data);
                      })} className="space-y-6">
                        {/* Invoice Status Row */}
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                          <FormField
                            control={form.control}
                            name="invoiceStatus"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Invoice Status</FormLabel>
                                <Select 
                                  value={field.value || undefined} 
                                  onValueChange={field.onChange}
                                >
                                  <FormControl>
                                    <SelectTrigger>
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
                            name="invoiceNo"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Invoice Number</FormLabel>
                                <FormControl>
                                  <Input {...field} placeholder="INV-001" />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />

                          <FormField
                            control={form.control}
                            name="invoiceTotal"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Invoice Total</FormLabel>
                                <FormControl>
                                  <Input 
                                    {...field} 
                                    type="number" 
                                    step="0.01" 
                                    placeholder="0.00" 
                                  />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                        </div>

                        {/* Patient Selection for new treatments */}
                        {!editingTreatment && (
                          <FormField
                            control={form.control}
                            name="patientId"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Patient *</FormLabel>
                                <Select
                                  value={field.value ? String(field.value) : undefined}
                                  onValueChange={(v) => field.onChange(v ? Number(v) : undefined)}
                                >
                                  <FormControl>
                                    <SelectTrigger>
                                      <SelectValue placeholder="Select patient" />
                                    </SelectTrigger>
                                  </FormControl>
                                  <SelectContent>
                                    {(patients as any[]).map((patient: any) => (
                                      <SelectItem key={patient.id} value={String(patient.id)}>
                                        {patient.firstName} {patient.lastName}
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                        )}

                        {/* Provider Selection */}
                        <FormField
                          control={form.control}
                          name="providerId"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Acting Provider</FormLabel>
                              <Select
                                value={field.value ? String(field.value) : undefined}
                                onValueChange={(v) => field.onChange(v ? Number(v) : undefined)}
                                disabled={!providers.length}
                              >
                                <FormControl>
                                  <SelectTrigger>
                                    <SelectValue placeholder="Select provider" />
                                  </SelectTrigger>
                                </FormControl>
                                <SelectContent>
                                  {providers.map((provider) => (
                                    <SelectItem key={provider.id} value={String(provider.id)}>
                                      {provider.name}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        {/* Treatment Details */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <FormField
                            control={form.control}
                            name="treatmentNumber"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Treatment Number</FormLabel>
                                <FormControl>
                                  <Input {...field} placeholder="TXN-001" />
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
                                <FormLabel>Treatment Date</FormLabel>
                                <Popover>
                                  <PopoverTrigger asChild>
                                    <FormControl>
                                      <Button
                                        variant={"outline"}
                                        className={`w-full pl-3 text-left font-normal ${!field.value && "text-muted-foreground"}`}
                                      >
                                        {field.value ? format(field.value, "PPP") : "Pick a date"}
                                        <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                                      </Button>
                                    </FormControl>
                                  </PopoverTrigger>
                                  <PopoverContent className="w-auto p-0" align="start">
                                    <Calendar
                                      mode="single"
                                      selected={field.value}
                                      onSelect={field.onChange}
                                      disabled={(date) => date > new Date() || date < new Date("1900-01-01")}
                                      initialFocus
                                    />
                                  </PopoverContent>
                                </Popover>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                        </div>

                        {/* Graft Details */}
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                          <FormField
                            control={form.control}
                            name="skinGraftType"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Skin Graft Type</FormLabel>
                                <FormControl>
                                  <Input {...field} placeholder="e.g. Apligraf" />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />

                          <FormField
                            control={form.control}
                            name="qCode"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Q Code</FormLabel>
                                <FormControl>
                                  <Input {...field} placeholder="Q4101" />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />

                          <FormField
                            control={form.control}
                            name="woundSizeAtTreatment"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Wound Size (sq cm)</FormLabel>
                                <FormControl>
                                  <Input {...field} type="number" placeholder="0" />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                        </div>

                        {/* Commission Assignments */}
                        <div className="space-y-4">
                          <div className="flex items-center justify-between">
                            <FormLabel>Commission Assignments</FormLabel>
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={addCommissionAssignment}
                            >
                              <Plus className="h-4 w-4 mr-2" />
                              Add Commission
                            </Button>
                          </div>

                          {treatmentCommissions.map((commission, index) => (
                            <div key={index} className="flex items-center space-x-2 p-4 border rounded">
                              <Select
                                value={commission.salesRepId ? String(commission.salesRepId) : undefined}
                                onValueChange={(value) => updateCommissionAssignment(index, "salesRepId", Number(value))}
                              >
                                <SelectTrigger className="flex-1">
                                  <SelectValue placeholder="Select sales rep" />
                                </SelectTrigger>
                                <SelectContent>
                                  {(salesReps as any[]).map((rep: any) => (
                                    <SelectItem key={rep.id} value={String(rep.id)}>
                                      {rep.name}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>

                              <Input
                                type="number"
                                placeholder="Rate %"
                                value={commission.commissionRate}
                                onChange={(e) => updateCommissionAssignment(index, "commissionRate", e.target.value)}
                                className="w-24"
                              />

                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={() => removeCommissionAssignment(index)}
                                className="text-red-600"
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          ))}
                        </div>

                        {/* Notes */}
                        <FormField
                          control={form.control}
                          name="notes"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Notes</FormLabel>
                              <FormControl>
                                <Textarea {...field} placeholder="Treatment notes..." />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        {/* Submit Button */}
                        <div className="flex justify-end space-x-2">
                          <Button type="button" variant="outline" onClick={() => setEditOpen(false)}>
                            Cancel
                          </Button>
                          <Button 
                            type="submit" 
                            form="treatment-form"
                            disabled={treatmentMutation.isPending}
                          >
                            {editingTreatment ? "Update Treatment" : "Create Treatment"}
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
                  Sales Rep
                </label>
                <Select
                  value={salesRepFilter ?? undefined}
                  onValueChange={(v) => setSalesRepFilter(v === "ALL" ? undefined : v)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="All reps" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ALL">All reps</SelectItem>
                    {salesReps.map((rep: any) => (
                      <SelectItem key={rep.id} value={rep.name}>
                        {rep.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-900 mb-2">
                  Date Range
                </label>
                <Select value={dateFilter} onValueChange={setDateFilter}>
                  <SelectTrigger>
                    <SelectValue placeholder="All time" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Time</SelectItem>
                    <SelectItem value="today">Today</SelectItem>
                    <SelectItem value="week">This Week</SelectItem>
                    <SelectItem value="month">This Month</SelectItem>
                    <SelectItem value="month-to-date">Month to Date</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Summary Section */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
              <Card>
                <CardContent className="p-4">
                  <div className="text-sm text-gray-600">Total Treatments</div>
                  <div className="text-2xl font-bold text-blue-600">{filteredTreatments.length}</div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4">
                  <div className="text-sm text-gray-600">Total Revenue</div>
                  <div className="text-2xl font-bold text-green-600">
                    {formatCurrency(filteredTreatments.reduce((sum, t) => sum + parseFloat(t.totalRevenue || "0"), 0))}
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4">
                  <div className="text-sm text-gray-600">Invoice Total</div>
                  <div className="text-2xl font-bold text-orange-600">
                    {formatCurrency(filteredTreatments.reduce((sum, t) => sum + parseFloat(t.invoiceTotal || "0"), 0))}
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4">
                  <div className="text-sm text-gray-600">Commission Total</div>
                  <div className="text-2xl font-bold text-purple-600">
                    {formatCurrency(filteredTreatments.reduce((sum, t) => sum + (parseFloat(t.invoiceTotal || "0") * 0.4), 0))}
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Comprehensive Treatments Table */}
            <div className="border rounded-lg overflow-hidden">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-gray-50">
                      <TableHead>Patient</TableHead>
                      <TableHead>Treatment #</TableHead>
                      <TableHead>Treatment Date</TableHead>
                      <TableHead>Treatment Status</TableHead>
                      <TableHead>Invoice No</TableHead>
                      <TableHead>Invoice Status</TableHead>
                      <TableHead>Invoice Date</TableHead>
                      <TableHead>Payable Date</TableHead>
                      <TableHead>Graft Used</TableHead>
                      <TableHead>Q Code</TableHead>
                      <TableHead>Wound Size</TableHead>
                      <TableHead>ASP Price</TableHead>
                      <TableHead>Revenue</TableHead>
                      <TableHead>Invoice (60%)</TableHead>
                      <TableHead>Sales Rep Commission</TableHead>
                      {(user as any)?.role === 'admin' && <TableHead>NXT Commission</TableHead>}
                      <TableHead>Acting Provider</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredTreatments.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={(user as any)?.role === 'admin' ? 18 : 17} className="text-center text-gray-500 py-8">
                          No treatments found matching your criteria
                        </TableCell>
                      </TableRow>
                    ) : (
                      filteredTreatments.map((treatment) => {
                        const invoiceAmount = (parseFloat(treatment.totalRevenue || "0")) * 0.6;
                        
                        return (
                          <TableRow key={treatment.id} className="hover:bg-gray-50">
                            <TableCell className="font-medium text-blue-600" data-testid={`text-patient-name-${treatment.id}`}>
                              <Link href={`/patient-profile/${treatment.patientId}`} className="hover:underline">
                                {(treatment as any).firstName} {(treatment as any).lastName}
                              </Link>
                            </TableCell>
                            <TableCell data-testid={`text-treatment-number-${treatment.id}`}>
                              <Badge variant="outline">
                                #{treatment.treatmentNumber}
                              </Badge>
                            </TableCell>
                            <TableCell className="whitespace-nowrap" data-testid={`text-treatment-date-${treatment.id}`}>
                              {formatMDY(treatment.treatmentDate)}
                            </TableCell>
                            <TableCell data-testid={`text-treatment-status-${treatment.id}`}>
                              <Badge variant={treatment.status === 'completed' ? 'default' : 'secondary'}>
                                {titleCase(treatment.status)}
                              </Badge>
                            </TableCell>
                            <TableCell className="whitespace-nowrap" data-testid={`text-invoice-no-${treatment.id}`}>
                              {treatment.invoiceNo || '—'}
                            </TableCell>
                            <TableCell data-testid={`text-invoice-status-${treatment.id}`}>
                              <Badge variant={treatment.invoiceStatus === 'closed' ? 'default' : 'destructive'}>
                                {titleCase(treatment.invoiceStatus)}
                              </Badge>
                            </TableCell>
                            <TableCell className="whitespace-nowrap" data-testid={`text-invoice-date-${treatment.id}`}>
                              {treatment.invoiceDate ? formatMDY(treatment.invoiceDate) : '—'}
                            </TableCell>
                            <TableCell className="whitespace-nowrap" data-testid={`text-payable-date-${treatment.id}`}>
                              {treatment.payableDate ? formatMDY(treatment.payableDate) : '—'}
                            </TableCell>
                            <TableCell className="whitespace-nowrap" data-testid={`text-graft-used-${treatment.id}`}>
                              {treatment.skinGraftType || '—'}
                            </TableCell>
                            <TableCell className="whitespace-nowrap" data-testid={`text-q-code-${treatment.id}`}>
                              <Badge variant="outline">
                                {treatment.qCode}
                              </Badge>
                            </TableCell>
                            <TableCell className="whitespace-nowrap" data-testid={`text-wound-size-${treatment.id}`}>
                              {treatment.woundSizeAtTreatment} sq cm
                            </TableCell>
                            <TableCell className="text-right font-medium" data-testid={`text-asp-price-${treatment.id}`}>
                              {formatUSD(parseFloat(treatment.pricePerSqCm || "0"))}
                            </TableCell>
                            <TableCell className="text-right font-medium text-green-600" data-testid={`text-revenue-${treatment.id}`}>
                              {formatUSD(parseFloat(treatment.totalRevenue || "0"))}
                            </TableCell>
                            <TableCell className="text-right font-medium text-purple-600" data-testid={`text-invoice-amount-${treatment.id}`}>
                              {formatUSD(invoiceAmount)}
                            </TableCell>
                            <TableCell className="text-right font-medium text-green-600" data-testid={`text-sales-commission-${treatment.id}`}>
                              {formatUSD(parseFloat(treatment.salesRepCommission || "0"))}
                            </TableCell>
                            {(user as any)?.role === 'admin' && (
                              <TableCell className="text-right font-medium text-orange-600" data-testid={`text-nxt-commission-${treatment.id}`}>
                                {formatUSD(parseFloat(treatment.nxtCommission || "0"))}
                              </TableCell>
                            )}
                            <TableCell className="whitespace-nowrap" data-testid={`text-acting-provider-${treatment.id}`}>
                              {treatment.actingProvider || '—'}
                            </TableCell>
                            <TableCell className="text-center" data-testid={`actions-${treatment.id}`}>
                              <button
                                type="button"
                                onClick={() => handleEditTreatment(treatment)}
                                className="text-blue-600 hover:text-blue-700"
                                aria-label="Edit"
                                title="Edit"
                                data-testid={`button-edit-${treatment.id}`}
                              >
                                <Edit className="h-4 w-4" />
                              </button>
                            </TableCell>
                          </TableRow>
                        );
                      })
                    )}
                  </TableBody>
                </Table>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

    </div>
  );
};
