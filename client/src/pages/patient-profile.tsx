import { useState, useEffect, useMemo, useRef } from 'react';
import { useParams, useLocation } from 'wouter';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { cn } from "@/lib/utils";
import { format, parseISO } from 'date-fns';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';
import { useMe } from '@/hooks/useMe';
import { isUnauthorizedError } from '@/lib/authUtils';
import { apiRequest, queryClient } from '@/lib/queryClient';
import Navigation from '@/components/ui/navigation';
import { 
  ArrowLeft, 
  Edit, 
  Save, 
  X, 
  Plus, 
  Calendar,
  Phone,
  Mail,
  Heart,
  TrendingUp,
  Clock,
  User,
  MapPin,
  FileText,
  Trash2,
  DollarSign,
  Activity,
  Check,
  ChevronsUpDown,
  Download,
  Upload
} from 'lucide-react';
import type { 
  Patient, 
  InsertPatient, 
  SalesRep, 
  PatientTimelineEvent, 
  InsertPatientTimelineEvent,
  PatientTreatment,
  InsertPatientTreatment,
  Provider,
  ReferralFile
} from '@shared/schema';
import { toSimpleOptions } from '@shared/constants/grafts';

// Import graft options from centralized source (single source of truth for ASP pricing)
const GRAFT_OPTIONS = toSimpleOptions();

// Form schema for React Hook Form
const treatmentFormSchema = z.object({
  treatmentNumber: z.number().min(1).max(99),
  skinGraftType: z.string().min(1, "Graft selection is required"),
  qCode: z.string().optional(),
  woundSizeAtTreatment: z.string().min(1, "Wound size is required"),
  pricePerSqCm: z.string().min(1, "Price per sq cm is required"),
  treatmentDate: z.string().min(1, "Treatment date is required"),
  status: z.string().min(1, "Status is required"),
  actingProvider: z.string().optional(),
  notes: z.string().optional(),
  invoiceStatus: z.string().min(1, "Invoice status is required"),
  invoiceDate: z.string().optional(),
  invoiceNo: z.string().optional(),
  payableDate: z.string().optional(),
  totalRevenue: z.string().optional(),
  invoiceTotal: z.string().optional(),
  salesRepCommission: z.string().optional(),
  nxtCommission: z.string().optional(),
  salesRepCommissionRate: z.string().optional(),
  salesRep: z.string().optional(),
});

