import { useAuth } from "@/hooks/useAuth";
import { useEffect, useState, useCallback, useMemo } from "react";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Upload, FileText, Download, Plus, Check, X } from "lucide-react";
import Navigation from "@/components/ui/navigation";
import { isUnauthorizedError } from "@/lib/authUtils";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { PatientReferral, SalesRep, ReferralFile, User, InsertPatient } from "@shared/schema";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { DragDropContext, Droppable, Draggable, DropResult } from "@hello-pangea/dnd";
import { PatientForm } from "@/components/patients/PatientForm";

type KanbanStatus = 'new' | 'in_review' | 'approved' | 'denied' | 'completed';

const KANBAN_COLUMNS: { id: KanbanStatus; title: string; color: string }[] = [
  { id: 'new', title: 'New / Needs Review', color: 'bg-gray-100 dark:bg-gray-800' },
  { id: 'in_review', title: 'In Review', color: 'bg-blue-100 dark:bg-blue-900' },
  { id: 'approved', title: 'Approved', color: 'bg-green-100 dark:bg-green-900' },
  { id: 'denied', title: 'Denied', color: 'bg-red-100 dark:bg-red-900' },
  { id: 'completed', title: 'Completed', color: 'bg-purple-100 dark:bg-purple-900' },
];

export default function PatientReferrals() {
  const { isAuthenticated, isLoading } = useAuth();
  const { toast } = useToast();
  const [isDragOver, setIsDragOver] = useState(false);
  const [uploadDialogOpen, setUploadDialogOpen] = useState(false);
  const [createPatientDialogOpen, setCreatePatientDialogOpen] = useState(false);
  const [selectedReferralId, setSelectedReferralId] = useState<number | null>(null);
  const [editingField, setEditingField] = useState<{ referralId: number; field: string } | null>(null);

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

  // Get file for referral
  const getReferralFile = (referralId: number): ReferralFile | undefined => {
    return allFiles.find(f => f.patientReferralId === referralId);
  };

  // Role-based filtering
  const visibleReferrals = currentUser?.role === 'admin' 
    ? allReferrals 
    : allReferrals.filter(ref => ref.assignedSalesRepId === currentUser?.salesRepId);

  // Group referrals by kanban status
  const referralsByStatus = KANBAN_COLUMNS.reduce((acc, col) => {
    acc[col.id] = visibleReferrals.filter(ref => ref.kanbanStatus === col.id);
    return acc;
  }, {} as Record<KanbanStatus, PatientReferral[]>);

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

  // Update status mutation (admin only)
  const updateStatusMutation = useMutation({
    mutationFn: async ({ id, kanbanStatus }: { id: number; kanbanStatus: KanbanStatus }) => {
      const response = await apiRequest("PATCH", `/api/referrals/${id}/status`, { kanbanStatus });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/patient-referrals"] });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update status",
        variant: "destructive",
      });
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
                        const file = getReferralFile(referral.id);
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
                                  {/* File Preview */}
                                  {file && (
                                    <a
                                      href={`/api/referral-files/${file.id}/download`}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="flex items-center gap-2 text-blue-600 hover:text-blue-800 text-sm"
                                      data-testid={`link-file-${referral.id}`}
                                    >
                                      <FileText className="h-4 w-4" />
                                      <span className="truncate">{file.fileName}</span>
                                    </a>
                                  )}

                                  {/* Upload Date */}
                                  <div className="text-xs text-gray-500">
                                    {(() => {
                                      if (!referral.createdAt) return "Uploaded: Unknown";
                                      const date = typeof referral.createdAt === 'string' 
                                        ? new Date(referral.createdAt) 
                                        : referral.createdAt;
                                      return !isNaN(date.getTime()) 
                                        ? `Uploaded: ${format(date, "MMM d, yyyy")}` 
                                        : "Uploaded: Unknown";
                                    })()}
                                  </div>

                                  {/* Assigned Rep */}
                                  <div className="text-sm">
                                    <span className="font-medium">Rep:</span> {getSalesRepName(referral.assignedSalesRepId)}
                                  </div>

                                  {/* Inline Editable Fields */}
                                  {['patientName', 'patientInsurance', 'estimatedWoundSize'].map(field => {
                                    const isEditing = editingField?.referralId === referral.id && editingField?.field === field;
                                    const value = referral[field as keyof PatientReferral] as string | null;
                                    const label = field === 'patientName' ? 'Patient' : 
                                                 field === 'patientInsurance' ? 'Insurance' : 'Wound Size';

                                    return (
                                      <div key={field} className="text-sm">
                                        <span className="font-medium">{label}:</span>{" "}
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
                                  })}

                                  {/* Create Patient Button (Approved column only) */}
                                  {column.id === 'approved' && !referral.patientId && (
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

                                  {/* Patient Created Badge (Completed column) */}
                                  {column.id === 'completed' && referral.patientId && (
                                    <Badge variant="secondary" className="w-full justify-center">
                                      <Check className="h-3 w-3 mr-1" />
                                      Patient Created
                                    </Badge>
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
      </div>
    </div>
  );
}
