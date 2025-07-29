import { useState, useEffect } from 'react';
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
  ChevronsUpDown
} from 'lucide-react';
import type { 
  Patient, 
  InsertPatient, 
  SalesRep, 
  PatientTimelineEvent, 
  InsertPatientTimelineEvent,
  PatientTreatment,
  InsertPatientTreatment,
  Provider
} from '@shared/schema';

// Graft options with ASP pricing and manufacturers
const GRAFT_OPTIONS = [
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

// Form schema for React Hook Form
const treatmentFormSchema = z.object({
  treatmentNumber: z.number().min(1).max(8),
  skinGraftType: z.string().min(1, "Graft selection is required"),
  qCode: z.string().optional(),
  woundSizeAtTreatment: z.string().min(1, "Wound size is required"),
  pricePerSqCm: z.string().min(1, "Price per sq cm is required"),
  treatmentDate: z.union([z.date(), z.string().min(1, "Treatment date is required")]),
  status: z.string().min(1, "Status is required"),
  actingProvider: z.string().optional(),
  notes: z.string().optional(),
  invoiceStatus: z.string().min(1, "Invoice status is required"),
  invoiceDate: z.union([z.date(), z.string(), z.null()]).optional(),
  invoiceNo: z.string().optional(),
  payableDate: z.union([z.date(), z.string(), z.null()]).optional(),
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
  const { patientId } = useParams<{ patientId: string }>();
  const [, navigate] = useLocation();
  
  const [isEditing, setIsEditing] = useState(false);
  const [isAddEventDialogOpen, setIsAddEventDialogOpen] = useState(false);
  const [isAddTreatmentDialogOpen, setIsAddTreatmentDialogOpen] = useState(false);
  const [editingEvent, setEditingEvent] = useState<PatientTimelineEvent | null>(null);
  const [editingTreatment, setEditingTreatment] = useState<PatientTreatment | null>(null);
  const [editFormData, setEditFormData] = useState<Partial<InsertPatient>>({});
  const [timelineFormData, setTimelineFormData] = useState<Partial<InsertPatientTimelineEvent>>({
    eventType: 'note',
    description: '',
    eventDate: new Date().toISOString().split('T')[0],
    woundSize: undefined,
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
      treatmentDate: new Date(),
      status: 'active',
      actingProvider: '',
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
  const { data: salesReps = [] } = useQuery({
    queryKey: ["/api/sales-reps"],
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

  // Auto-populate sales rep for sales rep users when data loads
  useEffect(() => {
    if (user && "role" in user && user.role === "sales_rep" && Array.isArray(salesReps) && salesReps.length > 0) {
      const currentUserSalesRep = salesReps.find((rep: any) => rep.name === (user as any).salesRepName);
      if (currentUserSalesRep) {
        form.setValue("salesRepCommissionRate", currentUserSalesRep.commissionRate?.toString() || "10");
      }
    }
  }, [user, salesReps, form]);

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
      queryClient.invalidateQueries({ predicate: (query) => query.queryKey[0]?.toString().includes("/api/referral-sources") && query.queryKey[1]?.toString().includes("/treatments") });
      queryClient.refetchQueries({ queryKey: ["/api/treatments/all"] });
      setIsAddTreatmentDialogOpen(false);
      form.reset({
        treatmentNumber: 1,
        skinGraftType: 'Dermabind Q3',
        qCode: 'Q4313-Q3',
        woundSizeAtTreatment: '',
        pricePerSqCm: '3520.69',
        treatmentDate: new Date(),
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
      queryClient.invalidateQueries({ predicate: (query) => query.queryKey[0]?.toString().includes("/api/referral-sources") && query.queryKey[1]?.toString().includes("/treatments") });
      queryClient.refetchQueries({ queryKey: ["/api/treatments/all"] });
      setIsAddTreatmentDialogOpen(false);
      setEditingTreatment(null);
      form.reset({
        treatmentNumber: 1,
        skinGraftType: 'Dermabind Q3',
        qCode: 'Q4313-Q3',
        woundSizeAtTreatment: '',
        pricePerSqCm: '3520.69',
        treatmentDate: new Date(),
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
      queryClient.invalidateQueries({ predicate: (query) => query.queryKey[0]?.toString().includes("/api/referral-sources") && query.queryKey[1]?.toString().includes("/treatments") });
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
      queryClient.invalidateQueries({ predicate: (query) => query.queryKey[0]?.toString().includes("/api/referral-sources") && query.queryKey[1]?.toString().includes("/treatments") });
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
      salesRep: (user as any)?.role === 'admin' ? editFormData.salesRep : ((user as any)?.salesRepName || '') // Admin can select, sales rep uses own name
    };
    
    console.log('Submitting patient data:', submitData);
    
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
      form.setValue("qCode", selectedGraft.qCode);
      form.setValue("pricePerSqCm", selectedGraft.asp.toString());
      
      // Recalculate values when graft changes
      const woundSize = parseFloat(form.getValues("woundSizeAtTreatment") || "0");
      const revenue = woundSize * selectedGraft.asp;
      const invoiceTotal = revenue * 0.6;
      const totalCommission = invoiceTotal * 0.4;
      
      form.setValue("totalRevenue", revenue.toFixed(2));
      form.setValue("invoiceTotal", invoiceTotal.toFixed(2));
      form.setValue("nxtCommission", totalCommission.toFixed(2));
      
      // Recalculate rep commission if rate is already set
      const repRate = parseFloat(form.getValues("salesRepCommissionRate") || "0");
      if (repRate > 0) {
        const repCommission = invoiceTotal * (repRate / 100);
        form.setValue("salesRepCommission", repCommission.toFixed(2));
        form.setValue("nxtCommission", (totalCommission - repCommission).toFixed(2));
      }
    }
  };

  // React Hook Form submit handler
  const onSubmit = (data: z.infer<typeof treatmentFormSchema>) => {
    const woundSize = parseFloat(data.woundSizeAtTreatment || '0');
    const pricePerSqCm = parseFloat(data.pricePerSqCm || '0');
    
    // Calculate revenue fields
    const totalRevenue = woundSize * pricePerSqCm;
    const invoiceTotal = totalRevenue * 0.6;
    const totalCommission = invoiceTotal * 0.4;
    
    // Get sales rep info
    const salesRepName = patient?.salesRep || '';
    const salesRep = salesReps?.find(rep => rep.name === salesRepName);
    const defaultCommissionRate = parseFloat(salesRep?.commissionRate || '10.00');
    
    let salesRepCommissionRate;
    let salesRepCommission;
    let nxtCommission;
    
    if ((user as any)?.role === 'admin' && data.salesRepCommissionRate) {
      // Admin users can manually enter commission percentage
      salesRepCommissionRate = parseFloat(data.salesRepCommissionRate);
      salesRepCommission = invoiceTotal * (salesRepCommissionRate / 100);
      nxtCommission = totalCommission - salesRepCommission;
    } else {
      // Sales reps get auto-calculated commission based on their assigned rate
      salesRepCommissionRate = defaultCommissionRate;
      salesRepCommission = invoiceTotal * (salesRepCommissionRate / 100);
      nxtCommission = totalCommission - salesRepCommission;
    }
    
    const treatmentData = {
      patientId: parseInt(patientId),
      treatmentNumber: data.treatmentNumber,
      woundSizeAtTreatment: woundSize.toFixed(2),
      skinGraftType: data.skinGraftType,
      qCode: data.qCode,
      pricePerSqCm: pricePerSqCm.toFixed(2),
      totalRevenue: totalRevenue.toFixed(2),
      invoiceTotal: invoiceTotal.toFixed(2),
      nxtCommission: Math.max(0, nxtCommission).toFixed(2),
      salesRepCommissionRate: salesRepCommissionRate.toFixed(2),
      salesRepCommission: salesRepCommission.toFixed(2),
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
      salesRep: salesRepName,
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
    
    // Debug: Log patient data to check field values
    console.log('Patient data for edit:', {
      insurance: patient?.insurance,
      woundType: patient?.woundType,
      customInsurance: patient?.customInsurance,
      provider: patient?.provider
    });
    
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
      salesRep: (user as any)?.salesRepName || '',
      provider: patient?.provider || '',
      patientStatus: patient?.patientStatus || 'Evaluation Stage',
      notes: patient?.notes || '',
    };
    
    console.log('Setting edit form data:', formData);
    setEditFormData(formData);
  };

  const handleCancel = () => {
    setIsEditing(false);
    setEditFormData({});
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
                        <Input
                          id="referralSource"
                          value={editFormData.referralSource || ''}
                          onChange={(e) => setEditFormData(prev => ({ ...prev, referralSource: e.target.value }))}
                          required
                        />
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
                              treatmentDate: new Date(),
                              status: 'active',
                              actingProvider: '',
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
                      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
                        <DialogHeader>
                          <DialogTitle className="text-lg font-semibold">
                            {editingTreatment ? 'Edit Treatment' : 'Add New Treatment'}
                          </DialogTitle>
                        </DialogHeader>
                        <Form {...form}>
                          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
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
                                        value={field.value instanceof Date ? field.value.toISOString().split('T')[0] : field.value || ""}
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
                                        value={field.value instanceof Date ? field.value.toISOString().split('T')[0] : field.value || ""}
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
                                        value={field.value instanceof Date ? field.value.toISOString().split('T')[0] : field.value}
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
                                    <Select value={field.value} onValueChange={field.onChange}>
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

                            {/* Commission Rate Row - Admin Only */}
                            {(user as any)?.role === 'admin' && (
                              <div className="grid grid-cols-1 gap-4">
                                <FormField
                                  control={form.control}
                                  name="salesRepCommissionRate"
                                  render={({ field }) => (
                                    <FormItem>
                                      <FormLabel className="text-sm font-medium text-gray-700">Sales Rep Commission %</FormLabel>
                                      <FormControl>
                                        <Input
                                          type="number"
                                          step="0.01"
                                          min="0"
                                          max="100"
                                          value={field.value || ''}
                                          onChange={(e) => {
                                            field.onChange(e.target.value);
                                            
                                            // Recalculate commissions when rate changes
                                            const totalRevenue = parseFloat(form.getValues("totalRevenue") || "0");
                                            const invoiceTotal = totalRevenue * 0.6;
                                            const commissionRate = parseFloat(e.target.value || "0");
                                            const repCommission = invoiceTotal * (commissionRate / 100);
                                            form.setValue("salesRepCommission", repCommission.toFixed(2));
                                            
                                            // Recalculate NXT commission with new formula
                                            const totalCommission = invoiceTotal * 0.4;
                                            const nxtCommission = totalCommission - repCommission;
                                            form.setValue("nxtCommission", Math.max(0, nxtCommission).toFixed(2));
                                          }}
                                          className="mt-1"
                                          placeholder="Enter percentage"
                                        />
                                      </FormControl>
                                      <FormMessage />
                                    </FormItem>
                                  )}
                                />
                              </div>
                            )}

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
                                        value={field.value || ""}
                                        onChange={(e) => {
                                          field.onChange(e.target.value);
                                          
                                          // Recalculate values when wound size changes
                                          const woundSize = parseFloat(e.target.value || "0");
                                          const pricePerSqCm = parseFloat(form.getValues("pricePerSqCm") || "0");
                                          const revenue = woundSize * pricePerSqCm;
                                          const invoiceTotal = revenue * 0.6;
                                          const totalCommission = invoiceTotal * 0.4;
                                          
                                          form.setValue("totalRevenue", revenue.toFixed(2));
                                          form.setValue("invoiceTotal", invoiceTotal.toFixed(2));
                                          
                                          // Recalculate rep commission if rate is set
                                          const repRate = parseFloat(form.getValues("salesRepCommissionRate") || "0");
                                          if (repRate > 0) {
                                            const repCommission = invoiceTotal * (repRate / 100);
                                            form.setValue("salesRepCommission", repCommission.toFixed(2));
                                            form.setValue("nxtCommission", (totalCommission - repCommission).toFixed(2));
                                          } else {
                                            form.setValue("nxtCommission", totalCommission.toFixed(2));
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
                                disabled={addTreatmentMutation.isPending}
                                className="px-6 bg-blue-600 hover:bg-blue-700"
                              >
                                {addTreatmentMutation.isPending ? (
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
                              <div className={`grid grid-cols-2 ${user?.role === 'admin' ? 'lg:grid-cols-6' : 'lg:grid-cols-5'} gap-6 text-base`}>
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
                                {user?.role === 'admin' && (
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
                                {user?.role === 'admin' && <TableHead>NXT Commission</TableHead>}
                                <TableHead>Acting Provider</TableHead>
                                <TableHead>Actions</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {treatments.map((treatment: PatientTreatment) => {
                                const invoiceAmount = (treatment.revenue || 0) * 0.6;
                                
                                return (
                                  <TableRow key={treatment.id} className="hover:bg-gray-50">
                                    <TableCell>
                                      <Badge variant="outline">
                                        #{treatment.treatmentNumber}
                                      </Badge>
                                    </TableCell>
                                    <TableCell>
                                      {format(parseISO(treatment.treatmentDate), "MM/dd/yyyy")}
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
                                    {user?.role === 'admin' && (
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
                                    <TableCell>
                                      <div className="flex space-x-2">
                                        <Button
                                          size="sm"
                                          variant="ghost"
                                          className="text-blue-600 hover:text-blue-700"
                                          onClick={() => {
                                            setEditingTreatment(treatment);
                                            form.reset({
                                              treatmentNumber: treatment.treatmentNumber,
                                              skinGraftType: treatment.skinGraftType,
                                              qCode: treatment.qCode || '',
                                              woundSizeAtTreatment: treatment.woundSizeAtTreatment?.toString() || '',
                                              pricePerSqCm: treatment.pricePerSqCm.toString(),
                                              treatmentDate: new Date(treatment.treatmentDate),
                                              status: treatment.status,
                                              actingProvider: treatment.actingProvider || 'none',
                                              notes: treatment.notes || '',
                                              invoiceStatus: treatment.invoiceStatus || 'open',
                                              invoiceDate: treatment.invoiceDate ? treatment.invoiceDate.toString().split('T')[0] : new Date().toISOString().split('T')[0],
                                              invoiceNo: treatment.invoiceNo || '',
                                              payableDate: treatment.payableDate ? treatment.payableDate.toString().split('T')[0] : new Date().toISOString().split('T')[0],
                                              salesRepCommissionRate: treatment.salesRepCommissionRate?.toString() || '',
                                            });
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
    </div>
  );
}