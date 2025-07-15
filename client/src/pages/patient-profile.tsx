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
  Trash2
} from 'lucide-react';
import type { Patient, InsertPatient, SalesRep, PatientTimelineEvent, InsertPatientTimelineEvent } from '@shared/schema';

export default function PatientProfile() {
  const { toast } = useToast();
  const { isAuthenticated, isLoading } = useAuth();
  const { patientId } = useParams<{ patientId: string }>();
  const [, navigate] = useLocation();
  
  const [isEditing, setIsEditing] = useState(false);
  const [isAddEventDialogOpen, setIsAddEventDialogOpen] = useState(false);
  const [editingEvent, setEditingEvent] = useState<PatientTimelineEvent | null>(null);
  const [editFormData, setEditFormData] = useState<Partial<InsertPatient>>({});
  const [timelineFormData, setTimelineFormData] = useState<Partial<InsertPatientTimelineEvent>>({
    eventType: 'note',
    description: '',
    eventDate: new Date().toISOString().split('T')[0],
    woundSize: undefined,
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

  const handleEditSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    // Convert dateOfBirth from MM/DD/YYYY back to YYYY-MM-DD for API
    const submitData = { ...editFormData };
    if (submitData.dateOfBirth && submitData.dateOfBirth.match(/^\d{2}\/\d{2}\/\d{4}$/)) {
      const [month, day, year] = submitData.dateOfBirth.split('/');
      submitData.dateOfBirth = `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
    }
    
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

  const handleEdit = () => {
    setIsEditing(true);
    
    // Convert dateOfBirth from YYYY-MM-DD to MM/DD/YYYY for form editing
    let formattedDate = patient?.dateOfBirth || '';
    if (formattedDate && formattedDate.match(/^\d{4}-\d{2}-\d{2}$/)) {
      const [year, month, day] = formattedDate.split('-');
      formattedDate = `${month}/${day}/${year}`;
    }
    
    setEditFormData({
      firstName: patient?.firstName || '',
      lastName: patient?.lastName || '',
      dateOfBirth: formattedDate,
      phoneNumber: patient?.phoneNumber || '',
      insurance: patient?.insurance || '',
      customInsurance: patient?.customInsurance || '',
      woundType: patient?.woundType || '',
      woundSize: patient?.woundSize || '',
      referralSource: patient?.referralSource || '',
      salesRep: patient?.salesRep || '',
      notes: patient?.notes || '',
    });
  };

  const handleCancel = () => {
    setIsEditing(false);
    setEditFormData({});
  };

  const formatDate = (dateString: string) => {
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
      </div>
    </div>
  );
}