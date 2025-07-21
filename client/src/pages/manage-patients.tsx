import { useAuth } from "@/hooks/useAuth";
import { useEffect, useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Link } from "wouter";
import { Search, Download, Edit, Trash2, FolderOpen, Plus, Clock } from "lucide-react";
import Navigation from "@/components/ui/navigation";
import { isUnauthorizedError } from "@/lib/authUtils";
import type { Patient, SalesRep, User } from "@shared/schema";

export default function ManagePatients() {
  const { isAuthenticated, isLoading } = useAuth();
  const { toast } = useToast();
  const [searchTerm, setSearchTerm] = useState("");
  const [salesRepFilter, setSalesRepFilter] = useState("all");
  const [referralSourceFilter, setReferralSourceFilter] = useState("");

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

  // Fetch sales reps for filtering
  const { data: salesReps = [] } = useQuery<SalesRep[]>({
    queryKey: ["/api/sales-reps"],
    retry: false,
    enabled: isAuthenticated,
  });

  const { data: allPatients = [], isLoading: patientsLoading } = useQuery({
    queryKey: ["/api/patients", { search: searchTerm, salesRep: currentUser?.role === 'admin' && salesRepFilter !== "all" ? salesRepFilter : "", referralSource: referralSourceFilter }],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (searchTerm) params.append('search', searchTerm);
      // Only apply sales rep filter for admin users
      if (currentUser?.role === 'admin' && salesRepFilter && salesRepFilter !== "all") {
        params.append('salesRep', salesRepFilter);
      }
      if (referralSourceFilter) params.append('referralSource', referralSourceFilter);
      
      const url = `/api/patients${params.toString() ? '?' + params.toString() : ''}`;
      const res = await fetch(url, { credentials: "include" });
      
      if (!res.ok) {
        throw new Error(`${res.status}: ${res.statusText}`);
      }
      
      return res.json();
    },
    retry: false,
    enabled: isAuthenticated && currentUser !== undefined,
  });

  // Show all patients regardless of status
  const patients = allPatients;

  const deletePatientMutation = useMutation({
    mutationFn: async (patientId: number) => {
      await apiRequest("DELETE", `/api/patients/${patientId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/patients"] });
      toast({
        title: "Success",
        description: "Patient deleted successfully!",
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
        description: error.message || "Failed to delete patient",
        variant: "destructive",
      });
    },
  });

  const handleDeletePatient = (patientId: number) => {
    if (window.confirm("Are you sure you want to delete this patient?")) {
      deletePatientMutation.mutate(patientId);
    }
  };

  const handleDownloadCSV = async () => {
    try {
      const response = await fetch("/api/patients/export/csv?status=non-approved", {
        credentials: "include",
      });
      
      if (!response.ok) {
        throw new Error("Failed to download CSV");
      }
      
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = response.headers.get('Content-Disposition')?.split('filename=')[1]?.replace(/"/g, '') || 'patients.csv';
      a.click();
      window.URL.revokeObjectURL(url);
      
      toast({
        title: "Success",
        description: "CSV downloaded successfully!",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to download CSV",
        variant: "destructive",
      });
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
        <Card>
          <CardHeader>
            <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between">
              <CardTitle className="text-xl font-semibold text-gray-900 mb-4 lg:mb-0">
                Patients
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
            <div className={`grid grid-cols-1 gap-4 mb-6 ${currentUser?.role === 'admin' ? 'md:grid-cols-3' : 'md:grid-cols-2'}`}>
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
                  <Search className="h-4 w-4 absolute left-3 top-3 text-gray-400" />
                </div>
              </div>
              
              {/* Only show sales rep filter for admin users */}
              {currentUser?.role === 'admin' && (
                <div>
                  <label className="block text-sm font-medium text-gray-900 mb-2">
                    Filter by Sales Rep
                  </label>
                  <Select value={salesRepFilter} onValueChange={setSalesRepFilter}>
                    <SelectTrigger>
                      <SelectValue placeholder="All Reps" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Reps</SelectItem>
                      {salesReps.map((salesRep: SalesRep) => (
                        <SelectItem key={salesRep.id} value={salesRep.name}>
                          {salesRep.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
              
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
                <p className="text-gray-600">Loading patients...</p>
              </div>
            ) : patients.length === 0 ? (
              <div className="text-center py-12">
                <FolderOpen className="h-16 w-16 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">No patients found</h3>
                <p className="text-gray-600 mb-4">
                  {searchTerm || (currentUser?.role === 'admin' && salesRepFilter !== "all") || referralSourceFilter
                    ? "Try adjusting your search filters"
                    : "Get started by adding your first patient"}
                </p>
                <Link href="/add-patient">
                  <Button>
                    <Plus className="h-4 w-4 mr-2" />
                    Add Patient
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
                      <TableHead>Patient Status</TableHead>
                      <TableHead>Date Added</TableHead>
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
                            <Link href={`/patient-timeline/${patient.id}`}>
                              <Button
                                size="sm"
                                variant="ghost"
                                className="text-green-600 hover:text-green-700"
                                title="View patient timeline"
                              >
                                <Clock className="h-4 w-4" />
                              </Button>
                            </Link>
                            <Link href={`/edit-patient/${patient.id}`}>
                              <Button
                                size="sm"
                                variant="ghost"
                                className="text-primary hover:text-blue-700"
                                title="Edit patient"
                              >
                                <Edit className="h-4 w-4" />
                              </Button>
                            </Link>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="text-red-600 hover:text-red-700"
                              onClick={() => handleDeletePatient(patient.id)}
                              disabled={deletePatientMutation.isPending}
                              title="Delete patient"
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
                  Showing 1 to {patients.length} of {patients.length} patients
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
