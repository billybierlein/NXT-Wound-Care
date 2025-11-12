import { useAuth } from "@/hooks/useAuth";
import { useEffect, useState, useMemo } from "react";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { useQuery } from "@tanstack/react-query";
import { Search, Download, Upload, Edit, Trash2, ChevronLeft, ChevronRight, Filter } from "lucide-react";
import Navigation from "@/components/ui/navigation";
import { isUnauthorizedError } from "@/lib/authUtils";
import type { PatientReferral, SalesRep, Provider, ReferralSource, User } from "@shared/schema";
import { format, parseISO, isAfter, isBefore } from "date-fns";

export default function PatientReferrals() {
  const { isAuthenticated, isLoading } = useAuth();
  const { toast } = useToast();

  // State for filters
  const [searchTerm, setSearchTerm] = useState("");
  const [sortBy, setSortBy] = useState("referralDate");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [priorityFilter, setPriorityFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

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

  // Fetch providers for display
  const { data: providers = [] } = useQuery<Provider[]>({
    queryKey: ["/api/providers"],
    retry: false,
    enabled: isAuthenticated,
  });

  // Fetch referral sources for display
  const { data: referralSources = [] } = useQuery<ReferralSource[]>({
    queryKey: ["/api/referral-sources"],
    retry: false,
    enabled: isAuthenticated,
  });

  // Get sales rep name by ID
  const getSalesRepName = (repId: number | null): string => {
    if (!repId) return "Unassigned";
    const rep = salesReps.find(r => r.id === repId);
    return rep?.name || "Unknown";
  };

  // Get provider name by ID
  const getProviderName = (providerId: number | null): string => {
    if (!providerId) return "Unassigned";
    const provider = providers.find(p => p.id === providerId);
    return provider?.name || "Unknown";
  };

  // Get referral source name by ID
  const getReferralSourceName = (sourceId: number | null): string => {
    if (!sourceId) return "Unknown";
    const source = referralSources.find(s => s.id === sourceId);
    return source?.facilityName || "Unknown";
  };

  // Filter and sort referrals
  const filteredReferrals = useMemo(() => {
    let filtered = [...allReferrals];

    // Role-based filtering: sales reps see only their assigned referrals
    if (currentUser?.role === 'sales_rep' && currentUser?.salesRepId) {
      filtered = filtered.filter(ref => ref.assignedSalesRepId === currentUser.salesRepId);
    }

    // Search by patient name
    if (searchTerm) {
      filtered = filtered.filter(ref =>
        ref.patientName.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    // Priority filter
    if (priorityFilter !== "all") {
      filtered = filtered.filter(ref => ref.priority === priorityFilter);
    }

    // Status filter
    if (statusFilter !== "all") {
      filtered = filtered.filter(ref => ref.status === statusFilter);
    }

    // Date range filter
    if (fromDate) {
      const from = parseISO(fromDate);
      filtered = filtered.filter(ref => {
        const refDate = parseISO(ref.referralDate.toString());
        return isAfter(refDate, from) || refDate.getTime() === from.getTime();
      });
    }

    if (toDate) {
      const to = parseISO(toDate);
      filtered = filtered.filter(ref => {
        const refDate = parseISO(ref.referralDate.toString());
        return isBefore(refDate, to) || refDate.getTime() === to.getTime();
      });
    }

    // Sort referrals
    filtered.sort((a, b) => {
      if (sortBy === "referralDate") {
        return new Date(b.referralDate).getTime() - new Date(a.referralDate).getTime();
      } else if (sortBy === "patientName") {
        return a.patientName.localeCompare(b.patientName);
      } else if (sortBy === "priority") {
        const priorityOrder = { High: 1, Medium: 2, Low: 3 };
        return (priorityOrder[a.priority as keyof typeof priorityOrder] || 3) - 
               (priorityOrder[b.priority as keyof typeof priorityOrder] || 3);
      } else if (sortBy === "status") {
        return a.status.localeCompare(b.status);
      }
      return 0;
    });

    return filtered;
  }, [allReferrals, currentUser, searchTerm, priorityFilter, statusFilter, fromDate, toDate, sortBy]);

  // Pagination
  const totalPages = Math.ceil(filteredReferrals.length / itemsPerPage);
  const paginatedReferrals = filteredReferrals.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  // Reset to page 1 when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, priorityFilter, statusFilter, fromDate, toDate, sortBy]);

  // Priority badge color
  const getPriorityBadgeColor = (priority: string) => {
    switch (priority) {
      case "High":
        return "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200";
      case "Medium":
        return "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200";
      case "Low":
        return "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200";
      default:
        return "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200";
    }
  };

  // Status badge color
  const getStatusBadgeColor = (status: string) => {
    switch (status) {
      case "Active":
        return "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200";
      case "Completed":
        return "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200";
      case "Cancelled":
        return "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200";
      default:
        return "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200";
    }
  };

  // Export to CSV
  const handleExportCSV = () => {
    if (filteredReferrals.length === 0) {
      toast({
        title: "No Data",
        description: "No referrals to export",
        variant: "destructive",
      });
      return;
    }

    // Create CSV headers
    const headers = [
      "Patient Name",
      "Assigned Rep",
      "Assigned Provider",
      "Referral Date",
      "Referral Source Account",
      "Priority",
      "Status",
      "Notes"
    ];

    // Create CSV rows
    const rows = filteredReferrals.map(ref => [
      ref.patientName,
      getSalesRepName(ref.assignedSalesRepId),
      getProviderName(ref.assignedProviderId),
      format(parseISO(ref.referralDate.toString()), "MM/dd/yyyy"),
      getReferralSourceName(ref.referralSourceId),
      ref.priority || "",
      ref.status || "",
      ref.notes || ""
    ]);

    // Combine headers and rows
    const csvContent = [
      headers.join(","),
      ...rows.map(row => row.map(cell => `"${cell}"`).join(","))
    ].join("\n");

    // Create and download file
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `patient-referrals-${format(new Date(), "yyyy-MM-dd")}.csv`;
    link.click();
    URL.revokeObjectURL(url);

    toast({
      title: "Success",
      description: "CSV downloaded successfully!",
    });
  };

  // Handle upload button (placeholder)
  const handleUploadClick = () => {
    toast({
      title: "Coming Soon",
      description: "Upload dialog coming soon",
    });
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
        <Card>
          <CardHeader>
            <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
              <div className="flex items-center gap-2">
                <CardTitle className="text-xl font-semibold text-gray-900">
                  Patient Referrals
                </CardTitle>
                <Badge variant="secondary" className="px-2 py-1">
                  {filteredReferrals.length}
                </Badge>
              </div>
              
              <div className="flex flex-col sm:flex-row gap-2">
                <Button
                  onClick={handleExportCSV}
                  variant="outline"
                  className="bg-white hover:bg-gray-50"
                  disabled={filteredReferrals.length === 0}
                  data-testid="button-export"
                >
                  <Download className="h-4 w-4 mr-2" />
                  Export
                </Button>
                <Button
                  onClick={handleUploadClick}
                  className="bg-blue-600 hover:bg-blue-700"
                  data-testid="button-upload"
                >
                  <Upload className="h-4 w-4 mr-2" />
                  Upload New Referral
                </Button>
              </div>
            </div>
          </CardHeader>

          <CardContent>
            {/* Search and Filter Controls */}
            <div className="space-y-4 mb-6">
              {/* Search Bar */}
              <div className="flex items-center gap-2">
                <div className="relative flex-1">
                  <Search className="h-4 w-4 absolute left-3 top-3 text-gray-400" />
                  <Input
                    placeholder="Search by patient name..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10"
                    data-testid="input-search"
                  />
                </div>
              </div>

              {/* Filters Row */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Sort By
                  </label>
                  <Select value={sortBy} onValueChange={setSortBy}>
                    <SelectTrigger data-testid="select-sort">
                      <SelectValue placeholder="Sort by..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="referralDate">Referral Date</SelectItem>
                      <SelectItem value="patientName">Patient Name</SelectItem>
                      <SelectItem value="priority">Priority</SelectItem>
                      <SelectItem value="status">Status</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    From Date
                  </label>
                  <Input
                    type="date"
                    value={fromDate}
                    onChange={(e) => setFromDate(e.target.value)}
                    data-testid="input-from-date"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    To Date
                  </label>
                  <Input
                    type="date"
                    value={toDate}
                    onChange={(e) => setToDate(e.target.value)}
                    data-testid="input-to-date"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Priority
                  </label>
                  <Select value={priorityFilter} onValueChange={setPriorityFilter}>
                    <SelectTrigger data-testid="select-priority">
                      <SelectValue placeholder="All Priorities" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Priorities</SelectItem>
                      <SelectItem value="High">High</SelectItem>
                      <SelectItem value="Medium">Medium</SelectItem>
                      <SelectItem value="Low">Low</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Status
                  </label>
                  <Select value={statusFilter} onValueChange={setStatusFilter}>
                    <SelectTrigger data-testid="select-status">
                      <SelectValue placeholder="All Statuses" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Statuses</SelectItem>
                      <SelectItem value="Active">Active</SelectItem>
                      <SelectItem value="Completed">Completed</SelectItem>
                      <SelectItem value="Cancelled">Cancelled</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>

            {/* Table */}
            {referralsLoading ? (
              <div className="text-center py-8">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
                <p className="text-gray-600">Loading referrals...</p>
              </div>
            ) : filteredReferrals.length === 0 ? (
              <div className="text-center py-12">
                <p className="text-gray-600 mb-2">No patient referrals found</p>
                <p className="text-sm text-gray-500">
                  {searchTerm || fromDate || toDate || priorityFilter !== "all" || statusFilter !== "all"
                    ? "Try adjusting your search filters"
                    : "Upload a new referral to get started"}
                </p>
              </div>
            ) : (
              <>
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Patient Name</TableHead>
                        <TableHead>Assigned Rep</TableHead>
                        <TableHead>Assigned Provider</TableHead>
                        <TableHead>Referral Date</TableHead>
                        <TableHead>Referral Source Account</TableHead>
                        <TableHead>Priority</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Notes</TableHead>
                        <TableHead className="text-right">Action</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {paginatedReferrals.map((referral) => (
                        <TableRow key={referral.id} data-testid={`row-referral-${referral.id}`}>
                          <TableCell className="font-medium" data-testid={`text-patient-name-${referral.id}`}>
                            {referral.patientName}
                          </TableCell>
                          <TableCell data-testid={`text-rep-${referral.id}`}>
                            {getSalesRepName(referral.assignedSalesRepId)}
                          </TableCell>
                          <TableCell data-testid={`text-provider-${referral.id}`}>
                            {getProviderName(referral.assignedProviderId)}
                          </TableCell>
                          <TableCell data-testid={`text-date-${referral.id}`}>
                            {format(parseISO(referral.referralDate.toString()), "MM/dd/yyyy")}
                          </TableCell>
                          <TableCell data-testid={`text-source-${referral.id}`}>
                            {getReferralSourceName(referral.referralSourceId)}
                          </TableCell>
                          <TableCell>
                            <Badge className={getPriorityBadgeColor(referral.priority)} data-testid={`badge-priority-${referral.id}`}>
                              {referral.priority}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <Badge className={getStatusBadgeColor(referral.status)} data-testid={`badge-status-${referral.id}`}>
                              {referral.status}
                            </Badge>
                          </TableCell>
                          <TableCell className="max-w-xs truncate" data-testid={`text-notes-${referral.id}`}>
                            {referral.notes || "—"}
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex justify-end gap-2">
                              <Button
                                variant="ghost"
                                size="sm"
                                data-testid={`button-edit-${referral.id}`}
                              >
                                <Edit className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                data-testid={`button-delete-${referral.id}`}
                              >
                                <Trash2 className="h-4 w-4 text-red-600" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>

                {/* Pagination */}
                <div className="flex items-center justify-between mt-6">
                  <div className="text-sm text-gray-600" data-testid="text-pagination-info">
                    Showing {((currentPage - 1) * itemsPerPage) + 1} to {Math.min(currentPage * itemsPerPage, filteredReferrals.length)} of {filteredReferrals.length} results
                  </div>
                  
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                      disabled={currentPage === 1}
                      data-testid="button-prev-page"
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </Button>
                    
                    <div className="flex items-center gap-1">
                      {Array.from({ length: totalPages }, (_, i) => i + 1)
                        .filter(page => {
                          // Show first page, last page, current page, and pages around current
                          return page === 1 || 
                                 page === totalPages || 
                                 Math.abs(page - currentPage) <= 1;
                        })
                        .map((page, index, array) => {
                          // Add ellipsis if there's a gap
                          const showEllipsisBefore = index > 0 && page - array[index - 1] > 1;
                          
                          return (
                            <div key={page} className="flex items-center gap-1">
                              {showEllipsisBefore && (
                                <span className="px-2 text-gray-500">...</span>
                              )}
                              <Button
                                variant={currentPage === page ? "default" : "outline"}
                                size="sm"
                                onClick={() => setCurrentPage(page)}
                                data-testid={`button-page-${page}`}
                              >
                                {page}
                              </Button>
                            </div>
                          );
                        })}
                    </div>
                    
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                      disabled={currentPage === totalPages}
                      data-testid="button-next-page"
                    >
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
