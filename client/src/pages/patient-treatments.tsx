import { useAuth } from "@/hooks/useAuth";
import { useEffect, useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Link } from "wouter";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { 
  Search, 
  Download, 
  Edit, 
  Trash2, 
  Clock, 
  DollarSign,
  TrendingUp,
  Users,
  Activity,
  FolderOpen
} from "lucide-react";
import Navigation from "@/components/ui/navigation";
import { isUnauthorizedError } from "@/lib/authUtils";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { Patient, SalesRep } from "@shared/schema";

export default function PatientTreatments() {
  const { isAuthenticated, isLoading } = useAuth();
  const { toast } = useToast();
  const [searchTerm, setSearchTerm] = useState("");
  const [salesRepFilter, setSalesRepFilter] = useState("");
  const [referralSourceFilter, setReferralSourceFilter] = useState("");

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

  // Fetch sales reps for filtering
  const { data: salesReps = [] } = useQuery({
    queryKey: ["/api/sales-reps"],
    retry: false,
    enabled: isAuthenticated,
  });

  // Fetch only IVR Approved patients
  const { data: allPatients = [], isLoading: patientsLoading } = useQuery({
    queryKey: ["/api/patients", { search: searchTerm, salesRep: salesRepFilter === "all" ? "" : salesRepFilter, referralSource: referralSourceFilter }],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (searchTerm) params.append('search', searchTerm);
      if (salesRepFilter && salesRepFilter !== "all") params.append('salesRep', salesRepFilter);
      if (referralSourceFilter) params.append('referralSource', referralSourceFilter);
      
      const url = `/api/patients${params.toString() ? '?' + params.toString() : ''}`;
      const res = await fetch(url, { credentials: "include" });
      
      if (!res.ok) {
        throw new Error(`${res.status}: ${res.statusText}`);
      }
      
      return res.json();
    },
    retry: false,
    enabled: isAuthenticated,
  });

  // Filter to only show IVR Approved patients
  const patients = allPatients.filter((patient: Patient) => 
    patient.patientStatus?.toLowerCase() === 'ivr approved'
  );

  // Fetch all treatments for approved patients
  const { data: allTreatments = [] } = useQuery({
    queryKey: ["/api/treatments/all"],
    queryFn: async () => {
      const response = await fetch("/api/treatments/all", { credentials: "include" });
      if (!response.ok) {
        throw new Error(`${response.status}: ${response.statusText}`);
      }
      return response.json();
    },
    retry: false,
    enabled: isAuthenticated && patients.length > 0,
  });

  const deletePatientMutation = useMutation({
    mutationFn: async (patientId: number) => {
      await apiRequest("DELETE", `/api/patients/${patientId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/patients"] });
      toast({
        title: "Success",
        description: "Patient removed from treatments successfully!",
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
        description: error.message || "Failed to remove patient",
        variant: "destructive",
      });
    },
  });

  const handleDeletePatient = (patientId: number) => {
    if (window.confirm("Are you sure you want to remove this patient from treatments?")) {
      deletePatientMutation.mutate(patientId);
    }
  };

  const handleDownloadCSV = async () => {
    try {
      const response = await fetch("/api/patients/export/csv?status=ivr-approved", {
        credentials: "include",
      });
      
      if (!response.ok) {
        throw new Error("Failed to download CSV");
      }
      
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'approved-patients.csv';
      a.click();
      window.URL.revokeObjectURL(url);
      
      toast({
        title: "Success",
        description: "Treatment patients CSV downloaded successfully!",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to download CSV",
        variant: "destructive",
      });
    }
  };

  const getPatientStatusBadgeColor = (status: string) => {
    switch (status?.toLowerCase()) {
      case 'evaluation stage':
        return 'bg-yellow-100 text-yellow-800';
      case 'ivr requested':
        return 'bg-blue-100 text-blue-800';
      case 'ivr denied':
        return 'bg-red-100 text-red-800';
      case 'ivr approved':
        return 'bg-green-100 text-green-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getInsuranceBadgeColor = (insurance: string) => {
    const colors: Record<string, string> = {
      medicare: "bg-blue-100 text-blue-800",
      medicaid: "bg-green-100 text-green-800",
      aetna: "bg-purple-100 text-purple-800",
      "blue cross blue shield": "bg-blue-100 text-blue-800",
      bluecross: "bg-blue-100 text-blue-800",
      cigna: "bg-red-100 text-red-800",
      humana: "bg-yellow-100 text-yellow-800",
      "united healthcare": "bg-purple-100 text-purple-800",
      united: "bg-purple-100 text-purple-800",
      "unitedhealthcare-ma": "bg-indigo-100 text-indigo-800",
      "aetna-ma": "bg-purple-100 text-purple-800",
      "cigna-ma": "bg-red-100 text-red-800", 
      "humana-ma": "bg-yellow-100 text-yellow-800",
      "wellcare-ma": "bg-teal-100 text-teal-800",
    };
    return colors[insurance.toLowerCase()] || "bg-gray-100 text-gray-800";
  };

  // Calculate treatment statistics based on actual treatment data
  const activeTreatments = allTreatments.filter(treatment => treatment.status === 'active');
  const completedTreatments = allTreatments.filter(treatment => treatment.status === 'completed');
  
  // Calculate total wound sizes
  const activeWoundSize = activeTreatments.reduce((sum, treatment) => {
    const size = parseFloat(treatment.woundSizeAtTreatment || '0');
    return sum + (isNaN(size) ? 0 : size);
  }, 0);
  
  const completedWoundSize = completedTreatments.reduce((sum, treatment) => {
    const size = parseFloat(treatment.woundSizeAtTreatment || '0');
    return sum + (isNaN(size) ? 0 : size);
  }, 0);
  
  // Calculate revenues from actual treatment data
  const projectedRevenue = activeTreatments.reduce((sum, treatment) => {
    const revenue = parseFloat(treatment.totalRevenue || '0');
    return sum + (isNaN(revenue) ? 0 : revenue);
  }, 0);
  
  const totalRevenue = completedTreatments.reduce((sum, treatment) => {
    const revenue = parseFloat(treatment.totalRevenue || '0');
    return sum + (isNaN(revenue) ? 0 : revenue);
  }, 0);
  
  // Calculate invoice amounts (60% of revenue)
  const projectedInvoice = projectedRevenue * 0.6;
  const totalInvoice = totalRevenue * 0.6;
  
  // Calculate patient counts
  const totalTreatmentPatients = patients.length;

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
    return null; // Will redirect in useEffect
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Navigation />
      
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Treatment Statistics Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Active Treatments</CardTitle>
              <Activity className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{activeTreatments.length}</div>
              <p className="text-xs text-muted-foreground">
                Currently active treatments
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Completed Treatments</CardTitle>
              <Clock className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{completedTreatments.length}</div>
              <p className="text-xs text-muted-foreground">
                Completed treatments
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Patients</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{totalTreatmentPatients}</div>
              <p className="text-xs text-muted-foreground">
                IVR Approved patients
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Active Wound Size</CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{activeWoundSize.toFixed(1)} sq cm</div>
              <p className="text-xs text-muted-foreground">
                Total active treatment area
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Completed Wound Size</CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{completedWoundSize.toFixed(1)} sq cm</div>
              <p className="text-xs text-muted-foreground">
                Total completed treatment area
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Projected Revenue</CardTitle>
              <DollarSign className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">${projectedRevenue.toLocaleString()}</div>
              <p className="text-xs text-muted-foreground">
                From active treatments
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Revenue</CardTitle>
              <DollarSign className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">${totalRevenue.toLocaleString()}</div>
              <p className="text-xs text-muted-foreground">
                From completed treatments
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Projected Invoice</CardTitle>
              <DollarSign className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-purple-600">${projectedInvoice.toLocaleString()}</div>
              <p className="text-xs text-muted-foreground">
                60% of projected revenue
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Invoice</CardTitle>
              <DollarSign className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-purple-600">${totalInvoice.toLocaleString()}</div>
              <p className="text-xs text-muted-foreground">
                60% of completed revenue
              </p>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between">
              <CardTitle className="text-xl font-semibold text-gray-900 mb-4 lg:mb-0">
                Patient Treatments & Revenue Forecast
              </CardTitle>
              
              <div className="flex flex-col sm:flex-row space-y-2 sm:space-y-0 sm:space-x-4">
                <Button 
                  onClick={handleDownloadCSV}
                  className="bg-green-600 hover:bg-green-700"
                  disabled={patients.length === 0}
                >
                  <Download className="h-4 w-4 mr-2" />
                  Download CSV
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {/* Search and Filter Controls */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
              <div>
                <label className="block text-sm font-medium text-gray-900 mb-2">
                  Search Patients
                </label>
                <div className="relative">
                  <Input
                    placeholder="Search by name or phone..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10"
                  />
                  <Search className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
                </div>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-900 mb-2">
                  Filter by Sales Rep
                </label>
                <Select value={salesRepFilter} onValueChange={setSalesRepFilter}>
                  <SelectTrigger>
                    <SelectValue placeholder="All sales reps" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Sales Reps</SelectItem>
                    {salesReps.map((salesRep: SalesRep) => (
                      <SelectItem key={salesRep.id} value={salesRep.name}>
                        {salesRep.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-900 mb-2">
                  Filter by Referral Source
                </label>
                <Input
                  placeholder="Filter by facility..."
                  value={referralSourceFilter}
                  onChange={(e) => setReferralSourceFilter(e.target.value)}
                />
              </div>
            </div>

            {/* Patients Table */}
            {patientsLoading ? (
              <div className="text-center py-8">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
                <p className="text-gray-600">Loading treatment patients...</p>
              </div>
            ) : patients.length === 0 ? (
              <div className="text-center py-12">
                <FolderOpen className="h-16 w-16 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">No approved patients found</h3>
                <p className="text-gray-600 mb-4">
                  {searchTerm || salesRepFilter || referralSourceFilter
                    ? "Try adjusting your search filters"
                    : "Patients with 'IVR Approved' status will appear here"}
                </p>
                <Link href="/manage-patients">
                  <Button>
                    <Users className="h-4 w-4 mr-2" />
                    Manage Patients
                  </Button>
                </Link>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Patient Name</TableHead>
                      <TableHead>Date of Birth</TableHead>
                      <TableHead>Phone</TableHead>
                      <TableHead>Insurance</TableHead>
                      <TableHead>Wound Type</TableHead>
                      <TableHead>Wound Size</TableHead>
                      <TableHead>Referral Source</TableHead>
                      <TableHead>Sales Rep</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Date Approved</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {patients.map((patient: Patient) => (
                      <TableRow key={patient.id} className="hover:bg-gray-50">
                        <TableCell>
                          <div className="font-medium text-gray-900">
                            <Link 
                              href={`/patient-profile/${patient.id}`}
                              className="text-blue-600 hover:text-blue-800 hover:underline cursor-pointer"
                            >
                              {patient.firstName} {patient.lastName}
                            </Link>
                          </div>
                        </TableCell>
                        <TableCell>
                          {(() => {
                            // Convert YYYY-MM-DD to MM/DD/YYYY for display
                            if (patient.dateOfBirth && patient.dateOfBirth.match(/^\d{4}-\d{2}-\d{2}$/)) {
                              const [year, month, day] = patient.dateOfBirth.split('-');
                              return `${month}/${day}/${year}`;
                            }
                            return patient.dateOfBirth;
                          })()}
                        </TableCell>
                        <TableCell>{patient.phoneNumber}</TableCell>
                        <TableCell>
                          <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getInsuranceBadgeColor(patient.insurance)}`}>
                            {patient.insurance === "other" && patient.customInsurance ? patient.customInsurance : patient.insurance}
                          </span>
                        </TableCell>
                        <TableCell>
                          <span className="text-sm text-gray-900">
                            {patient.woundType || 'Not specified'}
                          </span>
                        </TableCell>
                        <TableCell>
                          <span className="text-sm text-gray-900">
                            {patient.woundSize ? `${patient.woundSize} sq cm` : 'Not specified'}
                          </span>
                        </TableCell>
                        <TableCell>{patient.referralSource}</TableCell>
                        <TableCell>{patient.salesRep}</TableCell>
                        <TableCell>
                          <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getPatientStatusBadgeColor(patient.patientStatus)}`}>
                            {patient.patientStatus || 'Evaluation Stage'}
                          </span>
                        </TableCell>
                        <TableCell className="text-gray-500">
                          {new Date(patient.createdAt || '').toLocaleDateString()}
                        </TableCell>
                        <TableCell>
                          <div className="flex space-x-2">
                            <Link href={`/patient-profile/${patient.id}`}>
                              <Button
                                size="sm"
                                variant="ghost"
                                className="text-green-600 hover:text-green-700"
                                title="View patient profile"
                              >
                                <Clock className="h-4 w-4" />
                              </Button>
                            </Link>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="text-red-600 hover:text-red-700"
                              onClick={() => handleDeletePatient(patient.id)}
                              disabled={deletePatientMutation.isPending}
                              title="Remove from treatments"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
            
            {/* Pagination Info */}
            {patients.length > 0 && (
              <div className="flex items-center justify-between mt-6">
                <div className="text-sm text-gray-500">
                  Showing 1 to {patients.length} of {patients.length} approved patients
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}