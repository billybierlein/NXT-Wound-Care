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
  Activity, 
  Calendar,
  MessageSquare,
  Star,
  ArrowLeft,
  FileText,
  Trash2,
  Upload
} from 'lucide-react';
import type { 
  ReferralSource, 
  InsertReferralSource, 
  ReferralSourceTimelineEvent, 
  InsertReferralSourceTimelineEvent,
  ReferralSourceContact,
  InsertReferralSourceContact,
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
  
  const [isEditing, setIsEditing] = useState(false);
  const [editData, setEditData] = useState<Partial<InsertReferralSource>>({});
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

  // State for inline editing
  const [editingReferralId, setEditingReferralId] = useState<number | null>(null);
  const [editingField, setEditingField] = useState<'status' | 'insurance' | 'notes' | null>(null);
  const [editValue, setEditValue] = useState<string>('');

  // State for patient creation dialog
  const [showPatientForm, setShowPatientForm] = useState(false);
  const [selectedReferralForPatient, setSelectedReferralForPatient] = useState<PatientReferral | null>(null);

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

  // Fetch referral source data
  const { data: referralSource, isLoading: sourceLoading } = useQuery<ReferralSource>({
    queryKey: [`/api/referral-sources/${referralSourceId}`],
    retry: false,
    enabled: isAuthenticated && !!referralSourceId,
  });

  // Fetch timeline events
  const { data: timelineEvents = [], isLoading: timelineLoading } = useQuery<ReferralSourceTimelineEvent[]>({
    queryKey: [`/api/referral-sources/${referralSourceId}/timeline`],
    retry: false,
    enabled: isAuthenticated && !!referralSourceId,
  });

  // Fetch contacts
  const { data: contacts = [], isLoading: contactsLoading } = useQuery<ReferralSourceContact[]>({
    queryKey: [`/api/referral-sources/${referralSourceId}/contacts`],
    retry: false,
    enabled: isAuthenticated && !!referralSourceId,
  });

  // Fetch treatments
  const { data: treatments = [], isLoading: treatmentsLoading } = useQuery<any[]>({
    queryKey: [`/api/referral-sources/${referralSourceId}/treatments`],
    retry: false,
    enabled: isAuthenticated && !!referralSourceId,
    staleTime: 30000, // 30 seconds
    refetchInterval: 10000, // Auto-refresh every 10 seconds
  });

  // Fetch patients referred by this source
  const { data: patients = [], isLoading: patientsLoading } = useQuery<Patient[]>({
    queryKey: ["/api/patients"],
    retry: false,
    enabled: isAuthenticated && !!referralSourceId,
    select: (data) => {
      // Filter patients by referral source name
      return data.filter((patient: Patient) => 
        patient.referralSource === referralSource?.facilityName || 
        patient.referralSourceId === referralSourceId
      );
    }
  });

  // Fetch Kanban referrals from this source
  const { data: kanbanReferrals = [], isLoading: kanbanReferralsLoading, error: kanbanReferralsError } = useQuery<any[]>({
    queryKey: [`/api/referral-sources/${referralSourceId}/kanban-referrals`],
    retry: false,
    enabled: isAuthenticated && !!referralSourceId,
  });

  // Fetch sales reps for editing and displaying in Kanban table
  const { data: salesReps = [] } = useQuery<SalesRep[]>({
    queryKey: ["/api/sales-reps"],
    retry: false,
    enabled: isAuthenticated,
  });

  // Fetch referral files for Kanban referrals
  const { data: allReferralFiles = [] } = useQuery<ReferralFile[]>({
    queryKey: ["/api/referral-files"],
    retry: false,
    enabled: isAuthenticated,
  });

  // File management state
  const [pdfPreviewOpen, setPdfPreviewOpen] = useState(false);
  const [previewFile, setPreviewFile] = useState<{ id: number; fileName: string } | null>(null);
  const [deleteFileConfirmOpen, setDeleteFileConfirmOpen] = useState(false);
  const [fileToDelete, setFileToDelete] = useState<{ id: number; fileName: string } | null>(null);
  const [uploadFileDialogOpen, setUploadFileDialogOpen] = useState(false);
  const [selectedReferralForFile, setSelectedReferralForFile] = useState<number | null>(null);

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
      setIsEditing(false);
      queryClient.invalidateQueries({ queryKey: [`/api/referral-sources/${referralSourceId}`] });
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

  // Add timeline event mutation
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

  // File upload mutation
  const uploadFileMutation = useMutation({
    mutationFn: async ({ referralId, file }: { referralId: number; file: File }) => {
      const formData = new FormData();
      formData.append('file', file);
      const response = await fetch(`/api/referrals/${referralId}/upload-file`, {
        method: 'POST',
        body: formData,
        credentials: 'include',
      });
      if (!response.ok) throw new Error('File upload failed');
      return response.json();
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

  // Mutation for updating referral inline
  const updateReferralMutation = useMutation({
    mutationFn: async ({ id, updates }: { id: number; updates: Partial<PatientReferral> }) => {
      const response = await apiRequest("PATCH", `/api/patient-referrals/${id}`, updates);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/referral-sources/${referralSourceId}/kanban-referrals`] });
      queryClient.invalidateQueries({ queryKey: ["/api/patient-referrals"] });
      setEditingReferralId(null);
      setEditingField(null);
      setEditValue('');
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

  const handleEdit = () => {
    setEditData(referralSource || {});
    setIsEditing(true);
  };

  const handleSave = () => {
    updateMutation.mutate(editData);
  };

  const handleCancel = () => {
    setIsEditing(false);
    setEditData({});
  };

  const handleAddTimelineEvent = (e: React.FormEvent) => {
    e.preventDefault();
    
    // Auto-generate title based on event type
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

  // Inline editing handlers
  const startEditingField = (referral: PatientReferral, field: 'status' | 'insurance' | 'notes') => {
    setEditingReferralId(referral.id);
    setEditingField(field);
    if (field === 'status') {
      setEditValue(referral.kanbanStatus || '');
    } else if (field === 'insurance') {
      setEditValue(referral.patientInsurance || '');
    } else if (field === 'notes') {
      setEditValue(referral.notes || '');
    }
  };

  const cancelEditing = () => {
    setEditingReferralId(null);
    setEditingField(null);
    setEditValue('');
  };

  const saveInlineEdit = (referralId: number, field: 'status' | 'insurance' | 'notes') => {
    const updates: Partial<PatientReferral> = {};
    
    if (field === 'status') {
      updates.kanbanStatus = editValue as any;
    } else if (field === 'insurance') {
      updates.patientInsurance = editValue;
    } else if (field === 'notes') {
      updates.notes = editValue;
    }
    
    updateReferralMutation.mutate({ id: referralId, updates });
  };

  // Open patient form with prefilled data
  const openPatientFormWithReferral = (referral: PatientReferral) => {
    setSelectedReferralForPatient(referral);
    setShowPatientForm(true);
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

  const getVolumeColor = (volume: string) => {
    switch (volume) {
      case 'High':
        return 'bg-orange-100 text-orange-800';
      case 'Medium':
        return 'bg-yellow-100 text-yellow-800';
      case 'Low':
        return 'bg-blue-100 text-blue-800';
      default:
        return 'bg-gray-100 text-gray-800';
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

  if (!isAuthenticated || authLoading || sourceLoading || !referralSource) {
    return <div>Loading...</div>;
  }

  if (!referralSourceId) {
    return <div>Invalid referral source ID</div>;
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Navigation />
      <div className="container mx-auto p-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-4">
            <Button 
              variant="ghost" 
              onClick={() => navigate('/patient-referrals')}
              className="p-2"
              data-testid="button-back-to-referrals"
            >
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div>
              <h1 className="text-3xl font-bold text-gray-900">{referralSource?.facilityName || 'Loading...'}</h1>
              <p className="text-gray-600">{referralSource?.facilityType || ''} • {referralSource?.relationshipStatus || ''}</p>
            </div>
          </div>
          <div className="flex gap-2">
            {isEditing ? (
              <>
                <Button 
                  variant="outline" 
                  onClick={handleCancel}
                  disabled={updateMutation.isPending}
                >
                  <X className="h-4 w-4 mr-2" />
                  Cancel
                </Button>
                <Button 
                  onClick={handleSave}
                  disabled={updateMutation.isPending}
                >
                  <Save className="h-4 w-4 mr-2" />
                  {updateMutation.isPending ? "Saving..." : "Save Changes"}
                </Button>
              </>
            ) : (
              <Button onClick={handleEdit}>
                <Edit className="h-4 w-4 mr-2" />
                Edit
              </Button>
            )}
          </div>
        </div>

        <Tabs defaultValue="profile" className="space-y-6">
          <TabsList>
            <TabsTrigger value="profile">Profile</TabsTrigger>
            <TabsTrigger value="kanban-referrals">Inbound Referrals ({kanbanReferrals.length})</TabsTrigger>
            <TabsTrigger value="patient-referrals">Active Patients ({patients.length})</TabsTrigger>
            <TabsTrigger value="contacts">Contacts</TabsTrigger>
            <TabsTrigger value="timeline">Timeline</TabsTrigger>
            {(user as any)?.role === 'admin' && (
              <TabsTrigger value="treatments">Treatments</TabsTrigger>
            )}
          </TabsList>

          <TabsContent value="profile" className="space-y-6">
            {/* Basic Information */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Building2 className="h-5 w-5" />
                  Basic Information
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {isEditing ? (
                  <div className="grid md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium mb-1">Facility Name *</label>
                      <Input
                        value={editData.facilityName || ''}
                        onChange={(e) => setEditData({ ...editData, facilityName: e.target.value })}
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-1">Contact Person</label>
                      <Input
                        value={editData.contactPerson || ''}
                        onChange={(e) => setEditData({ ...editData, contactPerson: e.target.value })}
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-1">Email</label>
                      <Input
                        type="email"
                        value={editData.email || ''}
                        onChange={(e) => setEditData({ ...editData, email: e.target.value })}
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-1">Phone Number</label>
                      <Input
                        value={editData.phoneNumber || ''}
                        onChange={(e) => setEditData({ ...editData, phoneNumber: e.target.value })}
                      />
                    </div>
                    <div className="md:col-span-2">
                      <label className="block text-sm font-medium mb-1">Address</label>
                      <Input
                        value={editData.address || ''}
                        onChange={(e) => setEditData({ ...editData, address: e.target.value })}
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-1">Facility Type</label>
                      <Select 
                        value={editData.facilityType || ''} 
                        onValueChange={(value) => setEditData({ ...editData, facilityType: value })}
                      >
                        <SelectTrigger>
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
                        value={editData.referralVolume || ''} 
                        onValueChange={(value) => setEditData({ ...editData, referralVolume: value })}
                      >
                        <SelectTrigger>
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
                        value={editData.relationshipStatus || ''} 
                        onValueChange={(value) => setEditData({ ...editData, relationshipStatus: value })}
                      >
                        <SelectTrigger>
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
                        value={editData.salesRep || ''} 
                        onValueChange={(value) => setEditData({ ...editData, salesRep: value })}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select sales rep" />
                        </SelectTrigger>
                        <SelectContent>
                          {salesReps.map((rep) => (
                            <SelectItem key={rep.id} value={rep.name}>{rep.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="md:col-span-2">
                      <label className="block text-sm font-medium mb-1">Notes</label>
                      <Textarea
                        value={editData.notes || ''}
                        onChange={(e) => setEditData({ ...editData, notes: e.target.value })}
                        rows={3}
                      />
                    </div>
                  </div>
                ) : (
                  <div className="grid md:grid-cols-2 gap-4">
                    <div className="space-y-3">
                      <div className="flex items-center gap-2">
                        <Building2 className="h-4 w-4 text-gray-500" />
                        <span className="font-medium">Facility:</span>
                        <span>{referralSource.facilityName}</span>
                      </div>
                      {referralSource.contactPerson && (
                        <div className="flex items-center gap-2">
                          <Users className="h-4 w-4 text-gray-500" />
                          <span className="font-medium">Contact:</span>
                          <span>{referralSource.contactPerson}</span>
                        </div>
                      )}
                      {referralSource.email && (
                        <div className="flex items-center gap-2">
                          <Mail className="h-4 w-4 text-gray-500" />
                          <span className="font-medium">Email:</span>
                          <span>{referralSource.email}</span>
                        </div>
                      )}
                      {referralSource.phoneNumber && (
                        <div className="flex items-center gap-2">
                          <Phone className="h-4 w-4 text-gray-500" />
                          <span className="font-medium">Phone:</span>
                          <span>{referralSource.phoneNumber}</span>
                        </div>
                      )}
                      {referralSource.address && (
                        <div className="flex items-center gap-2">
                          <MapPin className="h-4 w-4 text-gray-500" />
                          <span className="font-medium">Address:</span>
                          <span>{referralSource.address}</span>
                        </div>
                      )}
                    </div>
                    <div className="space-y-3">
                      <div className="flex items-center gap-2">
                        <span className="font-medium">Type:</span>
                        <Badge variant="outline">{referralSource.facilityType}</Badge>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="font-medium">Volume:</span>
                        <Badge className={getVolumeColor(referralSource.referralVolume || 'Medium')}>
                          {referralSource.referralVolume}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="font-medium">Status:</span>
                        <Badge className={getBadgeColor(referralSource.relationshipStatus || 'Active')}>
                          {referralSource.relationshipStatus}
                        </Badge>
                      </div>
                      {referralSource.salesRep && (
                        <div className="flex items-center gap-2">
                          <span className="font-medium">Sales Rep:</span>
                          <span>{referralSource.salesRep}</span>
                        </div>
                      )}
                      {referralSource.notes && (
                        <div className="flex flex-col gap-1">
                          <span className="font-medium">Notes:</span>
                          <span className="text-gray-600">{referralSource.notes}</span>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="kanban-referrals" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Inbound Referrals from {referralSource?.facilityName}</CardTitle>
                <p className="text-sm text-muted-foreground">
                  All referrals in the Kanban system, including those not yet converted to patients
                </p>
              </CardHeader>
              <CardContent>
                {kanbanReferralsLoading ? (
                  <div className="text-center py-8">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
                    <p className="text-gray-600">Loading referrals...</p>
                  </div>
                ) : kanbanReferralsError ? (
                  <div className="text-center py-8">
                    <X className="h-12 w-12 text-red-400 mx-auto mb-4" />
                    <p className="text-gray-600 dark:text-gray-300 font-semibold mb-2">Error loading Kanban referrals</p>
                    <p className="text-sm text-gray-500">
                      {(kanbanReferralsError as any)?.message || "Failed to fetch referrals. Please try again."}
                    </p>
                  </div>
                ) : kanbanReferrals.length > 0 ? (
                  <>
                    {/* Summary Statistics */}
                    <div className="grid grid-cols-3 gap-4 mb-6">
                      <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg">
                        <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                          {kanbanReferrals.length}
                        </div>
                        <div className="text-sm text-gray-600 dark:text-gray-300">Total Referrals</div>
                      </div>
                      <div className="bg-green-50 dark:bg-green-900/20 p-4 rounded-lg">
                        <div className="text-2xl font-bold text-green-600 dark:text-green-400">
                          {kanbanReferrals.filter((r: any) => r.patientInsurance === 'Medicare').length}
                        </div>
                        <div className="text-sm text-gray-600 dark:text-gray-300">Medicare</div>
                      </div>
                      <div className="bg-purple-50 dark:bg-purple-900/20 p-4 rounded-lg">
                        <div className="text-2xl font-bold text-purple-600 dark:text-purple-400">
                          {kanbanReferrals.filter((r: any) => r.patientInsurance === 'Advantage Plan').length}
                        </div>
                        <div className="text-sm text-gray-600 dark:text-gray-300">Advantage Plans</div>
                      </div>
                    </div>
                    
                    {/* Referrals Table */}
                    <div className="border rounded-lg overflow-hidden">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Patient Name</TableHead>
                            <TableHead>Referral Date</TableHead>
                            <TableHead>Insurance</TableHead>
                            <TableHead>Wound Size</TableHead>
                            <TableHead>Notes</TableHead>
                            <TableHead>Files</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead>Sales Rep</TableHead>
                            <TableHead>Actions</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {(kanbanReferrals || [])
                            .filter((referral: any) => referral.kanbanStatus !== 'patient_created')
                            .map((referral: any) => {
                            const getStatusBadge = (status: string) => {
                              switch (status) {
                                case 'new':
                                  return <Badge className="bg-yellow-100 text-yellow-800">New / Needs Review</Badge>;
                                case 'medicare':
                                  return <Badge className="bg-green-100 text-green-800">Medicare</Badge>;
                                case 'advantage_plans':
                                  return <Badge className="bg-purple-100 text-purple-800">Advantage Plans</Badge>;
                                case 'patient_created':
                                  return <Badge className="bg-blue-100 text-blue-800">Patient Created</Badge>;
                                default:
                                  return <Badge variant="outline">{status}</Badge>;
                              }
                            };

                            // Get files for this referral
                            const referralFiles = allReferralFiles.filter(f => f.patientReferralId === referral.id);
                            
                            return (
                              <TableRow key={referral.id} className="hover:bg-gray-50 dark:hover:bg-gray-800">
                                <TableCell className="font-medium">
                                  {referral.patientName || <span className="text-gray-400 italic">Not set</span>}
                                </TableCell>
                                <TableCell>
                                  {referral.referralDate ? new Date(referral.referralDate).toLocaleDateString() : 'N/A'}
                                </TableCell>
                                <TableCell>
                                  {editingReferralId === referral.id && editingField === 'insurance' ? (
                                    <div className="flex items-center gap-1">
                                      <Select
                                        value={editValue}
                                        onValueChange={setEditValue}
                                      >
                                        <SelectTrigger className="h-7 text-xs w-36" data-testid={`select-insurance-${referral.id}`}>
                                          <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                          <SelectItem value="Medicare">Medicare</SelectItem>
                                          <SelectItem value="Advantage Plan">Advantage Plan</SelectItem>
                                        </SelectContent>
                                      </Select>
                                      <Button
                                        size="sm"
                                        variant="ghost"
                                        className="h-6 w-6 p-0"
                                        onClick={() => saveInlineEdit(referral.id, 'insurance')}
                                        data-testid={`button-save-insurance-${referral.id}`}
                                      >
                                        <Save className="h-3 w-3 text-green-600" />
                                      </Button>
                                      <Button
                                        size="sm"
                                        variant="ghost"
                                        className="h-6 w-6 p-0"
                                        onClick={cancelEditing}
                                        data-testid={`button-cancel-insurance-${referral.id}`}
                                      >
                                        <X className="h-3 w-3 text-red-600" />
                                      </Button>
                                    </div>
                                  ) : (
                                    <div 
                                      onClick={() => startEditingField(referral, 'insurance')}
                                      className="cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700 p-1 rounded"
                                      data-testid={`cell-insurance-${referral.id}`}
                                    >
                                      {referral.patientInsurance ? (
                                        <Badge variant="outline">{referral.patientInsurance}</Badge>
                                      ) : (
                                        <span className="text-gray-400 italic text-xs">Click to set</span>
                                      )}
                                    </div>
                                  )}
                                </TableCell>
                                <TableCell>
                                  {referral.estimatedWoundSize || <span className="text-gray-400 italic">Not set</span>}
                                </TableCell>
                                <TableCell>
                                  {editingReferralId === referral.id && editingField === 'notes' ? (
                                    <div className="flex items-center gap-1">
                                      <Textarea
                                        value={editValue}
                                        onChange={(e) => setEditValue(e.target.value)}
                                        className="text-xs min-h-[60px]"
                                        data-testid={`textarea-notes-${referral.id}`}
                                      />
                                      <div className="flex flex-col gap-1">
                                        <Button
                                          size="sm"
                                          variant="ghost"
                                          className="h-6 w-6 p-0"
                                          onClick={() => saveInlineEdit(referral.id, 'notes')}
                                          data-testid={`button-save-notes-${referral.id}`}
                                        >
                                          <Save className="h-3 w-3 text-green-600" />
                                        </Button>
                                        <Button
                                          size="sm"
                                          variant="ghost"
                                          className="h-6 w-6 p-0"
                                          onClick={cancelEditing}
                                          data-testid={`button-cancel-notes-${referral.id}`}
                                        >
                                          <X className="h-3 w-3 text-red-600" />
                                        </Button>
                                      </div>
                                    </div>
                                  ) : (
                                    <div 
                                      onClick={() => startEditingField(referral, 'notes')}
                                      className="cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700 p-1 rounded min-h-[40px]"
                                      data-testid={`cell-notes-${referral.id}`}
                                    >
                                      {referral.notes ? (
                                        <span className="text-sm">{referral.notes.length > 50 ? `${referral.notes.substring(0, 50)}...` : referral.notes}</span>
                                      ) : (
                                        <span className="text-gray-400 italic text-xs">Click to add</span>
                                      )}
                                    </div>
                                  )}
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
                                  {editingReferralId === referral.id && editingField === 'status' ? (
                                    <div className="flex items-center gap-1">
                                      <Select
                                        value={editValue}
                                        onValueChange={setEditValue}
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
                                        onClick={() => saveInlineEdit(referral.id, 'status')}
                                        data-testid={`button-save-status-${referral.id}`}
                                      >
                                        <Save className="h-3 w-3 text-green-600" />
                                      </Button>
                                      <Button
                                        size="sm"
                                        variant="ghost"
                                        className="h-6 w-6 p-0"
                                        onClick={cancelEditing}
                                        data-testid={`button-cancel-status-${referral.id}`}
                                      >
                                        <X className="h-3 w-3 text-red-600" />
                                      </Button>
                                    </div>
                                  ) : (
                                    <div 
                                      onClick={() => startEditingField(referral, 'status')}
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
                          })}
                        </TableBody>
                      </Table>
                    </div>
                  </>
                ) : (
                  <div className="text-center py-8">
                    <Users className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                    <p className="text-gray-600 dark:text-gray-300">No Kanban referrals from this source yet</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="patient-referrals" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Patients Referred by {referralSource?.facilityName}</CardTitle>
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
                          <TableRow key={patient.id} className="hover:bg-gray-50">
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
                  <div className="text-center py-8">
                    <Users className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                    <p className="text-gray-600">No patients referred from this source yet</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="contacts" className="space-y-6">
            {/* Contacts Header */}
            <div className="flex justify-between items-center">
              <h2 className="text-xl font-semibold">Contact Persons</h2>
              <Button onClick={handleAddContact}>
                <Plus className="h-4 w-4 mr-2" />
                Add Contact
              </Button>
            </div>

            {/* Contacts List */}
            <Card>
              <CardContent className="pt-6">
                {contactsLoading ? (
                  <div className="text-center py-4">Loading contacts...</div>
                ) : contacts.length === 0 ? (
                  <div className="text-center py-8 text-gray-500">
                    No contacts added yet
                  </div>
                ) : (
                  <div className="space-y-4">
                    {contacts.map((contact: ReferralSourceContact) => (
                      <div key={contact.id} className="flex items-center justify-between p-4 border rounded-lg">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <h4 className="font-medium">{contact.contactName}</h4>
                            {contact.isPrimary && (
                              <Badge className="bg-blue-100 text-blue-800">Primary</Badge>
                            )}
                          </div>
                          {contact.titlePosition && (
                            <p className="text-sm text-gray-600 mb-1">{contact.titlePosition}</p>
                          )}
                          <div className="flex gap-4 text-sm text-gray-500">
                            {contact.phoneNumber && (
                              <div className="flex items-center gap-1">
                                <Phone className="h-3 w-3" />
                                <span>{contact.phoneNumber}</span>
                              </div>
                            )}
                            {contact.email && (
                              <div className="flex items-center gap-1">
                                <Mail className="h-3 w-3" />
                                <span>{contact.email}</span>
                              </div>
                            )}
                          </div>
                        </div>
                        <div className="flex gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleEditContact(contact)}
                          >
                            <Edit className="h-3 w-3" />
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleDeleteContact(contact.id)}
                            className="text-red-600 hover:text-red-700"
                          >
                            <X className="h-3 w-3" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Add/Edit Contact Dialog */}
            <Dialog open={showContactDialog} onOpenChange={setShowContactDialog}>
              <DialogContent>
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
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">Title/Position</label>
                    <Input
                      value={contactFormData.titlePosition || ''}
                      onChange={(e) => setContactFormData({ ...contactFormData, titlePosition: e.target.value })}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">Phone Number</label>
                    <Input
                      value={contactFormData.phoneNumber || ''}
                      onChange={(e) => setContactFormData({ ...contactFormData, phoneNumber: e.target.value })}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">Email</label>
                    <Input
                      type="email"
                      value={contactFormData.email || ''}
                      onChange={(e) => setContactFormData({ ...contactFormData, email: e.target.value })}
                    />
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      id="isPrimary"
                      checked={contactFormData.isPrimary || false}
                      onChange={(e) => setContactFormData({ ...contactFormData, isPrimary: e.target.checked })}
                      className="rounded border-gray-300"
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
                    >
                      Cancel
                    </Button>
                    <Button
                      type="submit"
                      disabled={addContactMutation.isPending || updateContactMutation.isPending}
                    >
                      {editingContact ? 'Update Contact' : 'Add Contact'}
                    </Button>
                  </div>
                </form>
              </DialogContent>
            </Dialog>
          </TabsContent>

          <TabsContent value="timeline" className="space-y-6">
            {/* Timeline Header */}
            <div className="flex justify-between items-center">
              <h2 className="text-xl font-semibold">Activity Timeline</h2>
              <Button onClick={() => setShowTimelineDialog(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Add Event
              </Button>
            </div>

            {/* Timeline Events */}
            <Card>
              <CardContent className="pt-6">
                {timelineLoading ? (
                  <div className="text-center py-4">Loading timeline...</div>
                ) : timelineEvents.length === 0 ? (
                  <div className="text-center py-8 text-gray-500">
                    No timeline events recorded yet
                  </div>
                ) : (
                  <div className="space-y-4">
                    {timelineEvents.map((event: ReferralSourceTimelineEvent) => (
                      <div key={event.id} className="flex gap-4 pb-4 border-b border-gray-100 last:border-0">
                        <div className="flex-shrink-0 w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                          {getEventIcon(event.eventType)}
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center justify-between mb-1">
                            <h4 className="font-medium capitalize">{event.eventType}</h4>
                            <span className="text-sm text-gray-500">
                              {formatTimestamp(event.eventDate)} • {event.createdBy}
                            </span>
                          </div>
                          <p className="text-gray-700">{event.description}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Add Timeline Event Dialog */}
            <Dialog open={showTimelineDialog} onOpenChange={setShowTimelineDialog}>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Add Timeline Event</DialogTitle>
                </DialogHeader>
                <form onSubmit={handleAddTimelineEvent} className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium mb-1">Event Type</label>
                    <Select
                      value={timelineEventData.eventType}
                      onValueChange={(value) => setTimelineEventData({ ...timelineEventData, eventType: value })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="note">Note</SelectItem>
                        <SelectItem value="call">Phone Call</SelectItem>
                        <SelectItem value="email">Email</SelectItem>
                        <SelectItem value="meeting">Meeting</SelectItem>
                        <SelectItem value="visit">Site Visit</SelectItem>
                        <SelectItem value="presentation">Presentation</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">Event Date</label>
                    <Input
                      type="date"
                      value={timelineEventData.eventDate instanceof Date ? timelineEventData.eventDate.toISOString().split('T')[0] : timelineEventData.eventDate || ''}
                      onChange={(e) => setTimelineEventData({ ...timelineEventData, eventDate: new Date(e.target.value) })}
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">Description *</label>
                    <Textarea
                      value={timelineEventData.description || ''}
                      onChange={(e) => setTimelineEventData({ ...timelineEventData, description: e.target.value })}
                      placeholder="Enter event details..."
                      rows={4}
                      required
                    />
                  </div>
                  <div className="flex justify-end gap-2 pt-4">
                    <Button 
                      type="button" 
                      variant="outline" 
                      onClick={() => setShowTimelineDialog(false)}
                      disabled={addTimelineEventMutation.isPending}
                    >
                      Cancel
                    </Button>
                    <Button type="submit" disabled={addTimelineEventMutation.isPending}>
                      {addTimelineEventMutation.isPending ? "Adding..." : "Add Event"}
                    </Button>
                  </div>
                </form>
              </DialogContent>
            </Dialog>
          </TabsContent>

          <TabsContent value="treatments" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Associated Treatments</CardTitle>
              </CardHeader>
              <CardContent>
                {treatmentsLoading ? (
                  <div className="text-center py-4">Loading treatments...</div>
                ) : treatments.length === 0 ? (
                  <div className="text-center py-8 text-gray-500">
                    No treatments found for patients from this referral source
                  </div>
                ) : (
                  <div className="space-y-4">
                    {/* Treatments Table */}
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b">
                            <th className="text-left py-2">Patient</th>
                            <th className="text-left py-2">Treatment Date</th>
                            <th className="text-left py-2">Graft Type</th>
                            <th className="text-left py-2">Size (sq cm)</th>
                            <th className="text-left py-2">Status</th>
                            <th className="text-left py-2">Provider</th>
                            <th className="text-left py-2">Sales Rep</th>
                            <th className="text-right py-2">Revenue</th>
                          </tr>
                        </thead>
                        <tbody>
                          {treatments.map((treatment) => (
                            <tr key={treatment.id} className="border-b hover:bg-gray-50">
                              <td className="py-2">
                                <Link href={`/patient-profile/${treatment.patientId}`} className="text-blue-600 hover:underline">
                                  {treatment.patientFirstName} {treatment.patientLastName}
                                </Link>
                              </td>
                              <td className="py-2">
                                {new Date(treatment.treatmentDate).toLocaleDateString('en-US', {
                                  month: '2-digit',
                                  day: '2-digit',
                                  year: 'numeric'
                                })}
                              </td>
                              <td className="py-2">{treatment.skinGraftType}</td>
                              <td className="py-2">{treatment.woundSizeAtTreatment}</td>
                              <td className="py-2">
                                <Badge className={treatment.status === 'active' ? 'bg-blue-100 text-blue-800' : 'bg-green-100 text-green-800'}>
                                  {treatment.status}
                                </Badge>
                              </td>
                              <td className="py-2">{treatment.actingProvider || 'N/A'}</td>
                              <td className="py-2">{treatment.salesRep || 'N/A'}</td>
                              <td className="py-2 text-right font-medium">
                                ${parseFloat(treatment.totalRevenue || '0').toLocaleString('en-US', {
                                  minimumFractionDigits: 2,
                                  maximumFractionDigits: 2
                                })}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>

                    {/* Treatment Summary */}
                    <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-4">
                      <Card>
                        <CardContent className="pt-4">
                          <div className="text-center">
                            <div className="text-2xl font-bold text-blue-600">
                              {treatments.length}
                            </div>
                            <div className="text-sm text-gray-600">Total Treatments</div>
                          </div>
                        </CardContent>
                      </Card>
                      <Card>
                        <CardContent className="pt-4">
                          <div className="text-center">
                            <div className="text-2xl font-bold text-green-600">
                              {treatments.filter(t => t.status === 'active').length}
                            </div>
                            <div className="text-sm text-gray-600">Active Treatments</div>
                          </div>
                        </CardContent>
                      </Card>
                      <Card>
                        <CardContent className="pt-4">
                          <div className="text-center">
                            <div className="text-2xl font-bold text-purple-600">
                              ${treatments.reduce((sum, t) => sum + parseFloat(t.totalRevenue || '0'), 0).toLocaleString('en-US', {
                                minimumFractionDigits: 2,
                                maximumFractionDigits: 2
                              })}
                            </div>
                            <div className="text-sm text-gray-600">Total Revenue</div>
                          </div>
                        </CardContent>
                      </Card>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      {/* PDF Preview Modal */}
      <PDFPreviewModal
        open={pdfPreviewOpen}
        onClose={() => setPdfPreviewOpen(false)}
        fileId={previewFile?.id || null}
        fileName={previewFile?.fileName || ""}
      />

      {/* Upload File Dialog */}
      <Dialog open={uploadFileDialogOpen} onOpenChange={setUploadFileDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Upload Additional File</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <Input
              type="file"
              accept="application/pdf"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file && selectedReferralForFile) {
                  uploadFileMutation.mutate({ referralId: selectedReferralForFile, file });
                }
              }}
              data-testid="input-upload-file"
            />
            <p className="text-sm text-gray-500">Only PDF files are allowed</p>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete File Confirmation Dialog */}
      <Dialog open={deleteFileConfirmOpen} onOpenChange={setDeleteFileConfirmOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete File</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p>Are you sure you want to delete <span className="font-semibold">{fileToDelete?.fileName}</span>?</p>
            <p className="text-sm text-gray-500">This action cannot be undone.</p>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setDeleteFileConfirmOpen(false)}>
                Cancel
              </Button>
              <Button
                variant="destructive"
                onClick={() => {
                  if (fileToDelete) {
                    deleteFileMutation.mutate(fileToDelete.id);
                  }
                }}
                data-testid="button-confirm-delete-file"
              >
                Delete
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Patient Form Dialog */}
      {showPatientForm && selectedReferralForPatient && (
        <Dialog open={showPatientForm} onOpenChange={setShowPatientForm}>
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Create Patient from Referral</DialogTitle>
            </DialogHeader>
            <PatientForm
              mode="dialog"
              initialValues={{
                firstName: selectedReferralForPatient.patientName?.split(' ')[0] || '',
                lastName: selectedReferralForPatient.patientName?.split(' ').slice(1).join(' ') || '',
                insurance: selectedReferralForPatient.patientInsurance || 'Medicare',
                referralSource: referralSource?.facilityName || 'Unknown',
                referralSourceId: selectedReferralForPatient.referralSourceId || undefined,
                salesRep: salesReps.find(rep => rep.id === selectedReferralForPatient.assignedSalesRepId)?.name || user?.salesRepName || 'Unknown',
                woundSize: selectedReferralForPatient.estimatedWoundSize || '',
              }}
              onSubmit={async (data: InsertPatient) => {
                try {
                  const response = await apiRequest("POST", `/api/referrals/${selectedReferralForPatient.id}/create-patient`, data);
                  if (response.ok) {
                    setShowPatientForm(false);
                    setSelectedReferralForPatient(null);
                    // Invalidate all relevant queries to refresh UI
                    await Promise.all([
                      queryClient.invalidateQueries({ queryKey: [`/api/referral-sources/${referralSourceId}/kanban-referrals`] }),
                      queryClient.invalidateQueries({ queryKey: ["/api/patient-referrals"] }),
                      queryClient.invalidateQueries({ queryKey: ["/api/patients"] }),
                      queryClient.invalidateQueries({ queryKey: ["/api/referral-files"] }),
                    ]);
                    toast({
                      title: "Success",
                      description: "Patient created successfully! PDF file has been attached to the patient profile.",
                    });
                  }
                } catch (error: any) {
                  toast({
                    title: "Error",
                    description: error.message || "Failed to create patient",
                    variant: "destructive",
                  });
                }
              }}
              onCancel={() => {
                setShowPatientForm(false);
                setSelectedReferralForPatient(null);
              }}
              userRole={user?.role === 'admin' ? 'admin' : 'salesRep'}
              userSalesRepName={user?.salesRepName || ''}
            />
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}