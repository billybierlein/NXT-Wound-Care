import { useAuth } from "@/hooks/useAuth";
import { useEffect, useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { useParams } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { 
  Calendar, 
  Clock, 
  Plus, 
  Edit3, 
  Trash2, 
  Phone, 
  Users, 
  FileText, 
  TrendingUp,
  MapPin,
  Activity,
  Heart
} from "lucide-react";
import Navigation from "@/components/ui/navigation";
import { isUnauthorizedError } from "@/lib/authUtils";
import type { Patient, PatientTimelineEvent, InsertPatientTimelineEvent } from "@shared/schema";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";

export default function PatientTimeline() {
  const { isAuthenticated, isLoading } = useAuth();
  const { toast } = useToast();
  const { patientId } = useParams<{ patientId: string }>();
  const [isAddEventDialogOpen, setIsAddEventDialogOpen] = useState(false);
  const [editingEvent, setEditingEvent] = useState<PatientTimelineEvent | null>(null);
  const [formData, setFormData] = useState<Partial<InsertPatientTimelineEvent>>({
    eventType: 'note',
    description: '',
    eventDate: new Date().toISOString().split('T')[0],
    woundSize: undefined,
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

  // Fetch patient data
  const { data: patient } = useQuery({
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

  // Fetch timeline events
  const { data: timelineEvents = [], isLoading: eventsLoading } = useQuery({
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

  // Add event mutation
  const addEventMutation = useMutation({
    mutationFn: async (event: Partial<InsertPatientTimelineEvent>) => {
      await apiRequest("POST", `/api/patients/${patientId}/timeline`, event);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/patients", patientId, "timeline"] });
      setIsAddEventDialogOpen(false);
      setFormData({
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

  // Update event mutation
  const updateEventMutation = useMutation({
    mutationFn: async ({ eventId, event }: { eventId: number; event: Partial<InsertPatientTimelineEvent> }) => {
      await apiRequest("PUT", `/api/patients/${patientId}/timeline/${eventId}`, event);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/patients", patientId, "timeline"] });
      setEditingEvent(null);
      setFormData({
        eventType: 'note',
        description: '',
        eventDate: new Date().toISOString().split('T')[0],
        woundSize: undefined,
      });
      toast({
        title: "Success",
        description: "Timeline event updated successfully!",
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
        description: error.message || "Failed to update timeline event",
        variant: "destructive",
      });
    },
  });

  // Delete event mutation
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

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    // Convert eventDate string to Date object, set title based on event type, and woundSize to string if present
    const getEventTitle = (eventType: string) => {
      switch (eventType) {
        case 'visit': return 'Patient Visit';
        case 'measurement': return 'Wound Measurement';
        case 'treatment_change': return 'Treatment Change';
        case 'note': return 'Note';
        case 'milestone': return 'Milestone';
        case 'created': return 'Patient Created';
        default: return 'Timeline Event';
      }
    };

    const eventData = {
      ...formData,
      title: getEventTitle(formData.eventType || 'note'),
      eventDate: new Date(formData.eventDate + 'T00:00:00'),
      woundSize: formData.woundSize ? formData.woundSize.toString() : undefined
    };
    
    if (editingEvent) {
      updateEventMutation.mutate({
        eventId: editingEvent.id,
        event: eventData
      });
    } else {
      addEventMutation.mutate(eventData);
    }
  };

  const handleEdit = (event: PatientTimelineEvent) => {
    setEditingEvent(event);
    setFormData({
      eventType: event.eventType,
      description: event.description || '',
      eventDate: new Date(event.eventDate).toISOString().split('T')[0],
      woundSize: event.woundSize ? parseFloat(event.woundSize) : undefined,
    });
  };

  const handleDelete = (eventId: number) => {
    if (window.confirm("Are you sure you want to delete this timeline event?")) {
      deleteEventMutation.mutate(eventId);
    }
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

  const getEventIcon = (eventType: string) => {
    switch (eventType) {
      case 'created':
        return <Plus className="h-4 w-4" />;
      case 'note':
        return <FileText className="h-4 w-4" />;
      case 'wound_measurement':
        return <TrendingUp className="h-4 w-4" />;
      case 'appointment':
        return <Calendar className="h-4 w-4" />;
      case 'treatment':
        return <Activity className="h-4 w-4" />;
      case 'call':
        return <Phone className="h-4 w-4" />;
      case 'visit':
        return <MapPin className="h-4 w-4" />;
      default:
        return <Clock className="h-4 w-4" />;
    }
  };

  const getEventColor = (eventType: string) => {
    switch (eventType) {
      case 'created':
        return 'bg-green-100 text-green-800 border-green-200';
      case 'note':
        return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'wound_measurement':
        return 'bg-orange-100 text-orange-800 border-orange-200';
      case 'appointment':
        return 'bg-purple-100 text-purple-800 border-purple-200';
      case 'treatment':
        return 'bg-red-100 text-red-800 border-red-200';
      case 'call':
        return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'visit':
        return 'bg-indigo-100 text-indigo-800 border-indigo-200';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200';
    }
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
      
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Patient Header */}
        {patient && (
          <Card className="mb-6">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-2xl font-bold text-gray-900">
                    {patient.firstName} {patient.lastName}
                  </CardTitle>
                  <p className="text-gray-600 mt-1">Patient Journey Timeline</p>
                </div>
                <div className="flex items-center space-x-4 text-sm text-gray-500">
                  <div className="flex items-center">
                    <Heart className="h-4 w-4 mr-1" />
                    {patient.woundType || 'No wound type'}
                  </div>
                  <div className="flex items-center">
                    <TrendingUp className="h-4 w-4 mr-1" />
                    {patient.woundSize ? `${patient.woundSize} sq cm` : 'No size recorded'}
                  </div>
                </div>
              </div>
            </CardHeader>
          </Card>
        )}

        {/* Add Event Button */}
        <div className="mb-6 flex justify-end">
          <Dialog open={isAddEventDialogOpen} onOpenChange={setIsAddEventDialogOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                Add Timeline Event
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>
                  {editingEvent ? 'Edit Timeline Event' : 'Add Timeline Event'}
                </DialogTitle>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <Label htmlFor="eventType">Event Type</Label>
                  <Select 
                    value={formData.eventType} 
                    onValueChange={(value) => setFormData(prev => ({ ...prev, eventType: value }))}
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
                    value={formData.eventDate}
                    onChange={(e) => setFormData(prev => ({ ...prev, eventDate: e.target.value }))}
                    required
                  />
                </div>

                {formData.eventType === 'wound_measurement' && (
                  <div>
                    <Label htmlFor="woundSize">Wound Size (sq cm)</Label>
                    <Input
                      id="woundSize"
                      type="number"
                      step="0.1"
                      value={formData.woundSize || ''}
                      onChange={(e) => setFormData(prev => ({ ...prev, woundSize: e.target.value ? parseFloat(e.target.value) : undefined }))}
                      placeholder="Enter wound size"
                    />
                  </div>
                )}

                <div>
                  <Label htmlFor="description">Description</Label>
                  <Textarea
                    id="description"
                    value={formData.description}
                    onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                    placeholder="Enter event description"
                    rows={3}
                  />
                </div>

                <div className="flex justify-end space-x-2">
                  <Button 
                    type="button" 
                    variant="outline" 
                    onClick={() => {
                      setIsAddEventDialogOpen(false);
                      setEditingEvent(null);
                      setFormData({
                        eventType: 'note',
                        title: '',
                        description: '',
                        eventDate: new Date().toISOString().split('T')[0],
                        woundSize: undefined,
                      });
                    }}
                  >
                    Cancel
                  </Button>
                  <Button 
                    type="submit" 
                    disabled={addEventMutation.isPending || updateEventMutation.isPending}
                  >
                    {addEventMutation.isPending || updateEventMutation.isPending ? 'Saving...' : 'Save Event'}
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        {/* Timeline */}
        <Card>
          <CardHeader>
            <CardTitle>Timeline Events</CardTitle>
          </CardHeader>
          <CardContent>
            {eventsLoading ? (
              <div className="text-center py-8">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
                <p className="text-gray-600">Loading timeline events...</p>
              </div>
            ) : timelineEvents.length === 0 ? (
              <div className="text-center py-12">
                <Clock className="h-16 w-16 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">No timeline events yet</h3>
                <p className="text-gray-600 mb-4">Start tracking this patient's journey by adding your first event</p>
                <Button onClick={() => setIsAddEventDialogOpen(true)}>
                  <Plus className="h-4 w-4 mr-2" />
                  Add First Event
                </Button>
              </div>
            ) : (
              <div className="space-y-6">
                {timelineEvents.map((event: PatientTimelineEvent, index: number) => (
                  <div key={event.id} className="relative">
                    {/* Timeline line */}
                    {index < timelineEvents.length - 1 && (
                      <div className="absolute left-6 top-12 w-0.5 h-16 bg-gray-200"></div>
                    )}
                    
                    {/* Event */}
                    <div className="flex items-start space-x-4">
                      <div className={`flex-shrink-0 w-12 h-12 rounded-full border-2 flex items-center justify-center ${getEventColor(event.eventType)}`}>
                        {getEventIcon(event.eventType)}
                      </div>
                      
                      <div className="flex-1 min-w-0">
                        <div className="bg-white rounded-lg border border-gray-200 p-4 shadow-sm">
                          <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center space-x-2">
                              <h3 className="text-lg font-medium text-gray-900">{event.title}</h3>
                              <Badge variant="outline" className="text-xs">
                                {event.eventType.replace('_', ' ').toUpperCase()}
                              </Badge>
                            </div>
                            <div className="flex items-center space-x-2">
                              <span className="text-sm text-gray-500">
                                {new Date(event.eventDate).toLocaleDateString()}
                              </span>
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => {
                                  handleEdit(event);
                                  setIsAddEventDialogOpen(true);
                                }}
                                className="text-blue-600 hover:text-blue-700"
                              >
                                <Edit3 className="h-4 w-4" />
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => handleDelete(event.id)}
                                className="text-red-600 hover:text-red-700"
                                disabled={deleteEventMutation.isPending}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </div>
                          
                          {event.description && (
                            <p className="text-gray-700 mb-3">{event.description}</p>
                          )}
                          
                          {event.woundSize && (
                            <div className="flex items-center space-x-2 text-sm text-gray-600 mb-3">
                              <TrendingUp className="h-4 w-4" />
                              <span>Wound size: {event.woundSize} sq cm</span>
                            </div>
                          )}
                          
                          {/* Timestamp */}
                          {event.createdAt && (
                            <div className="text-xs text-gray-400 border-t pt-2 mt-3">
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
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}