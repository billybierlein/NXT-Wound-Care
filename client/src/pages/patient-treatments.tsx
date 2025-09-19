import { useAuth } from "@/hooks/useAuth";
import { useEffect, useState, useMemo, useRef } from "react";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Link } from "wouter";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Label } from "@/components/ui/label";
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
import TreatmentEditDialog from "@/components/TreatmentEditDialog";

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
  const [customStartDate, setCustomStartDate] = useState("");
  const [customEndDate, setCustomEndDate] = useState("");

  // Dashboard-specific date range filter
  const [dashboardStartDate, setDashboardStartDate] = useState("");
  const [dashboardEndDate, setDashboardEndDate] = useState("");
  const [dashboardDatePreset, setDashboardDatePreset] = useState("all");
  const [isAddTreatmentDialogOpen, setIsAddTreatmentDialogOpen] = useState(false);
  const [editingTreatment, setEditingTreatment] = useState<PatientTreatment | null>(null);
  
  // Shared dialog state
  const [editOpen, setEditOpen] = useState(false);
  const [selectedId, setSelectedId] = useState<number | undefined>(undefined);

  // Payment date dialog state
  const [isPaymentDialogOpen, setIsPaymentDialogOpen] = useState(false);
  const [selectedTreatment, setSelectedTreatment] = useState<PatientTreatment | null>(null);
  const [paymentDate, setPaymentDate] = useState("");
  const [patientSearchOpen, setPatientSearchOpen] = useState(false);
  
  
  // Treatment commissions state for multi-rep commission system
  const [treatmentCommissions, setTreatmentCommissions] = useState<Array<{
    salesRepId: number;
    salesRepName: string;
    commissionRate: string;
    commissionAmount: string;
  }>>([]);

  // Helper functions for commission management
  const addCommissionAssignment = () => {
    const invoiceTotal = parseFloat(form.getValues("invoiceTotal") || "0");
    setTreatmentCommissions(prev => [...prev, {
      salesRepId: 0,
      salesRepName: "",
      commissionRate: "0",
      commissionAmount: "0"
    }]);
  };

  const removeCommissionAssignment = (index: number) => {
    setTreatmentCommissions(prev => {
      const newCommissions = prev.filter((_, i) => i !== index);
      recalculateCommissions(newCommissions);
      return newCommissions;
    });
  };

  const updateCommissionAssignment = (index: number, field: string, value: string) => {
    setTreatmentCommissions(prev => {
      const newCommissions = [...prev];
      if (field === 'salesRepId') {
        newCommissions[index].salesRepId = parseInt(value);
        const selectedRep = salesReps.find(rep => rep.id === parseInt(value));
        if (selectedRep) {
          newCommissions[index].salesRepName = selectedRep.name;
          // Auto-populate rate if not set
          if (!newCommissions[index].commissionRate || newCommissions[index].commissionRate === "0") {
            newCommissions[index].commissionRate = selectedRep.commissionRate?.toString() || "0";
          }
        }
      } else if (field === 'commissionRate') {
        newCommissions[index].commissionRate = value;
      }
      recalculateCommissions(newCommissions);
      return newCommissions;
    });
  };

  const recalculateCommissions = (commissions: typeof treatmentCommissions) => {
    const invoiceTotal = parseFloat(form.getValues("invoiceTotal") || "0");
    const totalCommissionPool = invoiceTotal * 0.4; // 40% total commission pool
    
    let totalSalesRepCommissions = 0;
    commissions.forEach((commission, index) => {
      const rate = parseFloat(commission.commissionRate || "0");
      const amount = invoiceTotal * (rate / 100);
      commission.commissionAmount = amount.toFixed(2);
      totalSalesRepCommissions += amount;
    });
    
    // Calculate NXT commission (remainder from 40% pool)
    const nxtCommission = totalCommissionPool - totalSalesRepCommissions;
    form.setValue("nxtCommission", Math.max(0, nxtCommission).toFixed(2));
    
    // Update form values for backward compatibility (use primary rep if exists)
    if (commissions.length > 0) {
      form.setValue("salesRep", commissions[0].salesRepName);
      form.setValue("salesRepCommissionRate", commissions[0].commissionRate);
      form.setValue("salesRepCommission", commissions[0].commissionAmount);
    } else {
      form.setValue("salesRep", "");
      form.setValue("salesRepCommissionRate", "0");
      form.setValue("salesRepCommission", "0");
    }
  };

  // Calculate total commission percentage
  const totalCommissionPercentage = useMemo(() => {
    return treatmentCommissions.reduce((total, commission) => {
      return total + parseFloat(commission.commissionRate || "0");
    }, 0);
  }, [treatmentCommissions]);
  
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
      salesRep: "",
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

  // Auto-populate commission assignments when dialog opens (only for new treatments, not editing)
  useEffect(() => {
    // Debug: Auto-populate commission assignments when dialog opens
    if (isAddTreatmentDialogOpen && user && salesReps.length > 0 && !editingTreatment) {
      // Reset commission assignments (only for new treatments)
      setTreatmentCommissions([]);
      
      // Small delay to ensure form is reset first
      setTimeout(() => {
        if ((user as any).role === "sales_rep") {
          // For sales rep users, auto-add themselves to commission assignments
          // Auto-populate commission for sales rep user
          const currentUserSalesRep = salesReps.find(rep => rep.name === (user as any).salesRepName);
          // Found matching sales rep
          if (currentUserSalesRep) {
            // Setting commission assignment
            setTreatmentCommissions([{
              salesRepId: currentUserSalesRep.id,
              salesRepName: currentUserSalesRep.name,
              commissionRate: currentUserSalesRep.commissionRate?.toString() || "0",
              commissionAmount: "0"
            }]);
            // Set form values for backward compatibility
            form.setValue("salesRep", currentUserSalesRep.name);
            form.setValue("salesRepCommissionRate", currentUserSalesRep.commissionRate?.toString() || "0");
            // Commission assignment completed
          } else {
            // No matching sales rep found
          }
        }
        // For admin users, commission assignments start empty - they can add manually
      }, 100);
    }
  }, [isAddTreatmentDialogOpen, user, salesReps, form]);

  // Recalculate commissions when invoice total and commission assignments are ready
  useEffect(() => {
    // Only recalculate if we have commission assignments and we're editing
    if (treatmentCommissions.length > 0 && editingTreatment) {
      const invoiceTotal = parseFloat(form.getValues("invoiceTotal") || "0");
      
      if (invoiceTotal > 0) {
        // Small delay to ensure form state is fully updated
        setTimeout(() => {
          recalculateCommissions(treatmentCommissions);
        }, 50);
      }
    }
  }, [treatmentCommissions, editingTreatment, form]);

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
                    setSelectedId(undefined); // Clear selectedId for new treatment
                    setEditOpen(true);
                  }}
                  className="bg-blue-600 hover:bg-blue-700"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Add Treatment
                </Button>
                
                {/* Shared Treatment Edit Dialog - Only mount when open */}
                {editOpen && (
                  <TreatmentEditDialog
                    key={selectedId ?? 'new'}
                    open={editOpen}
                    onOpenChange={setEditOpen}
                    treatmentId={selectedId}
                    onSaved={() => {
                      queryClient.invalidateQueries({ queryKey: ["treatments", "all"] });
                      queryClient.invalidateQueries({ queryKey: ["patients"] });
                    }}
                  />
                )}
                
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
                <Select value={salesRepFilter} onValueChange={setSalesRepFilter}>
                  <SelectTrigger>
                    <SelectValue placeholder="All reps" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Sales Reps</SelectItem>
                    {salesReps.map((rep: any) => (
                      <SelectItem key={rep.id} value={rep.id.toString()}>{rep.name}</SelectItem>
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

            {/* Treatments Table */}
            <div className="border rounded-lg overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow className="bg-gray-50">
                    <TableHead className="text-left">Patient</TableHead>
                    <TableHead className="text-left">Treatment Date</TableHead>
                    <TableHead className="text-left">Invoice Status</TableHead>
                    <TableHead className="text-right">Invoice Total</TableHead>
                    <TableHead className="text-left">Sales Rep</TableHead>
                    <TableHead className="text-center">Status</TableHead>
                    <TableHead className="text-center">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredTreatments.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center text-gray-500 py-8">
                        No treatments found matching your criteria
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredTreatments.map((treatment) => (
                      <TableRow key={treatment.id} className="hover:bg-gray-50">
                        <TableCell className="font-medium text-blue-600" data-testid={`text-patient-name-${treatment.id}`}>
                          <Link href={`/patient-profile/${treatment.patientId}`} className="hover:underline">
                            {treatment.patientName}
                          </Link>
                        </TableCell>
                        <TableCell data-testid={`text-treatment-date-${treatment.id}`}>
                          {treatment.treatmentDate ? format(new Date(treatment.treatmentDate), 'MM/dd/yyyy') : '—'}
                        </TableCell>
                        <TableCell data-testid={`select-invoice-status-${treatment.id}`}>
                          <Select value={treatment.invoiceStatus || 'open'} onValueChange={(value) => handleInvoiceStatusChange(treatment, value)}>
                            <SelectTrigger className="w-24 h-8">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="open">Open</SelectItem>
                              <SelectItem value="payable">Payable</SelectItem>
                              <SelectItem value="closed">Closed</SelectItem>
                            </SelectContent>
                          </Select>
                        </TableCell>
                        <TableCell className="text-right font-medium text-blue-700" data-testid={`text-invoice-total-${treatment.id}`}>
                          {formatCurrency(parseFloat(treatment.invoiceTotal || "0"))}
                        </TableCell>
                        <TableCell data-testid={`text-sales-rep-${treatment.id}`}>
                          {treatment.salesRepName || '—'}
                        </TableCell>
                        <TableCell className="text-center" data-testid={`badge-status-${treatment.id}`}>
                          <Badge variant={treatment.status === 'active' ? 'default' : treatment.status === 'completed' ? 'secondary' : 'destructive'}>
                            {treatment.status}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-center" data-testid={`actions-${treatment.id}`}>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => {
                              setSelectedId(treatment.id);
                              setEditOpen(true);
                            }}
                            className="h-8 w-8 p-0 text-blue-600 hover:text-blue-800"
                            data-testid={`button-edit-${treatment.id}`}
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Payment Date Dialog */}
      <Dialog open={isPaymentDialogOpen} onOpenChange={setIsPaymentDialogOpen}>
                                <div className="w-20">
                                  <Input
                                    type="number"
                                    step="0.01"
                                    min="0"
                                    max="40"
                                    value={commission.commissionRate}
                                    onChange={(e) => updateCommissionAssignment(index, 'commissionRate', e.target.value)}
                                    placeholder="Rate %"
                                    className="text-center"
                                  />
                                </div>
                                
                                <div className="w-24 text-sm text-gray-600">
                                  ${Number(commission.commissionAmount).toFixed(2)}
                                </div>
                                
                                <Button
                                  type="button"
                                  variant="outline"
                                  size="sm"
                                  onClick={() => removeCommissionAssignment(index)}
                                  className="text-red-500 hover:text-red-700"
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </div>
                            ))}
                            
                            {/* Add Rep Button */}
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={addCommissionAssignment}
                              className="w-full"
                              disabled={totalCommissionPercentage >= 40}
                            >
                              <Plus className="h-4 w-4 mr-2" />
                              Add Rep and Commission
                            </Button>
                          </div>
                          
                          {/* Commission Summary */}
                          {form.watch("invoiceTotal") && parseFloat(form.watch("invoiceTotal")) > 0 && (
                            <div className="bg-gray-50 p-3 rounded-md space-y-2">
                              <div className="flex justify-between text-sm">
                                <span>Total Sales Rep Commission:</span>
                                <span className="font-medium text-green-600">
                                  ${treatmentCommissions.reduce((sum, c) => sum + parseFloat(c.commissionAmount || "0"), 0).toFixed(2)}
                                </span>
                              </div>
                              <div className="flex justify-between text-sm">
                                <span>NXT Commission:</span>
                                <span className="font-medium text-orange-600">
                                  ${form.watch("nxtCommission") || "0"}
                                </span>
                              </div>
                              <div className="flex justify-between text-sm font-medium border-t border-gray-200 pt-2">
                                <span>Total Commission (40%):</span>
                                <span>
                                  ${((parseFloat(form.watch("invoiceTotal") || "0")) * 0.4).toFixed(2)}
                                </span>
                              </div>
                            </div>
                          )}
                        </div>

                        {/* Fifth Row - Provider & Treatment Status */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <FormField
                            control={form.control}
                            name="actingProvider"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel className="text-sm font-medium text-gray-700">Provider</FormLabel>
                                <Select 
                                  value={field.value ? String(field.value) : undefined} 
                                  onValueChange={(v) => field.onChange(v || undefined)}
                                >
                                  <FormControl>
                                    <SelectTrigger className="mt-1">
                                      <SelectValue placeholder="Select provider" />
                                    </SelectTrigger>
                                  </FormControl>
                                  <SelectContent>
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
                                      const totalCommission = invoiceTotal * 0.4;
                                      
                                      form.setValue("totalRevenue", revenue.toFixed(2));
                                      form.setValue("invoiceTotal", invoiceTotal.toFixed(2));
                                      
                                      // Recalculate multi-rep commissions
                                      recalculateCommissions(treatmentCommissions);
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
                                      
                                      form.setValue("totalRevenue", revenue.toFixed(2));
                                      form.setValue("invoiceTotal", invoiceTotal.toFixed(2));
                                      
                                      // Recalculate multi-rep commissions
                                      recalculateCommissions(treatmentCommissions);
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
                            
                            <div className={`grid gap-4 ${(user as any)?.role === 'admin' ? 'grid-cols-1 md:grid-cols-3' : 'grid-cols-1'}`}>
                              <div>
                                {(user as any)?.role === 'admin' ? (
                                  // Admin users see calculated commission with current rate
                                  <div>
                                    <FormLabel className="text-sm font-medium text-gray-700">Sales Rep Commission</FormLabel>
                                    <div className="mt-1 p-3 bg-green-50 border border-green-300 rounded-md">
                                      <span className="text-lg font-semibold text-green-700">
                                        {(() => {
                                          const totalRepCommission = treatmentCommissions.reduce((sum, c) => sum + parseFloat(c.commissionAmount || "0"), 0);
                                          const totalRepPercentage = treatmentCommissions.reduce((sum, c) => sum + parseFloat(c.commissionRate || "0"), 0);
                                          return `$${totalRepCommission.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} (${totalRepPercentage}%)`;
                                        })()}
                                      </span>
                                    </div>
                                  </div>
                                ) : (
                                  // Sales reps see auto-calculated commission (read-only)
                                  <>
                                    <FormLabel className="text-sm font-medium text-gray-700">Sales Rep Commission</FormLabel>
                                    <div className="mt-1 p-3 bg-green-50 border border-green-300 rounded-md">
                                      <span className="text-lg font-semibold text-green-700">
                                        {(() => {
                                          const totalRepCommission = treatmentCommissions.reduce((sum, c) => sum + parseFloat(c.commissionAmount || "0"), 0);
                                          const totalRepPercentage = treatmentCommissions.reduce((sum, c) => sum + parseFloat(c.commissionRate || "0"), 0);
                                          return `$${totalRepCommission.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} (${totalRepPercentage}%)`;
                                        })()}
                                      </span>
                                    </div>
                                  </>
                                )}
                              </div>
                              {(user as any)?.role === 'admin' && (
                                <>
                                  <div>
                                    <FormLabel className="text-sm font-medium text-gray-700">Total Commission (40% of Invoice)</FormLabel>
                                    <div className="mt-1 p-3 bg-gray-50 border border-gray-300 rounded-md">
                                      <span className="text-lg font-semibold text-gray-700">
                                        {(() => {
                                          const woundSize = parseFloat(form.watch("woundSizeAtTreatment") || "0");
                                          const pricePerSqCm = parseFloat(form.watch("pricePerSqCm") || "0");
                                          const totalRevenue = woundSize * pricePerSqCm;
                                          const invoiceTotal = totalRevenue * 0.6;
                                          const totalCommission = invoiceTotal * 0.4;
                                          return `$${totalCommission.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
                                        })()}
                                      </span>
                                    </div>
                                  </div>
                                  <div>
                                    <FormLabel className="text-sm font-medium text-gray-700">NXT Commission</FormLabel>
                                    <div className="mt-1 p-3 bg-orange-50 border border-orange-300 rounded-md">
                                      <span className="text-lg font-semibold text-orange-700">
                                        {(() => {
                                          const woundSize = parseFloat(form.watch("woundSizeAtTreatment") || "0");
                                          const pricePerSqCm = parseFloat(form.watch("pricePerSqCm") || "0");
                                          const totalRevenue = woundSize * pricePerSqCm;
                                          const invoiceTotal = totalRevenue * 0.6;
                                          const totalCommission = invoiceTotal * 0.4;
                                          const totalRepCommission = treatmentCommissions.reduce((sum, c) => sum + parseFloat(c.commissionAmount || "0"), 0);
                                          const nxtCommission = totalCommission - totalRepCommission;
                                          return `$${Math.max(0, nxtCommission).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
                                        })()}
                                      </span>
                                    </div>
                                  </div>
                                </>
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
                        <TableRow 
                          key={treatment.id} 
                          className="hover:bg-gray-50 cursor-pointer" 
                          onClick={() => {
                            setSelectedId(treatment.id);
                            setEditOpen(true);
                          }}
                        >
                          <TableCell>
                            <div className="font-medium text-gray-900">
                              <Link 
                                href={`/patient-profile/${treatment.patientId}`}
                                className="text-blue-600 hover:text-blue-800 hover:underline cursor-pointer"
                                onClick={(e) => e.stopPropagation()}
                              >
                                {patientName}
                              </Link>
                            </div>
                          </TableCell>
                          <TableCell>
                            {formatDateSafe(treatment.treatmentDate)}
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
                              <SelectTrigger 
                                className={`w-[120px] h-8 ${
                                  treatment.status === 'active' ? 'bg-blue-50 text-blue-800 border-blue-200' :
                                  treatment.status === 'completed' ? 'bg-green-50 text-green-800 border-green-200' :
                                  treatment.status === 'cancelled' ? 'bg-red-50 text-red-800 border-red-200' :
                                  'bg-gray-50 text-gray-800 border-gray-200'
                                }`}
                                onClick={(e) => e.stopPropagation()}
                              >
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
                              onValueChange={(value) => handleInvoiceStatusChange(treatment, value)}
                              disabled={updateTreatmentStatusMutation.isPending}
                            >
                              <SelectTrigger 
                                className={`w-[120px] h-8 ${
                                  treatment.invoiceStatus === 'open' ? 'bg-yellow-50 text-yellow-800 border-yellow-200' :
                                  treatment.invoiceStatus === 'payable' ? 'bg-blue-50 text-blue-800 border-blue-200' :
                                  treatment.invoiceStatus === 'closed' ? 'bg-green-50 text-green-800 border-green-200' :
                                  'bg-gray-50 text-gray-800 border-gray-200'
                                }`}
                                onClick={(e) => e.stopPropagation()}
                              >
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
                              {formatDateSafe(treatment.invoiceDate)}
                            </span>
                          </TableCell>
                          <TableCell>
                            <span className="text-sm text-gray-900">
                              {formatDateSafe(treatment.payableDate)}
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
                              {formatCurrency(Number(treatment.pricePerSqCm) || 0)}
                            </span>
                          </TableCell>
                          <TableCell>
                            <span className="text-sm font-medium text-green-600">
                              {formatCurrency(Number(treatment.totalRevenue) || 0)}
                            </span>
                          </TableCell>
                          <TableCell>
                            <span className="text-sm font-medium text-purple-600">
                              {formatCurrency(Number(treatment.invoiceTotal) || 0)}
                            </span>
                          </TableCell>
                          <TableCell>
                            <span className="text-sm font-medium text-green-600">
                              {formatCurrency(Number(treatment.salesRepCommission) || 0)}
                            </span>
                          </TableCell>
                          {(user as any)?.role === 'admin' && (
                            <TableCell>
                              <span className="text-sm font-medium text-orange-600">
                                {formatCurrency(Number(treatment.nxtCommission) || 0)}
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
                    
                    {/* Totals Row */}
                    {treatments.length > 0 && (
                      <TableRow className="bg-gray-50 border-t-2 border-gray-200 font-bold">
                        <TableCell colSpan={11} className="text-right font-bold text-gray-900">
                          TOTALS:
                        </TableCell>
                        <TableCell>
                          <span className="text-sm font-bold text-green-600">
                            {formatCurrency(treatments.reduce((sum, t) => sum + (Number(t.totalRevenue) || 0), 0))}
                          </span>
                        </TableCell>
                        <TableCell>
                          <span className="text-sm font-bold text-purple-600">
                            {formatCurrency(treatments.reduce((sum, t) => sum + (Number(t.invoiceTotal) || 0), 0))}
                          </span>
                        </TableCell>
                        <TableCell>
                          <span className="text-sm font-bold text-green-600">
                            {formatCurrency(treatments.reduce((sum, t) => sum + (Number(t.salesRepCommission) || 0), 0))}
                          </span>
                        </TableCell>
                        {(user as any)?.role === 'admin' && (
                          <TableCell>
                            <span className="text-sm font-bold text-orange-600">
                              {formatCurrency(treatments.reduce((sum, t) => sum + (Number(t.nxtCommission) || 0), 0))}
                            </span>
                          </TableCell>
                        )}
                        <TableCell colSpan={3}></TableCell>
                      </TableRow>
                    )}
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

      {/* Payment Date Dialog */}
      <Dialog open={isPaymentDialogOpen} onOpenChange={setIsPaymentDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Mark Invoice as Paid</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label className="text-sm font-medium">Invoice Details</Label>
              <div className="text-sm text-muted-foreground mt-1">
                {selectedTreatment && (
                  <>
                    <div>Invoice #{selectedTreatment.invoiceNo || `INV-${selectedTreatment.id}`}</div>
                    <div>Patient: {(selectedTreatment as any).firstName} {(selectedTreatment as any).lastName}</div>
                    <div>Amount: ${parseFloat(selectedTreatment.invoiceTotal || '0').toLocaleString()}</div>
                  </>
                )}
              </div>
            </div>
            <div>
              <Label htmlFor="payment-date" className="text-sm font-medium">
                Payment Date
              </Label>
              <Input
                id="payment-date"
                type="date"
                value={paymentDate}
                onChange={(e) => setPaymentDate(e.target.value)}
                className="mt-1"
              />
              <div className="text-xs text-muted-foreground mt-1">
                This date determines which commission payment period the invoice belongs to
              </div>
            </div>
          </div>
          <DialogFooter className="flex gap-2">
            <Button 
              variant="outline" 
              onClick={() => setIsPaymentDialogOpen(false)}
            >
              Cancel
            </Button>
            <Button 
              onClick={confirmPayment}
              disabled={!paymentDate || updateTreatmentStatusMutation.isPending}
            >
              {updateTreatmentStatusMutation.isPending ? "Processing..." : "Confirm Payment"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}