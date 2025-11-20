import { useState, useEffect } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { useRoute } from 'wouter';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';
import { isUnauthorizedError } from '@/lib/authUtils';
import { apiRequest, queryClient } from '@/lib/queryClient';
import Navigation from '@/components/ui/navigation';
import { 
  Edit, 
  Save, 
  X, 
  Plus,
  Building2, 
  Phone, 
  Mail, 
  MapPin, 
  Users, 
  Star,
  ChevronLeft,
  ChevronRight,
  FileText,
  Trash2,
  Upload,
  Pencil,
  Check,
  Calendar,
  Activity,
  MessageSquare,
  ClipboardList,
  Download,
  File,
  Send
} from 'lucide-react';
import type { 
  ReferralSource, 
  InsertReferralSource, 
  ReferralSourceTimelineEvent, 
  InsertReferralSourceTimelineEvent,
  ReferralSourceContact,
  InsertReferralSourceContact,
  ReferralSourceNote,
  ReferralSourceNoteFile,
  ReferralSourceNoteComment,
  SalesRep,
  Patient,
  ReferralFile,
  PatientReferral,
  InsertPatient
} from '@shared/schema';
import { PatientForm } from '@/components/patients/PatientForm';
import { useLocation, Link } from 'wouter';
import PDFPreviewModal from '@/components/PDFPreviewModal';

