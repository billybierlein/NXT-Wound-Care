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
  FolderOpen,
  Calendar
} from "lucide-react";
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip } from "recharts";
import Navigation from "@/components/ui/navigation";
import { isUnauthorizedError } from "@/lib/authUtils";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { Patient, SalesRep, Provider, PatientTreatment } from "@shared/schema";
import { format, startOfYear, startOfMonth, isAfter, isBefore, parseISO } from "date-fns";

export default function PatientTreatments() {
  const { user, isAuthenticated, isLoading } = useAuth();
  const { toast } = useToast();
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [dateFilter, setDateFilter] = useState("all");
  const [customStartDate, setCustomStartDate] = useState("");
  const [customEndDate, setCustomEndDate] = useState("");

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

  // Fetch patients for treatment association
  const { data: allPatients = [] } = useQuery({
    queryKey: ["/api/patients"],
    retry: false,
    enabled: isAuthenticated,
  });

  // Fetch all treatments
  const { data: allTreatments = [], refetch: refetchTreatments } = useQuery<PatientTreatment[]>({
    queryKey: ["/api/treatments/all"],
    queryFn: async () => {
      const response = await fetch("/api/treatments/all", { credentials: "include" });
      if (!response.ok) {
        throw new Error(`${response.status}: ${response.statusText}`);
      }
      return response.json();
    },
    retry: false,
    enabled: isAuthenticated,
    refetchInterval: 10000, // Refetch every 10 seconds for real-time updates
  });

  // Helper function to filter treatments by date range
  const filterTreatmentsByDate = (treatments: PatientTreatment[]) => {
    if (dateFilter === "all") return treatments;
    
    const now = new Date();
    let startDate: Date;
    let endDate = now;
    
    if (dateFilter === "ytd") {
      startDate = startOfYear(now);
    } else if (dateFilter === "mtd") {
      startDate = startOfMonth(now);
    } else if (dateFilter === "custom" && customStartDate && customEndDate) {
      startDate = parseISO(customStartDate);
      endDate = parseISO(customEndDate);
    } else {
      return treatments;
    }
    
    return treatments.filter(treatment => {
      const treatmentDate = parseISO(treatment.treatmentDate);
      return isAfter(treatmentDate, startDate) && isBefore(treatmentDate, endDate);
    });
  };

  // Filter treatments based on search, status, and date filters
  const filteredTreatments = allTreatments.filter(treatment => {
    // Get patient info for this treatment
    const patient = allPatients.find(p => p.id === treatment.patientId);
    const patientName = patient ? `${patient.firstName} ${patient.lastName}`.toLowerCase() : "";
    
    // Search filter
    const matchesSearch = !searchTerm || 
      patientName.includes(searchTerm.toLowerCase()) ||
      treatment.skinGraftType?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      treatment.qCode?.toLowerCase().includes(searchTerm.toLowerCase());
    
    // Status filter
    const matchesStatus = statusFilter === "all" || treatment.status === statusFilter;
    
    return matchesSearch && matchesStatus;
  });

  // Apply date filter
  const treatments = filterTreatmentsByDate(filteredTreatments);

  const deleteTreatmentMutation = useMutation({
    mutationFn: async (treatmentId: number) => {
      await apiRequest("DELETE", `/api/treatments/${treatmentId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/treatments/all"] });
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

  // Update treatment status mutation
  const updateTreatmentStatusMutation = useMutation({
    mutationFn: async ({ treatmentId, field, value }: { treatmentId: number; field: string; value: string }) => {
      await apiRequest("PUT", `/api/treatments/${treatmentId}/status`, { [field]: value });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/treatments/all"] });
      toast({
        title: "Success",
        description: "Status updated successfully!",
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
        description: error.message || "Failed to update status",
        variant: "destructive",
      });
    },
  });

  const handleDeleteTreatment = (treatmentId: number) => {
    if (window.confirm("Are you sure you want to delete this treatment?")) {
      deleteTreatmentMutation.mutate(treatmentId);
    }
  };

  const handleDownloadCSV = async () => {
    try {
      // Create CSV content from filtered treatments
      const csvHeaders = [
        "Patient Name", "Treatment Date", "Invoice No", "Invoice Status", "Invoice Date", "Payable Date",
        "Graft Used", "Q Code", "Wound Size (sq cm)", "ASP Price", "Revenue", "Invoice (60%)", 
        "Sales Rep Commission", ...(user?.role === 'admin' ? ["NXT Commission"] : []),
        "Sales Rep", "Status", "Acting Provider"
      ];
      
      const csvRows = treatments.map(treatment => {
        const patient = allPatients.find(p => p.id === treatment.patientId);
        const patientName = patient ? `${patient.firstName} ${patient.lastName}` : "Unknown";
        
        const baseRow = [
          patientName,
          format(parseISO(treatment.treatmentDate), "MM/dd/yyyy"),
          treatment.invoiceNo || "",
          treatment.invoiceStatus || "open",
          treatment.invoiceDate ? format(new Date(treatment.invoiceDate), "MM/dd/yyyy") : "",
          treatment.payableDate ? format(new Date(treatment.payableDate), "MM/dd/yyyy") : "",
          treatment.skinGraftType || "",
          treatment.qCode || "",
          treatment.woundSizeAtTreatment || "",
          `$${Number(treatment.pricePerSqCm || 0).toFixed(2)}`,
          `$${Number(treatment.totalRevenue || 0).toFixed(2)}`,
          `$${Number(treatment.invoiceTotal || 0).toFixed(2)}`,
          `$${Number(treatment.salesRepCommission || 0).toFixed(2)}`,
        ];
        
        // Add NXT Commission for admin users
        if (user?.role === 'admin') {
          baseRow.push(`$${Number(treatment.nxtCommission || 0).toFixed(2)}`);
        }
        
        // Add common fields
        baseRow.push(
          patient?.salesRep || "Not assigned",
          treatment.status || "",
          treatment.actingProvider || ""
        );
        
        return baseRow;
      });
      
      const csvContent = [csvHeaders, ...csvRows]
        .map(row => row.map(field => `"${field}"`).join(","))
        .join("\n");
      
      const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'patient-treatments.csv';
      a.click();
      window.URL.revokeObjectURL(url);
      
      toast({
        title: "Success",
        description: "Treatments CSV downloaded successfully!",
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

  // Calculate invoice totals by status (using invoiceStatus from treatments)
  const invoiceTotals = {
    open: treatments.filter(treatment => treatment.invoiceStatus === 'open').reduce((sum, treatment) => sum + parseFloat(treatment.invoiceTotal || '0'), 0),
    payable: treatments.filter(treatment => treatment.invoiceStatus === 'payable').reduce((sum, treatment) => sum + parseFloat(treatment.invoiceTotal || '0'), 0),
    closed: treatments.filter(treatment => treatment.invoiceStatus === 'closed').reduce((sum, treatment) => sum + parseFloat(treatment.invoiceTotal || '0'), 0),
  };

  // Prepare treatment size data for bar chart by month
  const treatmentSizeByMonth = treatments.reduce((acc, treatment) => {
    const date = new Date(treatment.treatmentDate);
    const monthYear = `${date.getMonth() + 1}/${date.getFullYear()}`;
    
    if (!acc[monthYear]) {
      acc[monthYear] = 0;
    }
    acc[monthYear] += parseFloat(treatment.woundSizeAtTreatment || '0');
    return acc;
  }, {} as Record<string, number>);

  // Convert to array for recharts
  const chartData = Object.entries(treatmentSizeByMonth)
    .map(([month, size]) => ({ month, size }))
    .sort((a, b) => {
      const [aMonth, aYear] = a.month.split('/').map(Number);
      const [bMonth, bYear] = b.month.split('/').map(Number);
      return aYear - bYear || aMonth - bMonth;
    });

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
    }).format(amount);
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
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Patient Treatments</h1>
          <p className="text-gray-600 mt-2">Track and manage patient treatment records</p>
        </div>

        {/* Dashboard Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <div className="md:col-span-3">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Open Invoices */}
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Open Invoices</CardTitle>
                  <DollarSign className="h-4 w-4 text-yellow-600" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-yellow-600">
                    {formatCurrency(invoiceTotals.open)}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {treatments.filter(t => t.invoiceStatus === 'open').length} invoice(s)
                  </p>
                </CardContent>
              </Card>

              {/* Payable Invoices */}
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Payable Invoices</CardTitle>
                  <DollarSign className="h-4 w-4 text-blue-600" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-blue-600">
                    {formatCurrency(invoiceTotals.payable)}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {treatments.filter(t => t.invoiceStatus === 'payable').length} invoice(s)
                  </p>
                </CardContent>
              </Card>

              {/* Closed Invoices */}
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Closed Invoices</CardTitle>
                  <DollarSign className="h-4 w-4 text-green-600" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-green-600">
                    {formatCurrency(invoiceTotals.closed)}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {treatments.filter(t => t.invoiceStatus === 'closed').length} invoice(s)
                  </p>
                </CardContent>
              </Card>
            </div>
          </div>

          {/* Treatment Size Bar Chart */}
          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-medium">Squares</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis 
                    dataKey="month" 
                    tick={{ fontSize: 10 }}
                    angle={-45}
                    textAnchor="end"
                    height={60}
                  />
                  <YAxis tick={{ fontSize: 10 }} />
                  <Tooltip 
                    formatter={(value) => [`${value} sq cm`, 'Size']}
                    labelFormatter={(label) => `Month: ${label}`}
                  />
                  <Bar dataKey="size" fill="#8884d8" />
                </BarChart>
              </ResponsiveContainer>
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
                  disabled={treatments.length === 0}
                >
                  <Download className="h-4 w-4 mr-2" />
                  Download CSV
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {/* Search and Filter Controls */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
              <div>
                <label className="block text-sm font-medium text-gray-900 mb-2">
                  Search Treatments
                </label>
                <div className="relative">
                  <Input
                    placeholder="Search by patient name, graft, Q code..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10"
                  />
                  <Search className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
                </div>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-900 mb-2">
                  Treatment Status
                </label>
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger>
                    <SelectValue placeholder="All treatments" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Treatments</SelectItem>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="completed">Completed</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-900 mb-2">
                  Date Range
                </label>
                <Select value={dateFilter} onValueChange={setDateFilter}>
                  <SelectTrigger>
                    <SelectValue placeholder="All dates" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Dates</SelectItem>
                    <SelectItem value="ytd">Year to Date</SelectItem>
                    <SelectItem value="mtd">Month to Date</SelectItem>
                    <SelectItem value="custom">Custom Range</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              {dateFilter === "custom" && (
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-sm font-medium text-gray-900 mb-2">
                      Start Date
                    </label>
                    <Input
                      type="date"
                      value={customStartDate}
                      onChange={(e) => setCustomStartDate(e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-900 mb-2">
                      End Date
                    </label>
                    <Input
                      type="date"
                      value={customEndDate}
                      onChange={(e) => setCustomEndDate(e.target.value)}
                    />
                  </div>
                </div>
              )}
              
            </div>

            {/* Treatment Results Summary */}
            <div className="mb-4 text-sm text-gray-600">
              Showing {treatments.length} treatments {statusFilter !== "all" && `(${statusFilter})`} {dateFilter !== "all" && `(${dateFilter})`}
            </div>

            {/* Treatments Table */}
            {treatments.length === 0 ? (
              <div className="text-center py-12">
                <FolderOpen className="h-16 w-16 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">No treatments found</h3>
                <p className="text-gray-600 mb-4">
                  {searchTerm || statusFilter !== "all" || dateFilter !== "all"
                    ? "Try adjusting your search filters"
                    : "Patient treatments will appear here once they are created"}
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
                      <TableHead>Treatment Date</TableHead>
                      <TableHead>Invoice No</TableHead>
                      <TableHead>Invoice Status</TableHead>
                      <TableHead>Invoice Date</TableHead>
                      <TableHead>Payable Date</TableHead>
                      <TableHead>Graft Used</TableHead>
                      <TableHead>Q Code</TableHead>
                      <TableHead>Wound Size</TableHead>
                      <TableHead>ASP Price</TableHead>
                      <TableHead>Revenue</TableHead>
                      <TableHead>Invoice (60%)</TableHead>
                      <TableHead>Sales Rep Commission</TableHead>
                      {user?.role === 'admin' && <TableHead>NXT Commission</TableHead>}
                      <TableHead>Sales Rep</TableHead>
                      <TableHead>Treatment Status</TableHead>
                      <TableHead>Acting Provider</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {treatments.map((treatment: PatientTreatment) => {
                      const patient = allPatients.find(p => p.id === treatment.patientId);
                      const patientName = patient ? `${patient.firstName} ${patient.lastName}` : "Unknown Patient";
                      const invoiceAmount = (treatment.revenue || 0) * 0.6;
                      
                      return (
                        <TableRow key={treatment.id} className="hover:bg-gray-50">
                          <TableCell>
                            <div className="font-medium text-gray-900">
                              <Link 
                                href={`/patient-profile/${treatment.patientId}`}
                                className="text-blue-600 hover:text-blue-800 hover:underline cursor-pointer"
                              >
                                {patientName}
                              </Link>
                            </div>
                          </TableCell>
                          <TableCell>
                            {format(parseISO(treatment.treatmentDate), "MM/dd/yyyy")}
                          </TableCell>
                          <TableCell>
                            <span className="text-sm text-gray-900 font-medium">
                              {treatment.invoiceNo || 'Not assigned'}
                            </span>
                          </TableCell>
                          <TableCell>
                            <Select
                              value={treatment.invoiceStatus || 'open'}
                              onValueChange={(value) => updateTreatmentStatusMutation.mutate({
                                treatmentId: treatment.id,
                                field: 'invoiceStatus',
                                value: value
                              })}
                              disabled={updateTreatmentStatusMutation.isPending}
                            >
                              <SelectTrigger className={`w-[120px] h-8 ${
                                treatment.invoiceStatus === 'open' ? 'bg-yellow-50 text-yellow-800 border-yellow-200' :
                                treatment.invoiceStatus === 'payable' ? 'bg-blue-50 text-blue-800 border-blue-200' :
                                treatment.invoiceStatus === 'closed' ? 'bg-green-50 text-green-800 border-green-200' :
                                'bg-gray-50 text-gray-800 border-gray-200'
                              }`}>
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="open">Open</SelectItem>
                                <SelectItem value="payable">Payable</SelectItem>
                                <SelectItem value="closed">Closed</SelectItem>
                              </SelectContent>
                            </Select>
                          </TableCell>
                          <TableCell>
                            <span className="text-sm text-gray-900">
                              {treatment.invoiceDate ? format(new Date(treatment.invoiceDate), "MM/dd/yyyy") : 'Not set'}
                            </span>
                          </TableCell>
                          <TableCell>
                            <span className="text-sm text-gray-900">
                              {treatment.payableDate ? format(new Date(treatment.payableDate), "MM/dd/yyyy") : 'Not set'}
                            </span>
                          </TableCell>
                          <TableCell>
                            <span className="text-sm text-gray-900 font-medium">
                              {treatment.skinGraftType || 'Not specified'}
                            </span>
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">
                              {treatment.qCode || 'Not assigned'}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <span className="text-sm text-gray-900">
                              {treatment.woundSizeAtTreatment ? `${treatment.woundSizeAtTreatment} sq cm` : 'Not specified'}
                            </span>
                          </TableCell>
                          <TableCell>
                            <span className="text-sm font-medium text-green-600">
                              ${(Number(treatment.pricePerSqCm) || 0).toFixed(2)}
                            </span>
                          </TableCell>
                          <TableCell>
                            <span className="text-sm font-medium text-green-600">
                              ${(Number(treatment.totalRevenue) || 0).toFixed(2)}
                            </span>
                          </TableCell>
                          <TableCell>
                            <span className="text-sm font-medium text-purple-600">
                              ${(Number(treatment.invoiceTotal) || 0).toFixed(2)}
                            </span>
                          </TableCell>
                          <TableCell>
                            <span className="text-sm font-medium text-green-600">
                              ${(Number(treatment.salesRepCommission) || 0).toFixed(2)}
                            </span>
                          </TableCell>
                          {user?.role === 'admin' && (
                            <TableCell>
                              <span className="text-sm font-medium text-orange-600">
                                ${(Number(treatment.nxtCommission) || 0).toFixed(2)}
                              </span>
                            </TableCell>
                          )}
                          <TableCell>
                            <span className="text-sm text-gray-900">
                              {patient?.salesRep || 'Not assigned'}
                            </span>
                          </TableCell>
                          <TableCell>
                            <Select
                              value={treatment.status || 'active'}
                              onValueChange={(value) => updateTreatmentStatusMutation.mutate({
                                treatmentId: treatment.id,
                                field: 'status',
                                value: value
                              })}
                              disabled={updateTreatmentStatusMutation.isPending}
                            >
                              <SelectTrigger className={`w-[120px] h-8 ${
                                treatment.status === 'active' ? 'bg-blue-50 text-blue-800 border-blue-200' :
                                treatment.status === 'completed' ? 'bg-green-50 text-green-800 border-green-200' :
                                treatment.status === 'cancelled' ? 'bg-red-50 text-red-800 border-red-200' :
                                'bg-gray-50 text-gray-800 border-gray-200'
                              }`}>
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="active">Active</SelectItem>
                                <SelectItem value="completed">Completed</SelectItem>
                                <SelectItem value="cancelled">Cancelled</SelectItem>
                              </SelectContent>
                            </Select>
                          </TableCell>
                          <TableCell>
                            <span className="text-sm text-gray-900">
                              {treatment.actingProvider || 'Not assigned'}
                            </span>
                          </TableCell>
                          <TableCell>
                            <div className="flex space-x-2">
                              <Link href={`/patient-profile/${treatment.patientId}`}>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  className="text-blue-600 hover:text-blue-700"
                                  title="View patient profile"
                                >
                                  <Edit className="h-4 w-4" />
                                </Button>
                              </Link>
                              <Button
                                size="sm"
                                variant="ghost"
                                className="text-red-600 hover:text-red-700"
                                onClick={() => handleDeleteTreatment(treatment.id)}
                                disabled={deleteTreatmentMutation.isPending}
                                title="Delete treatment"
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            )}
            
            {/* Pagination Info */}
            {treatments.length > 0 && (
              <div className="flex items-center justify-between mt-6">
                <div className="text-sm text-gray-500">
                  Showing 1 to {treatments.length} of {treatments.length} treatments
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}