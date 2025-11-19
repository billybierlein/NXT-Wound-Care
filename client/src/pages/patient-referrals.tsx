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
import { Upload, FileText, Download, Plus, Check, X, Archive, Filter, XCircle, Trash2 } from "lucide-react";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import Navigation from "@/components/ui/navigation";
import { isUnauthorizedError } from "@/lib/authUtils";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { PatientReferral, SalesRep, ReferralFile, User, InsertPatient, ReferralSource } from "@shared/schema";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { DragDropContext, Droppable, Draggable, DropResult } from "@hello-pangea/dnd";
import { PatientForm } from "@/components/patients/PatientForm";

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
  
  // Filter state
  const [filters, setFilters] = useState({
    date: '',
    referralSourceId: 'all',
    salesRepId: 'all',
    insuranceType: '',
  });

  // Get current user data to check role
  const { data: currentUser } = useQuery<User>({
    queryKey: ["/api/auth/user"],
    retry: false,
    enabled: isAuthenticated,
  });

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

  // Role-based filtering
  const visibleReferrals = currentUser?.role === 'admin' 
    ? allReferrals 
    : allReferrals.filter(ref => ref.assignedSalesRepId === currentUser?.salesRepId);

  // Apply filters
  const filteredReferrals = useMemo(() => {
    return visibleReferrals.filter(ref => {
      // Date filter
      if (filters.date && ref.referralDate) {
        const refDate = new Date(ref.referralDate).toISOString().split('T')[0];
        if (refDate !== filters.date) return false;
      }
      
      // Referral Source filter
      if (filters.referralSourceId && filters.referralSourceId !== 'all') {
        if (String(ref.referralSourceId) !== filters.referralSourceId) return false;
      }
      
      // Sales Rep filter
      if (filters.salesRepId && filters.salesRepId !== 'all') {
        if (String(ref.assignedSalesRepId) !== filters.salesRepId) return false;
      }
      
      // Insurance Type filter
      if (filters.insuranceType) {
        if (!ref.patientInsurance || !ref.patientInsurance.toLowerCase().includes(filters.insuranceType.toLowerCase())) {
          return false;
        }
      }
      
      return true;
    });
  }, [visibleReferrals, filters]);

  // Group referrals by kanban status and auto-sort 'new' column by referral date (newest first)
  const referralsByStatus = useMemo(() => {
    return KANBAN_COLUMNS.reduce((acc, col) => {
      let columnReferrals = filteredReferrals.filter(ref => ref.kanbanStatus === col.id);
      
      // Auto-sort 'new' column by referral date (newest first)
      if (col.id === 'new') {
        columnReferrals = columnReferrals.sort((a, b) => {
          const dateA = a.referralDate ? new Date(a.referralDate).getTime() : 0;
          const dateB = b.referralDate ? new Date(b.referralDate).getTime() : 0;
          return dateB - dateA; // Newest first
        });
      }
      
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

        {/* Filters Section */}
        <Card className="mb-6">
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 mb-4">
              <Filter className="h-4 w-4" />
              <h3 className="font-semibold">Filters</h3>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              {/* Date Filter */}
              <div>
                <label className="block text-sm font-medium mb-1">Date</label>
                <Input
                  type="date"
                  value={filters.date}
                  onChange={(e) => setFilters({ ...filters, date: e.target.value })}
                  data-testid="filter-date"
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
                <Input
                  placeholder="e.g., Medicare, Medicaid"
                  value={filters.insuranceType}
                  onChange={(e) => setFilters({ ...filters, insuranceType: e.target.value })}
                  data-testid="filter-insurance-type"
                />
              </div>
            </div>

            {/* Reset Filters Button */}
            <div className="mt-4 flex justify-end">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setFilters({ date: '', referralSourceId: 'all', salesRepId: 'all', insuranceType: '' })}
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
                        "flex-1 p-2 bg-gray-100 dark:bg-gray-800 rounded-b-lg min-h-[200px]",
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
                                    const dateValue = displayDate ? (typeof displayDate === 'string' ? displayDate.split('T')[0] : format(new Date(displayDate), 'yyyy-MM-dd')) : '';
                                    
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
                                              const date = typeof displayDate === 'string' ? new Date(displayDate) : displayDate;
                                              return !isNaN(date.getTime()) ? format(date, "MMM d, yyyy") : "Click to add";
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

                                  {/* Insurance - Inline Editable */}
                                  {(() => {
                                    const field = 'patientInsurance';
                                    const isEditing = editingField?.referralId === referral.id && editingField?.field === field;
                                    const value = referral.patientInsurance;
                                    return (
                                      <div className="text-sm">
                                        <span className="font-medium">Insurance:</span>{" "}
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

                                  {/* Files Section - Bottom of Card */}
                                  {(files.length > 0 || column.id !== 'patient_created') && (
                                    <div className="mt-2 pt-2 border-t border-gray-200 dark:border-gray-700">
                                      {/* File List */}
                                      {files.map((file, idx) => (
                                        <div
                                          key={file.id}
                                          className="flex items-center justify-between gap-2 mb-1 group"
                                        >
                                          <a
                                            href={`/api/referral-files/${file.id}/download`}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="flex items-center gap-2 text-blue-600 hover:text-blue-800 text-sm flex-1 min-w-0"
                                            data-testid={`link-file-${referral.id}-${idx}`}
                                          >
                                            <FileText className="h-4 w-4 flex-shrink-0" />
                                            <span className="truncate">{file.fileName}</span>
                                          </a>
                                          <Button
                                            size="sm"
                                            variant="ghost"
                                            className="h-6 w-6 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
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

                                      {/* Upload Additional File Button */}
                                      {column.id !== 'patient_created' && (
                                        <Button
                                          size="sm"
                                          variant="ghost"
                                          onClick={() => {
                                            setSelectedReferralForFile(referral.id);
                                            setUploadAdditionalFileDialogOpen(true);
                                          }}
                                          className="w-full mt-1 text-xs h-7"
                                          data-testid={`button-upload-file-${referral.id}`}
                                        >
                                          <Upload className="h-3 w-3 mr-1" />
                                          Upload Additional File
                                        </Button>
                                      )}
                                    </div>
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

        {/* Add Referral Source Dialog */}
        <AddReferralSourceDialog 
          open={addReferralSourceDialogOpen} 
          onOpenChange={setAddReferralSourceDialogOpen} 
          salesReps={salesReps}
        />
      </div>
    </div>
  );
}

// Add Referral Source Dialog Component
function AddReferralSourceDialog({ 
  open, 
  onOpenChange,
  salesReps 
}: { 
  open: boolean; 
  onOpenChange: (open: boolean) => void;
  salesReps: SalesRep[];
}) {
  const { toast } = useToast();
  const [formData, setFormData] = useState({
    facilityName: '',
    contactPerson: '',
    email: '',
    phoneNumber: '',
    address: '',
    facilityType: 'Hospital',
    referralVolume: 'Medium',
    relationshipStatus: 'Active',
    salesRep: '',
    notes: '',
  });

  // Reset form when dialog closes
  useEffect(() => {
    if (!open) {
      setFormData({
        facilityName: '',
        contactPerson: '',
        email: '',
        phoneNumber: '',
        address: '',
        facilityType: 'Hospital',
        referralVolume: 'Medium',
        relationshipStatus: 'Active',
        salesRep: '',
        notes: '',
      });
    }
  }, [open]);

  const createSourceMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      const response = await apiRequest("POST", "/api/referral-sources", data);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/referral-sources"] });
      toast({
        title: "Success",
        description: "Referral source added successfully",
      });
      onOpenChange(false);
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to add referral source",
        variant: "destructive",
      });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.facilityName) {
      toast({
        title: "Validation Error",
        description: "Facility name is required",
        variant: "destructive",
      });
      return;
    }
    createSourceMutation.mutate(formData);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Add New Referral Source</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">Facility Name *</label>
              <Input
                value={formData.facilityName}
                onChange={(e) => setFormData({ ...formData, facilityName: e.target.value })}
                required
                data-testid="input-facility-name"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Contact Person</label>
              <Input
                value={formData.contactPerson}
                onChange={(e) => setFormData({ ...formData, contactPerson: e.target.value })}
                data-testid="input-contact-person"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Email</label>
              <Input
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                data-testid="input-email"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Phone Number</label>
              <Input
                value={formData.phoneNumber}
                onChange={(e) => setFormData({ ...formData, phoneNumber: e.target.value })}
                data-testid="input-phone"
              />
            </div>
            <div className="md:col-span-2">
              <label className="block text-sm font-medium mb-1">Address</label>
              <Input
                value={formData.address}
                onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                data-testid="input-address"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Facility Type</label>
              <Select 
                value={formData.facilityType} 
                onValueChange={(value) => setFormData({ ...formData, facilityType: value })}
              >
                <SelectTrigger data-testid="select-facility-type">
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
              <label className="block text-sm font-medium mb-1">Assigned Sales Rep</label>
              <Select 
                value={formData.salesRep} 
                onValueChange={(value) => setFormData({ ...formData, salesRep: value })}
              >
                <SelectTrigger data-testid="select-sales-rep">
                  <SelectValue placeholder="Select sales rep" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="unassigned">Unassigned</SelectItem>
                  {salesReps.map((rep) => (
                    <SelectItem key={rep.id} value={rep.name}>
                      {rep.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="md:col-span-2">
              <label className="block text-sm font-medium mb-1">Notes</label>
              <Textarea
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                placeholder="Additional notes about this referral source..."
                rows={3}
                data-testid="textarea-notes"
              />
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-4">
            <Button 
              type="button" 
              variant="outline" 
              onClick={() => onOpenChange(false)}
              data-testid="button-cancel"
            >
              Cancel
            </Button>
            <Button 
              type="submit" 
              disabled={createSourceMutation.isPending}
              data-testid="button-submit"
            >
              {createSourceMutation.isPending ? "Adding..." : "Add Source"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
