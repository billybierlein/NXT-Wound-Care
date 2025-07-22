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
  ArrowLeft
} from 'lucide-react';
import type { 
  ReferralSource, 
  InsertReferralSource, 
  ReferralSourceTimelineEvent, 
  InsertReferralSourceTimelineEvent,
  SalesRep 
} from '@shared/schema';
import { useLocation } from 'wouter';

export default function ReferralSourceProfile() {
  const { toast } = useToast();
  const { user, isAuthenticated, isLoading: authLoading } = useAuth();
  const [, params] = useRoute('/referral-sources/:id');
  const [, navigate] = useLocation();
  const referralSourceId = params?.id ? parseInt(params.id) : null;
  
  const [isEditing, setIsEditing] = useState(false);
  const [editData, setEditData] = useState<Partial<InsertReferralSource>>({});
  const [showTimelineDialog, setShowTimelineDialog] = useState(false);
  const [timelineEventData, setTimelineEventData] = useState<Partial<InsertReferralSourceTimelineEvent>>({
    eventType: 'note',
    eventDate: new Date(),
    description: '',
  });

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

  // Fetch sales reps for editing
  const { data: salesReps = [] } = useQuery<SalesRep[]>({
    queryKey: ["/api/sales-reps"],
    retry: false,
    enabled: isAuthenticated && isEditing,
  });

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
    addTimelineEventMutation.mutate(timelineEventData as InsertReferralSourceTimelineEvent);
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
              onClick={() => navigate('/manage-referral-sources')}
              className="p-2"
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
            <TabsTrigger value="timeline">Timeline</TabsTrigger>
            <TabsTrigger value="treatments">Treatments</TabsTrigger>
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
                          <Star className="h-4 w-4 text-gray-500" />
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
            <div className="text-center py-8 text-gray-500">
              Treatment tracking for referral sources coming soon...
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}