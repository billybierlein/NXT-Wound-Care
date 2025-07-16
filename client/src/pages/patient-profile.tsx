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
  Activity
} from 'lucide-react';
import type { 
  Patient, 
  InsertPatient, 
  SalesRep, 
  PatientTimelineEvent, 
  InsertPatientTimelineEvent,
  PatientTreatment,
  InsertPatientTreatment 
} from '@shared/schema';

// Graft options with ASP pricing and Q codes
const GRAFT_OPTIONS = [
  { name: "Membrane Wrap", asp: 1190.44, qCode: "Q4205-Q3" },
  { name: "Membrane Hydro", asp: 1864.71, qCode: "Q4290-Q3" },
  { name: "Membrane Tri Layer", asp: 2689.48, qCode: "Q4344-Q3" },
  { name: "Dermabind (Q2)", asp: 3337.23, qCode: "Q4313-Q2" },
  { name: "Dermabind (Q3)", asp: 3520.69, qCode: "Q4313-Q3" },
  { name: "Revoshield", asp: 1468.11, qCode: "Q4289-Q3" },
  { name: "Esano", asp: 2675.48, qCode: "Q4275-Q3" },
  { name: "Simplimax", asp: 3071.28, qCode: "Q4341-Q3" },
  { name: "AmchoPlast", asp: 4415.97, qCode: "Q4316-Q3" },
  { name: "Helicoll", asp: 1640.93, qCode: "Q4164-Q3" },
];

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
  const [treatmentFormData, setTreatmentFormData] = useState<Partial<InsertPatientTreatment>>({
    treatmentNumber: 1,
    skinGraftType: 'Dermabind (Q3)',
    qCode: 'Q4313-Q3',
    woundSizeAtTreatment: '',
    pricePerSqCm: '3520.69',
    treatmentDate: new Date().toISOString().split('T')[0],
    status: 'active',
    notes: '',
  });

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

  // Update patient mutation
  const updatePatientMutation = useMutation({
    mutationFn: async (updatedPatient: Partial<InsertPatient>) => {
      await apiRequest("PUT", `/api/patients/${patientId}`, updatedPatient);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/patients", patientId] });
      queryClient.invalidateQueries({ queryKey: ["/api/patients"] });
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
      queryClient.refetchQueries({ queryKey: ["/api/treatments/all"] });
      setIsAddTreatmentDialogOpen(false);
      setTreatmentFormData({
        treatmentNumber: 1,
        skinGraftType: 'Dermabind (Q3)',
        qCode: 'Q4313-Q3',
        woundSizeAtTreatment: '',
        pricePerSqCm: '3520.69',
        treatmentDate: new Date().toISOString().split('T')[0],
        status: 'active',
        notes: '',
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
      queryClient.refetchQueries({ queryKey: ["/api/treatments/all"] });
      setIsAddTreatmentDialogOpen(false);
      setEditingTreatment(null);
      setTreatmentFormData({
        treatmentNumber: 1,
        skinGraftType: 'Dermabind (Q3)',
        qCode: 'Q4313-Q3',
        woundSizeAtTreatment: '',
        pricePerSqCm: '3520.69',
        treatmentDate: new Date().toISOString().split('T')[0],
        status: 'active',
        notes: '',
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

  const handleEditSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    // editFormData.dateOfBirth is already in YYYY-MM-DD format from the date input
    updatePatientMutation.mutate(editFormData);
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
      setTreatmentFormData(prev => ({
        ...prev,
        skinGraftType: graftName,
        qCode: selectedGraft.qCode,
        pricePerSqCm: selectedGraft.asp.toFixed(2),
      }));
    }
  };

  const handleTreatmentSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    const woundSize = parseFloat(treatmentFormData.woundSizeAtTreatment || '0');
    const pricePerSqCm = parseFloat(treatmentFormData.pricePerSqCm || '0');
    
    // Calculate revenue fields
    const totalRevenue = woundSize * pricePerSqCm;
    const invoiceTotal = totalRevenue * 0.6; // 60% of total revenue
    const nxtCommission = invoiceTotal * 0.3; // 30% of invoice
    
    // Get sales rep commission rate (default to 10% if not found)
    const salesRepName = patient?.salesRep || '';
    const salesRep = salesReps?.find(rep => rep.name === salesRepName);
    const salesRepCommissionRate = parseFloat(salesRep?.commissionRate || '10.00');
    const salesRepCommission = invoiceTotal * (salesRepCommissionRate / 100);
    
    const treatmentData = {
      patientId: parseInt(patientId),
      treatmentNumber: parseInt(treatmentFormData.treatmentNumber?.toString() || '1'),
      woundSizeAtTreatment: woundSize.toFixed(2),
      skinGraftType: treatmentFormData.skinGraftType,
      qCode: treatmentFormData.qCode,
      pricePerSqCm: pricePerSqCm.toFixed(2),
      totalRevenue: totalRevenue.toFixed(2),
      invoiceTotal: invoiceTotal.toFixed(2),
      nxtCommission: nxtCommission.toFixed(2),
      salesRepCommissionRate: salesRepCommissionRate.toFixed(2),
      salesRepCommission: salesRepCommission.toFixed(2),
      treatmentDate: treatmentFormData.treatmentDate,
      status: treatmentFormData.status,
      notes: treatmentFormData.notes || '',
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
    
    // Keep dateOfBirth in YYYY-MM-DD format for date input field
    let dateForInput = patient?.dateOfBirth || '';
    if (dateForInput && dateForInput.match(/^\d{2}\/\d{2}\/\d{4}$/)) {
      // If it's in MM/DD/YYYY format, convert to YYYY-MM-DD
      const [month, day, year] = dateForInput.split('/');
      dateForInput = `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
    }
    
    setEditFormData({
      firstName: patient?.firstName || '',
      lastName: patient?.lastName || '',
      dateOfBirth: dateForInput,
      phoneNumber: patient?.phoneNumber || '',
      insurance: patient?.insurance || '',
      customInsurance: patient?.customInsurance || '',
      woundType: patient?.woundType || '',
      woundSize: patient?.woundSize || '',
      referralSource: patient?.referralSource || '',
      salesRep: patient?.salesRep || '',
      patientStatus: patient?.patientStatus || 'Evaluation Stage',
      notes: patient?.notes || '',
    });
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
                        <Label className="text-sm font-medium text-gray-500">Wound Size</Label>
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
                        <Label className="text-sm font-medium text-gray-500">Patient Status</Label>
                        <div className="mt-1">
                          <Badge className={getPatientStatusBadgeColor(patient.patientStatus)}>
                            {patient.patientStatus || 'Evaluation Stage'}
                          </Badge>
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
                        <Label htmlFor="woundSize">Wound Size (sq cm)</Label>
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
                        <Select
                          value={editFormData.salesRep || ''}
                          onValueChange={(value) => setEditFormData(prev => ({ ...prev, salesRep: value }))}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Select sales rep" />
                          </SelectTrigger>
                          <SelectContent>
                            {salesReps.map((salesRep: SalesRep) => (
                              <SelectItem key={salesRep.id} value={salesRep.name}>
                                {salesRep.name}
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
                        <Button size="sm">
                          <Plus className="h-4 w-4 mr-1" />
                          Add Treatment
                        </Button>
                      </DialogTrigger>
                      <DialogContent className="max-w-2xl">
                        <DialogHeader>
                          <DialogTitle>{editingTreatment ? 'Edit Treatment' : 'Add New Treatment'}</DialogTitle>
                        </DialogHeader>
                        <form onSubmit={handleTreatmentSubmit} className="space-y-4">
                          <div className="grid grid-cols-2 gap-4">
                            <div>
                              <Label htmlFor="treatmentNumber">Treatment #</Label>
                              <Input
                                id="treatmentNumber"
                                type="number"
                                min="1"
                                max="8"
                                value={treatmentFormData.treatmentNumber || 1}
                                onChange={(e) => setTreatmentFormData(prev => ({ ...prev, treatmentNumber: parseInt(e.target.value) }))}
                                required
                              />
                            </div>
                            <div>
                              <Label htmlFor="treatmentDate">Treatment Date</Label>
                              <Input
                                id="treatmentDate"
                                type="date"
                                value={treatmentFormData.treatmentDate}
                                onChange={(e) => setTreatmentFormData(prev => ({ ...prev, treatmentDate: e.target.value }))}
                                required
                              />
                            </div>
                            <div>
                              <Label htmlFor="skinGraftType">Skin Graft Type</Label>
                              <Select
                                value={treatmentFormData.skinGraftType}
                                onValueChange={handleGraftSelection}
                              >
                                <SelectTrigger>
                                  <SelectValue placeholder="Select skin graft type" />
                                </SelectTrigger>
                                <SelectContent>
                                  {GRAFT_OPTIONS.map((graft) => (
                                    <SelectItem key={graft.name} value={graft.name}>
                                      {graft.name} - ${graft.asp.toLocaleString()}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>
                            <div>
                              <Label htmlFor="qCode">Q Code</Label>
                              <Input
                                id="qCode"
                                value={treatmentFormData.qCode || ''}
                                onChange={(e) => setTreatmentFormData(prev => ({ ...prev, qCode: e.target.value }))}
                                placeholder="Q code will auto-populate"
                                readOnly
                                className="bg-gray-50"
                              />
                            </div>
                            <div>
                              <Label htmlFor="woundSizeAtTreatment">Wound Size (sq cm)</Label>
                              <Input
                                id="woundSizeAtTreatment"
                                type="number"
                                step="0.1"
                                value={treatmentFormData.woundSizeAtTreatment}
                                onChange={(e) => setTreatmentFormData(prev => ({ ...prev, woundSizeAtTreatment: e.target.value }))}
                                placeholder="Enter wound size"
                                required
                              />
                            </div>
                            <div>
                              <Label htmlFor="pricePerSqCm">Price per sq cm ($)</Label>
                              <Input
                                id="pricePerSqCm"
                                type="number"
                                step="0.01"
                                value={treatmentFormData.pricePerSqCm}
                                onChange={(e) => setTreatmentFormData(prev => ({ ...prev, pricePerSqCm: e.target.value }))}
                                placeholder="Enter price per sq cm"
                                required
                              />
                            </div>
                            <div>
                              <Label htmlFor="status">Treatment Status</Label>
                              <Select
                                value={treatmentFormData.status}
                                onValueChange={(value) => setTreatmentFormData(prev => ({ ...prev, status: value }))}
                              >
                                <SelectTrigger>
                                  <SelectValue placeholder="Select status" />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="active">Active</SelectItem>
                                  <SelectItem value="completed">Completed</SelectItem>
                                  <SelectItem value="cancelled">Cancelled</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>
                          </div>
                          
                          {/* Revenue Calculation Preview */}
                          {treatmentFormData.woundSizeAtTreatment && treatmentFormData.pricePerSqCm && (
                            <div className="bg-gray-50 p-4 rounded-lg">
                              <h4 className="font-semibold mb-2 flex items-center">
                                <DollarSign className="h-4 w-4 mr-1" />
                                Revenue Calculations
                              </h4>
                              {(() => {
                                const woundSize = parseFloat(treatmentFormData.woundSizeAtTreatment);
                                const pricePerSqCm = parseFloat(treatmentFormData.pricePerSqCm);
                                const { totalRevenue, invoiceAmount, nxtCommission } = calculateTreatmentRevenue(woundSize, pricePerSqCm);
                                
                                // Get sales rep commission rate (default to 10% if not found)
                                const salesRepName = patient?.salesRep || '';
                                const salesRep = salesReps?.find(rep => rep.name === salesRepName);
                                const salesRepCommissionRate = parseFloat(salesRep?.commissionRate || '10.00');
                                const salesRepCommission = invoiceAmount * (salesRepCommissionRate / 100);
                                
                                return (
                                  <div className={`grid gap-4 text-sm ${user?.role === 'admin' ? 'grid-cols-2 lg:grid-cols-4' : 'grid-cols-1 lg:grid-cols-3'}`}>
                                    <div>
                                      <span className="text-gray-600">Total Revenue:</span>
                                      <p className="font-semibold">${totalRevenue.toLocaleString()}</p>
                                    </div>
                                    <div>
                                      <span className="text-gray-600">Invoice (60%):</span>
                                      <p className="font-semibold">${invoiceAmount.toLocaleString()}</p>
                                    </div>
                                    {user?.role === 'admin' && (
                                      <div>
                                        <span className="text-gray-600">NXT Commission (30%):</span>
                                        <p className="font-semibold">${nxtCommission.toLocaleString()}</p>
                                      </div>
                                    )}
                                    <div>
                                      <span className="text-gray-600">Sales Rep Commission ({salesRepCommissionRate}%):</span>
                                      <p className="font-semibold">${salesRepCommission.toLocaleString()}</p>
                                    </div>
                                  </div>
                                );
                              })()}
                            </div>
                          )}

                          <div>
                            <Label htmlFor="notes">Treatment Notes</Label>
                            <Textarea
                              id="notes"
                              value={treatmentFormData.notes}
                              onChange={(e) => setTreatmentFormData(prev => ({ ...prev, notes: e.target.value }))}
                              rows={3}
                              placeholder="Add treatment notes..."
                            />
                          </div>

                          <div className="flex justify-end space-x-2">
                            <Button
                              type="button"
                              variant="outline"
                              onClick={() => {
                                setIsAddTreatmentDialogOpen(false);
                                setEditingTreatment(null);
                                setTreatmentFormData({
                                  treatmentNumber: 1,
                                  skinGraftType: 'Dermabind (Q3)',
                                  qCode: 'Q4313-Q3',
                                  woundSizeAtTreatment: '',
                                  pricePerSqCm: '3520.69',
                                  treatmentDate: new Date().toISOString().split('T')[0],
                                  status: 'active',
                                  notes: '',
                                });
                              }}
                            >
                              Cancel
                            </Button>
                            <Button type="submit" disabled={addTreatmentMutation.isPending}>
                              {addTreatmentMutation.isPending ? (
                                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                              ) : (
                                <Save className="h-4 w-4 mr-2" />
                              )}
                              {editingTreatment ? 'Update Treatment' : 'Save Treatment'}
                            </Button>
                          </div>
                        </form>
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
                            const totalRevenue = treatments.reduce((sum: number, t: PatientTreatment) => 
                              sum + (t.woundSizeAtTreatment * t.pricePerSqCm), 0);
                            const totalInvoice = totalRevenue * 0.6; // Invoice is 60% of revenue
                            const totalNxtCommission = totalInvoice * 0.3; // NXT commission is 30% of invoice
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

                        {/* Individual Treatments */}
                        {treatments.map((treatment: PatientTreatment) => (
                          <div key={treatment.id} className="border rounded-lg p-6 bg-white shadow-sm">
                            <div className="flex items-start justify-between">
                              <div className="flex-1">
                                <div className="flex items-center space-x-2 mb-2">
                                  <Badge variant="outline">
                                    Treatment #{treatment.treatmentNumber}
                                  </Badge>
                                  <Badge className={
                                    treatment.status === 'completed' ? 'bg-green-100 text-green-800' :
                                    treatment.status === 'active' ? 'bg-blue-100 text-blue-800' :
                                    'bg-gray-100 text-gray-800'
                                  }>
                                    {treatment.status}
                                  </Badge>
                                  <span className="text-sm text-gray-500">
                                    {formatDate(treatment.treatmentDate)}
                                  </span>
                                </div>
                                
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6 text-base mb-4">
                                  <div>
                                    <span className="text-gray-600">Skin Graft:</span>
                                    <p className="font-medium text-gray-900">{treatment.skinGraftType}</p>
                                  </div>
                                  <div>
                                    <span className="text-gray-600">Wound Size:</span>
                                    <p className="font-medium text-gray-900">{treatment.woundSizeAtTreatment} sq cm</p>
                                  </div>
                                  <div>
                                    <span className="text-gray-600">Price/sq cm:</span>
                                    <p className="font-medium text-gray-900">${treatment.pricePerSqCm.toLocaleString()}</p>
                                  </div>
                                  <div>
                                    <span className="text-gray-600">Revenue:</span>
                                    <p className="font-medium text-green-600">
                                      ${(treatment.woundSizeAtTreatment * treatment.pricePerSqCm).toLocaleString()}
                                    </p>
                                  </div>
                                  <div>
                                    <span className="text-gray-600">Sales Rep Commission:</span>
                                    <p className="font-medium text-blue-600">
                                      ${parseFloat(treatment.salesRepCommission || '0').toLocaleString()}
                                    </p>
                                  </div>
                                </div>

                                {treatment.notes && (
                                  <p className="text-gray-900 text-sm bg-gray-50 p-2 rounded">
                                    {treatment.notes}
                                  </p>
                                )}
                              </div>
                              <div className="flex items-center space-x-2">
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => {
                                    setEditingTreatment(treatment);
                                    setTreatmentFormData({
                                      treatmentNumber: treatment.treatmentNumber,
                                      skinGraftType: treatment.skinGraftType,
                                      qCode: treatment.qCode,
                                      woundSizeAtTreatment: treatment.woundSizeAtTreatment.toString(),
                                      pricePerSqCm: treatment.pricePerSqCm.toString(),
                                      treatmentDate: treatment.treatmentDate.toString().split('T')[0],
                                      status: treatment.status,
                                      notes: treatment.notes || '',
                                    });
                                    setIsAddTreatmentDialogOpen(true);
                                  }}
                                >
                                  <Edit className="h-4 w-4" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => deleteTreatmentMutation.mutate(treatment.id)}
                                  disabled={deleteTreatmentMutation.isPending}
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </div>
                            </div>
                          </div>
                        ))}
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