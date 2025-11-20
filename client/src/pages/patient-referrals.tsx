import { useAuth } from "@/hooks/useAuth";
import { useEffect, useState, useCallback, useMemo } from "react";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Upload, FileText, Download, Plus, Check, X, Archive, Filter, XCircle, Trash2, Search, Edit, Building2, Phone, Mail, Users, Activity, TrendingUp, ArrowUpDown, ArrowUp, ArrowDown } from "lucide-react";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import Navigation from "@/components/ui/navigation";
import { isUnauthorizedError } from "@/lib/authUtils";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { PatientReferral, SalesRep, ReferralFile, User, InsertPatient, ReferralSource, InsertReferralSource } from "@shared/schema";
import { normalizeInsuranceType } from "@shared/schema";
import { format, startOfMonth, endOfMonth } from "date-fns";
import { cn } from "@/lib/utils";
import { DragDropContext, Droppable, Draggable, DropResult } from "@hello-pangea/dnd";
import { PatientForm } from "@/components/patients/PatientForm";
import PDFPreviewModal from "@/components/PDFPreviewModal";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, PieChart, Pie, Cell } from "recharts";
import { Link } from "wouter";

type KanbanStatus = 'new' | 'medicare' | 'advantage_plans' | 'patient_created';

const KANBAN_COLUMNS: { id: KanbanStatus; title: string; color: string }[] = [
  { id: 'new', title: 'New / Needs Review', color: 'bg-gray-100 dark:bg-gray-800' },
  { id: 'medicare', title: 'Medicare', color: 'bg-green-100 dark:bg-green-900' },
  { id: 'advantage_plans', title: 'Advantage Plans', color: 'bg-blue-100 dark:bg-blue-900' },
  { id: 'patient_created', title: 'Patient Created', color: 'bg-purple-100 dark:bg-purple-900' },
];