export default function ReferralSourceProfile() {
  const { toast } = useToast();
  const { user, isAuthenticated, isLoading: authLoading } = useAuth();
  const [, params] = useRoute('/referral-sources/:id');
  const [, navigate] = useLocation();
  const referralSourceId = params?.id ? parseInt(params.id) : null;
  
  // Inline editing state for sidebar fields
  const [editingField, setEditingField] = useState<string | null>(null);
  const [editValue, setEditValue] = useState<string>('');
  
  // State for dialogs
  const [showTimelineDialog, setShowTimelineDialog] = useState(false);
  const [showContactDialog, setShowContactDialog] = useState(false);
  const [editingContact, setEditingContact] = useState<ReferralSourceContact | null>(null);
  const [timelineEventData, setTimelineEventData] = useState<Partial<InsertReferralSourceTimelineEvent>>({
    eventType: 'note',
    eventDate: new Date(),
    description: '',
  });
  const [contactFormData, setContactFormData] = useState<Partial<InsertReferralSourceContact>>({
    contactName: '',
    titlePosition: '',
    phoneNumber: '',
    email: '',
    isPrimary: false,
  });

  // State for Kanban referral inline editing
  const [editingReferralId, setEditingReferralId] = useState<number | null>(null);
  const [editingReferralField, setEditingReferralField] = useState<'status' | 'insurance' | 'notes' | null>(null);
  const [editReferralValue, setEditReferralValue] = useState<string>('');

  // State for patient creation dialog
  const [showPatientForm, setShowPatientForm] = useState(false);
  const [selectedReferralForPatient, setSelectedReferralForPatient] = useState<PatientReferral | null>(null);

  // File management state
  const [pdfPreviewOpen, setPdfPreviewOpen] = useState(false);
  const [previewFile, setPreviewFile] = useState<{ id: number; fileName: string } | null>(null);
  const [deleteFileConfirmOpen, setDeleteFileConfirmOpen] = useState(false);
  const [fileToDelete, setFileToDelete] = useState<{ id: number; fileName: string } | null>(null);
  const [uploadFileDialogOpen, setUploadFileDialogOpen] = useState(false);
  const [selectedReferralForFile, setSelectedReferralForFile] = useState<number | null>(null);

  // Notes system state
  const [noteContent, setNoteContent] = useState('');
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [expandedComments, setExpandedComments] = useState<Set<number>>(new Set());
  const [commentInputs, setCommentInputs] = useState<Record<number, string>>({});

  // Note editing dialog state
  const [noteEditDialogOpen, setNoteEditDialogOpen] = useState(false);
  const [editingNoteReferral, setEditingNoteReferral] = useState<PatientReferral | null>(null);
  const [noteEditValue, setNoteEditValue] = useState('');

  // Pagination state for Inbound Referrals table
  const [currentPage, setCurrentPage] = useState(1);
  const rowsPerPage = 10;

  // Redirect to login if not authenticated
  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
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
  }, [isAuthenticated, authLoading, toast]);

  // Fetch all referral sources for navigation
  const { data: allReferralSources = [] } = useQuery<ReferralSource[]>({
    queryKey: ["/api/referral-sources"],
    retry: false,
    enabled: isAuthenticated,
  });

  // Fetch current referral source data
  const { data: referralSource, isLoading: sourceLoading } = useQuery<ReferralSource>({
    queryKey: [`/api/referral-sources/${referralSourceId}`],
    retry: false,
    enabled: isAuthenticated && !!referralSourceId,
  });

  // Fetch contacts for this referral source
  const { data: contacts = [], isLoading: contactsLoading } = useQuery<ReferralSourceContact[]>({
    queryKey: [`/api/referral-sources/${referralSourceId}/contacts`],
    retry: false,
    enabled: isAuthenticated && !!referralSourceId,
  });

  // Fetch timeline events
  const { data: timelineEvents = [], isLoading: timelineLoading } = useQuery<ReferralSourceTimelineEvent[]>({
    queryKey: [`/api/referral-sources/${referralSourceId}/timeline`],
    retry: false,
    enabled: isAuthenticated && !!referralSourceId,
  });

  // Fetch treatments
  const { data: treatments = [], isLoading: treatmentsLoading } = useQuery<any[]>({
    queryKey: [`/api/referral-sources/${referralSourceId}/treatments`],
    retry: false,
    enabled: isAuthenticated && !!referralSourceId,
    staleTime: 30000,
    refetchInterval: 10000,
  });

  // Fetch patients referred by this source
  const { data: patients = [], isLoading: patientsLoading } = useQuery<Patient[]>({
    queryKey: ["/api/patients"],
    retry: false,
    enabled: isAuthenticated && !!referralSourceId,
    select: (data) => {
      return data.filter((patient: Patient) => 
        patient.referralSource === referralSource?.facilityName || 
        patient.referralSourceId === referralSourceId
      );
    }
  });

  // Fetch Kanban referrals from this source
  const { data: kanbanReferrals = [], isLoading: kanbanReferralsLoading } = useQuery<PatientReferral[]>({
    queryKey: [`/api/referral-sources/${referralSourceId}/kanban-referrals`],
    retry: false,
    enabled: isAuthenticated && !!referralSourceId,
  });

  // Fetch all patient referrals for metrics
  const { data: allPatientReferrals = [] } = useQuery<PatientReferral[]>({
    queryKey: ["/api/patient-referrals"],
    retry: false,
    enabled: isAuthenticated && !!referralSourceId,
  });

  // Fetch sales reps
  const { data: salesReps = [] } = useQuery<SalesRep[]>({
    queryKey: ["/api/sales-reps"],
    retry: false,
    enabled: isAuthenticated,
  });

  // Fetch referral files
  const { data: allReferralFiles = [] } = useQuery<ReferralFile[]>({
    queryKey: ["/api/referral-files"],
    retry: false,
    enabled: isAuthenticated,
  });

  // Fetch notes for this referral source
  const { data: notes = [], isLoading: notesLoading } = useQuery<Array<ReferralSourceNote & { user: { firstName: string; lastName: string; email: string } }>>({
    queryKey: [`/api/referral-sources/${referralSourceId}/notes`],
    retry: false,
    enabled: isAuthenticated && !!referralSourceId,
  });

  // Calculate metrics for this referral source
  const metrics = (() => {
    if (!referralSourceId || !allPatientReferrals.length) {
      return { total: 0, medicare: 0, advantagePlan: 0 };
    }

    const sourceReferrals = allPatientReferrals.filter(
      ref => ref.referralSourceId === referralSourceId
    );

    const total = sourceReferrals.length;
    const medicare = sourceReferrals.filter(ref => 
      ref.patientInsurance?.toLowerCase().includes('medicare') && 
      !ref.patientInsurance?.toLowerCase().includes('advantage')
    ).length;
    const advantagePlan = sourceReferrals.filter(ref => 
      ref.patientInsurance?.toLowerCase().includes('advantage')
    ).length;

    return { total, medicare, advantagePlan };
  })();

  // Calculate navigation position
  const currentIndex = allReferralSources.findIndex(source => source.id === referralSourceId);
  const totalSources = allReferralSources.length;

  // Navigation handlers
  const handlePrevious = () => {
    if (currentIndex > 0) {
      const prevSource = allReferralSources[currentIndex - 1];
      navigate(`/referral-sources/${prevSource.id}`);
    }
  };

  const handleNext = () => {
    if (currentIndex < totalSources - 1) {
      const nextSource = allReferralSources[currentIndex + 1];
      navigate(`/referral-sources/${nextSource.id}`);
    }
  };

  // Update referral source mutation
  const updateMutation = useMutation({
    mutationFn: async (data: Partial<InsertReferralSource>) => {
      return await apiRequest("PUT", `/api/referral-sources/${referralSourceId}`, data);
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Referral source updated successfully",
      });
      setEditingField(null);
      setEditValue('');
      queryClient.invalidateQueries({ queryKey: [`/api/referral-sources/${referralSourceId}`] });
      queryClient.invalidateQueries({ queryKey: ["/api/referral-sources"] });
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
        description: error.message || "Failed to update referral source",
        variant: "destructive",
      });
    },
  });

  // Contact mutations
  const addContactMutation = useMutation({
    mutationFn: async (data: InsertReferralSourceContact) => {
      return await apiRequest("POST", `/api/referral-sources/${referralSourceId}/contacts`, data);
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Contact added successfully",
      });
      setShowContactDialog(false);
      setContactFormData({
        contactName: '',
        titlePosition: '',
        phoneNumber: '',
        email: '',
        isPrimary: false,
      });
      queryClient.invalidateQueries({ queryKey: [`/api/referral-sources/${referralSourceId}/contacts`] });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to add contact",
        variant: "destructive",
      });
    },
  });

  const updateContactMutation = useMutation({
    mutationFn: async ({ contactId, data }: { contactId: number; data: Partial<InsertReferralSourceContact> }) => {
      return await apiRequest("PUT", `/api/referral-sources/${referralSourceId}/contacts/${contactId}`, data);
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Contact updated successfully",
      });
      setShowContactDialog(false);
      setEditingContact(null);
      setContactFormData({
        contactName: '',
        titlePosition: '',
        phoneNumber: '',
        email: '',
        isPrimary: false,
      });
      queryClient.invalidateQueries({ queryKey: [`/api/referral-sources/${referralSourceId}/contacts`] });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update contact",
        variant: "destructive",
      });
    },
  });

  const deleteContactMutation = useMutation({
    mutationFn: async (contactId: number) => {
      return await apiRequest("DELETE", `/api/referral-sources/${referralSourceId}/contacts/${contactId}`);
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Contact deleted successfully",
      });
      queryClient.invalidateQueries({ queryKey: [`/api/referral-sources/${referralSourceId}/contacts`] });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to delete contact",
        variant: "destructive",
      });
    },
  });

  // Timeline mutation
  const addTimelineEventMutation = useMutation({
    mutationFn: async (data: InsertReferralSourceTimelineEvent) => {
      return await apiRequest("POST", `/api/referral-sources/${referralSourceId}/timeline`, data);
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Timeline event added successfully",
      });
      setShowTimelineDialog(false);
      setTimelineEventData({
        eventType: 'note',
        eventDate: new Date(),
        description: '',
      });
      queryClient.invalidateQueries({ queryKey: [`/api/referral-sources/${referralSourceId}/timeline`] });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to add timeline event",
        variant: "destructive",
      });
    },
  });

  // Mutation for updating Kanban referral inline
  const updateReferralMutation = useMutation({
    mutationFn: async ({ id, updates }: { id: number; updates: Partial<PatientReferral> }) => {
      const response = await apiRequest("PATCH", `/api/patient-referrals/${id}`, updates);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/referral-sources/${referralSourceId}/kanban-referrals`] });
      queryClient.invalidateQueries({ queryKey: ["/api/patient-referrals"] });
      setEditingReferralId(null);
      setEditingReferralField(null);
      setEditReferralValue('');
      toast({
        title: "Success",
        description: "Referral updated successfully",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update referral",
        variant: "destructive",
      });
    },
  });

  // File upload mutation
  const uploadFileMutation = useMutation({
    mutationFn: async ({ referralId, file }: { referralId: number; file: File }) => {
      return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = async () => {
          const base64Data = reader.result?.toString().split(",")[1];
          if (!base64Data) {
            reject(new Error("Failed to read file"));
            return;
          }

          try {
            const response = await apiRequest("POST", `/api/referrals/${referralId}/upload-file`, {
              base64Data,
              fileName: file.name,
              fileSize: file.size,
              mimeType: file.type,
            });
            const data = await response.json();
            resolve(data);
          } catch (error) {
            reject(error);
          }
        };
        reader.onerror = () => reject(new Error("Failed to read file"));
        reader.readAsDataURL(file);
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/referral-files"] });
      toast({
        title: "Success",
        description: "File uploaded successfully!",
      });
      setUploadFileDialogOpen(false);
      setSelectedReferralForFile(null);
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to upload file",
        variant: "destructive",
      });
    },
  });

  // File delete mutation
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

  // Notes mutations
  const createNoteMutation = useMutation({
    mutationFn: async ({ content, files }: { content: string; files: File[] }) => {
      const formData = new FormData();
      formData.append('content', content);
      files.forEach(file => formData.append('files', file));

      const response = await fetch(`/api/referral-sources/${referralSourceId}/notes`, {
        method: 'POST',
        body: formData,
        credentials: 'include',
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to create note');
      }

      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/referral-sources/${referralSourceId}/notes`] });
      setNoteContent('');
      setSelectedFiles([]);
      toast({
        title: "Success",
        description: "Note created successfully",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to create note",
        variant: "destructive",
      });
    },
  });

  const deleteNoteMutation = useMutation({
    mutationFn: async (noteId: number) => {
      const response = await apiRequest("DELETE", `/api/referral-sources/notes/${noteId}`);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/referral-sources/${referralSourceId}/notes`] });
      toast({
        title: "Success",
        description: "Note deleted successfully",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to delete note",
        variant: "destructive",
      });
    },
  });

  const deleteNoteFileMutation = useMutation({
    mutationFn: async (fileId: number) => {
      const response = await apiRequest("DELETE", `/api/referral-sources/notes/files/${fileId}`);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/referral-sources/${referralSourceId}/notes`] });
      toast({
        title: "Success",
        description: "File deleted successfully",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to delete file",
        variant: "destructive",
      });
    },
  });

  const createCommentMutation = useMutation({
    mutationFn: async ({ noteId, content }: { noteId: number; content: string }) => {
      const response = await apiRequest("POST", `/api/referral-sources/notes/${noteId}/comments`, { content });
      return response.json();
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: [`/api/referral-sources/${referralSourceId}/notes`] });
      setCommentInputs(prev => ({ ...prev, [variables.noteId]: '' }));
      toast({
        title: "Success",
        description: "Comment added successfully",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to add comment",
        variant: "destructive",
      });
    },
  });

  const deleteCommentMutation = useMutation({
    mutationFn: async (commentId: number) => {
      const response = await apiRequest("DELETE", `/api/referral-sources/notes/comments/${commentId}`);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/referral-sources/${referralSourceId}/notes`] });
      toast({
        title: "Success",
        description: "Comment deleted successfully",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to delete comment",
        variant: "destructive",
      });
    },
  });

  // Inline editing handlers for sidebar
  const startInlineEdit = (field: string, currentValue: string) => {
    setEditingField(field);
    setEditValue(currentValue || '');
  };

  const saveInlineEdit = (field: string) => {
    const updates: Partial<InsertReferralSource> = {
      [field]: editValue
    };
    updateMutation.mutate(updates);
  };

  const cancelInlineEdit = () => {
    setEditingField(null);
    setEditValue('');
  };

  // Kanban referral inline editing handlers
  const startEditingReferralField = (referral: PatientReferral, field: 'status' | 'insurance' | 'notes') => {
    setEditingReferralId(referral.id);
    setEditingReferralField(field);
    if (field === 'status') {
      setEditReferralValue(referral.kanbanStatus || '');
    } else if (field === 'insurance') {
      setEditReferralValue(referral.patientInsurance || '');
    } else if (field === 'notes') {
      setEditReferralValue(referral.notes || '');
    }
  };

  const saveReferralInlineEdit = (referralId: number, field: 'status' | 'insurance' | 'notes') => {
    const updates: Partial<PatientReferral> = {};
    
    if (field === 'status') {
      updates.kanbanStatus = editReferralValue as any;
    } else if (field === 'insurance') {
      updates.patientInsurance = editReferralValue;
    } else if (field === 'notes') {
      updates.notes = editReferralValue;
    }
    
    updateReferralMutation.mutate({ id: referralId, updates });
  };

  const cancelReferralEditing = () => {
    setEditingReferralId(null);
    setEditingReferralField(null);
    setEditReferralValue('');
  };

  // Contact handlers
  const handleAddContact = () => {
    setEditingContact(null);
    setContactFormData({
      contactName: '',
      titlePosition: '',
      phoneNumber: '',
      email: '',
      isPrimary: false,
    });
    setShowContactDialog(true);
  };

  const handleEditContact = (contact: ReferralSourceContact) => {
    setEditingContact(contact);
    setContactFormData({
      contactName: contact.contactName,
      titlePosition: contact.titlePosition || '',
      phoneNumber: contact.phoneNumber || '',
      email: contact.email || '',
      isPrimary: contact.isPrimary,
    });
    setShowContactDialog(true);
  };

  const handleDeleteContact = (contactId: number) => {
    if (window.confirm('Are you sure you want to delete this contact?')) {
      deleteContactMutation.mutate(contactId);
    }
  };

  const handleContactSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (editingContact) {
      updateContactMutation.mutate({
        contactId: editingContact.id,
        data: contactFormData,
      });
    } else {
      addContactMutation.mutate(contactFormData as InsertReferralSourceContact);
    }
  };

  // Timeline handlers
  const handleAddTimelineEvent = (e: React.FormEvent) => {
    e.preventDefault();
    
    const getEventTitle = (eventType: string) => {
      switch (eventType) {
        case 'note': return 'Added Note';
        case 'meeting': return 'Meeting';
        case 'call': return 'Phone Call';
        case 'visit': return 'Site Visit';
        case 'contract_update': return 'Contract Update';
        default: return 'General Event';
      }
    };

    const eventDataWithTitle = {
      ...timelineEventData,
      title: getEventTitle(timelineEventData.eventType || 'note'),
      userId: user?.id,
    };
    
    addTimelineEventMutation.mutate(eventDataWithTitle as InsertReferralSourceTimelineEvent);
  };

  // Patient form handler
  const openPatientFormWithReferral = (referral: PatientReferral) => {
    setSelectedReferralForPatient(referral);
    setShowPatientForm(true);
  };

  // Helper functions
  const getStatusBadge = (status: string | null) => {
    switch (status) {
      case 'new':
        return <Badge className="bg-blue-100 text-blue-800">New / Needs Review</Badge>;
      case 'medicare':
        return <Badge className="bg-green-100 text-green-800">Medicare</Badge>;
      case 'advantage_plans':
        return <Badge className="bg-purple-100 text-purple-800">Advantage Plans</Badge>;
      case 'patient_created':
        return <Badge className="bg-gray-100 text-gray-800">Patient Created</Badge>;
      default:
        return <Badge variant="outline">Unknown</Badge>;
    }
  };

  const formatTimestamp = (timestamp: string | Date) => {
    const date = new Date(timestamp);
    const timeStr = date.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
      timeZone: 'America/New_York'
    });
    const dateStr = date.toLocaleDateString('en-US', {
      month: '2-digit',
      day: '2-digit',
      year: 'numeric',
      timeZone: 'America/New_York'
    });
    return `${timeStr}, ${dateStr}`;
  };

  const formatNoteTimestamp = (timestamp: string | Date) => {
    const date = new Date(timestamp);
    return date.toLocaleDateString('en-US', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    });
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const getUserInitials = (firstName: string, lastName: string) => {
    return `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase();
  };

  const getAvatarColor = (name: string) => {
    const colors = [
      'bg-blue-500',
      'bg-green-500',
      'bg-purple-500',
      'bg-pink-500',
      'bg-indigo-500',
      'bg-yellow-500',
      'bg-red-500',
    ];
    const index = name.charCodeAt(0) % colors.length;
    return colors[index];
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    setSelectedFiles(prev => [...prev, ...files]);
  };

  const removeSelectedFile = (index: number) => {
    setSelectedFiles(prev => prev.filter((_, i) => i !== index));
  };

  const handleSubmitNote = (e: React.FormEvent) => {
    e.preventDefault();
    if (!noteContent.trim()) {
      toast({
        title: "Error",
        description: "Please enter note content",
        variant: "destructive",
      });
      return;
    }
    createNoteMutation.mutate({ content: noteContent, files: selectedFiles });
  };

  const handleClearNote = () => {
    setNoteContent('');
    setSelectedFiles([]);
  };

  const toggleComments = (noteId: number) => {
    setExpandedComments(prev => {
      const newSet = new Set(prev);
      if (newSet.has(noteId)) {
        newSet.delete(noteId);
      } else {
        newSet.add(noteId);
      }
      return newSet;
    });
  };

  const handleSubmitComment = (noteId: number) => {
    const content = commentInputs[noteId];
    if (!content?.trim()) {
      toast({
        title: "Error",
        description: "Please enter comment content",
        variant: "destructive",
      });
      return;
    }
    createCommentMutation.mutate({ noteId, content });
  };

  const getEventIcon = (eventType: string) => {
    switch (eventType) {
      case 'note':
        return <MessageSquare className="h-4 w-4" />;
      case 'call':
        return <Phone className="h-4 w-4" />;
      case 'email':
        return <Mail className="h-4 w-4" />;
      case 'meeting':
        return <Users className="h-4 w-4" />;
      case 'visit':
        return <MapPin className="h-4 w-4" />;
      default:
        return <Calendar className="h-4 w-4" />;
    }
  };

  // Get primary contact
  const primaryContact = contacts.find(c => c.isPrimary) || contacts[0];

  if (!isAuthenticated || authLoading || sourceLoading || !referralSource) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Navigation />
        <div className="flex items-center justify-center h-screen">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
            <p className="text-gray-600">Loading...</p>
          </div>
        </div>
      </div>
    );
  }

  if (!referralSourceId) {
    return <div>Invalid referral source ID</div>;
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Navigation />
      
      <div className="container mx-auto p-8">
        {/* Two-Column Layout */}
        <div className="flex gap-6">
          {/* Left Sidebar - 30% */}
          <div className="w-[30%] space-y-6">
            {/* Basic Information Card */}
            <Card data-testid="card-basic-info">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <Building2 className="h-5 w-5" />
                  Basic Information
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Facility Name */}
                <div className="group">
                  <label className="text-sm font-medium text-gray-600 block mb-1">Facility Name</label>
                  {editingField === 'facilityName' ? (
                    <div className="flex items-center gap-2">
                      <Input
                        value={editValue}
                        onChange={(e) => setEditValue(e.target.value)}
                        className="flex-1"
                        data-testid="input-facility-name"
                      />
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => saveInlineEdit('facilityName')}
                        className="p-2"
                        data-testid="button-save-facility-name"
                      >
                        <Check className="h-4 w-4 text-green-600" />
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={cancelInlineEdit}
                        className="p-2"
                        data-testid="button-cancel-facility-name"
                      >
                        <X className="h-4 w-4 text-red-600" />
                      </Button>
                    </div>
                  ) : (
                    <div
                      className="flex items-center justify-between p-2 rounded hover:bg-gray-100 cursor-pointer"
                      onClick={() => startInlineEdit('facilityName', referralSource.facilityName || '')}
                      data-testid="text-facility-name"
                    >
                      <span className="font-medium">{referralSource.facilityName || 'Not set'}</span>
                      <Pencil className="h-4 w-4 text-gray-400 opacity-0 group-hover:opacity-100 transition-opacity" />
                    </div>
                  )}
                </div>

                {/* Phone Number */}
                <div className="group">
                  <label className="text-sm font-medium text-gray-600 block mb-1">Phone Number</label>
                  {editingField === 'phoneNumber' ? (
                    <div className="flex items-center gap-2">
                      <Input
                        value={editValue}
                        onChange={(e) => setEditValue(e.target.value)}
                        className="flex-1"
                        data-testid="input-phone-number"
                      />
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => saveInlineEdit('phoneNumber')}
                        className="p-2"
                        data-testid="button-save-phone-number"
                      >
                        <Check className="h-4 w-4 text-green-600" />
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={cancelInlineEdit}
                        className="p-2"
                        data-testid="button-cancel-phone-number"
                      >
                        <X className="h-4 w-4 text-red-600" />
                      </Button>
                    </div>
                  ) : (
                    <div
                      className="flex items-center justify-between p-2 rounded hover:bg-gray-100 cursor-pointer"
                      onClick={() => startInlineEdit('phoneNumber', referralSource.phoneNumber || '')}
                      data-testid="text-phone-number"
                    >
                      <span>{referralSource.phoneNumber || 'Not set'}</span>
                      <Pencil className="h-4 w-4 text-gray-400 opacity-0 group-hover:opacity-100 transition-opacity" />
                    </div>
                  )}
                </div>

                {/* Fax Number - Note: schema doesn't have fax, will use notes field as placeholder */}
                <div className="group">
                  <label className="text-sm font-medium text-gray-600 block mb-1">Fax Number</label>
                  <div className="flex items-center justify-between p-2 rounded">
                    <span className="text-gray-400 text-sm italic">Not available</span>
                  </div>
                </div>

                {/* Assigned Rep */}
                <div className="group">
                  <label className="text-sm font-medium text-gray-600 block mb-1">Assigned Rep</label>
                  {editingField === 'salesRep' ? (
                    <div className="flex items-center gap-2">
                      <Select value={editValue} onValueChange={setEditValue}>
                        <SelectTrigger className="flex-1" data-testid="select-sales-rep">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {salesReps.map((rep) => (
                            <SelectItem key={rep.id} value={rep.name}>
                              {rep.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => saveInlineEdit('salesRep')}
                        className="p-2"
                        data-testid="button-save-sales-rep"
                      >
                        <Check className="h-4 w-4 text-green-600" />
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={cancelInlineEdit}
                        className="p-2"
                        data-testid="button-cancel-sales-rep"
                      >
                        <X className="h-4 w-4 text-red-600" />
                      </Button>
                    </div>
                  ) : (
                    <div
                      className="flex items-center justify-between p-2 rounded hover:bg-gray-100 cursor-pointer"
                      onClick={() => startInlineEdit('salesRep', referralSource.salesRep || '')}
                      data-testid="text-sales-rep"
                    >
                      <span>{referralSource.salesRep || 'Not assigned'}</span>
                      <Pencil className="h-4 w-4 text-gray-400 opacity-0 group-hover:opacity-100 transition-opacity" />
                    </div>
                  )}
                </div>

                {/* Facility Type */}
                <div className="group">
                  <label className="text-sm font-medium text-gray-600 block mb-1">Facility Type</label>
                  {editingField === 'facilityType' ? (
                    <div className="flex items-center gap-2">
                      <Select value={editValue} onValueChange={setEditValue}>
                        <SelectTrigger className="flex-1" data-testid="select-facility-type">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Hospital">Hospital</SelectItem>
                          <SelectItem value="Clinic">Clinic</SelectItem>
                          <SelectItem value="SNF">SNF</SelectItem>
                          <SelectItem value="Home Health">Home Health</SelectItem>
                          <SelectItem value="Hospice">Hospice</SelectItem>
                          <SelectItem value="Other">Other</SelectItem>
                        </SelectContent>
                      </Select>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => saveInlineEdit('facilityType')}
                        className="p-2"
                        data-testid="button-save-facility-type"
                      >
                        <Check className="h-4 w-4 text-green-600" />
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={cancelInlineEdit}
                        className="p-2"
                        data-testid="button-cancel-facility-type"
                      >
                        <X className="h-4 w-4 text-red-600" />
                      </Button>
                    </div>
                  ) : (
                    <div
                      className="flex items-center justify-between p-2 rounded hover:bg-gray-100 cursor-pointer"
                      onClick={() => startInlineEdit('facilityType', referralSource.facilityType || '')}
                      data-testid="text-facility-type"
                    >
                      <span>{referralSource.facilityType || 'Not set'}</span>
                      <Pencil className="h-4 w-4 text-gray-400 opacity-0 group-hover:opacity-100 transition-opacity" />
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Contact Information Card */}
            <Card data-testid="card-contact-info">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <Users className="h-5 w-5" />
                  Contact Information
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={handleAddContact}
                    className="ml-auto"
                    data-testid="button-add-contact"
                  >
                    <Plus className="h-4 w-4" />
                  </Button>
                </CardTitle>
              </CardHeader>
              <CardContent>
                {primaryContact ? (
                  <div className="space-y-4">
                    <div className="group">
                      <label className="text-sm font-medium text-gray-600 block mb-1">Contact Name</label>
                      <div
                        className="flex items-center justify-between p-2 rounded hover:bg-gray-100 cursor-pointer"
                        onClick={() => handleEditContact(primaryContact)}
                        data-testid="text-contact-name"
                      >
                        <span className="font-medium">{primaryContact.contactName}</span>
                        <Pencil className="h-4 w-4 text-gray-400 opacity-0 group-hover:opacity-100 transition-opacity" />
                      </div>
                    </div>
                    
                    {primaryContact.titlePosition && (
                      <div className="group">
                        <label className="text-sm font-medium text-gray-600 block mb-1">Title/Position</label>
                        <div
                          className="flex items-center justify-between p-2 rounded hover:bg-gray-100 cursor-pointer"
                          onClick={() => handleEditContact(primaryContact)}
                          data-testid="text-contact-title"
                        >
                          <span>{primaryContact.titlePosition}</span>
                          <Pencil className="h-4 w-4 text-gray-400 opacity-0 group-hover:opacity-100 transition-opacity" />
                        </div>
                      </div>
                    )}
                    
                    <div className="group">
                      <label className="text-sm font-medium text-gray-600 block mb-1">Phone Number</label>
                      <div
                        className="flex items-center justify-between p-2 rounded hover:bg-gray-100 cursor-pointer"
                        onClick={() => handleEditContact(primaryContact)}
                        data-testid="text-contact-phone"
                      >
                        <span>{primaryContact.phoneNumber || 'Not set'}</span>
                        <Pencil className="h-4 w-4 text-gray-400 opacity-0 group-hover:opacity-100 transition-opacity" />
                      </div>
                    </div>
                    
                    <div className="group">
                      <label className="text-sm font-medium text-gray-600 block mb-1">Email</label>
                      <div
                        className="flex items-center justify-between p-2 rounded hover:bg-gray-100 cursor-pointer"
                        onClick={() => handleEditContact(primaryContact)}
                        data-testid="text-contact-email"
                      >
                        <span>{primaryContact.email || 'Not set'}</span>
                        <Pencil className="h-4 w-4 text-gray-400 opacity-0 group-hover:opacity-100 transition-opacity" />
                      </div>
                    </div>

                    {contacts.length > 1 && (
                      <div className="pt-2 border-t">
                        <p className="text-xs text-gray-500">
                          +{contacts.length - 1} more contact{contacts.length > 2 ? 's' : ''}
                        </p>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="text-center py-8">
                    <Users className="h-8 w-8 text-gray-400 mx-auto mb-2" />
                    <p className="text-sm text-gray-500 mb-4">No contacts added</p>
                    <Button size="sm" onClick={handleAddContact} data-testid="button-add-first-contact">
                      <Plus className="h-4 w-4 mr-2" />
                      Add Contact
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Main Content Area - 70% */}
          <div className="w-[70%] space-y-6">
            {/* Header with Facility Info and Metrics */}
            <Card data-testid="card-header">
              <CardContent className="p-6">
                {/* Navigation and Facility Name */}
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-4">
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={handlePrevious}
                        disabled={currentIndex <= 0}
                        data-testid="button-previous-source"
                      >
                        <ChevronLeft className="h-4 w-4" />
                        Previous
                      </Button>
                      <span className="text-sm text-gray-600" data-testid="text-source-position">
                        {currentIndex + 1} of {totalSources}
                      </span>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={handleNext}
                        disabled={currentIndex >= totalSources - 1}
                        data-testid="button-next-source"
                      >
                        Next
                        <ChevronRight className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => navigate('/patient-referrals')}
                    data-testid="button-back-to-referrals"
                  >
                    Back to Referrals
                  </Button>
                </div>

                {/* Facility Name and Address */}
                <div className="mb-6">
                  <h1 className="text-3xl font-bold text-gray-900 mb-2" data-testid="text-header-facility-name">
                    {referralSource.facilityName}
                  </h1>
                  {referralSource.address && (
                    <div className="flex items-center gap-2 text-gray-600">
                      <MapPin className="h-4 w-4" />
                      <span data-testid="text-header-address">{referralSource.address}</span>
                    </div>
                  )}
                </div>

                {/* Summary Metrics */}
                <div className="grid grid-cols-3 gap-4">
                  <div className="bg-blue-50 rounded-lg p-4" data-testid="metric-total-referrals">
                    <div className="flex items-center gap-2 mb-2">
                      <Star className="h-5 w-5 text-blue-600" />
                      <span className="text-sm font-medium text-blue-900">Total Referrals</span>
                    </div>
                    <p className="text-3xl font-bold text-blue-600">{metrics.total}</p>
                  </div>
                  
                  <div className="bg-green-50 rounded-lg p-4" data-testid="metric-medicare">
                    <div className="flex items-center gap-2 mb-2">
                      <Star className="h-5 w-5 text-green-600" />
                      <span className="text-sm font-medium text-green-900">Medicare</span>
                    </div>
                    <p className="text-3xl font-bold text-green-600">{metrics.medicare}</p>
                  </div>
                  
                  <div className="bg-purple-50 rounded-lg p-4" data-testid="metric-advantage-plan">
                    <div className="flex items-center gap-2 mb-2">
                      <Star className="h-5 w-5 text-purple-600" />
                      <span className="text-sm font-medium text-purple-900">Advantage Plan</span>
                    </div>
                    <p className="text-3xl font-bold text-purple-600">{metrics.advantagePlan}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Tabbed Content */}
            <Tabs defaultValue="notes" className="space-y-4" data-testid="tabs-main-content">
              <TabsList>
                <TabsTrigger value="notes" data-testid="tab-notes">
                  <MessageSquare className="h-4 w-4 mr-2" />
                  Notes
                </TabsTrigger>
                <TabsTrigger value="inbound-referrals" data-testid="tab-inbound-referrals">
                  <FileText className="h-4 w-4 mr-2" />
                  Inbound Referrals ({kanbanReferrals.length})
                </TabsTrigger>
                <TabsTrigger value="active-patients" data-testid="tab-active-patients">
                  <Users className="h-4 w-4 mr-2" />
                  Active Patients ({patients.length})
                </TabsTrigger>
                {(user as any)?.role === 'admin' && (
                  <TabsTrigger value="treatments" data-testid="tab-treatments">
                    <Activity className="h-4 w-4 mr-2" />
                    Treatments ({treatments.length})
                  </TabsTrigger>
                )}
                <TabsTrigger value="tasks" data-testid="tab-tasks">
                  <ClipboardList className="h-4 w-4 mr-2" />
                  Tasks
                </TabsTrigger>
              </TabsList>

              {/* Notes Tab */}
              <TabsContent value="notes">
                <div className="space-y-6">
                  {/* Add Note Form */}
                  <Card data-testid="card-add-note-form">
                    <CardHeader>
                      <CardTitle className="text-lg">Add New Note</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <form onSubmit={handleSubmitNote} className="space-y-4">
                        <div>
                          <Textarea
                            placeholder="Enter your note here..."
                            value={noteContent}
                            onChange={(e) => setNoteContent(e.target.value)}
                            rows={4}
                            className="w-full"
                            data-testid="textarea-note-content"
                          />
                        </div>

                        {/* File Upload Section */}
                        <div className="flex items-center gap-4">
                          <label className="flex items-center gap-2 cursor-pointer px-4 py-2 border border-gray-300 rounded-md hover:bg-gray-50">
                            <Upload className="h-4 w-4" />
                            <span className="text-sm">Attach Files</span>
                            <input
                              type="file"
                              multiple
                              onChange={handleFileSelect}
                              className="hidden"
                              data-testid="input-file-upload"
                            />
                          </label>
                          {selectedFiles.length > 0 && (
                            <span className="text-sm text-gray-600" data-testid="text-files-selected">
                              {selectedFiles.length} file{selectedFiles.length > 1 ? 's' : ''} selected
                            </span>
                          )}
                        </div>

                        {/* Selected Files Preview */}
                        {selectedFiles.length > 0 && (
                          <div className="space-y-2">
                            {selectedFiles.map((file, index) => (
                              <div
                                key={index}
                                className="flex items-center justify-between bg-gray-50 p-2 rounded-md"
                                data-testid={`selected-file-${index}`}
                              >
                                <div className="flex items-center gap-2">
                                  <File className="h-4 w-4 text-gray-500" />
                                  <span className="text-sm text-gray-700">{file.name}</span>
                                  <span className="text-xs text-gray-500">
                                    ({formatFileSize(file.size)})
                                  </span>
                                </div>
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => removeSelectedFile(index)}
                                  data-testid={`button-remove-file-${index}`}
                                >
                                  <X className="h-4 w-4" />
                                </Button>
                              </div>
                            ))}
                          </div>
                        )}

                        {/* Action Buttons */}
                        <div className="flex justify-end gap-2">
                          <Button
                            type="button"
                            variant="outline"
                            onClick={handleClearNote}
                            disabled={createNoteMutation.isPending}
                            data-testid="button-clear-note"
                          >
                            Clear
                          </Button>
                          <Button
                            type="submit"
                            disabled={createNoteMutation.isPending || !noteContent.trim()}
                            data-testid="button-submit-note"
                          >
                            {createNoteMutation.isPending ? 'Creating...' : 'Create Note'}
                          </Button>
                        </div>
                      </form>
                    </CardContent>
                  </Card>

                  {/* Notes Feed */}
                  <Card data-testid="card-notes-feed">
                    <CardHeader>
                      <CardTitle>Notes & Activity</CardTitle>
                    </CardHeader>
                    <CardContent>
                      {notesLoading ? (
                        <div className="text-center py-8">
                          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
                          <p className="text-gray-600">Loading notes...</p>
                        </div>
                      ) : notes.length > 0 ? (
                        <div className="space-y-6">
                          {[...notes].reverse().map((note) => (
                            <div
                              key={note.id}
                              className="border-b border-gray-200 last:border-0 pb-6 last:pb-0"
                              data-testid={`note-${note.id}`}
                            >
                              {/* Note Header */}
                              <div className="flex items-start gap-3 mb-3">
                                {/* User Avatar */}
                                <div
                                  className={`flex-shrink-0 w-10 h-10 ${getAvatarColor(note.user.firstName)} rounded-full flex items-center justify-center text-white font-semibold text-sm`}
                                  data-testid={`avatar-${note.id}`}
                                >
                                  {getUserInitials(note.user.firstName, note.user.lastName)}
                                </div>

                                {/* Note Content */}
                                <div className="flex-1">
                                  <div className="flex items-center justify-between mb-1">
                                    <div>
                                      <span className="font-semibold text-gray-900" data-testid={`note-user-${note.id}`}>
                                        {note.user.firstName} {note.user.lastName}
                                      </span>
                                      <span className="text-sm text-gray-500 ml-2" data-testid={`note-timestamp-${note.id}`}>
                                        {formatNoteTimestamp(note.createdAt!)}
                                      </span>
                                    </div>
                                    {(user?.id === note.userId || user?.role === 'admin') && (
                                      <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => {
                                          if (window.confirm('Are you sure you want to delete this note?')) {
                                            deleteNoteMutation.mutate(note.id);
                                          }
                                        }}
                                        data-testid={`button-delete-note-${note.id}`}
                                      >
                                        <Trash2 className="h-4 w-4 text-red-500" />
                                      </Button>
                                    )}
                                  </div>
                                  <p className="text-gray-700 whitespace-pre-wrap" data-testid={`note-content-${note.id}`}>
                                    {note.content}
                                  </p>

                                  {/* File Attachments */}
                                  {(note as any).files && (note as any).files.length > 0 && (
                                    <div className="mt-3 space-y-2" data-testid={`note-files-${note.id}`}>
                                      <div className="text-sm font-medium text-gray-700">Attachments:</div>
                                      {(note as any).files.map((file: ReferralSourceNoteFile) => (
                                        <div
                                          key={file.id}
                                          className="flex items-center justify-between bg-gray-50 p-3 rounded-md hover:bg-gray-100"
                                          data-testid={`file-${file.id}`}
                                        >
                                          <div className="flex items-center gap-2 flex-1">
                                            <File className="h-4 w-4 text-gray-500" />
                                            <span className="text-sm text-gray-700">{file.fileName}</span>
                                            <span className="text-xs text-gray-500">
                                              ({formatFileSize(file.fileSize || 0)})
                                            </span>
                                          </div>
                                          <div className="flex items-center gap-2">
                                            <a
                                              href={`/api/referral-sources/notes/files/${file.id}/download`}
                                              download
                                              className="text-blue-600 hover:text-blue-800"
                                              data-testid={`button-download-file-${file.id}`}
                                            >
                                              <Download className="h-4 w-4" />
                                            </a>
                                            {(user?.id === note.userId || user?.role === 'admin') && (
                                              <Button
                                                variant="ghost"
                                                size="sm"
                                                onClick={() => {
                                                  if (window.confirm('Delete this file?')) {
                                                    deleteNoteFileMutation.mutate(file.id);
                                                  }
                                                }}
                                                data-testid={`button-delete-file-${file.id}`}
                                              >
                                                <Trash2 className="h-4 w-4 text-red-500" />
                                              </Button>
                                            )}
                                          </div>
                                        </div>
                                      ))}
                                    </div>
                                  )}

                                  {/* Comments Section */}
                                  <div className="mt-4" data-testid={`comments-section-${note.id}`}>
                                    {/* Existing Comments */}
                                    {(note as any).comments && (note as any).comments.length > 0 && (
                                      <div className="space-y-3 mb-3">
                                        {(note as any).comments.map((comment: ReferralSourceNoteComment & { user: { firstName: string; lastName: string } }) => (
                                          <div
                                            key={comment.id}
                                            className="flex items-start gap-2 bg-gray-50 p-3 rounded-md"
                                            data-testid={`comment-${comment.id}`}
                                          >
                                            <div
                                              className={`flex-shrink-0 w-8 h-8 ${getAvatarColor(comment.user.firstName)} rounded-full flex items-center justify-center text-white font-semibold text-xs`}
                                            >
                                              {getUserInitials(comment.user.firstName, comment.user.lastName)}
                                            </div>
                                            <div className="flex-1">
                                              <div className="flex items-center justify-between">
                                                <div>
                                                  <span className="font-medium text-sm text-gray-900">
                                                    {comment.user.firstName} {comment.user.lastName}
                                                  </span>
                                                  <span className="text-xs text-gray-500 ml-2">
                                                    {formatNoteTimestamp(comment.createdAt!)}
                                                  </span>
                                                </div>
                                                {(user?.id === comment.userId || user?.role === 'admin') && (
                                                  <Button
                                                    variant="ghost"
                                                    size="sm"
                                                    onClick={() => {
                                                      if (window.confirm('Delete this comment?')) {
                                                        deleteCommentMutation.mutate(comment.id);
                                                      }
                                                    }}
                                                    data-testid={`button-delete-comment-${comment.id}`}
                                                  >
                                                    <Trash2 className="h-3 w-3 text-red-500" />
                                                  </Button>
                                                )}
                                              </div>
                                              <p className="text-sm text-gray-700 mt-1">{comment.content}</p>
                                            </div>
                                          </div>
                                        ))}
                                      </div>
                                    )}

                                    {/* Add Comment Button/Input */}
                                    {!expandedComments.has(note.id) ? (
                                      <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => toggleComments(note.id)}
                                        className="text-blue-600"
                                        data-testid={`button-add-comment-${note.id}`}
                                      >
                                        <MessageSquare className="h-4 w-4 mr-2" />
                                        Add Comment
                                      </Button>
                                    ) : (
                                      <div className="space-y-2" data-testid={`comment-input-${note.id}`}>
                                        <Textarea
                                          placeholder="Write a comment..."
                                          value={commentInputs[note.id] || ''}
                                          onChange={(e) =>
                                            setCommentInputs((prev) => ({
                                              ...prev,
                                              [note.id]: e.target.value,
                                            }))
                                          }
                                          rows={2}
                                          className="w-full"
                                          data-testid={`textarea-comment-${note.id}`}
                                        />
                                        <div className="flex justify-end gap-2">
                                          <Button
                                            variant="outline"
                                            size="sm"
                                            onClick={() => {
                                              toggleComments(note.id);
                                              setCommentInputs((prev) => ({ ...prev, [note.id]: '' }));
                                            }}
                                            data-testid={`button-cancel-comment-${note.id}`}
                                          >
                                            Cancel
                                          </Button>
                                          <Button
                                            size="sm"
                                            onClick={() => handleSubmitComment(note.id)}
                                            disabled={createCommentMutation.isPending}
                                            data-testid={`button-submit-comment-${note.id}`}
                                          >
                                            <Send className="h-4 w-4 mr-1" />
                                            Comment
                                          </Button>
                                        </div>
                                      </div>
                                    )}
                                  </div>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="text-center py-12">
                          <MessageSquare className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                          <p className="text-gray-600 mb-4">No notes yet</p>
                          <p className="text-sm text-gray-500">
                            Create your first note using the form above
                          </p>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </div>
              </TabsContent>

              {/* Inbound Referrals Tab */}
              <TabsContent value="inbound-referrals">
                <Card data-testid="card-inbound-referrals-content">
                  <CardHeader>
                    <CardTitle>Inbound Referrals from {referralSource.facilityName}</CardTitle>
                    <p className="text-sm text-muted-foreground">
                      Kanban referrals requiring review and processing
                    </p>
                  </CardHeader>
                  <CardContent>
                    {kanbanReferralsLoading ? (
                      <div className="text-center py-8">
                        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
                        <p className="text-gray-600">Loading referrals...</p>
                      </div>
                    ) : kanbanReferrals.length > 0 ? (
                      <>
                        {/* Table */}
                        <div className="border rounded-lg overflow-x-auto">
                          <Table>
                            <TableHeader>
                              <TableRow>
                                <TableHead className="whitespace-nowrap">Received</TableHead>
                                <TableHead className="whitespace-nowrap">Patient Name</TableHead>
                                <TableHead className="whitespace-nowrap">Insurance</TableHead>
                                <TableHead className="whitespace-nowrap">Wound Size</TableHead>
                                <TableHead className="whitespace-nowrap w-32">Notes</TableHead>
                                <TableHead className="whitespace-nowrap">Files</TableHead>
                                <TableHead className="whitespace-nowrap">Status</TableHead>
                                <TableHead className="whitespace-nowrap">Assigned Rep</TableHead>
                                <TableHead className="whitespace-nowrap">Actions</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {(() => {
                                const startIdx = (currentPage - 1) * rowsPerPage;
                                const endIdx = startIdx + rowsPerPage;
                                const paginatedReferrals = kanbanReferrals.slice(startIdx, endIdx);
                                
                                return paginatedReferrals.map((referral) => {
                              const referralFiles = allReferralFiles.filter(f => f.patientReferralId === referral.id);
                              
                              return (
                                <TableRow key={referral.id} data-testid={`referral-row-${referral.id}`}>
                                  <TableCell className="text-xs">
                                    {referral.referralDate ? new Date(referral.referralDate).toLocaleDateString() : 'N/A'}
                                  </TableCell>
                                  <TableCell className="font-medium">
                                    {referral.patientName || <span className="text-gray-400 italic text-xs">N/A</span>}
                                  </TableCell>
                                  <TableCell>
                                    {editingReferralId === referral.id && editingReferralField === 'insurance' ? (
                                      <div className="flex items-center gap-1">
                                        <Input
                                          value={editReferralValue}
                                          onChange={(e) => setEditReferralValue(e.target.value)}
                                          className="text-xs h-7 w-32"
                                          data-testid={`input-insurance-${referral.id}`}
                                        />
                                        <Button
                                          size="sm"
                                          variant="ghost"
                                          className="h-6 w-6 p-0"
                                          onClick={() => saveReferralInlineEdit(referral.id, 'insurance')}
                                          data-testid={`button-save-insurance-${referral.id}`}
                                        >
                                          <Save className="h-3 w-3 text-green-600" />
                                        </Button>
                                        <Button
                                          size="sm"
                                          variant="ghost"
                                          className="h-6 w-6 p-0"
                                          onClick={cancelReferralEditing}
                                          data-testid={`button-cancel-insurance-${referral.id}`}
                                        >
                                          <X className="h-3 w-3 text-red-600" />
                                        </Button>
                                      </div>
                                    ) : (
                                      <div 
                                        onClick={() => startEditingReferralField(referral, 'insurance')}
                                        className="cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700 p-1 rounded"
                                        data-testid={`cell-insurance-${referral.id}`}
                                      >
                                        {referral.patientInsurance || <span className="text-gray-400 italic text-xs">Click to add</span>}
                                      </div>
                                    )}
                                  </TableCell>
                                  <TableCell>
                                    {referral.estimatedWoundSize || <span className="text-gray-400 italic">Not set</span>}
                                  </TableCell>
                                  <TableCell>
                                    <div 
                                      onClick={() => {
                                        setEditingNoteReferral(referral);
                                        setNoteEditValue(referral.notes || '');
                                        setNoteEditDialogOpen(true);
                                      }}
                                      className="cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700 p-2 rounded min-h-[40px] flex items-center gap-2"
                                      data-testid={`cell-notes-${referral.id}`}
                                    >
                                      {referral.notes ? (
                                        <>
                                          <span className="text-sm flex-1 truncate">{referral.notes}</span>
                                          <Pencil className="h-3 w-3 text-gray-400 flex-shrink-0" />
                                        </>
                                      ) : (
                                        <>
                                          <span className="text-gray-400 italic text-xs flex-1">Click to add</span>
                                          <Plus className="h-3 w-3 text-gray-400 flex-shrink-0" />
                                        </>
                                      )}
                                    </div>
                                  </TableCell>
                                  <TableCell>
                                    {referralFiles.length > 0 ? (
                                      <div className="flex flex-col gap-1">
                                        {referralFiles.map((file, idx) => (
                                          <div key={file.id} className="flex items-center gap-2 text-sm">
                                            <button
                                              onClick={() => {
                                                setPreviewFile({ id: file.id, fileName: file.fileName });
                                                setPdfPreviewOpen(true);
                                              }}
                                              className="flex items-center gap-1 text-blue-600 hover:text-blue-800 hover:underline"
                                              data-testid={`link-file-${referral.id}-${idx}`}
                                            >
                                              <FileText className="h-3 w-3 flex-shrink-0" />
                                              <span className="truncate max-w-[150px]">{file.fileName}</span>
                                            </button>
                                            <Button
                                              size="sm"
                                              variant="ghost"
                                              className="h-5 w-5 p-0"
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
                                        {referral.kanbanStatus !== 'patient_created' && (
                                          <Button
                                            size="sm"
                                            variant="ghost"
                                            onClick={() => {
                                              setSelectedReferralForFile(referral.id);
                                              setUploadFileDialogOpen(true);
                                            }}
                                            className="w-full text-xs h-6 mt-1"
                                            data-testid={`button-upload-file-${referral.id}`}
                                          >
                                            <Upload className="h-3 w-3 mr-1" />
                                            Add File
                                          </Button>
                                        )}
                                      </div>
                                    ) : (
                                      <div className="flex flex-col gap-1">
                                        <span className="text-gray-400 italic text-xs">No files</span>
                                        {referral.kanbanStatus !== 'patient_created' && (
                                          <Button
                                            size="sm"
                                            variant="ghost"
                                            onClick={() => {
                                              setSelectedReferralForFile(referral.id);
                                              setUploadFileDialogOpen(true);
                                            }}
                                            className="w-full text-xs h-6"
                                            data-testid={`button-upload-file-${referral.id}`}
                                          >
                                            <Upload className="h-3 w-3 mr-1" />
                                            Add File
                                          </Button>
                                        )}
                                      </div>
                                    )}
                                  </TableCell>
                                  <TableCell>
                                    {editingReferralId === referral.id && editingReferralField === 'status' ? (
                                      <div className="flex items-center gap-1">
                                        <Select
                                          value={editReferralValue}
                                          onValueChange={setEditReferralValue}
                                        >
                                          <SelectTrigger className="h-7 text-xs w-44" data-testid={`select-status-${referral.id}`}>
                                            <SelectValue />
                                          </SelectTrigger>
                                          <SelectContent>
                                            <SelectItem value="new">New / Needs Review</SelectItem>
                                            <SelectItem value="medicare">Medicare</SelectItem>
                                            <SelectItem value="advantage_plans">Advantage Plans</SelectItem>
                                            <SelectItem value="patient_created">Patient Created</SelectItem>
                                          </SelectContent>
                                        </Select>
                                        <Button
                                          size="sm"
                                          variant="ghost"
                                          className="h-6 w-6 p-0"
                                          onClick={() => saveReferralInlineEdit(referral.id, 'status')}
                                          data-testid={`button-save-status-${referral.id}`}
                                        >
                                          <Save className="h-3 w-3 text-green-600" />
                                        </Button>
                                        <Button
                                          size="sm"
                                          variant="ghost"
                                          className="h-6 w-6 p-0"
                                          onClick={cancelReferralEditing}
                                          data-testid={`button-cancel-status-${referral.id}`}
                                        >
                                          <X className="h-3 w-3 text-red-600" />
                                        </Button>
                                      </div>
                                    ) : (
                                      <div 
                                        onClick={() => startEditingReferralField(referral, 'status')}
                                        className="cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700 p-1 rounded"
                                        data-testid={`cell-status-${referral.id}`}
                                      >
                                        {getStatusBadge(referral.kanbanStatus)}
                                      </div>
                                    )}
                                  </TableCell>
                                  <TableCell>
                                    {referral.assignedSalesRepId ? (
                                      <span>{salesReps.find(rep => rep.id === referral.assignedSalesRepId)?.name || `Sales Rep ${referral.assignedSalesRepId}`}</span>
                                    ) : (
                                      <span className="text-gray-400 italic">Unassigned</span>
                                    )}
                                  </TableCell>
                                  <TableCell>
                                    {referral.kanbanStatus !== 'patient_created' && (
                                      <Button
                                        size="sm"
                                        variant="default"
                                        onClick={() => openPatientFormWithReferral(referral)}
                                        className="text-xs h-7"
                                        data-testid={`button-create-patient-${referral.id}`}
                                      >
                                        <Plus className="h-3 w-3 mr-1" />
                                        Create Patient
                                      </Button>
                                    )}
                                  </TableCell>
                                </TableRow>
                              );
                                })
                              })()}
                            </TableBody>
                          </Table>
                        </div>
                        
                        {/* Pagination Controls */}
                        {kanbanReferrals.length > rowsPerPage && (
                          <div className="flex items-center justify-between mt-4">
                            <div className="text-sm text-gray-600">
                              Showing {((currentPage - 1) * rowsPerPage) + 1} to {Math.min(currentPage * rowsPerPage, kanbanReferrals.length)} of {kanbanReferrals.length} referrals
                            </div>
                            <div className="flex items-center gap-2">
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                                disabled={currentPage === 1}
                                data-testid="button-prev-page"
                              >
                                <ChevronLeft className="h-4 w-4 mr-1" />
                                Previous
                              </Button>
                              <div className="text-sm">
                                Page {currentPage} of {Math.ceil(kanbanReferrals.length / rowsPerPage)}
                              </div>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => setCurrentPage(p => Math.min(Math.ceil(kanbanReferrals.length / rowsPerPage), p + 1))}
                                disabled={currentPage >= Math.ceil(kanbanReferrals.length / rowsPerPage)}
                                data-testid="button-next-page"
                              >
                                Next
                                <ChevronRight className="h-4 w-4 ml-1" />
                              </Button>
                            </div>
                          </div>
                        )}
                      </>
                    ) : (
                      <div className="text-center py-12">
                        <FileText className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                        <p className="text-gray-600">No inbound referrals from this source yet</p>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>

              {/* Active Patients Tab */}
              <TabsContent value="active-patients">
                <Card data-testid="card-active-patients-content">
                  <CardHeader>
                    <CardTitle>Active Patients from {referralSource.facilityName}</CardTitle>
                    <p className="text-sm text-muted-foreground">
                      All patients referred from this source
                    </p>
                  </CardHeader>
                  <CardContent>
                    {patientsLoading ? (
                      <div className="text-center py-8">
                        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
                        <p className="text-gray-600">Loading patients...</p>
                      </div>
                    ) : patients.length > 0 ? (
                      <div className="border rounded-lg overflow-hidden">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>Patient Name</TableHead>
                              <TableHead>Date Added</TableHead>
                              <TableHead>Insurance</TableHead>
                              <TableHead>Patient Status</TableHead>
                              <TableHead>Sales Rep</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {patients.map((patient) => (
                              <TableRow key={patient.id} className="hover:bg-gray-50" data-testid={`patient-row-${patient.id}`}>
                                <TableCell className="font-medium">
                                  <Link 
                                    href={`/patient-profile/${patient.id}`}
                                    className="text-blue-600 hover:text-blue-800 hover:underline cursor-pointer"
                                    data-testid={`link-patient-${patient.id}`}
                                  >
                                    {patient.firstName} {patient.lastName}
                                  </Link>
                                </TableCell>
                                <TableCell>
                                  {patient.createdAt ? new Date(patient.createdAt).toLocaleDateString() : 'N/A'}
                                </TableCell>
                                <TableCell>
                                  <Badge variant="outline">{patient.insurance}</Badge>
                                </TableCell>
                                <TableCell>
                                  <Badge className={
                                    patient.patientStatus === 'IVR Approved' ? 'bg-green-100 text-green-800' :
                                    patient.patientStatus === 'IVR Requested' ? 'bg-blue-100 text-blue-800' :
                                    patient.patientStatus === 'IVR Denied' ? 'bg-red-100 text-red-800' :
                                    'bg-yellow-100 text-yellow-800'
                                  }>
                                    {patient.patientStatus || 'Evaluation Stage'}
                                  </Badge>
                                </TableCell>
                                <TableCell>{patient.salesRep}</TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </div>
                    ) : (
                      <div className="text-center py-12">
                        <Users className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                        <p className="text-gray-600">No active patients from this source yet</p>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>

              {/* Treatments Tab - Only for admins */}
              {(user as any)?.role === 'admin' && (
                <TabsContent value="treatments">
                  <Card data-testid="card-treatments-content">
                    <CardHeader>
                      <CardTitle>Treatments from {referralSource.facilityName}</CardTitle>
                      <p className="text-sm text-muted-foreground">
                        All treatments for patients referred from this source
                      </p>
                    </CardHeader>
                    <CardContent>
                      {treatmentsLoading ? (
                        <div className="text-center py-8">
                          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
                          <p className="text-gray-600">Loading treatments...</p>
                        </div>
                      ) : treatments.length > 0 ? (
                        <div className="border rounded-lg overflow-hidden">
                          <Table>
                            <TableHeader>
                              <TableRow>
                                <TableHead>Patient Name</TableHead>
                                <TableHead>Treatment Date</TableHead>
                                <TableHead>Graft Type</TableHead>
                                <TableHead>Wound Size</TableHead>
                                <TableHead>Invoice Total</TableHead>
                                <TableHead>Status</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {treatments.map((treatment) => (
                                <TableRow key={treatment.id} data-testid={`treatment-row-${treatment.id}`}>
                                  <TableCell className="font-medium">
                                    {treatment.patientFirstName} {treatment.patientLastName}
                                  </TableCell>
                                  <TableCell>
                                    {new Date(treatment.treatmentDate).toLocaleDateString()}
                                  </TableCell>
                                  <TableCell>{treatment.skinGraftType}</TableCell>
                                  <TableCell>{treatment.woundSizeAtTreatment} cm²</TableCell>
                                  <TableCell>${parseFloat(treatment.invoiceTotal || 0).toFixed(2)}</TableCell>
                                  <TableCell>
                                    <Badge className={
                                      treatment.invoiceStatus === 'closed' ? 'bg-gray-100 text-gray-800' :
                                      treatment.invoiceStatus === 'payable' ? 'bg-green-100 text-green-800' :
                                      'bg-blue-100 text-blue-800'
                                    }>
                                      {treatment.invoiceStatus || 'open'}
                                    </Badge>
                                  </TableCell>
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                        </div>
                      ) : (
                        <div className="text-center py-12">
                          <Activity className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                          <p className="text-gray-600">No treatments from this source yet</p>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </TabsContent>
              )}

              {/* Tasks Tab - Placeholder */}
              <TabsContent value="tasks">
                <Card data-testid="card-tasks-content">
                  <CardContent className="p-12">
                    <div className="text-center">
                      <ClipboardList className="h-16 w-16 text-gray-400 mx-auto mb-4" />
                      <h3 className="text-xl font-semibold text-gray-900 mb-2">Tasks Coming Soon</h3>
                      <p className="text-gray-600">
                        Task management for referral sources will be available in a future update.
                      </p>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
          </div>
        </div>
      </div>

      {/* Dialogs */}
      {/* Add/Edit Contact Dialog */}
      <Dialog open={showContactDialog} onOpenChange={setShowContactDialog}>
        <DialogContent data-testid="dialog-contact">
          <DialogHeader>
            <DialogTitle>
              {editingContact ? 'Edit Contact' : 'Add New Contact'}
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleContactSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1">Name *</label>
              <Input
                value={contactFormData.contactName || ''}
                onChange={(e) => setContactFormData({ ...contactFormData, contactName: e.target.value })}
                required
                data-testid="input-contact-form-name"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Title/Position</label>
              <Input
                value={contactFormData.titlePosition || ''}
                onChange={(e) => setContactFormData({ ...contactFormData, titlePosition: e.target.value })}
                data-testid="input-contact-form-title"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Phone Number</label>
              <Input
                value={contactFormData.phoneNumber || ''}
                onChange={(e) => setContactFormData({ ...contactFormData, phoneNumber: e.target.value })}
                data-testid="input-contact-form-phone"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Email</label>
              <Input
                type="email"
                value={contactFormData.email || ''}
                onChange={(e) => setContactFormData({ ...contactFormData, email: e.target.value })}
                data-testid="input-contact-form-email"
              />
            </div>
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="isPrimary"
                checked={contactFormData.isPrimary || false}
                onChange={(e) => setContactFormData({ ...contactFormData, isPrimary: e.target.checked })}
                className="rounded border-gray-300"
                data-testid="checkbox-contact-form-primary"
              />
              <label htmlFor="isPrimary" className="text-sm font-medium">
                Set as primary contact
              </label>
            </div>
            <div className="flex justify-end gap-2 pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => setShowContactDialog(false)}
                data-testid="button-cancel-contact-form"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={addContactMutation.isPending || updateContactMutation.isPending}
                data-testid="button-submit-contact-form"
              >
                {editingContact ? 'Update Contact' : 'Add Contact'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Add Timeline Event Dialog */}
      <Dialog open={showTimelineDialog} onOpenChange={setShowTimelineDialog}>
        <DialogContent data-testid="dialog-timeline-event">
          <DialogHeader>
            <DialogTitle>Add Timeline Event</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleAddTimelineEvent} className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1">Event Type *</label>
              <Select
                value={timelineEventData.eventType}
                onValueChange={(value) => setTimelineEventData({ ...timelineEventData, eventType: value as any })}
              >
                <SelectTrigger data-testid="select-event-type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="note">Note</SelectItem>
                  <SelectItem value="call">Phone Call</SelectItem>
                  <SelectItem value="meeting">Meeting</SelectItem>
                  <SelectItem value="visit">Site Visit</SelectItem>
                  <SelectItem value="contract_update">Contract Update</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Description *</label>
              <Textarea
                value={timelineEventData.description || ''}
                onChange={(e) => setTimelineEventData({ ...timelineEventData, description: e.target.value })}
                rows={4}
                required
                data-testid="textarea-event-description"
              />
            </div>
            <div className="flex justify-end gap-2 pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => setShowTimelineDialog(false)}
                data-testid="button-cancel-timeline-event"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={addTimelineEventMutation.isPending}
                data-testid="button-submit-timeline-event"
              >
                Add Event
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* File Upload Dialog */}
      <Dialog open={uploadFileDialogOpen} onOpenChange={setUploadFileDialogOpen}>
        <DialogContent data-testid="dialog-file-upload">
          <DialogHeader>
            <DialogTitle>Upload File</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <Input
              type="file"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file && selectedReferralForFile) {
                  uploadFileMutation.mutate({ referralId: selectedReferralForFile, file });
                }
              }}
              data-testid="input-file-upload"
            />
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete File Confirmation Dialog */}
      <Dialog open={deleteFileConfirmOpen} onOpenChange={setDeleteFileConfirmOpen}>
        <DialogContent data-testid="dialog-delete-file">
          <DialogHeader>
            <DialogTitle>Delete File</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-gray-600">
            Are you sure you want to delete "{fileToDelete?.fileName}"? This action cannot be undone.
          </p>
          <div className="flex justify-end gap-2 pt-4">
            <Button
              variant="outline"
              onClick={() => setDeleteFileConfirmOpen(false)}
              data-testid="button-cancel-delete-file"
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => fileToDelete && deleteFileMutation.mutate(fileToDelete.id)}
              disabled={deleteFileMutation.isPending}
              data-testid="button-confirm-delete-file"
            >
              Delete
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* PDF Preview Modal */}
      {pdfPreviewOpen && previewFile && (
        <PDFPreviewModal
          fileId={previewFile.id}
          fileName={previewFile.fileName}
          open={pdfPreviewOpen}
          onClose={() => {
            setPdfPreviewOpen(false);
            setPreviewFile(null);
          }}
        />
      )}

      {/* Note Editing Dialog */}
      <Dialog open={noteEditDialogOpen} onOpenChange={setNoteEditDialogOpen}>
        <DialogContent className="max-w-2xl" data-testid="dialog-edit-note">
          <DialogHeader>
            <DialogTitle>
              Edit Note for {editingNoteReferral?.patientName || 'Referral'}
            </DialogTitle>
            <p className="text-sm text-muted-foreground mt-2">
              {editingNoteReferral?.referralDate && `Received: ${new Date(editingNoteReferral.referralDate).toLocaleDateString()}`}
              {editingNoteReferral?.patientInsurance && ` • ${editingNoteReferral.patientInsurance}`}
            </p>
          </DialogHeader>
          <div className="space-y-4 pt-4">
            <Textarea
              value={noteEditValue}
              onChange={(e) => setNoteEditValue(e.target.value)}
              placeholder="Add notes about this referral..."
              className="min-h-[200px] text-base"
              data-testid="textarea-edit-note"
            />
            <div className="flex justify-end gap-2">
              <Button
                variant="outline"
                onClick={() => {
                  setNoteEditDialogOpen(false);
                  setEditingNoteReferral(null);
                  setNoteEditValue('');
                }}
                data-testid="button-cancel-edit-note"
              >
                Cancel
              </Button>
              <Button
                onClick={() => {
                  if (editingNoteReferral) {
                    updateReferralMutation.mutate({
                      id: editingNoteReferral.id,
                      updates: { notes: noteEditValue }
                    });
                    setNoteEditDialogOpen(false);
                    setEditingNoteReferral(null);
                    setNoteEditValue('');
                  }
                }}
                disabled={updateReferralMutation.isPending}
                data-testid="button-save-edit-note"
              >
                <Save className="h-4 w-4 mr-2" />
                Save Note
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Patient Form Dialog */}
      <Dialog open={showPatientForm} onOpenChange={setShowPatientForm}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto" data-testid="dialog-patient-form">
          <DialogHeader>
            <DialogTitle>Create Patient from Referral</DialogTitle>
          </DialogHeader>
          <PatientForm
            mode="dialog"
            initialValues={selectedReferralForPatient ? (() => {
              // Parse patientName into firstName and lastName
              const nameParts = (selectedReferralForPatient.patientName || '').trim().split(/\s+/);
              const firstName = nameParts[0] || '';
              const lastName = nameParts.slice(1).join(' ') || '';
              
              return {
                firstName,
                lastName,
                dateOfBirth: '', // Not available in referrals
                phoneNumber: '', // Not available in referrals
                insurance: selectedReferralForPatient.patientInsurance || '',
                referralSource: referralSource.facilityName || '',
                referralSourceId: referralSourceId,
                salesRep: user?.salesRepName || '',
              };
            })() : undefined}
            onSubmit={(data) => {
              // Handle patient creation
              setShowPatientForm(false);
              setSelectedReferralForPatient(null);
              if (selectedReferralForPatient) {
                updateReferralMutation.mutate({
                  id: selectedReferralForPatient.id,
                  updates: { kanbanStatus: 'patient_created' as any }
                });
              }
            }}
            onCancel={() => {
              setShowPatientForm(false);
              setSelectedReferralForPatient(null);
            }}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}