export default function PatientProfile() {
  const { toast } = useToast();
  const { user, isAuthenticated, isLoading } = useAuth();
  const { isAdmin } = useMe();
  const { patientId } = useParams<{ patientId: string }>();
  const [, navigate] = useLocation();
  
  const [isEditing, setIsEditing] = useState(false);
  const [isAddEventDialogOpen, setIsAddEventDialogOpen] = useState(false);
  const [isAddTreatmentDialogOpen, setIsAddTreatmentDialogOpen] = useState(false);
  const [editingEvent, setEditingEvent] = useState<PatientTimelineEvent | null>(null);
  const [editingTreatment, setEditingTreatment] = useState<PatientTreatment | null>(null);
  const [editFormData, setEditFormData] = useState<Partial<InsertPatient>>({});
  const [isUploadFileDialogOpen, setIsUploadFileDialogOpen] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);
  const [timelineFormData, setTimelineFormData] = useState({
    eventType: 'note' as const,
    description: '',
    eventDate: new Date().toISOString().split('T')[0],
    woundSize: undefined as string | undefined,
  });
  // React Hook Form for treatment
  const form = useForm<z.infer<typeof treatmentFormSchema>>({
    resolver: zodResolver(treatmentFormSchema),
    defaultValues: {
      treatmentNumber: 1,
      skinGraftType: 'Dermabind Q3',
      qCode: 'Q4313-Q3',
      woundSizeAtTreatment: '',
      pricePerSqCm: '3520.69',
      treatmentDate: new Date().toISOString().split('T')[0],
      status: 'active',
      actingProvider: undefined as string | undefined,
      notes: '',
      invoiceStatus: 'open',
      invoiceDate: '',
      invoiceNo: '',
      payableDate: '',
      salesRep: '',
      salesRepCommissionRate: '',
    },
  });

  // State for form dialogs and search
  const [patientSearchOpen, setPatientSearchOpen] = useState(false);
  
  // Payment date popup state
  const [confirmDateOpen, setConfirmDateOpen] = useState(false);
  const lastStatusRef = useRef<string | undefined>(undefined);
  
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
        const selectedRep = salesReps.find((rep: SalesRep) => rep.id === parseInt(value));
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

  // Fetch patient data
  const { data: patient, isLoading: patientLoading } = useQuery({
    queryKey: ["/api/patients", patientId],
    queryFn: async () => {
      const response = await fetch(`/api/patients/${patientId}`, {
        credentials: "include"
      });
      if (!response.ok) {
        throw new Error("Failed to fetch patient");
      }
      return response.json();
    },
    enabled: isAuthenticated && !!patientId,
  });

  // Fetch providers for dropdown
  const { data: providers = [] } = useQuery<Provider[]>({
    queryKey: ["/api/providers"],
    enabled: isAuthenticated,
  });

  // Fetch sales reps
  const { data: salesReps = [] } = useQuery<SalesRep[]>({
    queryKey: ["/api/sales-reps"],
    enabled: isAuthenticated,
  });

  // Fetch referral sources for dropdown
  const { data: referralSources = [] } = useQuery({
    queryKey: ["/api/referral-sources"],
    enabled: isAuthenticated,
  });

  // Fetch timeline events
  const { data: timelineEvents = [] } = useQuery({
    queryKey: ["/api/patients", patientId, "timeline"],
    queryFn: async () => {
      const response = await fetch(`/api/patients/${patientId}/timeline`, {
        credentials: "include"
      });
      if (!response.ok) {
        throw new Error("Failed to fetch timeline events");
      }
      return response.json();
    },
    enabled: isAuthenticated && !!patientId,
  });

  // Fetch patient treatments
  const { data: treatments = [] } = useQuery({
    queryKey: ["/api/patients", patientId, "treatments"],
    queryFn: async () => {
      const response = await fetch(`/api/patients/${patientId}/treatments`, {
        credentials: "include"
      });
      if (!response.ok) {
        throw new Error("Failed to fetch treatments");
      }
      return response.json();
    },
    enabled: isAuthenticated && !!patientId && patient?.patientStatus?.toLowerCase() === 'ivr approved',
  });

  // Fetch patient files
  const { data: files = [], isLoading: filesLoading } = useQuery<ReferralFile[]>({
    queryKey: ["/api/patients", patientId, "files"],
    enabled: isAuthenticated && !!patientId,
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
          const currentUserSalesRep = salesReps.find((rep: SalesRep) => rep.name === (user as any).salesRepName);
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

  // Watch invoiceStatus → open payment-date prompt when changing from open→closed
  const status = form.watch("invoiceStatus");
  useEffect(() => {
    if (!isAddTreatmentDialogOpen) {
      lastStatusRef.current = undefined; // Reset when dialog closes
      return;
    }
    const prev = lastStatusRef.current;
    if (!prev) {
      lastStatusRef.current = status;
      return;
    }
    // Only prompt on *change* from open to closed specifically
    if (prev === "open" && status === "closed") {
      setConfirmDateOpen(true);
    }
    lastStatusRef.current = status;
  }, [status, isAddTreatmentDialogOpen]);

  // Update patient mutation
  const updatePatientMutation = useMutation({
    mutationFn: async (updatedPatient: Partial<InsertPatient>) => {
      await apiRequest("PUT", `/api/patients/${patientId}`, updatedPatient);
    },
    onSuccess: () => {
      // Invalidate all patient-related queries for immediate updates
      queryClient.invalidateQueries({ queryKey: ["/api/patients", patientId] });
      queryClient.invalidateQueries({ queryKey: ["/api/patients"] });
      queryClient.invalidateQueries({ queryKey: ["/api/treatments/all"] });
      queryClient.invalidateQueries({ predicate: (query) => query.queryKey[0] === '/api/patients' });
      
      // Force immediate refetch of critical data
      queryClient.refetchQueries({ queryKey: ['/api/patients'] });
      queryClient.refetchQueries({ queryKey: ["/api/treatments/all"] });
      
      setIsEditing(false);
      toast({
        title: "Success",
        description: "Patient updated successfully!",
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
        description: error.message || "Failed to update patient",
        variant: "destructive",
      });
    },
  });

  // Add timeline event mutation
  const addEventMutation = useMutation({
    mutationFn: async (event: Partial<InsertPatientTimelineEvent>) => {
      await apiRequest("POST", `/api/patients/${patientId}/timeline`, event);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/patients", patientId, "timeline"] });
      setIsAddEventDialogOpen(false);
      setTimelineFormData({
        eventType: 'note',
        description: '',
        eventDate: new Date().toISOString().split('T')[0],
        woundSize: undefined,
      });
      toast({
        title: "Success",
        description: "Timeline event added successfully!",
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
        description: error.message || "Failed to add timeline event",
        variant: "destructive",
      });
    },
  });

  // Delete timeline event mutation
  const deleteEventMutation = useMutation({
    mutationFn: async (eventId: number) => {
      await apiRequest("DELETE", `/api/patients/${patientId}/timeline/${eventId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/patients", patientId, "timeline"] });
      toast({
        title: "Success",
        description: "Timeline event deleted successfully!",
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
        description: error.message || "Failed to delete timeline event",
        variant: "destructive",
      });
    },
  });

  // Add treatment mutation
  const addTreatmentMutation = useMutation({
    mutationFn: async (treatment: Partial<InsertPatientTreatment>) => {
      await apiRequest("POST", `/api/patients/${patientId}/treatments`, treatment);
    },
    onSuccess: () => {
      // Force cache refresh with more aggressive invalidation
      queryClient.invalidateQueries({ queryKey: ["/api/patients", patientId, "treatments"] });
      queryClient.invalidateQueries({ queryKey: ["/api/treatments/all"] });
      queryClient.invalidateQueries({ predicate: (query) => query.queryKey[0] === "/api/patients" });
      queryClient.invalidateQueries({ predicate: (query) => Boolean(query.queryKey[0]?.toString().includes("/api/referral-sources") && query.queryKey[1]?.toString().includes("/treatments")) });
      queryClient.refetchQueries({ queryKey: ["/api/treatments/all"] });
      setIsAddTreatmentDialogOpen(false);
      form.reset({
        treatmentNumber: 1,
        skinGraftType: 'Dermabind Q3',
        qCode: 'Q4313-Q3',
        woundSizeAtTreatment: '',
        pricePerSqCm: '3520.69',
        treatmentDate: new Date().toISOString().split('T')[0],
        status: 'active',
        notes: '',
        invoiceStatus: 'open',
        invoiceDate: new Date().toISOString().split('T')[0],
        invoiceNo: '',
        payableDate: new Date().toISOString().split('T')[0],
        salesRepCommissionRate: '',
      });
      toast({
        title: "Success",
        description: "Treatment added successfully!",
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
        description: error.message || "Failed to add treatment",
        variant: "destructive",
      });
    },
  });

  // Update treatment mutation
  const updateTreatmentMutation = useMutation({
    mutationFn: async ({ treatmentId, treatment }: { treatmentId: number; treatment: Partial<InsertPatientTreatment> }) => {
      await apiRequest("PUT", `/api/patients/${patientId}/treatments/${treatmentId}`, treatment);
    },
    onSuccess: () => {
      // Force cache refresh with more aggressive invalidation
      queryClient.invalidateQueries({ queryKey: ["/api/patients", patientId, "treatments"] });
      queryClient.invalidateQueries({ queryKey: ["/api/treatments/all"] });
      queryClient.invalidateQueries({ predicate: (query) => query.queryKey[0] === "/api/patients" });
      queryClient.invalidateQueries({ predicate: (query) => Boolean(query.queryKey[0]?.toString().includes("/api/referral-sources") && query.queryKey[1]?.toString().includes("/treatments")) });
      queryClient.refetchQueries({ queryKey: ["/api/treatments/all"] });
      setIsAddTreatmentDialogOpen(false);
      setEditingTreatment(null);
      form.reset({
        treatmentNumber: 1,
        skinGraftType: 'Dermabind Q3',
        qCode: 'Q4313-Q3',
        woundSizeAtTreatment: '',
        pricePerSqCm: '3520.69',
        treatmentDate: new Date().toISOString().split('T')[0],
        status: 'active',
        notes: '',
        invoiceStatus: 'open',
        invoiceDate: new Date().toISOString().split('T')[0],
        invoiceNo: '',
        payableDate: new Date().toISOString().split('T')[0],
        salesRepCommissionRate: '',
      });
      toast({
        title: "Success",
        description: "Treatment updated successfully!",
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
        description: error.message || "Failed to update treatment",
        variant: "destructive",
      });
    },
  });

  // Delete treatment mutation
  const deleteTreatmentMutation = useMutation({
    mutationFn: async (treatmentId: number) => {
      await apiRequest("DELETE", `/api/patients/${patientId}/treatments/${treatmentId}`);
    },
    onSuccess: () => {
      // Force cache refresh with more aggressive invalidation
      queryClient.invalidateQueries({ queryKey: ["/api/patients", patientId, "treatments"] });
      queryClient.invalidateQueries({ queryKey: ["/api/treatments/all"] });
      queryClient.invalidateQueries({ predicate: (query) => query.queryKey[0] === "/api/patients" });
      queryClient.invalidateQueries({ predicate: (query) => Boolean(query.queryKey[0]?.toString().includes("/api/referral-sources") && query.queryKey[1]?.toString().includes("/treatments")) });
      queryClient.refetchQueries({ queryKey: ["/api/treatments/all"] });
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

  // Upload file mutation
  const uploadFileMutation = useMutation({
    mutationFn: async (fileData: { base64Data: string; fileName: string; fileSize: number; mimeType: string }) => {
      const response = await apiRequest("POST", "/api/referral-files", {
        ...fileData,
        patientId: parseInt(patientId!),
      });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/patients", patientId, "files"] });
      toast({
        title: "Success",
        description: "File uploaded successfully!",
      });
      setIsUploadFileDialogOpen(false);
    },
    onError: (error: any) => {
      toast({
        title: "Upload Failed",
        description: error.message || "Failed to upload file",
        variant: "destructive",
      });
    },
  });

  // Update treatment status mutation (for inline editing)
  const updateTreatmentStatusMutation = useMutation({
    mutationFn: async ({ treatmentId, field, value }: { treatmentId: number; field: string; value: string }) => {
      await apiRequest("PUT", `/api/treatments/${treatmentId}/status`, { [field]: value });
    },
    onSuccess: () => {
      // Force cache refresh with more aggressive invalidation
      queryClient.invalidateQueries({ queryKey: ["/api/patients", patientId, "treatments"] });
      queryClient.invalidateQueries({ queryKey: ["/api/treatments/all"] });
      queryClient.invalidateQueries({ predicate: (query) => query.queryKey[0] === "/api/patients" });
      queryClient.invalidateQueries({ predicate: (query) => Boolean(query.queryKey[0]?.toString().includes("/api/referral-sources") && query.queryKey[1]?.toString().includes("/treatments")) });
      queryClient.refetchQueries({ queryKey: ["/api/treatments/all"] });
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
        description: error.message || "Failed to update treatment status",
        variant: "destructive",
      });
    },
  });

  // Update patient status mutation (for inline editing)
  const updatePatientStatusMutation = useMutation({
    mutationFn: async ({ patientStatus }: { patientStatus: string }) => {
      // Create a clean update object with proper defaults for validation
      const updateData = {
        ...patient,
        patientStatus,
        // Ensure required fields have proper values
        woundType: patient?.woundType || "not-specified",
        woundSize: patient?.woundSize || "0",
        customInsurance: patient?.customInsurance || null,
      };
      
      const response = await apiRequest('PUT', `/api/patients/${patientId}`, updateData);
      if (!response.ok) {
        throw new Error('Failed to update patient status');
      }
      return response.json();
    },
    onSuccess: () => {
      // Invalidate all patient-related queries to ensure immediate updates
      queryClient.invalidateQueries({ queryKey: ['/api/patients', patientId] });
      queryClient.invalidateQueries({ queryKey: ['/api/patients'] });
      queryClient.invalidateQueries({ queryKey: ["/api/treatments/all"] });
      queryClient.invalidateQueries({ predicate: (query) => query.queryKey[0] === '/api/patients' });
      
      // Force immediate refetch of critical data
      queryClient.refetchQueries({ queryKey: ['/api/patients'] });
      queryClient.refetchQueries({ queryKey: ["/api/treatments/all"] });
      
      toast({
        title: "Success",
        description: "Patient status updated successfully",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update patient status",
        variant: "destructive",
      });
    },
  });

  const handleEditSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    // Convert wound type back to database format before submitting
    const denormalizeWoundType = (woundType: string) => {
      const woundTypeMap: { [key: string]: string } = {
        'Diabetic Ulcer': 'diabetic-ulcer',
        'Pressure Ulcer': 'pressure-ulcer',
        'Venous Ulcer': 'venous-ulcer', 
        'Arterial Ulcer': 'arterial-ulcer',
        'Surgical Wound': 'surgical-wound',
        'Traumatic Wound': 'traumatic-wound',
        'Burn': 'burn',
        'Other': 'other'
      };
      return woundTypeMap[woundType] || woundType?.toLowerCase() || '';
    };
    
    const submitData = {
      ...editFormData,
      woundType: denormalizeWoundType(editFormData.woundType || ''),
      // Use the salesRep from editFormData (which comes from patient data) for all users
      salesRep: editFormData.salesRep || ''
    };
    
    // Submitting patient data to API
    
    // editFormData.dateOfBirth is already in YYYY-MM-DD format from the date input
    updatePatientMutation.mutate(submitData);
  };

  const handleTimelineSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    // Convert eventDate string to Date object, set title based on event type, and woundSize to string if present
    const getEventTitle = (eventType: string) => {
      switch (eventType) {
        case 'visit': return 'Patient Visit';
        case 'measurement': return 'Wound Measurement';
        case 'treatment_change': return 'Treatment Change';
        case 'note': return 'Note';
        case 'milestone': return 'Milestone';
        case 'wound_measurement': return 'Wound Measurement';
        case 'appointment': return 'Appointment';
        case 'treatment': return 'Treatment';
        case 'call': return 'Phone Call';
        case 'created': return 'Patient Created';
        default: return 'Timeline Event';
      }
    };

    const eventData = {
      ...timelineFormData,
      title: getEventTitle(timelineFormData.eventType || 'note'),
      eventDate: new Date(timelineFormData.eventDate + 'T00:00:00'),
      woundSize: timelineFormData.woundSize ? timelineFormData.woundSize.toString() : undefined
    };

    addEventMutation.mutate(eventData);
  };

  // Handle graft selection and auto-populate ASP and Q code
  const handleGraftSelection = (graftName: string) => {
    const selectedGraft = GRAFT_OPTIONS.find(graft => graft.name === graftName);
    if (selectedGraft) {
      // Graft selected, updating prices
      form.setValue("qCode", selectedGraft.qCode);
      form.setValue("pricePerSqCm", selectedGraft.asp.toString());
      
      // Recalculate values when graft changes
      const woundSize = parseFloat(form.getValues("woundSizeAtTreatment") || "0");
      const revenue = woundSize * selectedGraft.asp;
      const invoiceTotal = revenue * 0.6;
      const totalCommission = invoiceTotal * 0.4;
      
      form.setValue("totalRevenue", revenue.toFixed(2));
      form.setValue("invoiceTotal", invoiceTotal.toFixed(2));
      
      // Auto-set commission rate for current user
      
      // Auto-set commission rate for sales rep users if not already set
      let repRate = parseFloat(form.getValues("salesRepCommissionRate") || "0");
      // Getting current commission rate
      
      if (repRate === 0 && user && (user as any).role === "sales_rep") {
        // Auto-setting commission rate
        const currentUserSalesRep = salesReps?.find(rep => rep.name === (user as any).salesRepName);
        // Found sales rep for commission
        if (currentUserSalesRep?.commissionRate) {
          repRate = parseFloat(currentUserSalesRep.commissionRate.toString());
          form.setValue("salesRepCommissionRate", repRate.toString());
          // Commission rate set
        }
      }
      
      // Calculating commissions with new rates
      if (repRate > 0) {
        const repCommission = invoiceTotal * (repRate / 100);
        // Rep commission calculated
        form.setValue("salesRepCommission", repCommission.toFixed(2));
        // Update NXT commission after deducting rep commission
        form.setValue("nxtCommission", (totalCommission - repCommission).toFixed(2));
      } else {
        form.setValue("salesRepCommission", "0");
        form.setValue("nxtCommission", totalCommission.toFixed(2));
        // No commission rate found, defaulting to 0
      }
    }
  };

  // React Hook Form submit handler
  const onSubmit = (data: z.infer<typeof treatmentFormSchema>) => {
    console.log("✅ onSubmit called with data:", data);
    console.log("✅ treatmentCommissions state:", treatmentCommissions);
    const woundSize = parseFloat(data.woundSizeAtTreatment || '0');
    const pricePerSqCm = parseFloat(data.pricePerSqCm || '0');
    
    // Calculate revenue fields
    const totalRevenue = woundSize * pricePerSqCm;
    const invoiceTotal = totalRevenue * 0.6;
    
    const treatmentData = {
      patientId: parseInt(patientId),
      treatmentNumber: data.treatmentNumber,
      woundSizeAtTreatment: woundSize.toFixed(2),
      skinGraftType: data.skinGraftType,
      qCode: data.qCode,
      pricePerSqCm: pricePerSqCm.toFixed(2),
      totalRevenue: totalRevenue.toFixed(2),
      invoiceTotal: invoiceTotal.toFixed(2),
      nxtCommission: data.nxtCommission || '0',
      salesRepCommissionRate: data.salesRepCommissionRate || '0',
      salesRepCommission: data.salesRepCommission || '0',
      treatmentDate: typeof data.treatmentDate === 'string' 
        ? data.treatmentDate + 'T00:00:00'
        : data.treatmentDate,
      invoiceDate: typeof data.invoiceDate === 'string' && data.invoiceDate
        ? data.invoiceDate + 'T00:00:00'
        : data.invoiceDate,
      payableDate: typeof data.payableDate === 'string' && data.payableDate
        ? data.payableDate + 'T00:00:00'
        : data.payableDate,
      status: data.status,
      actingProvider: data.actingProvider === '' ? null : data.actingProvider,
      notes: data.notes || '',
      invoiceStatus: data.invoiceStatus || 'open',
      invoiceNo: data.invoiceNo || '',
      salesRep: data.salesRep || '',
      // Include commission assignments for multi-rep support
      commissionAssignments: treatmentCommissions.filter(tc => tc.salesRepId && parseFloat(tc.commissionRate || "0") > 0)
    };

    if (editingTreatment) {
      updateTreatmentMutation.mutate({ treatmentId: editingTreatment.id, treatment: treatmentData });
    } else {
      addTreatmentMutation.mutate(treatmentData);
    }
  };

  const handleTreatmentUpdate = (treatmentId: number, updatedData: Partial<InsertPatientTreatment>) => {
    updateTreatmentMutation.mutate({ treatmentId, treatment: updatedData });
  };

  const calculateTreatmentRevenue = (woundSize: number, pricePerSqCm: number) => {
    const totalRevenue = woundSize * pricePerSqCm;
    const invoiceAmount = totalRevenue * 0.6; // 60% invoice conversion
    const nxtCommission = invoiceAmount * 0.3; // 30% NXT commission
    return {
      totalRevenue,
      invoiceAmount,
      nxtCommission,
    };
  };

  const handleEdit = () => {
    setIsEditing(true);
    
    // Debug: Preparing patient data for edit form
    
    // Normalize wound type from database format to display format
    const normalizeWoundType = (woundType: string) => {
      const woundTypeMap: { [key: string]: string } = {
        'diabetic-ulcer': 'Diabetic Ulcer',
        'pressure-ulcer': 'Pressure Ulcer', 
        'venous-ulcer': 'Venous Ulcer',
        'arterial-ulcer': 'Arterial Ulcer',
        'surgical-wound': 'Surgical Wound',
        'traumatic-wound': 'Traumatic Wound',
        'burn': 'Burn',
        'other': 'Other'
      };
      return woundTypeMap[woundType?.toLowerCase()] || woundType || '';
    };
    
    // Keep dateOfBirth in YYYY-MM-DD format for date input field
    let dateForInput = patient?.dateOfBirth || '';
    if (dateForInput && dateForInput.match(/^\d{2}\/\d{2}\/\d{4}$/)) {
      // If it's in MM/DD/YYYY format, convert to YYYY-MM-DD
      const [month, day, year] = dateForInput.split('/');
      dateForInput = `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
    }
    
    const formData = {
      firstName: patient?.firstName || '',
      lastName: patient?.lastName || '',
      dateOfBirth: dateForInput,
      phoneNumber: patient?.phoneNumber || '',
      insurance: patient?.insurance || '',
      customInsurance: patient?.customInsurance || '',
      woundType: normalizeWoundType(patient?.woundType || ''),
      woundSize: patient?.woundSize || '',
      referralSource: patient?.referralSource || '',
      referralSourceId: patient?.referralSourceId || null,
      salesRep: patient?.salesRep || '',
      provider: patient?.provider || '',
      patientStatus: patient?.patientStatus || 'Evaluation Stage',
      notes: patient?.notes || '',
    };
    
    // Setting edit form data
    setEditFormData(formData);
  };

  const handleCancel = () => {
    setIsEditing(false);
    setEditFormData({});
  };

  // File upload handlers
  const handleFileUpload = async (file: File) => {
    if (file.type !== "application/pdf" && !file.type.startsWith("image/")) {
      toast({
        title: "Invalid File",
        description: "Only PDF files and images are allowed",
        variant: "destructive",
      });
      return;
    }

    const reader = new FileReader();
    reader.onload = async () => {
      const base64Data = reader.result?.toString().split(",")[1];
      if (!base64Data) return;

      uploadFileMutation.mutate({
        base64Data,
        fileName: file.name,
        fileSize: file.size,
        mimeType: file.type,
      });
    };
    reader.readAsDataURL(file);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    
    const files = Array.from(e.dataTransfer.files);
    if (files.length > 0) {
      handleFileUpload(files[0]);
    }
  };

  const formatDate = (dateString: string) => {
    if (!dateString) return '';
    
    // If it's already in YYYY-MM-DD format, parse it safely to avoid timezone issues
    if (dateString.match(/^\d{4}-\d{2}-\d{2}$/)) {
      const [year, month, day] = dateString.split('-');
      const date = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
      return date.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
      });
    }
    
    // Fallback for other formats
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  }

  // Timezone-safe date formatter for treatment table (MM/dd/yyyy format)
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

  // Format timestamp for timeline events (Eastern time)
  const formatTimestamp = (dateString: string) => {
    const date = new Date(dateString);
    
    // Convert to Eastern Time
    const easternTime = new Intl.DateTimeFormat('en-US', {
      timeZone: 'America/New_York',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
      month: '2-digit',
      day: '2-digit',
      year: 'numeric'
    }).formatToParts(date);
    
    const month = easternTime.find(part => part.type === 'month')?.value;
    const day = easternTime.find(part => part.type === 'day')?.value;
    const year = easternTime.find(part => part.type === 'year')?.value;
    const hour = easternTime.find(part => part.type === 'hour')?.value;
    const minute = easternTime.find(part => part.type === 'minute')?.value;
    const dayPeriod = easternTime.find(part => part.type === 'dayPeriod')?.value;
    
    return {
      time: `${hour}:${minute} ${dayPeriod}`,
      date: `${month}${day}${year}` // MMDDYYYY format
    };
  };

  const getEventTypeColor = (eventType: string) => {
    switch (eventType) {
      case 'visit':
        return 'bg-indigo-100 text-indigo-800 border-indigo-200';
      case 'measurement':
      case 'wound_measurement':
        return 'bg-orange-100 text-orange-800 border-orange-200';
      case 'treatment_change':
      case 'treatment':
        return 'bg-red-100 text-red-800 border-red-200';
      case 'note':
        return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'milestone':
        return 'bg-purple-100 text-purple-800 border-purple-200';
      case 'appointment':
        return 'bg-green-100 text-green-800 border-green-200';
      case 'call':
        return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'created':
        return 'bg-gray-100 text-gray-800 border-gray-200';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const getInsuranceBadgeColor = (insurance: string) => {
    switch (insurance?.toLowerCase()) {
      case 'medicare':
        return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'medicaid':
        return 'bg-green-100 text-green-800 border-green-200';
      case 'private':
        return 'bg-purple-100 text-purple-800 border-purple-200';
      case 'unitedhealthcare medicare advantage':
      case 'aetna medicare advantage':
      case 'cigna medicare advantage':
      case 'humana medicare advantage':
      case 'wellcare medicare advantage':
        return 'bg-indigo-100 text-indigo-800 border-indigo-200';
      case 'none':
        return 'bg-red-100 text-red-800 border-red-200';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const getPatientStatusBadgeColor = (status: string) => {
    switch (status?.toLowerCase()) {
      case 'evaluation stage':
        return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'ivr requested':
        return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'ivr denied':
        return 'bg-red-100 text-red-800 border-red-200';
      case 'ivr approved':
        return 'bg-green-100 text-green-800 border-green-200';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  if (isLoading || patientLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-gray-600">Loading patient profile...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated || !patient) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Navigation />
      
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-6 flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <Button
              variant="outline"
              onClick={() => navigate('/manage-patients')}
              className="flex items-center"
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Patients
            </Button>
            <div>
              <h1 className="text-3xl font-bold text-gray-900">
                {patient.firstName} {patient.lastName}
              </h1>
              <p className="text-gray-600">Patient Profile</p>
            </div>
          </div>
          <div className="flex items-center space-x-3">
            {!isEditing ? (
              <Button onClick={handleEdit} className="flex items-center">
                <Edit className="h-4 w-4 mr-2" />
                Edit Patient
              </Button>
            ) : (
              <div className="flex items-center space-x-2">
                <Button
                  variant="outline"
                  onClick={handleCancel}
                  disabled={updatePatientMutation.isPending}
                >
                  <X className="h-4 w-4 mr-2" />
                  Cancel
                </Button>
                <Button
                  onClick={handleEditSubmit}
                  disabled={updatePatientMutation.isPending}
                >
                  {updatePatientMutation.isPending ? (
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                  ) : (
                    <Save className="h-4 w-4 mr-2" />
                  )}
                  Save Changes
                </Button>
              </div>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Patient Information */}
          <div className="lg:col-span-2">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <User className="h-5 w-5 mr-2" />
                  Patient Information
                </CardTitle>
              </CardHeader>
              <CardContent>
                {!isEditing ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-4">
                      <div>
                        <Label className="text-sm font-medium text-gray-500">Full Name</Label>
                        <p className="text-lg font-semibold text-gray-900">
                          {patient.firstName} {patient.lastName}
                        </p>
                      </div>
                      <div>
                        <Label className="text-sm font-medium text-gray-500">Date of Birth</Label>
                        <p className="text-gray-900">{formatDate(patient.dateOfBirth)}</p>
                      </div>
                      <div>
                        <Label className="text-sm font-medium text-gray-500">Phone Number</Label>
                        <p className="text-gray-900 flex items-center">
                          <Phone className="h-4 w-4 mr-2" />
                          {patient.phoneNumber}
                        </p>
                      </div>
                      <div>
                        <Label className="text-sm font-medium text-gray-500">Insurance</Label>
                        <div className="mt-1">
                          <Badge className={getInsuranceBadgeColor(patient.insurance)}>
                            {patient.insurance === 'Other' && patient.customInsurance 
                              ? patient.customInsurance 
                              : patient.insurance}
                          </Badge>
                        </div>
                      </div>
                    </div>
                    <div className="space-y-4">
                      <div>
                        <Label className="text-sm font-medium text-gray-500">Wound Type</Label>
                        <p className="text-gray-900 flex items-center">
                          <Heart className="h-4 w-4 mr-2" />
                          {patient.woundType || 'Not specified'}
                        </p>
                      </div>
                      <div>
                        <Label className="text-sm font-medium text-gray-500">Initial Wound Size</Label>
                        <p className="text-gray-900 flex items-center">
                          <TrendingUp className="h-4 w-4 mr-2" />
                          {patient.woundSize ? `${patient.woundSize} sq cm` : 'Not specified'}
                        </p>
                      </div>
                      <div>
                        <Label className="text-sm font-medium text-gray-500">Referral Source</Label>
                        <p className="text-gray-900 flex items-center">
                          <MapPin className="h-4 w-4 mr-2" />
                          {patient.referralSource}
                        </p>
                      </div>
                      <div>
                        <Label className="text-sm font-medium text-gray-500">Sales Representative</Label>
                        <p className="text-gray-900">
                          {patient.salesRep || 'Not assigned'}
                        </p>
                      </div>
                      <div>
                        <Label className="text-sm font-medium text-gray-500">Acting Provider</Label>
                        <p className="text-gray-900">
                          {patient.provider && patient.provider !== 'none' ? patient.provider : 'Not assigned'}
                        </p>
                      </div>
                      <div>
                        <Label className="text-sm font-medium text-gray-500">Patient Status</Label>
                        <div className="mt-1">
                          <Select
                            value={patient.patientStatus || 'Evaluation Stage'}
                            onValueChange={(value) => updatePatientStatusMutation.mutate({ patientStatus: value })}
                          >
                            <SelectTrigger className="w-48">
                              <SelectValue>
                                <Badge className={getPatientStatusBadgeColor(patient.patientStatus)}>
                                  {patient.patientStatus || 'Evaluation Stage'}
                                </Badge>
                              </SelectValue>
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="Evaluation Stage">
                                <Badge className="bg-yellow-100 text-yellow-800 hover:bg-yellow-200">
                                  Evaluation Stage
                                </Badge>
                              </SelectItem>
                              <SelectItem value="IVR Requested">
                                <Badge className="bg-blue-100 text-blue-800 hover:bg-blue-200">
                                  IVR Requested
                                </Badge>
                              </SelectItem>
                              <SelectItem value="IVR Denied">
                                <Badge className="bg-red-100 text-red-800 hover:bg-red-200">
                                  IVR Denied
                                </Badge>
                              </SelectItem>
                              <SelectItem value="IVR Approved">
                                <Badge className="bg-green-100 text-green-800 hover:bg-green-200">
                                  IVR Approved
                                </Badge>
                              </SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                    </div>
                  </div>
                ) : (
                  <form onSubmit={handleEditSubmit} className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <Label htmlFor="firstName">First Name</Label>
                        <Input
                          id="firstName"
                          value={editFormData.firstName || ''}
                          onChange={(e) => setEditFormData(prev => ({ ...prev, firstName: e.target.value }))}
                          required
                        />
                      </div>
                      <div>
                        <Label htmlFor="lastName">Last Name</Label>
                        <Input
                          id="lastName"
                          value={editFormData.lastName || ''}
                          onChange={(e) => setEditFormData(prev => ({ ...prev, lastName: e.target.value }))}
                          required
                        />
                      </div>
                      <div>
                        <Label htmlFor="dateOfBirth">Date of Birth</Label>
                        <Input
                          id="dateOfBirth"
                          type="date"
                          value={editFormData.dateOfBirth || ''}
                          onChange={(e) => setEditFormData(prev => ({ ...prev, dateOfBirth: e.target.value }))}
                          required
                        />
                      </div>
                      <div>
                        <Label htmlFor="phoneNumber">Phone Number</Label>
                        <Input
                          id="phoneNumber"
                          value={editFormData.phoneNumber || ''}
                          onChange={(e) => setEditFormData(prev => ({ ...prev, phoneNumber: e.target.value }))}
                          required
                        />
                      </div>
                      <div>
                        <Label htmlFor="insurance">Insurance</Label>
                        <Select
                          value={editFormData.insurance || ''}
                          onValueChange={(value) => setEditFormData(prev => ({ ...prev, insurance: value }))}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Select insurance" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="Medicare">Medicare</SelectItem>
                            <SelectItem value="Medicaid">Medicaid</SelectItem>
                            <SelectItem value="Private">Private Insurance</SelectItem>
                            <SelectItem value="UnitedHealthcare Medicare Advantage">UnitedHealthcare Medicare Advantage</SelectItem>
                            <SelectItem value="Aetna Medicare Advantage">Aetna Medicare Advantage</SelectItem>
                            <SelectItem value="Cigna Medicare Advantage">Cigna Medicare Advantage</SelectItem>
                            <SelectItem value="Humana Medicare Advantage">Humana Medicare Advantage</SelectItem>
                            <SelectItem value="WellCare Medicare Advantage">WellCare Medicare Advantage</SelectItem>
                            <SelectItem value="Other">Other</SelectItem>
                            <SelectItem value="None">None</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      {editFormData.insurance === 'Other' && (
                        <div>
                          <Label htmlFor="customInsurance">Custom Insurance</Label>
                          <Input
                            id="customInsurance"
                            value={editFormData.customInsurance || ''}
                            onChange={(e) => setEditFormData(prev => ({ ...prev, customInsurance: e.target.value }))}
                            placeholder="Enter insurance name"
                            required
                          />
                        </div>
                      )}
                      <div>
                        <Label htmlFor="woundType">Wound Type</Label>
                        <Select
                          value={editFormData.woundType || ''}
                          onValueChange={(value) => setEditFormData(prev => ({ ...prev, woundType: value }))}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Select wound type" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="Diabetic Ulcer">Diabetic Ulcer</SelectItem>
                            <SelectItem value="Pressure Ulcer">Pressure Ulcer</SelectItem>
                            <SelectItem value="Venous Ulcer">Venous Ulcer</SelectItem>
                            <SelectItem value="Arterial Ulcer">Arterial Ulcer</SelectItem>
                            <SelectItem value="Surgical Wound">Surgical Wound</SelectItem>
                            <SelectItem value="Traumatic Wound">Traumatic Wound</SelectItem>
                            <SelectItem value="Burn">Burn</SelectItem>
                            <SelectItem value="Other">Other</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label htmlFor="woundSize">Initial Wound Size (sq cm)</Label>
                        <Input
                          id="woundSize"
                          type="number"
                          step="0.1"
                          value={editFormData.woundSize || ''}
                          onChange={(e) => setEditFormData(prev => ({ ...prev, woundSize: e.target.value }))}
                          placeholder="Enter wound size"
                        />
                      </div>
                      <div>
                        <Label htmlFor="referralSource">Referral Source</Label>
                        <Select
                          value={editFormData.referralSourceId?.toString() || ''}
                          onValueChange={(value) => {
                            const selectedSource = referralSources.find((source: any) => source.id.toString() === value);
                            setEditFormData(prev => ({ 
                              ...prev, 
                              referralSourceId: parseInt(value),
                              referralSource: selectedSource?.facilityName || ''
                            }));
                          }}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Select referral source" />
                          </SelectTrigger>
                          <SelectContent>
                            {referralSources.map((source: any) => (
                              <SelectItem key={source.id} value={source.id.toString()}>
                                {source.facilityName}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label htmlFor="salesRep">Sales Representative</Label>
                        {(user as any)?.role === 'admin' ? (
                          <Select
                            value={editFormData.salesRep || ''}
                            onValueChange={(value) => setEditFormData(prev => ({ ...prev, salesRep: value }))}
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="Select sales rep" />
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
                            id="salesRep"
                            value={(user as any)?.salesRepName || "Not assigned"}
                            disabled
                            className="bg-gray-100 text-gray-600"
                          />
                        )}
                      </div>
                      <div>
                        <Label htmlFor="provider">Acting Provider</Label>
                        <Select
                          value={editFormData.provider || ''}
                          onValueChange={(value) => setEditFormData(prev => ({ ...prev, provider: value }))}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Select provider" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="none">No Provider</SelectItem>
                            {providers.map((provider: Provider) => (
                              <SelectItem key={provider.id} value={provider.name}>
                                {provider.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label htmlFor="patientStatus">Patient Status</Label>
                        <Select
                          value={editFormData.patientStatus || 'Evaluation Stage'}
                          onValueChange={(value) => setEditFormData(prev => ({ ...prev, patientStatus: value }))}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Select patient status" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="Evaluation Stage">Evaluation Stage</SelectItem>
                            <SelectItem value="IVR Requested">IVR Requested</SelectItem>
                            <SelectItem value="IVR Denied">IVR Denied</SelectItem>
                            <SelectItem value="IVR Approved">IVR Approved</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    <div>
                      <Label htmlFor="notes">Notes</Label>
                      <Textarea
                        id="notes"
                        value={editFormData.notes || ''}
                        onChange={(e) => setEditFormData(prev => ({ ...prev, notes: e.target.value }))}
                        rows={3}
                        placeholder="Add any additional notes..."
                      />
                    </div>
                  </form>
                )}
                
                {!isEditing && patient.notes && (
                  <div className="mt-6 pt-6 border-t">
                    <div>
                      <Label className="text-sm font-medium text-gray-500 flex items-center">
                        <FileText className="h-4 w-4 mr-2" />
                        Notes
                      </Label>
                      <p className="text-gray-900 mt-1">{patient.notes}</p>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Timeline */}
          <div>
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="flex items-center">
                    <Clock className="h-5 w-5 mr-2" />
                    Timeline
                  </CardTitle>
                  <Dialog open={isAddEventDialogOpen} onOpenChange={setIsAddEventDialogOpen}>
                    <DialogTrigger asChild>
                      <Button size="sm">
                        <Plus className="h-4 w-4 mr-1" />
                        Add Event
                      </Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>Add Timeline Event</DialogTitle>
                      </DialogHeader>
                      <form onSubmit={handleTimelineSubmit} className="space-y-4">
                        <div>
                          <Label htmlFor="eventType">Event Type</Label>
                          <Select 
                            value={timelineFormData.eventType} 
                            onValueChange={(value) => setTimelineFormData(prev => ({ ...prev, eventType: value }))}
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="Select event type" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="note">Note</SelectItem>
                              <SelectItem value="wound_measurement">Wound Measurement</SelectItem>
                              <SelectItem value="appointment">Appointment</SelectItem>
                              <SelectItem value="treatment">Treatment</SelectItem>
                              <SelectItem value="call">Phone Call</SelectItem>
                              <SelectItem value="visit">Site Visit</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>

                        <div>
                          <Label htmlFor="eventDate">Date</Label>
                          <Input
                            id="eventDate"
                            type="date"
                            value={timelineFormData.eventDate}
                            onChange={(e) => setTimelineFormData(prev => ({ ...prev, eventDate: e.target.value }))}
                            required
                          />
                        </div>

                        {timelineFormData.eventType === 'wound_measurement' && (
                          <div>
                            <Label htmlFor="woundSize">Wound Size (sq cm)</Label>
                            <Input
                              id="woundSize"
                              type="number"
                              step="0.1"
                              value={timelineFormData.woundSize || ''}
                              onChange={(e) => setTimelineFormData(prev => ({ ...prev, woundSize: e.target.value ? parseFloat(e.target.value) : undefined }))}
                              placeholder="Enter wound size"
                            />
                          </div>
                        )}

                        <div>
                          <Label htmlFor="description">Description</Label>
                          <Textarea
                            id="description"
                            value={timelineFormData.description}
                            onChange={(e) => setTimelineFormData(prev => ({ ...prev, description: e.target.value }))}
                            rows={3}
                            placeholder="Enter event description"
                            required
                          />
                        </div>

                        <div className="flex justify-end space-x-2">
                          <Button
                            type="button"
                            variant="outline"
                            onClick={() => setIsAddEventDialogOpen(false)}
                          >
                            Cancel
                          </Button>
                          <Button type="submit" disabled={addEventMutation.isPending}>
                            {addEventMutation.isPending ? (
                              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                            ) : (
                              <Save className="h-4 w-4 mr-2" />
                            )}
                            Save Event
                          </Button>
                        </div>
                      </form>
                    </DialogContent>
                  </Dialog>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-4 max-h-96 overflow-y-auto">
                  {timelineEvents.length === 0 ? (
                    <p className="text-gray-500 text-center py-8">No timeline events yet</p>
                  ) : (
                    timelineEvents.map((event: PatientTimelineEvent) => (
                      <div key={event.id} className="border rounded-lg p-4 bg-white">
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <div className="flex items-center space-x-2 mb-2">
                              <Badge className={getEventTypeColor(event.eventType)}>
                                {event.title}
                              </Badge>
                              <span className="text-sm text-gray-500">
                                {formatDate(event.eventDate)}
                              </span>
                            </div>
                            <p className="text-gray-900 text-sm">{event.description}</p>
                            {event.woundSize && (
                              <p className="text-sm text-gray-600 mt-1">
                                Wound size: {event.woundSize} sq cm
                              </p>
                            )}
                            {/* Timestamp */}
                            {event.createdAt && (
                              <div className="mt-2 text-xs text-gray-400 border-t pt-2">
                                {(() => {
                                  const timestamp = formatTimestamp(event.createdAt);
                                  return (
                                    <span>
                                      {timestamp.time} ET • {timestamp.date}
                                      {event.createdBy && (
                                        <span> • {event.createdBy}</span>
                                      )}
                                    </span>
                                  );
                                })()}
                              </div>
                            )}
                          </div>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => deleteEventMutation.mutate(event.id)}
                            disabled={deleteEventMutation.isPending}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Files */}
          <div>
            <Card className="border" data-testid="section-files">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="flex items-center">
                    <FileText className="h-5 w-5 mr-2" />
                    Files
                  </CardTitle>
                  <Button
                    size="sm"
                    onClick={() => setIsUploadFileDialogOpen(true)}
                    data-testid="button-upload-file"
                  >
                    <Upload className="h-4 w-4 mr-2" />
                    Upload File
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {filesLoading ? (
                  <div className="flex items-center justify-center py-8">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
                  </div>
                ) : files.length === 0 ? (
                  <p className="text-gray-500 text-center py-8">No files uploaded yet</p>
                ) : (
                  <div className="space-y-3">
                    {files.map((file) => (
                      <div
                        key={file.id}
                        data-testid={`file-item-${file.id}`}
                        className="flex items-center justify-between p-3 border rounded-lg bg-white hover:bg-gray-50 transition-colors"
                      >
                        <div 
                          className="flex items-center space-x-3 flex-1 min-w-0 cursor-pointer"
                          onClick={() => {
                            window.open(`/api/referral-files/${file.id}/download`, '_blank');
                          }}
                        >
                          <FileText className="h-5 w-5 text-gray-400 flex-shrink-0" />
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-blue-600 hover:text-blue-800 hover:underline truncate">
                              {file.fileName}
                            </p>
                            <p className="text-xs text-gray-500">
                              {format(new Date(file.createdAt), 'MMM d, yyyy')}
                            </p>
                          </div>
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          data-testid={`button-download-${file.id}`}
                          onClick={() => {
                            window.open(`/api/referral-files/${file.id}/download`, '_blank');
                          }}
                          className="flex-shrink-0"
                        >
                          <Download className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

        </div>

        {/* Treatment Management - Only for IVR Approved patients - Full Width */}
        {patient?.patientStatus?.toLowerCase() === 'ivr approved' && (
          <div className="mt-6">
            <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle className="flex items-center">
                      <Activity className="h-5 w-5 mr-2" />
                      Treatment Management
                    </CardTitle>
                    <Dialog open={isAddTreatmentDialogOpen} onOpenChange={setIsAddTreatmentDialogOpen}>
                      {isAdmin && (
                        <DialogTrigger asChild>
                          <Button 
                            size="sm"
                            onClick={() => {
                              setEditingTreatment(null);
                              form.reset({
                                treatmentNumber: 1,
                                skinGraftType: 'Dermabind Q3',
                                qCode: 'Q4313-Q3',
                                woundSizeAtTreatment: '',
                                pricePerSqCm: '3520.69',
                                treatmentDate: new Date().toISOString().split('T')[0],
                                status: 'active',
                                actingProvider: undefined,
                                notes: '',
                                invoiceStatus: 'open',
                                invoiceDate: '',
                                invoiceNo: '',
                                payableDate: '',
                                salesRep: patient?.salesRep || '',
                                salesRepCommissionRate: '',
                              });
                            }}
                          >
                            <Plus className="h-4 w-4 mr-1" />
                            Add Treatment
                          </Button>
                        </DialogTrigger>
                      )}
                      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
                        <DialogHeader>
                          <DialogTitle className="text-lg font-semibold">
                            {editingTreatment ? 'Edit Treatment' : 'Add New Treatment'}
                          </DialogTitle>
                        </DialogHeader>
                        <Form {...form}>
                          <form onSubmit={(e) => {
                            console.log("🚀 Form submit event triggered", e);
                            console.log("🚀 Form errors:", form.formState.errors);
                            console.log("🚀 Form values:", form.getValues());
                            form.handleSubmit(onSubmit)(e);
                          }} className="space-y-6">
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
                                          field.onChange(invoiceDate); // Send as string to avoid timezone issues
                                          
                                          // Calculate payable date (invoice date + 30 days)
                                          if (invoiceDate) {
                                            const payableDate = new Date(invoiceDate + 'T00:00:00');
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
                                        onChange={(e) => {
                                          field.onChange(e.target.value); // Send as string to avoid timezone issues
                                        }}
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
                                        value={field.value || ""}
                                        onChange={(e) => {
                                          const dateStr = e.target.value;
                                          field.onChange(dateStr); // Send as string to avoid timezone issues
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
                            
                            {/* Third Row - Patient & Sales Rep */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                              <div>
                                <Label className="text-sm font-medium text-gray-700">Patient Name</Label>
                                <div className="mt-1 p-3 bg-gray-50 border border-gray-300 rounded-md">
                                  <span className="text-gray-900">
                                    {patient ? `${patient.firstName} ${patient.lastName}` : 'Loading...'}
                                  </span>
                                </div>
                              </div>
                              
                              <FormField
                                control={form.control}
                                name="salesRep"
                                render={({ field }) => (
                                  <FormItem>
                                    <FormLabel className="text-sm font-medium text-gray-700">Sales Rep</FormLabel>
                                    <FormControl>
                                      <Input
                                        value={patient?.salesRep || ""}
                                        readOnly
                                        className="mt-1 bg-gray-50"
                                        placeholder="Sales rep auto-assigned"
                                      />
                                    </FormControl>
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

                                    <Select
                                      // IMPORTANT: undefined (not "") when nothing selected
                                      value={field.value ? String(field.value) : undefined}
                                      onValueChange={(v) => field.onChange(v || undefined)}
                                      disabled={!providers?.length}
                                    >
                                      <FormControl>
                                        <SelectTrigger className="mt-1">
                                          <SelectValue placeholder="Select provider" />
                                        </SelectTrigger>
                                      </FormControl>

                                      <SelectContent>
                                        {/* Do NOT render a placeholder item with value="" or "none" */}
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

                            {/* Commission Assignments (New Multi-Rep System) */}
                            <div className="space-y-4">
                              <div className="flex items-center justify-between">
                                <Label className="text-sm font-medium text-gray-700">Commission Assignments</Label>
                                {user?.role === 'admin' && (
                                  <div className="flex items-center space-x-2">
                                    <span className="text-xs text-gray-500">
                                      Total: {totalCommissionPercentage.toFixed(2)}% / 40%
                                    </span>
                                    {totalCommissionPercentage > 40 && (
                                      <span className="text-xs text-red-500 font-medium">
                                        ⚠ Over limit!
                                      </span>
                                    )}
                                  </div>
                                )}
                              </div>
                              
                              {/* Commission Assignments List */}
                              <div className="space-y-2">
                                {treatmentCommissions.map((commission, index) => (
                                  <div key={index} className="flex items-center space-x-2 p-3 border border-gray-200 rounded-md">
                                    <div className="flex-1">
                                      <Select 
                                        value={commission.salesRepId.toString()} 
                                        onValueChange={(value) => updateCommissionAssignment(index, 'salesRepId', value)}
                                      >
                                        <SelectTrigger className="w-full">
                                          <SelectValue placeholder="Select sales rep" />
                                        </SelectTrigger>
                                        <SelectContent>
                                          {salesReps.map((rep: SalesRep) => (
                                            <SelectItem key={rep.id} value={rep.id.toString()}>
                                              {rep.name}
                                            </SelectItem>
                                          ))}
                                        </SelectContent>
                                      </Select>
                                    </div>
                                    
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
                                  disabled={user?.role === 'admin' ? totalCommissionPercentage >= 40 : false}
                                >
                                  <Plus className="h-4 w-4 mr-2" />
                                  Add Rep and Commission
                                </Button>
                              </div>
                              
                              {/* Commission Summary */}
                              {user?.role === 'admin' && form.watch("invoiceTotal") && parseFloat(form.watch("invoiceTotal")) > 0 && (
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
                                        handleGraftSelection(value);
                                      }}
                                    >
                                      <FormControl>
                                        <SelectTrigger className="mt-1">
                                          <SelectValue placeholder="Select graft type" />
                                        </SelectTrigger>
                                      </FormControl>
                                      <SelectContent>
                                        {GRAFT_OPTIONS.map((graft) => (
                                          <SelectItem key={graft.name} value={graft.name}>
                                            {graft.manufacturer} - {graft.name} - ${graft.asp.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} - {graft.qCode}
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
                                        value={field.value || ""}
                                        onChange={(e) => {
                                          field.onChange(e.target.value);
                                          
                                          // Recalculate values when wound size changes
                                          const woundSize = parseFloat(e.target.value || "0");
                                          const pricePerSqCm = parseFloat(form.getValues("pricePerSqCm") || "0");
                                          const revenue = woundSize * pricePerSqCm;
                                          const invoiceTotal = revenue * 0.6;
                                          
                                          form.setValue("totalRevenue", revenue.toFixed(2));
                                          form.setValue("invoiceTotal", invoiceTotal.toFixed(2));
                                          
                                          // Recalculate commissions using the new multi-rep system
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
                                        value={field.value || ""}
                                        placeholder="Q4205-Q3"
                                        readOnly
                                        className="mt-1 bg-gray-50 border-gray-200"
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
                                        value={field.value || ""}
                                        onChange={field.onChange}
                                        required
                                        className="mt-1 bg-gray-50 border-gray-200"
                                        readOnly
                                      />
                                    </FormControl>
                                    <FormMessage />
                                  </FormItem>
                                )}
                              />
                            </div>

                            {/* Auto-calculated Financial Fields */}
                            <div className="space-y-4">
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <FormField
                                  control={form.control}
                                  name="totalRevenue"
                                  render={({ field }) => (
                                    <FormItem>
                                      <FormLabel className="text-sm font-medium text-gray-700">Total Billable (Auto-calculated)</FormLabel>
                                      <FormControl>
                                        <Input
                                          value={field.value ? `$${parseFloat(field.value).toLocaleString()}` : "$0"}
                                          readOnly
                                          className="mt-1 bg-gray-50 border-gray-200 text-lg font-semibold"
                                        />
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
                                      <FormLabel className="text-sm font-medium text-gray-700">Total Invoice (Auto-calculated)</FormLabel>
                                      <FormControl>
                                        <Input
                                          value={field.value ? `$${parseFloat(field.value).toLocaleString()}` : "$0"}
                                          readOnly
                                          className="mt-1 bg-purple-50 border-purple-200 text-lg font-semibold text-purple-600"
                                        />
                                      </FormControl>
                                      <FormMessage />
                                    </FormItem>
                                  )}
                                />
                              </div>

                              {/* Commission Fields */}
                              <div className={`grid gap-4 ${(user as any)?.role === 'admin' ? 'grid-cols-1 md:grid-cols-3' : 'grid-cols-1'}`}>
                                {(user as any)?.role === 'admin' && (
                                  <FormField
                                    control={form.control}
                                    name="nxtCommission"
                                    render={({ field }) => (
                                      <FormItem>
                                        <FormLabel className="text-sm font-medium text-gray-700">NXT Commission</FormLabel>
                                        <FormControl>
                                          <Input
                                            value={field.value ? `$${parseFloat(field.value).toLocaleString()}` : "$0"}
                                            readOnly
                                            className="mt-1 bg-orange-50 border-orange-200 text-lg font-semibold text-orange-600"
                                          />
                                        </FormControl>
                                        <FormMessage />
                                      </FormItem>
                                    )}
                                  />
                                )}
                                
                                <FormField
                                  control={form.control}
                                  name="salesRepCommission"
                                  render={({ field }) => (
                                    <FormItem>
                                      <FormLabel className="text-sm font-medium text-gray-700">
                                        {(user as any)?.role === 'admin' ? 'Sales Rep Commission' : 'Rep Commission (Auto-calculated)'}
                                      </FormLabel>
                                      <FormControl>
                                        <Input
                                          value={field.value ? `$${parseFloat(field.value).toLocaleString()}` : "$0"}
                                          readOnly
                                          className="mt-1 bg-green-50 border-green-200 text-lg font-semibold text-green-600"
                                        />
                                      </FormControl>
                                      <FormMessage />
                                    </FormItem>
                                  )}
                                />
                              </div>
                            </div>

                            {/* Notes */}
                            <FormField
                              control={form.control}
                              name="notes"
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel className="text-sm font-medium text-gray-700">Treatment Notes</FormLabel>
                                  <FormControl>
                                    <Textarea
                                      {...field}
                                      rows={3}
                                      placeholder="Add treatment notes..."
                                      className="mt-1"
                                    />
                                  </FormControl>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />

                            {/* Action Buttons */}
                            <div className="flex justify-end space-x-3 pt-4 border-t">
                              <Button
                                type="button"
                                variant="outline"
                                className="px-6"
                                onClick={() => {
                                  setIsAddTreatmentDialogOpen(false);
                                  setEditingTreatment(null);
                                  form.reset();
                                }}
                              >
                                Cancel
                              </Button>
                              <Button 
                                type="submit" 
                                disabled={editingTreatment ? updateTreatmentMutation.isPending : addTreatmentMutation.isPending}
                                className="px-6 bg-blue-600 hover:bg-blue-700"
                              >
                                {(editingTreatment ? updateTreatmentMutation.isPending : addTreatmentMutation.isPending) ? (
                                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                                ) : null}
                                {editingTreatment ? 'Update Treatment' : 'Create Treatment'}
                              </Button>
                            </div>
                        </form>
                        </Form>
                      </DialogContent>
                    </Dialog>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {treatments.length === 0 ? (
                      <p className="text-gray-500 text-center py-8">No treatments scheduled yet</p>
                    ) : (
                      <>
                        {/* Treatment Summary */}
                        <div className="bg-blue-50 p-6 rounded-lg mb-6">
                          <h4 className="font-semibold text-lg mb-4 flex items-center">
                            <TrendingUp className="h-5 w-5 mr-2" />
                            Treatment Summary
                          </h4>
                          {(() => {
                            // Use actual stored values from treatments instead of recalculating
                            const totalRevenue = treatments.reduce((sum: number, t: PatientTreatment) => 
                              sum + parseFloat(t.totalRevenue || '0'), 0);
                            const totalInvoice = treatments.reduce((sum: number, t: PatientTreatment) => 
                              sum + parseFloat(t.invoiceTotal || '0'), 0);
                            const totalNxtCommission = treatments.reduce((sum: number, t: PatientTreatment) => 
                              sum + parseFloat(t.nxtCommission || '0'), 0);
                            const totalSalesRepCommission = treatments.reduce((sum: number, t: PatientTreatment) => 
                              sum + parseFloat(t.salesRepCommission || '0'), 0);
                            const completedTreatments = treatments.filter((t: PatientTreatment) => t.status === 'completed').length;
                            
                            return (
                              <div className={`grid grid-cols-2 ${(user as any)?.role === 'admin' ? 'lg:grid-cols-6' : 'lg:grid-cols-5'} gap-6 text-base`}>
                                <div>
                                  <span className="text-gray-600">Total Treatments:</span>
                                  <p className="font-semibold text-xl">{treatments.length}</p>
                                </div>
                                <div>
                                  <span className="text-gray-600">Completed:</span>
                                  <p className="font-semibold text-xl">{completedTreatments}</p>
                                </div>
                                <div>
                                  <span className="text-gray-600">Total Revenue:</span>
                                  <p className="font-semibold text-xl">${totalRevenue.toLocaleString()}</p>
                                </div>
                                <div>
                                  <span className="text-gray-600">Total Invoice:</span>
                                  <p className="font-semibold text-xl text-purple-600">${totalInvoice.toLocaleString()}</p>
                                </div>
                                {(user as any)?.role === 'admin' && (
                                  <div>
                                    <span className="text-gray-600">NXT Commission:</span>
                                    <p className="font-semibold text-xl text-orange-600">${totalNxtCommission.toLocaleString()}</p>
                                  </div>
                                )}
                                <div>
                                  <span className="text-gray-600">Sales Rep Commission:</span>
                                  <p className="font-semibold text-xl">${totalSalesRepCommission.toLocaleString()}</p>
                                </div>
                              </div>
                            );
                          })()}
                        </div>

                        {/* Treatments Table */}
                        <div className="overflow-x-auto">
                          <Table>
                            <TableHeader>
                              <TableRow>
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
                                {isAdmin && <TableHead>Actions</TableHead>}
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {treatments.map((treatment: PatientTreatment) => {
                                const invoiceAmount = (parseFloat(treatment.totalRevenue || "0")) * 0.6;
                                
                                return (
                                  <TableRow key={treatment.id} className="hover:bg-gray-50">
                                    <TableCell>
                                      <Badge variant="outline">
                                        #{treatment.treatmentNumber}
                                      </Badge>
                                    </TableCell>
                                    <TableCell>
                                      {formatDateSafe(treatment.treatmentDate)}
                                    </TableCell>
                                    <TableCell>
                                      <Select
                                        value={treatment.status || 'active'}
                                        onValueChange={isAdmin ? (value) => updateTreatmentStatusMutation.mutate({
                                          treatmentId: treatment.id,
                                          field: 'status',
                                          value: value
                                        }) : undefined}
                                        disabled={!isAdmin || updateTreatmentStatusMutation.isPending}
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
                                        onValueChange={isAdmin ? (value) => updateTreatmentStatusMutation.mutate({
                                          treatmentId: treatment.id,
                                          field: 'invoiceStatus',
                                          value: value
                                        }) : undefined}
                                        disabled={!isAdmin || updateTreatmentStatusMutation.isPending}
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
                                        {treatment.actingProvider || 'Not assigned'}
                                      </span>
                                    </TableCell>
                                    {isAdmin && (
                                      <TableCell>
                                        <div className="flex space-x-2">
                                          <Button
                                            size="sm"
                                            variant="ghost"
                                            className="text-blue-600 hover:text-blue-700"
                                            onClick={async () => {
                                            setEditingTreatment(treatment);
                                            form.reset({
                                              treatmentNumber: treatment.treatmentNumber,
                                              skinGraftType: treatment.skinGraftType,
                                              qCode: treatment.qCode || '',
                                              woundSizeAtTreatment: treatment.woundSizeAtTreatment?.toString() || '',
                                              pricePerSqCm: treatment.pricePerSqCm.toString(),
                                              treatmentDate: new Date(treatment.treatmentDate).toISOString().split('T')[0],
                                              status: treatment.status,
                                              actingProvider: treatment.actingProvider ?? undefined,
                                              notes: treatment.notes || '',
                                              invoiceStatus: treatment.invoiceStatus || 'open',
                                              invoiceDate: treatment.invoiceDate ? treatment.invoiceDate.toString().split('T')[0] : new Date().toISOString().split('T')[0],
                                              invoiceNo: treatment.invoiceNo || '',
                                              payableDate: treatment.payableDate ? treatment.payableDate.toString().split('T')[0] : new Date().toISOString().split('T')[0],
                                              invoiceTotal: treatment.invoiceTotal?.toString() || '0',
                                              salesRepCommissionRate: treatment.salesRepCommissionRate?.toString() || '',
                                            });
                                            
                                            // Load existing commission assignments
                                            console.log("🔍 Loading existing commissions for treatment ID:", treatment.id);
                                            try {
                                              const response = await fetch(`/api/treatment-commissions/${treatment.id}`, {
                                                credentials: "include"
                                              });
                                              console.log("🔍 API Response status:", response.status, response.ok);
                                              if (response.ok) {
                                                const existingCommissions = await response.json();
                                                console.log("🔍 Existing commissions data:", existingCommissions);
                                                
                                                // Transform API response to treatmentCommissions format
                                                const commissionAssignments = existingCommissions.map((commission: any) => ({
                                                  salesRepId: commission.salesRepId || 0,
                                                  salesRepName: commission.salesRepName || "",
                                                  commissionRate: String(commission.commissionRate ?? "0"),
                                                  commissionAmount: String(commission.commissionAmount ?? "0")
                                                }));
                                                
                                                console.log("🔍 Transformed commission assignments:", commissionAssignments);
                                                setTreatmentCommissions(commissionAssignments);
                                                console.log("🔍 Commission assignments set successfully");
                                                // Note: recalculation will happen via useEffect when form values settle
                                              } else {
                                                console.warn("⚠️ Failed to load existing commissions - API returned non-OK status:", response.status);
                                                setTreatmentCommissions([]);
                                              }
                                            } catch (error) {
                                              console.error("❌ Error loading existing commissions:", error);
                                              setTreatmentCommissions([]);
                                            }
                                            
                                            setIsAddTreatmentDialogOpen(true);
                                          }}
                                          title="Edit treatment"
                                        >
                                          <Edit className="h-4 w-4" />
                                        </Button>
                                        <Button
                                          size="sm"
                                          variant="ghost"
                                          className="text-red-600 hover:text-red-700"
                                          onClick={() => deleteTreatmentMutation.mutate(treatment.id)}
                                          disabled={deleteTreatmentMutation.isPending}
                                          title="Delete treatment"
                                        >
                                          <Trash2 className="h-4 w-4" />
                                        </Button>
                                        </div>
                                      </TableCell>
                                    )}
                                  </TableRow>
                                );
                              })}
                            </TableBody>
                          </Table>
                        </div>
                      </>
                    )}
                  </div>
                </CardContent>
              </Card>
            </div>
          )}
      </div>
      
      {/* Payment Date Popup Dialog */}
      {confirmDateOpen && (
        <Dialog open={confirmDateOpen} onOpenChange={setConfirmDateOpen}>
          <DialogContent className="max-w-sm">
            <DialogHeader>
              <DialogTitle>Enter payment date</DialogTitle>
            </DialogHeader>
            <div className="space-y-3">
              <Input
                type="date"
                value={form.getValues("payableDate") ?? ""}
                onChange={(e) => form.setValue("payableDate", e.target.value || undefined)}
              />
              <div className="flex justify-end gap-2">
                <Button variant="ghost" onClick={() => setConfirmDateOpen(false)}>Skip</Button>
                <Button onClick={() => setConfirmDateOpen(false)}>Save</Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}

      {/* Upload File Dialog */}
      <Dialog open={isUploadFileDialogOpen} onOpenChange={setIsUploadFileDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Upload Patient File</DialogTitle>
          </DialogHeader>
          <div
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            className={cn(
              "border-2 border-dashed rounded-lg p-12 text-center cursor-pointer transition-colors",
              isDragOver ? "border-blue-500 bg-blue-50" : "border-gray-300 bg-gray-50",
              uploadFileMutation.isPending && "opacity-50 pointer-events-none"
            )}
            onClick={() => document.getElementById("patient-file-input")?.click()}
            data-testid="dropzone-upload-patient-file"
          >
            <Upload className="h-12 w-12 mx-auto mb-4 text-gray-400" />
            <p className="text-gray-600 mb-2">
              {uploadFileMutation.isPending ? "Uploading..." : "Drag and drop file here"}
            </p>
            <p className="text-sm text-gray-500">or click to browse (PDF or images)</p>
            <input
              id="patient-file-input"
              type="file"
              accept="application/pdf,image/*"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) handleFileUpload(file);
              }}
              data-testid="input-patient-file"
            />
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}