export default function PatientReferrals() {
  const { isAuthenticated, isLoading } = useAuth();
  const { toast } = useToast();
  const [isDragOver, setIsDragOver] = useState(false);
  const [uploadDialogOpen, setUploadDialogOpen] = useState(false);
  const [createPatientDialogOpen, setCreatePatientDialogOpen] = useState(false);
  const [selectedReferralId, setSelectedReferralId] = useState<number | null>(null);
  const [editingField, setEditingField] = useState<{ referralId: number; field: string } | null>(null);
  const [archiveConfirmOpen, setArchiveConfirmOpen] = useState(false);
  const [referralToArchive, setReferralToArchive] = useState<number | null>(null);
  const [addReferralSourceDialogOpen, setAddReferralSourceDialogOpen] = useState(false);
  const [uploadAdditionalFileDialogOpen, setUploadAdditionalFileDialogOpen] = useState(false);
  const [selectedReferralForFile, setSelectedReferralForFile] = useState<number | null>(null);
  const [deleteFileConfirmOpen, setDeleteFileConfirmOpen] = useState(false);
  const [fileToDelete, setFileToDelete] = useState<{ id: number; fileName: string } | null>(null);
  const [pdfPreviewOpen, setPdfPreviewOpen] = useState(false);
  const [previewFile, setPreviewFile] = useState<{ id: number; fileName: string } | null>(null);
  
  // Filter state
  const [filters, setFilters] = useState({
    startDate: '',
    endDate: '',
    referralSourceId: 'all',
    salesRepId: 'all',
    insuranceType: 'all',
  });

  // Analytics date range state (default to current month)
  const [analyticsDateRange, setAnalyticsDateRange] = useState({
    startDate: format(startOfMonth(new Date()), 'yyyy-MM-dd'),
    endDate: format(endOfMonth(new Date()), 'yyyy-MM-dd'),
  });

  // Referral Sources table state
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState('all');
  const [filterStatus, setFilterStatus] = useState('all');
  const [filterSalesRep, setFilterSalesRep] = useState('all');
  const [sortColumn, setSortColumn] = useState<'facility' | 'referralsSent'>('facility');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
  const [showAddSourceDialog, setShowAddSourceDialog] = useState(false);
  const [editingSource, setEditingSource] = useState<ReferralSource | null>(null);
  const [sourceFormData, setSourceFormData] = useState<Partial<InsertReferralSource>>({
    facilityName: '',
    facilityType: 'Hospital',
    referralVolume: 'Medium',
    relationshipStatus: 'Active',
  });

  // Get current user data to check role
  const { data: currentUser } = useQuery<User>({
    queryKey: ["/api/auth/user"],
    retry: false,
    enabled: isAuthenticated,
  });

  // Get user details including salesRepId for sales reps
  const { data: meData, isLoading: meLoading, error: meError } = useQuery<{ ok: boolean; data: { id: number; role: string; salesRepId?: number } }>({
    queryKey: ["/api/me"],
    retry: false,
    enabled: isAuthenticated,
  });

  // Show error if /api/me fails for sales reps
  useEffect(() => {
    if (meError && currentUser?.role === 'sales_rep') {
      toast({
        title: "Error",
        description: "Failed to load your sales rep information. Please refresh the page.",
        variant: "destructive",
      });
    }
  }, [meError, currentUser, toast]);

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

  // Fetch patient referrals
  const { data: allReferrals = [], isLoading: referralsLoading } = useQuery<PatientReferral[]>({
    queryKey: ["/api/patient-referrals"],
    retry: false,
    enabled: isAuthenticated,
  });

  // Fetch sales reps for display
  const { data: salesReps = [] } = useQuery<SalesRep[]>({
    queryKey: ["/api/sales-reps"],
    retry: false,
    enabled: isAuthenticated,
  });

  // Fetch referral sources
  const { data: referralSources = [] } = useQuery<ReferralSource[]>({
    queryKey: ["/api/referral-sources"],
    retry: false,
    enabled: isAuthenticated,
  });

  // Fetch files for each referral
  const { data: allFiles = [] } = useQuery<ReferralFile[]>({
    queryKey: ["/api/referral-files"],
    retry: false,
    enabled: isAuthenticated,
  });

  // Fetch analytics data
  const { data: analyticsData } = useQuery<{
    bySource: Array<{ sourceName: string; count: number }>;
    byInsurance: Array<{ insuranceType: string; count: number }>;
  }>({
    queryKey: ["/api/analytics/referrals", analyticsDateRange.startDate, analyticsDateRange.endDate],
    queryFn: async () => {
      const response = await fetch(
        `/api/analytics/referrals?startDate=${analyticsDateRange.startDate}&endDate=${analyticsDateRange.endDate}`
      );
      if (!response.ok) throw new Error("Failed to fetch analytics");
      return response.json();
    },
    retry: false,
    enabled: isAuthenticated,
  });

  // Get sales rep name by ID
  const getSalesRepName = (repId: number | null): string => {
    if (!repId) return "Unassigned";
    const rep = salesReps.find(r => r.id === repId);
    return rep?.name || "Unknown";
  };

  // Get referral source name by ID
  const getReferralSourceName = (sourceId: number | null): string => {
    if (!sourceId) return "Not Set";
    const source = referralSources.find(s => s.id === sourceId);
    return source?.facilityName || "Unknown";
  };

  // Get all files for referral
  const getReferralFiles = (referralId: number): ReferralFile[] => {
    return allFiles.filter(f => f.patientReferralId === referralId);
  };

  // Role-based filtering - memoized to prevent unnecessary recalculations
  const visibleReferrals = useMemo(() => {
    if (currentUser?.role === 'admin') {
      return allReferrals;
    }
    // For sales reps, only show referrals assigned to them
    const salesRepId = meData?.data?.salesRepId;
    if (!salesRepId) {
      return []; // Return empty array if sales rep ID not yet loaded
    }
    return allReferrals.filter(ref => ref.assignedSalesRepId === salesRepId);
  }, [allReferrals, currentUser?.role, meData?.data?.salesRepId]);

  // Apply filters
  const filteredReferrals = useMemo(() => {
    return visibleReferrals.filter(ref => {
      // Date range filter
      if (filters.startDate && ref.referralDate) {
        const refDate = new Date(ref.referralDate).toISOString().split('T')[0];
        if (refDate < filters.startDate) return false;
      }
      if (filters.endDate && ref.referralDate) {
        const refDate = new Date(ref.referralDate).toISOString().split('T')[0];
        if (refDate > filters.endDate) return false;
      }
      
      // Referral Source filter
      if (filters.referralSourceId && filters.referralSourceId !== 'all') {
        if (String(ref.referralSourceId) !== filters.referralSourceId) return false;
      }
      
      // Sales Rep filter
      if (filters.salesRepId && filters.salesRepId !== 'all') {
        if (String(ref.assignedSalesRepId) !== filters.salesRepId) return false;
      }
      
      // Insurance Type filter with normalization
      if (filters.insuranceType && filters.insuranceType !== 'all') {
        const normalizedRefInsurance = normalizeInsuranceType(ref.patientInsurance);
        if (normalizedRefInsurance !== filters.insuranceType) {
          return false;
        }
      }
      
      return true;
    });
  }, [visibleReferrals, filters]);

  // Group referrals by kanban status and auto-sort all columns by referral date (newest first)
  const referralsByStatus = useMemo(() => {
    return KANBAN_COLUMNS.reduce((acc, col) => {
      let columnReferrals = filteredReferrals.filter(ref => ref.kanbanStatus === col.id);
      
      // Auto-sort all columns by referral date (newest first)
      columnReferrals = columnReferrals.sort((a, b) => {
        const dateA = a.referralDate ? new Date(a.referralDate).getTime() : 0;
        const dateB = b.referralDate ? new Date(b.referralDate).getTime() : 0;
        return dateB - dateA; // Newest first
      });
      
      acc[col.id] = columnReferrals;
      return acc;
    }, {} as Record<KanbanStatus, PatientReferral[]>);
  }, [filteredReferrals]);

  // Upload mutation
  const uploadMutation = useMutation({
    mutationFn: async (fileData: { base64Data: string; fileName: string; fileSize: number; mimeType: string }) => {
      const response = await apiRequest("POST", "/api/referrals/upload", fileData);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/patient-referrals"] });
      queryClient.invalidateQueries({ queryKey: ["/api/referral-files"] });
      toast({
        title: "Success",
        description: "Referral uploaded successfully! Email notification sent to admin team.",
      });
      setUploadDialogOpen(false);
    },
    onError: (error: any) => {
      toast({
        title: "Upload Failed",
        description: error.message || "Failed to upload referral",
        variant: "destructive",
      });
    },
  });

  // Upload additional file mutation
  const uploadAdditionalFileMutation = useMutation({
    mutationFn: async (fileData: { referralId: number; base64Data: string; fileName: string; fileSize: number; mimeType: string }) => {
      const { referralId, ...data } = fileData;
      const response = await apiRequest("POST", `/api/referrals/${referralId}/upload-file`, data);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/referral-files"] });
      toast({
        title: "Success",
        description: "Additional file uploaded successfully!",
      });
      setUploadAdditionalFileDialogOpen(false);
      setSelectedReferralForFile(null);
    },
    onError: (error: any) => {
      toast({
        title: "Upload Failed",
        description: error.message || "Failed to upload file",
        variant: "destructive",
      });
    },
  });

  // Update inline field mutation
  const updateInlineMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: any }) => {
      const response = await apiRequest("PATCH", `/api/referrals/${id}/inline`, data);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/patient-referrals"] });
      toast({
        title: "Updated",
        description: "Referral updated successfully",
      });
      setEditingField(null);
    },
    onError: (error: any) => {
      toast({
        title: "Update Failed",
        description: error.message || "Failed to update referral",
        variant: "destructive",
      });
    },
  });

  // Update status mutation (admin only) with optimistic updates
  const updateStatusMutation = useMutation({
    mutationFn: async ({ id, kanbanStatus }: { id: number; kanbanStatus: KanbanStatus }) => {
      const response = await apiRequest("PATCH", `/api/referrals/${id}/status`, { kanbanStatus });
      return response.json();
    },
    onMutate: async ({ id, kanbanStatus }) => {
      // Cancel outgoing refetches
      await queryClient.cancelQueries({ queryKey: ["/api/patient-referrals"] });

      // Snapshot the previous value
      const previousReferrals = queryClient.getQueryData<PatientReferral[]>(["/api/patient-referrals"]);

      // Optimistically update the cache
      if (previousReferrals) {
        const optimisticReferrals = previousReferrals.map(ref =>
          ref.id === id ? { ...ref, kanbanStatus } : ref
        );
        queryClient.setQueryData(["/api/patient-referrals"], optimisticReferrals);
      }

      // Return snapshot for rollback
      return { previousReferrals };
    },
    onError: (error: any, variables, context) => {
      // Rollback to the snapshot
      if (context?.previousReferrals) {
        queryClient.setQueryData(["/api/patient-referrals"], context.previousReferrals);
      }
      toast({
        title: "Error",
        description: error.message || "Failed to update status",
        variant: "destructive",
      });
    },
    onSettled: () => {
      // Refetch to ensure UI matches server state
      queryClient.invalidateQueries({ queryKey: ["/api/patient-referrals"] });
    },
  });

  // Create patient mutation
  // Helper: Split patient name into first/last names
  const splitPatientName = (fullName: string | null): { firstName: string; lastName: string } => {
    if (!fullName) return { firstName: "", lastName: "" };
    const trimmed = fullName.trim().replace(/\s+/g, ' ');
    const tokens = trimmed.split(' ');
    if (tokens.length === 0) return { firstName: "", lastName: "" };
    if (tokens.length === 1) return { firstName: tokens[0], lastName: "" };
    const lastName = tokens[tokens.length - 1];
    const firstName = tokens.slice(0, -1).join(' ');
    return { firstName, lastName };
  };

  // Helper: Map insurance string to dropdown value
  const mapInsuranceValue = (insurance: string | null): { insurance: string; customInsurance: string } => {
    if (!insurance) return { insurance: "", customInsurance: "" };
    const normalized = insurance.toLowerCase().trim();
    const knownValues = [
      "medicare", "medicaid", "aetna", "bluecross", "cigna", "humana", "united",
      "unitedhealthcare-ma", "aetna-ma", "cigna-ma", "humana-ma", "wellcare-ma"
    ];
    if (knownValues.includes(normalized)) {
      return { insurance: normalized, customInsurance: "" };
    }
    return { insurance: "other", customInsurance: insurance };
  };

  // Get selected referral from the list
  const selectedReferral = useMemo(() => {
    if (!selectedReferralId) return null;
    return visibleReferrals.find(r => r.id === selectedReferralId) || null;
  }, [selectedReferralId, visibleReferrals]);

  // Compute initial values for patient form from referral data
  const initialPatientValues = useMemo((): Partial<InsertPatient> => {
    if (!selectedReferral) return {};
    
    const { firstName, lastName } = splitPatientName(selectedReferral.patientName);
    const { insurance, customInsurance } = mapInsuranceValue(selectedReferral.patientInsurance);
    const salesRepName = selectedReferral.assignedSalesRepId
      ? getSalesRepName(selectedReferral.assignedSalesRepId)
      : "";

    return {
      firstName,
      lastName,
      insurance,
      customInsurance,
      woundSize: selectedReferral.estimatedWoundSize || "",
      salesRep: salesRepName !== "Unassigned" ? salesRepName : "",
    };
  }, [selectedReferral, salesReps]);

  const createPatientMutation = useMutation({
    mutationFn: async ({ referralId, patientData }: { referralId: number; patientData: InsertPatient }) => {
      const response = await apiRequest("POST", `/api/referrals/${referralId}/create-patient`, patientData);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/patient-referrals"] });
      queryClient.invalidateQueries({ queryKey: ["/api/patients"] });
      queryClient.invalidateQueries({ queryKey: ["/api/referral-files"] });
      toast({
        title: "Success",
        description: "Patient created successfully! PDF file has been attached to the patient profile.",
      });
      setCreatePatientDialogOpen(false);
      setSelectedReferralId(null);
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to create patient",
        variant: "destructive",
      });
    },
  });

  const archiveMutation = useMutation({
    mutationFn: async (referralId: number) => {
      const response = await apiRequest("PATCH", `/api/patient-referrals/${referralId}/archive`, {});
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/patient-referrals"] });
      toast({
        title: "Archived",
        description: "Referral has been archived successfully",
      });
      setArchiveConfirmOpen(false);
      setReferralToArchive(null);
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to archive referral",
        variant: "destructive",
      });
    },
  });

  const deleteFileMutation = useMutation({
    mutationFn: async (fileId: number) => {
      const response = await apiRequest("DELETE", `/api/referral-files/${fileId}`);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/referral-files"] });
      toast({
        title: "Deleted",
        description: "File has been deleted successfully",
      });
      setDeleteFileConfirmOpen(false);
      setFileToDelete(null);
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to delete file",
        variant: "destructive",
      });
    },
  });

  // Referral Source mutations
  const addSourceMutation = useMutation({
    mutationFn: async (data: InsertReferralSource) => {
      return await apiRequest("POST", "/api/referral-sources", data);
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Referral source added successfully",
      });
      setShowAddSourceDialog(false);
      resetSourceForm();
      queryClient.invalidateQueries({ queryKey: ["/api/referral-sources"] });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to add referral source",
        variant: "destructive",
      });
    },
  });

  const editSourceMutation = useMutation({
    mutationFn: async (data: { id: number; updates: Partial<InsertReferralSource> }) => {
      return await apiRequest("PUT", `/api/referral-sources/${data.id}`, data.updates);
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Referral source updated successfully",
      });
      setEditingSource(null);
      resetSourceForm();
      queryClient.invalidateQueries({ queryKey: ["/api/referral-sources"] });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update referral source",
        variant: "destructive",
      });
    },
  });

  const deleteSourceMutation = useMutation({
    mutationFn: async (id: number) => {
      return await apiRequest("DELETE", `/api/referral-sources/${id}`);
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Referral source deleted successfully",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/referral-sources"] });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to delete referral source",
        variant: "destructive",
      });
    },
  });

  // Handle file upload
  const handleFileUpload = async (file: File) => {
    if (file.type !== "application/pdf") {
      toast({
        title: "Invalid File",
        description: "Only PDF files are allowed",
        variant: "destructive",
      });
      return;
    }

    const reader = new FileReader();
    reader.onload = async () => {
      const base64Data = reader.result?.toString().split(",")[1];
      if (!base64Data) return;

      uploadMutation.mutate({
        base64Data,
        fileName: file.name,
        fileSize: file.size,
        mimeType: file.type,
      });
    };
    reader.readAsDataURL(file);
  };

  // Drag and drop handlers for file upload
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

  // Handler for uploading additional file
  const handleAdditionalFileUpload = (file: File) => {
    if (!selectedReferralForFile) return;

    const reader = new FileReader();
    reader.onload = async () => {
      const base64Data = reader.result?.toString().split(",")[1];
      if (!base64Data) return;

      uploadAdditionalFileMutation.mutate({
        referralId: selectedReferralForFile,
        base64Data,
        fileName: file.name,
        fileSize: file.size,
        mimeType: file.type,
      });
    };
    reader.readAsDataURL(file);
  };

  // Kanban drag and drop handler
  const handleDragEnd = (result: DropResult) => {
    if (!result.destination) return;
    if (!currentUser || currentUser.role !== 'admin') return;

    const sourceStatus = result.source.droppableId as KanbanStatus;
    const destStatus = result.destination.droppableId as KanbanStatus;

    if (sourceStatus === destStatus) return;

    const referralId = parseInt(result.draggableId);
    updateStatusMutation.mutate({ id: referralId, kanbanStatus: destStatus });
  };

  // Inline edit handlers
  const startEdit = (referralId: number, field: string) => {
    setEditingField({ referralId, field });
  };

  const saveEdit = (referralId: number, field: string, value: string) => {
    updateInlineMutation.mutate({ 
      id: referralId, 
      data: { [field]: value || null } 
    });
  };

  // Create patient form
  const handleCreatePatient = (data: InsertPatient) => {
    if (!selectedReferralId) return;
    createPatientMutation.mutate({ referralId: selectedReferralId, patientData: data });
  };

  // Referral Source table helper functions
  const resetSourceForm = () => {
    setSourceFormData({
      facilityName: '',
      facilityType: 'Hospital',
      referralVolume: 'Medium',
      relationshipStatus: 'Active',
    });
  };

  const handleAddSource = () => {
    setEditingSource(null);
    resetSourceForm();
    setShowAddSourceDialog(true);
  };

  const handleEditSource = (source: ReferralSource) => {
    setEditingSource(source);
    setSourceFormData({
      facilityName: source.facilityName,
      contactPerson: source.contactPerson || '',
      email: source.email || '',
      phoneNumber: source.phoneNumber || '',
      address: source.address || '',
      facilityType: source.facilityType,
      referralVolume: source.referralVolume,
      relationshipStatus: source.relationshipStatus,
      salesRep: source.salesRep || '',
      notes: source.notes || '',
    });
    setShowAddSourceDialog(true);
  };

  const handleDeleteSource = (id: number) => {
    if (confirm('Are you sure you want to delete this referral source?')) {
      deleteSourceMutation.mutate(id);
    }
  };

  const handleSubmitSource = (e: React.FormEvent) => {
    e.preventDefault();
    const processedFormData = {
      ...sourceFormData,
      salesRep: sourceFormData.salesRep === 'unassigned' ? null : sourceFormData.salesRep
    };
    
    if (editingSource) {
      editSourceMutation.mutate({ id: editingSource.id, updates: processedFormData });
    } else {
      addSourceMutation.mutate(processedFormData as InsertReferralSource);
    }
  };

  const handleSortSource = (column: 'facility' | 'referralsSent') => {
    if (sortColumn === column) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortColumn(column);
      setSortDirection('asc');
    }
  };

  // Filter and sort referral sources for the table
  const filteredAndSortedSources = referralSources
    .filter((source) => {
      const matchesSearch = source.facilityName.toLowerCase().includes(searchTerm.toLowerCase()) ||
                           source.contactPerson?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                           source.address?.toLowerCase().includes(searchTerm.toLowerCase());
      
      const matchesType = filterType === 'all' || source.facilityType === filterType;
      const matchesStatus = filterStatus === 'all' || source.relationshipStatus === filterStatus;
      const matchesSalesRep = filterSalesRep === 'all' || source.salesRep === filterSalesRep;
      
      return matchesSearch && matchesType && matchesStatus && matchesSalesRep;
    })
    .sort((a, b) => {
      let aValue: string | number;
      let bValue: string | number;
      
      if (sortColumn === 'facility') {
        aValue = a.facilityName.toLowerCase();
        bValue = b.facilityName.toLowerCase();
      } else {
        aValue = (a as any).referralsSent || 0;
        bValue = (b as any).referralsSent || 0;
      }
      
      if (aValue < bValue) return sortDirection === 'asc' ? -1 : 1;
      if (aValue > bValue) return sortDirection === 'asc' ? 1 : -1;
      return 0;
    });

  const getBadgeColor = (status: string) => {
    switch (status) {
      case 'Active':
        return 'bg-green-100 text-green-800';
      case 'Inactive':
        return 'bg-red-100 text-red-800';
      case 'Prospect':
        return 'bg-blue-100 text-blue-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  if (isLoading || (currentUser?.role === 'sales_rep' && meLoading)) {
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
    return null;
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Navigation />
      
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header with Upload Button */}
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Patient Referrals</h1>
            <p className="text-gray-600 dark:text-gray-400 mt-1">
              Drag and drop workflow for managing patient referrals
            </p>
          </div>
          <Button
            onClick={() => setUploadDialogOpen(true)}
            className="bg-blue-600 hover:bg-blue-700"
            data-testid="button-upload-referral"
          >
            <Upload className="h-4 w-4 mr-2" />
            Upload Referral
          </Button>
        </div>

        {/* Analytics Section */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Referral Analytics</CardTitle>
          </CardHeader>
          <CardContent>
            {/* Date Range Picker */}
            <div className="flex gap-4 mb-6">
              <div>
                <label className="block text-sm font-medium mb-1">Start Date</label>
                <Input
                  type="date"
                  value={analyticsDateRange.startDate}
                  onChange={(e) => setAnalyticsDateRange({ ...analyticsDateRange, startDate: e.target.value })}
                  data-testid="analytics-start-date"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">End Date</label>
                <Input
                  type="date"
                  value={analyticsDateRange.endDate}
                  onChange={(e) => setAnalyticsDateRange({ ...analyticsDateRange, endDate: e.target.value })}
                  data-testid="analytics-end-date"
                />
              </div>
            </div>

            {/* Charts */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Referrals by Source Chart */}
              <div>
                <h3 className="text-lg font-semibold mb-4 text-center">Referrals by Source</h3>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={analyticsData?.bySource || []}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="sourceName" angle={-45} textAnchor="end" height={100} />
                    <YAxis />
                    <Tooltip />
                    <Legend />
                    <Bar dataKey="count" fill="#3b82f6" name="Referrals" />
                  </BarChart>
                </ResponsiveContainer>
              </div>

              {/* Insurance Type Distribution Chart */}
              <div>
                <h3 className="text-lg font-semibold mb-4 text-center">Insurance Type Distribution</h3>
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie
                      data={analyticsData?.byInsurance || []}
                      dataKey="count"
                      nameKey="insuranceType"
                      cx="50%"
                      cy="50%"
                      outerRadius={100}
                      label={(entry) => `${entry.insuranceType}: ${entry.count}`}
                    >
                      {(analyticsData?.byInsurance || []).map((entry, index) => {
                        const colors: Record<string, string> = {
                          'Medicare': '#3b82f6',
                          'Advantage Plan': '#10b981',
                          'Not Set': '#9ca3af'
                        };
                        return (
                          <Cell key={`cell-${index}`} fill={colors[entry.insuranceType] || '#6b7280'} />
                        );
                      })}
                    </Pie>
                    <Tooltip />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Filters Section */}
        <Card className="mb-6">
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 mb-4">
              <Filter className="h-4 w-4" />
              <h3 className="font-semibold">Filters</h3>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
              {/* Start Date Filter */}
              <div>
                <label className="block text-sm font-medium mb-1">Start Date</label>
                <Input
                  type="date"
                  value={filters.startDate}
                  onChange={(e) => setFilters({ ...filters, startDate: e.target.value })}
                  data-testid="filter-start-date"
                />
              </div>

              {/* End Date Filter */}
              <div>
                <label className="block text-sm font-medium mb-1">End Date</label>
                <Input
                  type="date"
                  value={filters.endDate}
                  onChange={(e) => setFilters({ ...filters, endDate: e.target.value })}
                  data-testid="filter-end-date"
                />
              </div>

              {/* Referral Source Filter */}
              <div>
                <label className="block text-sm font-medium mb-1">Referral Source</label>
                <Select
                  value={filters.referralSourceId}
                  onValueChange={(value) => setFilters({ ...filters, referralSourceId: value })}
                >
                  <SelectTrigger data-testid="filter-referral-source">
                    <SelectValue placeholder="All Sources" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Sources</SelectItem>
                    {referralSources.map((source) => (
                      <SelectItem key={source.id} value={String(source.id)}>
                        {source.facilityName}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Sales Rep Filter */}
              <div>
                <label className="block text-sm font-medium mb-1">Sales Rep</label>
                <Select
                  value={filters.salesRepId}
                  onValueChange={(value) => setFilters({ ...filters, salesRepId: value })}
                >
                  <SelectTrigger data-testid="filter-sales-rep">
                    <SelectValue placeholder="All Reps" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Reps</SelectItem>
                    {salesReps.map((rep) => (
                      <SelectItem key={rep.id} value={String(rep.id)}>
                        {rep.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Insurance Type Filter */}
              <div>
                <label className="block text-sm font-medium mb-1">Insurance Type</label>
                <Select
                  value={filters.insuranceType}
                  onValueChange={(value) => setFilters({ ...filters, insuranceType: value })}
                >
                  <SelectTrigger data-testid="filter-insurance-type">
                    <SelectValue placeholder="All Types" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Types</SelectItem>
                    <SelectItem value="Medicare">Medicare</SelectItem>
                    <SelectItem value="Advantage Plan">Advantage Plan</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Reset Filters Button */}
            <div className="mt-4 flex justify-end">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setFilters({ startDate: '', endDate: '', referralSourceId: 'all', salesRepId: 'all', insuranceType: 'all' })}
                data-testid="button-reset-filters"
              >
                <XCircle className="h-4 w-4 mr-2" />
                Reset Filters
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Kanban Board */}
        <DragDropContext onDragEnd={handleDragEnd}>
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
            {KANBAN_COLUMNS.map(column => (
              <div key={column.id} className="flex flex-col">
                {/* Column Header */}
                <div className={cn("rounded-t-lg p-3", column.color)}>
                  <div className="flex items-center justify-between">
                    <h3 className="font-semibold text-sm">{column.title}</h3>
                    <Badge variant="secondary" className="ml-2">
                      {referralsByStatus[column.id]?.length || 0}
                    </Badge>
                  </div>
                </div>

                {/* Droppable Column */}
                <Droppable droppableId={column.id} isDropDisabled={currentUser?.role !== 'admin'}>
                  {(provided, snapshot) => (
                    <div
                      ref={provided.innerRef}
                      {...provided.droppableProps}
                      className={cn(
                        "flex-1 p-2 bg-gray-100 dark:bg-gray-800 rounded-b-lg min-h-[200px] max-h-[900px] overflow-y-auto",
                        snapshot.isDraggingOver && "bg-blue-50 dark:bg-blue-950"
                      )}
                    >
                      {referralsByStatus[column.id]?.map((referral, index) => {
                        const files = getReferralFiles(referral.id);
                        return (
                          <Draggable
                            key={referral.id}
                            draggableId={referral.id.toString()}
                            index={index}
                            isDragDisabled={currentUser?.role !== 'admin'}
                          >
                            {(provided, snapshot) => (
                              <Card
                                ref={provided.innerRef}
                                {...provided.draggableProps}
                                {...provided.dragHandleProps}
                                className={cn(
                                  "mb-2 cursor-pointer hover:shadow-md transition-shadow",
                                  snapshot.isDragging && "shadow-lg"
                                )}
                                data-testid={`card-referral-${referral.id}`}
                              >
                                <CardContent className="p-3 space-y-2">
                                  {/* Referral Date - Inline Editable */}
                                  {(() => {
                                    const field = 'referralDate';
                                    const isEditing = editingField?.referralId === referral.id && editingField?.field === field;
                                    
                                    // Use referralDate if available, fallback to createdAt
                                    const displayDate = referral.referralDate || referral.createdAt;
                                    
                                    // Parse date safely in local timezone to avoid date shifting
                                    const parseLocalDate = (dateStr: string) => {
                                      const parts = dateStr.split('T')[0].split('-');
                                      if (parts.length === 3) {
                                        const year = parseInt(parts[0], 10);
                                        const month = parseInt(parts[1], 10) - 1; // JS months are 0-indexed
                                        const day = parseInt(parts[2], 10);
                                        return new Date(year, month, day);
                                      }
                                      return null;
                                    };
                                    
                                    const dateValue = displayDate ? (typeof displayDate === 'string' ? displayDate.split('T')[0] : format(displayDate, 'yyyy-MM-dd')) : '';
                                    
                                    return (
                                      <div className="text-xs">
                                        <span className="text-gray-500">Referral Date:</span>{" "}
                                        {isEditing ? (
                                          <div className="flex items-center gap-1 mt-1">
                                            <Input
                                              type="date"
                                              autoFocus
                                              defaultValue={dateValue}
                                              className="h-7 text-xs"
                                              onKeyDown={(e) => {
                                                if (e.key === "Enter") {
                                                  saveEdit(referral.id, field, e.currentTarget.value);
                                                } else if (e.key === "Escape") {
                                                  setEditingField(null);
                                                }
                                              }}
                                              onBlur={(e) => saveEdit(referral.id, field, e.target.value)}
                                              data-testid={`input-edit-${field}-${referral.id}`}
                                            />
                                          </div>
                                        ) : (
                                          <span
                                            onClick={() => startEdit(referral.id, field)}
                                            className="cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700 px-1 rounded text-gray-700"
                                            data-testid={`text-${field}-${referral.id}`}
                                          >
                                            {displayDate ? (() => {
                                              if (typeof displayDate === 'string') {
                                                const localDate = parseLocalDate(displayDate);
                                                return localDate && !isNaN(localDate.getTime()) ? format(localDate, "MMM d, yyyy") : "Click to add";
                                              } else {
                                                return format(displayDate, "MMM d, yyyy");
                                              }
                                            })() : <span className="text-gray-400 italic">Click to add</span>}
                                          </span>
                                        )}
                                      </div>
                                    );
                                  })()}

                                  {/* Patient Name - Inline Editable */}
                                  {(() => {
                                    const field = 'patientName';
                                    const isEditing = editingField?.referralId === referral.id && editingField?.field === field;
                                    const value = referral.patientName;
                                    return (
                                      <div className="text-sm">
                                        <span className="font-medium">Patient:</span>{" "}
                                        {isEditing ? (
                                          <div className="flex items-center gap-1 mt-1">
                                            <Input
                                              autoFocus
                                              defaultValue={value || ""}
                                              className="h-7 text-sm"
                                              onKeyDown={(e) => {
                                                if (e.key === "Enter") {
                                                  saveEdit(referral.id, field, e.currentTarget.value);
                                                } else if (e.key === "Escape") {
                                                  setEditingField(null);
                                                }
                                              }}
                                              onBlur={(e) => saveEdit(referral.id, field, e.target.value)}
                                              data-testid={`input-edit-${field}-${referral.id}`}
                                            />
                                          </div>
                                        ) : (
                                          <span
                                            onClick={() => startEdit(referral.id, field)}
                                            className="cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700 px-1 rounded"
                                            data-testid={`text-${field}-${referral.id}`}
                                          >
                                            {value || <span className="text-gray-400 italic">Click to add</span>}
                                          </span>
                                        )}
                                      </div>
                                    );
                                  })()}

                                  {/* Referral Source - Dropdown on New cards only */}
                                  {column.id === 'new' ? (
                                    <div className="text-sm">
                                      <label className="block text-xs font-medium mb-1">Referral Source</label>
                                      <Select
                                        value={referral.referralSourceId ? String(referral.referralSourceId) : 'none'}
                                        onValueChange={(value) => {
                                          if (value === 'add_new') {
                                            setAddReferralSourceDialogOpen(true);
                                          } else {
                                            // Convert string to number (or null if none)
                                            const sourceId = value && value !== 'none' ? parseInt(value, 10) : null;
                                            updateInlineMutation.mutate({
                                              id: referral.id,
                                              data: { referralSourceId: sourceId }
                                            });
                                          }
                                        }}
                                      >
                                        <SelectTrigger className="h-8 text-xs" data-testid={`select-source-${referral.id}`}>
                                          <SelectValue placeholder="Select source..." />
                                        </SelectTrigger>
                                        <SelectContent>
                                          <SelectItem value="none">Not Set</SelectItem>
                                          {referralSources.map((source) => (
                                            <SelectItem key={source.id} value={String(source.id)}>
                                              {source.facilityName}
                                            </SelectItem>
                                          ))}
                                          <SelectItem value="add_new" className="text-blue-600 font-medium">
                                            <Plus className="h-3 w-3 inline mr-1" />
                                            Add New Source
                                          </SelectItem>
                                        </SelectContent>
                                      </Select>
                                    </div>
                                  ) : (
                                    <div className="text-sm">
                                      <span className="font-medium">Source:</span> {getReferralSourceName(referral.referralSourceId)}
                                    </div>
                                  )}

                                  {/* Insurance - Inline Editable Dropdown */}
                                  {(() => {
                                    const field = 'patientInsurance';
                                    const isEditing = editingField?.referralId === referral.id && editingField?.field === field;
                                    const value = referral.patientInsurance;
                                    return isEditing ? (
                                      <div className="mt-1">
                                        <label className="block text-xs font-medium mb-1">Insurance:</label>
                                        <Select
                                          defaultValue={value || ""}
                                          onValueChange={(newValue) => {
                                            saveEdit(referral.id, field, newValue);
                                          }}
                                        >
                                          <SelectTrigger className="h-8 text-xs" data-testid={`select-insurance-${referral.id}`}>
                                            <SelectValue placeholder="Select insurance..." />
                                          </SelectTrigger>
                                          <SelectContent>
                                            <SelectItem value="Medicare">Medicare</SelectItem>
                                            <SelectItem value="Advantage Plan">Advantage Plan</SelectItem>
                                          </SelectContent>
                                        </Select>
                                      </div>
                                    ) : (
                                      <div className="text-sm">
                                        <span className="font-medium">Insurance:</span>{" "}
                                        <span
                                          onClick={() => startEdit(referral.id, field)}
                                          className="cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700 px-1 rounded"
                                          data-testid={`text-${field}-${referral.id}`}
                                        >
                                          {value || <span className="text-gray-400 italic">Click to add</span>}
                                        </span>
                                      </div>
                                    );
                                  })()}

                                  {/* Wound Size - Inline Editable */}
                                  {(() => {
                                    const field = 'estimatedWoundSize';
                                    const isEditing = editingField?.referralId === referral.id && editingField?.field === field;
                                    const value = referral.estimatedWoundSize;
                                    return (
                                      <div className="text-sm">
                                        <span className="font-medium">Wound Size:</span>{" "}
                                        {isEditing ? (
                                          <div className="flex items-center gap-1 mt-1">
                                            <Input
                                              autoFocus
                                              defaultValue={value || ""}
                                              className="h-7 text-sm"
                                              onKeyDown={(e) => {
                                                if (e.key === "Enter") {
                                                  saveEdit(referral.id, field, e.currentTarget.value);
                                                } else if (e.key === "Escape") {
                                                  setEditingField(null);
                                                }
                                              }}
                                              onBlur={(e) => saveEdit(referral.id, field, e.target.value)}
                                              data-testid={`input-edit-${field}-${referral.id}`}
                                            />
                                          </div>
                                        ) : (
                                          <span
                                            onClick={() => startEdit(referral.id, field)}
                                            className="cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700 px-1 rounded"
                                            data-testid={`text-${field}-${referral.id}`}
                                          >
                                            {value || <span className="text-gray-400 italic">Click to add</span>}
                                          </span>
                                        )}
                                      </div>
                                    );
                                  })()}

                                  {/* Notes - Inline Editable */}
                                  {(() => {
                                    const field = 'notes';
                                    const isEditing = editingField?.referralId === referral.id && editingField?.field === field;
                                    const value = referral.notes;
                                    return (
                                      <div className="text-sm">
                                        <span className="font-medium">Notes:</span>{" "}
                                        {isEditing ? (
                                          <div className="flex items-center gap-1 mt-1">
                                            <Input
                                              autoFocus
                                              defaultValue={value || ""}
                                              className="h-7 text-sm"
                                              onKeyDown={(e) => {
                                                if (e.key === "Enter") {
                                                  saveEdit(referral.id, field, e.currentTarget.value);
                                                } else if (e.key === "Escape") {
                                                  setEditingField(null);
                                                }
                                              }}
                                              onBlur={(e) => saveEdit(referral.id, field, e.target.value)}
                                              data-testid={`input-edit-${field}-${referral.id}`}
                                            />
                                          </div>
                                        ) : (
                                          <span
                                            onClick={() => startEdit(referral.id, field)}
                                            className="cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700 px-1 rounded"
                                            data-testid={`text-${field}-${referral.id}`}
                                          >
                                            {value || <span className="text-gray-400 italic">Click to add</span>}
                                          </span>
                                        )}
                                      </div>
                                    );
                                  })()}

                                  {/* Files Column - Shows file count and list */}
                                  <div className="text-sm">
                                    <span className="font-medium">Files:</span>{" "}
                                    <div className="mt-1 space-y-1">
                                      {files.length > 0 ? (
                                        <>
                                          {files.map((file, idx) => (
                                            <div
                                              key={file.id}
                                              className="flex items-center justify-between gap-2 group text-xs"
                                            >
                                              <div
                                                onClick={() => {
                                                  setPreviewFile({ id: file.id, fileName: file.fileName });
                                                  setPdfPreviewOpen(true);
                                                }}
                                                className="flex items-center gap-1 text-blue-600 hover:text-blue-800 flex-1 min-w-0 cursor-pointer"
                                                data-testid={`link-file-${referral.id}-${idx}`}
                                              >
                                                <FileText className="h-3 w-3 flex-shrink-0" />
                                                <span className="truncate">{file.fileName}</span>
                                              </div>
                                              <Button
                                                size="sm"
                                                variant="ghost"
                                                className="h-5 w-5 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
                                                onClick={() => {
                                                  setFileToDelete({ id: file.id, fileName: file.fileName });
                                                  setDeleteFileConfirmOpen(true);
                                                }}
                                                data-testid={`button-delete-file-${file.id}`}
                                              >
                                                <Trash2 className="h-3 w-3 text-red-600" />
                                              </Button>
                                            </div>
                                          ))}
                                        </>
                                      ) : (
                                        <span className="text-gray-400 italic text-xs">No files</span>
                                      )}
                                      {/* Upload Additional File Button - Always show except in Patient Created column */}
                                      {column.id !== 'patient_created' && (
                                        <Button
                                          size="sm"
                                          variant="ghost"
                                          onClick={() => {
                                            setSelectedReferralForFile(referral.id);
                                            setUploadAdditionalFileDialogOpen(true);
                                          }}
                                          className="w-full text-xs h-6"
                                          data-testid={`button-upload-file-${referral.id}`}
                                        >
                                          <Upload className="h-3 w-3 mr-1" />
                                          Add File
                                        </Button>
                                      )}
                                    </div>
                                  </div>

                                  {/* Sales Rep - Dropdown on New cards only */}
                                  {column.id === 'new' ? (
                                    <div className="text-sm">
                                      <label className="block text-xs font-medium mb-1">Sales Rep</label>
                                      <Select
                                        value={referral.assignedSalesRepId ? String(referral.assignedSalesRepId) : 'unassigned'}
                                        onValueChange={(value) => {
                                          // Convert string to number (or null if unassigned)
                                          const repId = value && value !== 'unassigned' ? parseInt(value, 10) : null;
                                          updateInlineMutation.mutate({
                                            id: referral.id,
                                            data: { assignedSalesRepId: repId }
                                          });
                                        }}
                                      >
                                        <SelectTrigger className="h-8 text-xs" data-testid={`select-rep-${referral.id}`}>
                                          <SelectValue placeholder="Select rep..." />
                                        </SelectTrigger>
                                        <SelectContent>
                                          <SelectItem value="unassigned">Unassigned</SelectItem>
                                          {salesReps.map((rep) => (
                                            <SelectItem key={rep.id} value={String(rep.id)}>
                                              {rep.name}
                                            </SelectItem>
                                          ))}
                                        </SelectContent>
                                      </Select>
                                    </div>
                                  ) : (
                                    <div className="text-sm">
                                      <span className="font-medium">Rep:</span> {getSalesRepName(referral.assignedSalesRepId)}
                                    </div>
                                  )}

                                  {/* Create Patient Button (Medicare column only) */}
                                  {column.id === 'medicare' && !referral.patientId && (
                                    <Button
                                      size="sm"
                                      onClick={() => {
                                        setSelectedReferralId(referral.id);
                                        setCreatePatientDialogOpen(true);
                                      }}
                                      className="w-full mt-2"
                                      data-testid={`button-create-patient-${referral.id}`}
                                    >
                                      <Plus className="h-3 w-3 mr-1" />
                                      Create New Patient
                                    </Button>
                                  )}

                                  {/* Patient Created Badge (Patient Created column) */}
                                  {column.id === 'patient_created' && referral.patientId && (
                                    <Badge variant="secondary" className="w-full justify-center">
                                      <Check className="h-3 w-3 mr-1" />
                                      Patient Created
                                    </Badge>
                                  )}

                                  {/* Archive Button (Patient Created column only) */}
                                  {column.id === 'patient_created' && (
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      onClick={() => {
                                        setReferralToArchive(referral.id);
                                        setArchiveConfirmOpen(true);
                                      }}
                                      className="w-full mt-2"
                                      data-testid={`button-archive-${referral.id}`}
                                    >
                                      <Archive className="h-3 w-3 mr-1" />
                                      Archive
                                    </Button>
                                  )}
                                </CardContent>
                              </Card>
                            )}
                          </Draggable>
                        );
                      })}
                      {provided.placeholder}
                    </div>
                  )}
                </Droppable>
              </div>
            ))}
          </div>
        </DragDropContext>

        {/* Referral Sources Table */}
        <Card className="mt-8">
          <CardHeader>
            <CardTitle>Referral Sources</CardTitle>
          </CardHeader>
          <CardContent>
            {/* Filters Row */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
              <div>
                <label className="block text-sm font-medium mb-1">Search</label>
                <div className="relative">
                  <Search className="h-4 w-4 absolute left-3 top-3 text-gray-400" />
                  <Input
                    placeholder="Search facilities..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10"
                    data-testid="search-referral-sources"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Facility Type</label>
                <Select value={filterType} onValueChange={setFilterType}>
                  <SelectTrigger data-testid="filter-source-type">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Types</SelectItem>
                    <SelectItem value="Hospital">Hospital</SelectItem>
                    <SelectItem value="Clinic">Clinic</SelectItem>
                    <SelectItem value="SNF">SNF</SelectItem>
                    <SelectItem value="LTAC">LTAC</SelectItem>
                    <SelectItem value="Home Health">Home Health</SelectItem>
                    <SelectItem value="Wound Center">Wound Center</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Status</label>
                <Select value={filterStatus} onValueChange={setFilterStatus}>
                  <SelectTrigger data-testid="filter-source-status">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Statuses</SelectItem>
                    <SelectItem value="Active">Active</SelectItem>
                    <SelectItem value="Inactive">Inactive</SelectItem>
                    <SelectItem value="Prospect">Prospect</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Sales Rep</label>
                <Select value={filterSalesRep} onValueChange={setFilterSalesRep}>
                  <SelectTrigger data-testid="filter-source-sales-rep">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Reps</SelectItem>
                    {salesReps.map((rep) => (
                      <SelectItem key={rep.id} value={rep.name}>{rep.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Table */}
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      <button
                        onClick={() => handleSortSource('facility')}
                        className="flex items-center gap-1 hover:text-gray-700 transition-colors"
                        data-testid="sort-facility"
                      >
                        Facility
                        {sortColumn === 'facility' ? (
                          sortDirection === 'asc' ? (
                            <ArrowUp className="h-3 w-3" />
                          ) : (
                            <ArrowDown className="h-3 w-3" />
                          )
                        ) : (
                          <ArrowUpDown className="h-3 w-3 opacity-40" />
                        )}
                      </button>
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Contact
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Type
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      <button
                        onClick={() => handleSortSource('referralsSent')}
                        className="flex items-center gap-1 hover:text-gray-700 transition-colors"
                        data-testid="sort-referrals-sent"
                      >
                        Referrals Sent
                        {sortColumn === 'referralsSent' ? (
                          sortDirection === 'asc' ? (
                            <ArrowUp className="h-3 w-3" />
                          ) : (
                            <ArrowDown className="h-3 w-3" />
                          )
                        ) : (
                          <ArrowUpDown className="h-3 w-3 opacity-40" />
                        )}
                      </button>
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Sales Rep
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {filteredAndSortedSources.map((source) => (
                    <tr key={source.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex flex-col">
                          <Link 
                            href={`/referral-sources/${source.id}`}
                            className="text-sm font-medium text-blue-600 hover:text-blue-800 hover:underline cursor-pointer"
                            data-testid={`link-referral-source-${source.id}`}
                          >
                            {source.facilityName}
                          </Link>
                          {source.address && (
                            <span className="text-xs text-gray-500 mt-1">{source.address}</span>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900">
                          {source.contactPerson && (
                            <div className="flex items-center gap-1">
                              <Users className="h-3 w-3 text-gray-400" />
                              <span>{source.contactPerson}</span>
                            </div>
                          )}
                          {source.phoneNumber && (
                            <div className="flex items-center gap-1 mt-1">
                              <Phone className="h-3 w-3 text-gray-400" />
                              <span className="text-xs text-gray-500">{source.phoneNumber}</span>
                            </div>
                          )}
                          {source.email && (
                            <div className="flex items-center gap-1 mt-1">
                              <Mail className="h-3 w-3 text-gray-400" />
                              <span className="text-xs text-gray-500">{source.email}</span>
                            </div>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <Badge variant="outline">{source.facilityType}</Badge>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-gray-900">
                          {(source as any).referralsSent || 0}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {source.salesRep || 'Unassigned'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                        <div className="flex gap-1">
                          <Button variant="ghost" size="sm" onClick={() => handleEditSource(source)} data-testid={`button-edit-source-${source.id}`}>
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="sm" onClick={() => handleDeleteSource(source.id)} data-testid={`button-delete-source-${source.id}`}>
                            <Trash2 className="h-4 w-4 text-red-500" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {filteredAndSortedSources.length === 0 && (
              <div className="text-center py-12">
                <Building2 className="h-12 w-12 mx-auto text-gray-400 mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">No referral sources found</h3>
                <p className="text-gray-500 mb-4">Get started by adding your first referral source.</p>
                <Button onClick={handleAddSource}>
                  <Plus className="h-4 w-4 mr-2" />
                  Add Referral Source
                </Button>
              </div>
            )}

            {/* Add Source Button */}
            {filteredAndSortedSources.length > 0 && (
              <div className="mt-4 flex justify-end">
                <Button onClick={handleAddSource} data-testid="button-add-source">
                  <Plus className="h-4 w-4 mr-2" />
                  Add Referral Source
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Upload Dialog */}
        <Dialog open={uploadDialogOpen} onOpenChange={setUploadDialogOpen}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Upload Patient Referral PDF</DialogTitle>
            </DialogHeader>
            <div
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              className={cn(
                "border-2 border-dashed rounded-lg p-12 text-center cursor-pointer transition-colors",
                isDragOver ? "border-blue-500 bg-blue-50" : "border-gray-300 bg-gray-50",
                uploadMutation.isPending && "opacity-50 pointer-events-none"
              )}
              onClick={() => document.getElementById("file-input")?.click()}
              data-testid="dropzone-upload"
            >
              <Upload className="h-12 w-12 mx-auto mb-4 text-gray-400" />
              <p className="text-gray-600 mb-2">
                {uploadMutation.isPending ? "Uploading..." : "Drag and drop PDF here"}
              </p>
              <p className="text-sm text-gray-500">or click to browse</p>
              <input
                id="file-input"
                type="file"
                accept="application/pdf"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) handleFileUpload(file);
                }}
                data-testid="input-file"
              />
            </div>
          </DialogContent>
        </Dialog>

        {/* Create Patient Dialog */}
        <Dialog open={createPatientDialogOpen} onOpenChange={setCreatePatientDialogOpen}>
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Create New Patient</DialogTitle>
            </DialogHeader>
            <PatientForm
              key={selectedReferralId || 'new'} 
              mode="dialog"
              initialValues={initialPatientValues}
              onSubmit={handleCreatePatient}
              onCancel={() => setCreatePatientDialogOpen(false)}
              isPending={createPatientMutation.isPending}
              userRole={currentUser?.role === 'sales_rep' ? 'salesRep' : currentUser?.role === 'admin' ? 'admin' : undefined}
              userSalesRepName={currentUser?.salesRepName || ''}
            />
          </DialogContent>
        </Dialog>

        {/* Upload Additional File Dialog */}
        <Dialog open={uploadAdditionalFileDialogOpen} onOpenChange={setUploadAdditionalFileDialogOpen}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Upload Additional File</DialogTitle>
            </DialogHeader>
            <div
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={(e) => {
                e.preventDefault();
                setIsDragOver(false);
                const files = Array.from(e.dataTransfer.files);
                if (files.length > 0) {
                  handleAdditionalFileUpload(files[0]);
                }
              }}
              className={cn(
                "border-2 border-dashed rounded-lg p-12 text-center cursor-pointer transition-colors",
                isDragOver ? "border-blue-500 bg-blue-50" : "border-gray-300 bg-gray-50",
                uploadAdditionalFileMutation.isPending && "opacity-50 pointer-events-none"
              )}
              onClick={() => document.getElementById("additional-file-input")?.click()}
              data-testid="dropzone-upload-additional"
            >
              <Upload className="h-12 w-12 mx-auto mb-4 text-gray-400" />
              <p className="text-gray-600 mb-2">
                {uploadAdditionalFileMutation.isPending ? "Uploading..." : "Drag and drop file here"}
              </p>
              <p className="text-sm text-gray-500">or click to browse</p>
              <input
                id="additional-file-input"
                type="file"
                accept="application/pdf,image/*"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) handleAdditionalFileUpload(file);
                }}
                data-testid="input-additional-file"
              />
            </div>
          </DialogContent>
        </Dialog>

        {/* Archive Confirmation Dialog */}
        <AlertDialog open={archiveConfirmOpen} onOpenChange={setArchiveConfirmOpen}>
          <AlertDialogContent data-testid="dialog-archive-confirm">
            <AlertDialogHeader>
              <AlertDialogTitle>Archive Referral?</AlertDialogTitle>
              <AlertDialogDescription>
                This will move the referral to the archive. You can unarchive it later if needed.
                This action will remove it from the Kanban board view.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel data-testid="button-cancel-archive">Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={() => {
                  if (referralToArchive) {
                    archiveMutation.mutate(referralToArchive);
                  }
                }}
                data-testid="button-confirm-archive"
              >
                Archive
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* Delete File Confirmation Dialog */}
        <AlertDialog open={deleteFileConfirmOpen} onOpenChange={setDeleteFileConfirmOpen}>
          <AlertDialogContent data-testid="dialog-delete-file-confirm">
            <AlertDialogHeader>
              <AlertDialogTitle>Delete File?</AlertDialogTitle>
              <AlertDialogDescription>
                Are you sure you want to delete "{fileToDelete?.fileName}"? This action cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel data-testid="button-cancel-delete-file">Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={() => {
                  if (fileToDelete) {
                    deleteFileMutation.mutate(fileToDelete.id);
                  }
                }}
                className="bg-red-600 hover:bg-red-700"
                data-testid="button-confirm-delete-file"
              >
                Delete
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* Add/Edit Referral Source Dialog */}
        <Dialog open={showAddSourceDialog} onOpenChange={setShowAddSourceDialog}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>
                {editingSource ? 'Edit Referral Source' : 'Add New Referral Source'}
              </DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmitSource} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1">Facility Name *</label>
                  <Input
                    value={sourceFormData.facilityName || ''}
                    onChange={(e) => setSourceFormData({ ...sourceFormData, facilityName: e.target.value })}
                    required
                    data-testid="input-source-facility-name"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Contact Person</label>
                  <Input
                    value={sourceFormData.contactPerson || ''}
                    onChange={(e) => setSourceFormData({ ...sourceFormData, contactPerson: e.target.value })}
                    data-testid="input-source-contact-person"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Email</label>
                  <Input
                    type="email"
                    value={sourceFormData.email || ''}
                    onChange={(e) => setSourceFormData({ ...sourceFormData, email: e.target.value })}
                    data-testid="input-source-email"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Phone Number</label>
                  <Input
                    value={sourceFormData.phoneNumber || ''}
                    onChange={(e) => setSourceFormData({ ...sourceFormData, phoneNumber: e.target.value })}
                    data-testid="input-source-phone"
                  />
                </div>
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium mb-1">Address</label>
                  <Input
                    value={sourceFormData.address || ''}
                    onChange={(e) => setSourceFormData({ ...sourceFormData, address: e.target.value })}
                    data-testid="input-source-address"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Facility Type</label>
                  <Select 
                    value={sourceFormData.facilityType || 'Hospital'} 
                    onValueChange={(value) => setSourceFormData({ ...sourceFormData, facilityType: value })}
                  >
                    <SelectTrigger data-testid="select-source-type">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Hospital">Hospital</SelectItem>
                      <SelectItem value="Clinic">Clinic</SelectItem>
                      <SelectItem value="SNF">SNF</SelectItem>
                      <SelectItem value="LTAC">LTAC</SelectItem>
                      <SelectItem value="Home Health">Home Health</SelectItem>
                      <SelectItem value="Wound Center">Wound Center</SelectItem>
                      <SelectItem value="Other">Other</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Referral Volume</label>
                  <Select 
                    value={sourceFormData.referralVolume || 'Medium'} 
                    onValueChange={(value) => setSourceFormData({ ...sourceFormData, referralVolume: value })}
                  >
                    <SelectTrigger data-testid="select-source-volume">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="High">High</SelectItem>
                      <SelectItem value="Medium">Medium</SelectItem>
                      <SelectItem value="Low">Low</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Relationship Status</label>
                  <Select 
                    value={sourceFormData.relationshipStatus || 'Active'} 
                    onValueChange={(value) => setSourceFormData({ ...sourceFormData, relationshipStatus: value })}
                  >
                    <SelectTrigger data-testid="select-source-status">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Active">Active</SelectItem>
                      <SelectItem value="Inactive">Inactive</SelectItem>
                      <SelectItem value="Prospect">Prospect</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Assigned Sales Rep</label>
                  <Select 
                    value={sourceFormData.salesRep || ''} 
                    onValueChange={(value) => setSourceFormData({ ...sourceFormData, salesRep: value })}
                  >
                    <SelectTrigger data-testid="select-source-sales-rep">
                      <SelectValue placeholder="Select sales rep" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="unassigned">Unassigned</SelectItem>
                      {salesReps.map((rep) => (
                        <SelectItem key={rep.id} value={rep.name}>{rep.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium mb-1">Notes</label>
                  <Textarea
                    value={sourceFormData.notes || ''}
                    onChange={(e) => setSourceFormData({ ...sourceFormData, notes: e.target.value })}
                    placeholder="Additional notes about this referral source..."
                    rows={3}
                    data-testid="textarea-source-notes"
                  />
                </div>
              </div>
              <div className="flex justify-end gap-2 pt-4">
                <Button 
                  type="button" 
                  variant="outline" 
                  onClick={() => setShowAddSourceDialog(false)}
                  disabled={addSourceMutation.isPending || editSourceMutation.isPending}
                  data-testid="button-cancel-source"
                >
                  Cancel
                </Button>
                <Button 
                  type="submit" 
                  disabled={addSourceMutation.isPending || editSourceMutation.isPending}
                  data-testid="button-submit-source"
                >
                  {addSourceMutation.isPending || editSourceMutation.isPending 
                    ? "Saving..." 
                    : (editingSource ? "Update Source" : "Add Source")
                  }
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>

        {/* PDF Preview Modal */}
        <PDFPreviewModal
          open={pdfPreviewOpen}
          onClose={() => {
            setPdfPreviewOpen(false);
            setPreviewFile(null);
          }}
          fileId={previewFile?.id || null}
          fileName={previewFile?.fileName || ''}
        />
      </div>
    </div>
  );
}
