import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';
import { apiRequest, queryClient } from '@/lib/queryClient';
import Navigation from '@/components/ui/navigation';
import { 
  Plus, 
  Search, 
  Edit, 
  Trash2, 
  Building2, 
  Phone, 
  Mail, 
  MapPin, 
  Users,
  Activity,
  TrendingUp,
  ArrowUpDown,
  ArrowUp,
  ArrowDown
} from 'lucide-react';
import { useLocation } from 'wouter';
import type { ReferralSource, InsertReferralSource, SalesRep } from '@shared/schema';

export default function ManageReferralSources() {
  const { toast } = useToast();
  const { user } = useAuth();
  const [, navigate] = useLocation();
  
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState('all');
  const [filterStatus, setFilterStatus] = useState('all');
  const [filterSalesRep, setFilterSalesRep] = useState('all');
  const [sortColumn, setSortColumn] = useState<'facility' | 'referralsSent' | null>(null);
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [editingSource, setEditingSource] = useState<ReferralSource | null>(null);
  const [formData, setFormData] = useState<Partial<InsertReferralSource>>({
    facilityName: '',
    facilityType: 'Hospital',
    referralVolume: 'Medium',
    relationshipStatus: 'Active',
  });

  // Fetch referral sources
  const { data: referralSources = [], isLoading, refetch } = useQuery<ReferralSource[]>({
    queryKey: ["/api/referral-sources"],
    retry: false,
  });

  // Fetch sales reps for filtering and assignment
  const { data: salesReps = [] } = useQuery<SalesRep[]>({
    queryKey: ["/api/sales-reps"],
    retry: false,
  });

  // Add referral source mutation
  const addMutation = useMutation({
    mutationFn: async (data: InsertReferralSource) => {
      return await apiRequest("POST", "/api/referral-sources", data);
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Referral source added successfully",
      });
      setShowAddDialog(false);
      resetForm();
      queryClient.invalidateQueries({ queryKey: ["/api/referral-sources"] });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to add referral source",
        variant: "destructive",
      });
    },
  });

  // Edit referral source mutation
  const editMutation = useMutation({
    mutationFn: async (data: { id: number; updates: Partial<InsertReferralSource> }) => {
      return await apiRequest("PUT", `/api/referral-sources/${data.id}`, data.updates);
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Referral source updated successfully",
      });
      setEditingSource(null);
      resetForm();
      queryClient.invalidateQueries({ queryKey: ["/api/referral-sources"] });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update referral source",
        variant: "destructive",
      });
    },
  });

  // Delete referral source mutation
  const deleteMutation = useMutation({
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
    onError: (error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to delete referral source",
        variant: "destructive",
      });
    },
  });

  const resetForm = () => {
    setFormData({
      facilityName: '',
      facilityType: 'Hospital',
      referralVolume: 'Medium',
      relationshipStatus: 'Active',
    });
  };

  const handleAdd = () => {
    setEditingSource(null);
    resetForm();
    setShowAddDialog(true);
  };

  const handleEdit = (source: ReferralSource) => {
    setEditingSource(source);
    setFormData({
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
    setShowAddDialog(true);
  };

  const handleDelete = (id: number) => {
    if (confirm('Are you sure you want to delete this referral source?')) {
      deleteMutation.mutate(id);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // Handle "unassigned" value
    const processedFormData = {
      ...formData,
      salesRep: formData.salesRep === 'unassigned' ? null : formData.salesRep
    };
    
    if (editingSource) {
      editMutation.mutate({ id: editingSource.id, updates: processedFormData });
    } else {
      addMutation.mutate(processedFormData as InsertReferralSource);
    }
  };

  const handleViewProfile = (id: number) => {
    navigate(`/referral-sources/${id}`);
  };

  const handleSort = (column: 'facility' | 'referralsSent') => {
    if (sortColumn === column) {
      // Toggle direction if same column
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      // Set new column and default to ascending
      setSortColumn(column);
      setSortDirection('asc');
    }
  };

  // Filter and sort referral sources
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
      if (!sortColumn) return 0;
      
      let aValue: string | number;
      let bValue: string | number;
      
      if (sortColumn === 'facility') {
        aValue = a.facilityName.toLowerCase();
        bValue = b.facilityName.toLowerCase();
      } else {
        // referralsSent
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

  const getStats = () => {
    const active = referralSources.filter(s => s.relationshipStatus === 'Active').length;
    const prospects = referralSources.filter(s => s.relationshipStatus === 'Prospect').length;
    const highVolume = referralSources.filter(s => s.referralVolume === 'High').length;
    const total = referralSources.length;

    return { active, prospects, highVolume, total };
  };

  const stats = getStats();

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Navigation />
        <div className="container mx-auto p-8">
          <div className="text-center">Loading referral sources...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Navigation />
      <div className="container mx-auto p-8">
        {/* Header */}
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Referral Sources</h1>
            <p className="text-gray-600">Manage your healthcare facility partnerships</p>
          </div>
          <Button onClick={handleAdd}>
            <Plus className="h-4 w-4 mr-2" />
            Add Referral Source
          </Button>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Total Sources</p>
                  <p className="text-3xl font-bold text-gray-900">{stats.total}</p>
                </div>
                <Building2 className="h-8 w-8 text-blue-600" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Active Sources</p>
                  <p className="text-3xl font-bold text-green-600">{stats.active}</p>
                </div>
                <Activity className="h-8 w-8 text-green-600" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Prospects</p>
                  <p className="text-3xl font-bold text-blue-600">{stats.prospects}</p>
                </div>
                <Users className="h-8 w-8 text-blue-600" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">High Volume</p>
                  <p className="text-3xl font-bold text-orange-600">{stats.highVolume}</p>
                </div>
                <TrendingUp className="h-8 w-8 text-orange-600" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Filters */}
        <Card className="mb-6">
          <CardContent className="p-6">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1">Search</label>
                <div className="relative">
                  <Search className="h-4 w-4 absolute left-3 top-3 text-gray-400" />
                  <Input
                    placeholder="Search facilities..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Facility Type</label>
                <Select value={filterType} onValueChange={setFilterType}>
                  <SelectTrigger>
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
                  <SelectTrigger>
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
                  <SelectTrigger>
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
          </CardContent>
        </Card>

        {/* Referral Sources List */}
        <Card>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      <button
                        onClick={() => handleSort('facility')}
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
                        onClick={() => handleSort('referralsSent')}
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
                          <button
                            onClick={() => handleViewProfile(source.id)}
                            className="text-sm font-medium text-blue-600 hover:text-blue-800 text-left"
                          >
                            {source.facilityName}
                          </button>
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
                          <Button variant="ghost" size="sm" onClick={() => handleEdit(source)}>
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="sm" onClick={() => handleDelete(source.id)}>
                            <Trash2 className="h-4 w-4 text-red-500" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>

        {filteredAndSortedSources.length === 0 && (
          <div className="text-center py-12">
            <Building2 className="h-12 w-12 mx-auto text-gray-400 mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No referral sources found</h3>
            <p className="text-gray-500 mb-4">Get started by adding your first referral source.</p>
            <Button onClick={handleAdd}>
              <Plus className="h-4 w-4 mr-2" />
              Add Referral Source
            </Button>
          </div>
        )}

        {/* Add/Edit Dialog */}
        <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>
                {editingSource ? 'Edit Referral Source' : 'Add New Referral Source'}
              </DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1">Facility Name *</label>
                  <Input
                    value={formData.facilityName || ''}
                    onChange={(e) => setFormData({ ...formData, facilityName: e.target.value })}
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Contact Person</label>
                  <Input
                    value={formData.contactPerson || ''}
                    onChange={(e) => setFormData({ ...formData, contactPerson: e.target.value })}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Email</label>
                  <Input
                    type="email"
                    value={formData.email || ''}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Phone Number</label>
                  <Input
                    value={formData.phoneNumber || ''}
                    onChange={(e) => setFormData({ ...formData, phoneNumber: e.target.value })}
                  />
                </div>
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium mb-1">Address</label>
                  <Input
                    value={formData.address || ''}
                    onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Facility Type</label>
                  <Select 
                    value={formData.facilityType || 'Hospital'} 
                    onValueChange={(value) => setFormData({ ...formData, facilityType: value })}
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
                    value={formData.referralVolume || 'Medium'} 
                    onValueChange={(value) => setFormData({ ...formData, referralVolume: value })}
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
                    value={formData.relationshipStatus || 'Active'} 
                    onValueChange={(value) => setFormData({ ...formData, relationshipStatus: value })}
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
                    value={formData.salesRep || ''} 
                    onValueChange={(value) => setFormData({ ...formData, salesRep: value })}
                  >
                    <SelectTrigger>
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
                    value={formData.notes || ''}
                    onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                    placeholder="Additional notes about this referral source..."
                    rows={3}
                  />
                </div>
              </div>
              <div className="flex justify-end gap-2 pt-4">
                <Button 
                  type="button" 
                  variant="outline" 
                  onClick={() => setShowAddDialog(false)}
                  disabled={addMutation.isPending || editMutation.isPending}
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={addMutation.isPending || editMutation.isPending}>
                  {addMutation.isPending || editMutation.isPending 
                    ? "Saving..." 
                    : (editingSource ? "Update Source" : "Add Source")
                  }
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}