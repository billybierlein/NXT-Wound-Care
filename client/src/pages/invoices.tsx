import { useAuth } from "@/hooks/useAuth";
import { useState, useMemo, useEffect } from "react";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Label } from "@/components/ui/label";
import { 
  Search, 
  Download, 
  DollarSign,
  Clock,
  AlertTriangle,
  CheckCircle,
  Calendar,
  Users,
  TrendingUp,
  FileText,
  CreditCard,
  Banknote
} from "lucide-react";
import Navigation from "@/components/ui/navigation";
import { isUnauthorizedError } from "@/lib/authUtils";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { PatientTreatment, SalesRep } from "@shared/schema";
import { format, parseISO, isAfter, isBefore, differenceInDays, startOfMonth, endOfMonth, addDays } from "date-fns";

interface InvoiceData extends PatientTreatment {
  patientName?: string;
  daysOutstanding?: number;
  isOverdue?: boolean;
}

interface CommissionPaymentPeriod {
  periodStart: Date;
  periodEnd: Date;
  paymentDate: Date;
  salesRep: string;
  totalCommission: number;
  invoiceCount: number;
  invoices: InvoiceData[];
}

export default function Invoices() {
  const { user, isAuthenticated, isLoading } = useAuth();
  const { toast } = useToast();

  // Filters
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [salesRepFilter, setSalesRepFilter] = useState("all");
  const [providerFilter, setProviderFilter] = useState("all");
  const [dateRange, setDateRange] = useState("all");
  const [customStartDate, setCustomStartDate] = useState("");
  const [customEndDate, setCustomEndDate] = useState("");

  // Commission report filters
  const [commissionDateRange, setCommissionDateRange] = useState("current_month");
  const [selectedSalesRep, setSelectedSalesRep] = useState("all");

  // Payment date dialog state
  const [isPaymentDialogOpen, setIsPaymentDialogOpen] = useState(false);
  const [selectedInvoice, setSelectedInvoice] = useState<InvoiceData | null>(null);
  const [paymentDate, setPaymentDate] = useState("");

  // Commission tracking state with localStorage persistence
  const [commissionPayments, setCommissionPayments] = useState<Record<string, { datePaid: string; reference: string }>>({});

  // Load commission payments from localStorage on component mount
  useEffect(() => {
    const saved = localStorage.getItem('commissionPayments');
    if (saved) {
      try {
        setCommissionPayments(JSON.parse(saved));
      } catch (error) {
        console.error('Error loading commission payments from localStorage:', error);
      }
    }
  }, []);

  // Save commission payments to localStorage whenever they change
  useEffect(() => {
    localStorage.setItem('commissionPayments', JSON.stringify(commissionPayments));
  }, [commissionPayments]);

  // Fetch treatments data (invoices)
  const { data: treatments = [], isLoading: isLoadingTreatments } = useQuery<PatientTreatment[]>({
    queryKey: ["/api/treatments/all"],
    enabled: isAuthenticated,
  });

  // Fetch commission reports data for the new multi-rep system
  interface CommissionReport {
    treatmentId: number;
    invoiceNo: string;
    invoiceStatus: 'paid' | 'closed';
    repId: number;
    repName: string;
    commissionRate: number;
    commissionAmount: number;
    paidAt: string;
    isLegacy: boolean;
  }

  const { data: commissionReportsData = [], isLoading: isLoadingCommissions } = useQuery<CommissionReport[]>({
    queryKey: ["/api/commission-reports"],
    enabled: isAuthenticated,
  });

  // Fetch sales reps for filtering
  const { data: salesReps = [] } = useQuery<SalesRep[]>({
    queryKey: ["/api/sales-reps"],
    enabled: isAuthenticated,
  });

  // Fetch patients for name mapping
  interface Patient {
    id: number;
    firstName: string;
    lastName: string;
  }

  const { data: patients = [] } = useQuery<Patient[]>({
    queryKey: ["/api/patients"],
    enabled: isAuthenticated,
  });

  // Process invoice data with patient names and overdue status
  const invoiceData: InvoiceData[] = useMemo(() => {
    return treatments.map(treatment => {
      const patient = patients.find(p => p.id === treatment.patientId);
      const patientName = patient ? `${patient.firstName} ${patient.lastName}` : 'Unknown Patient';
      
      const daysOutstanding = treatment.payableDate 
        ? differenceInDays(new Date(), parseISO(typeof treatment.payableDate === 'string' ? treatment.payableDate : treatment.payableDate))
        : 0;
      
      const isOverdue = treatment.payableDate 
        ? isAfter(new Date(), parseISO(typeof treatment.payableDate === 'string' ? treatment.payableDate : treatment.payableDate)) && treatment.invoiceStatus !== 'closed'
        : false;

      return {
        ...treatment,
        patientName,
        daysOutstanding,
        isOverdue
      };
    });
  }, [treatments, patients]);

  // Apply filters to invoice data
  const filteredInvoices = useMemo(() => {
    let filtered = invoiceData;

    if (searchTerm) {
      filtered = filtered.filter(invoice => 
        invoice.patientName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        invoice.invoiceNo?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        invoice.actingProvider?.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    if (statusFilter !== "all") {
      if (statusFilter === "overdue") {
        filtered = filtered.filter(invoice => invoice.isOverdue);
      } else {
        filtered = filtered.filter(invoice => invoice.invoiceStatus === statusFilter);
      }
    }

    if (salesRepFilter !== "all") {
      filtered = filtered.filter(invoice => invoice.salesRep === salesRepFilter);
    }

    if (providerFilter !== "all") {
      filtered = filtered.filter(invoice => invoice.actingProvider === providerFilter);
    }

    // Date filtering
    if (dateRange !== "all" && customStartDate && customEndDate) {
      const start = parseISO(customStartDate);
      const end = parseISO(customEndDate);
      filtered = filtered.filter(invoice => {
        const invoiceDate = parseISO(invoice.invoiceDate || invoice.treatmentDate || '');
        return isAfter(invoiceDate, start) && isBefore(invoiceDate, end);
      });
    }

    return filtered;
  }, [invoiceData, searchTerm, statusFilter, salesRepFilter, providerFilter, dateRange, customStartDate, customEndDate]);

  // Calculate dashboard metrics
  const metrics = useMemo(() => {
    const openInvoices = invoiceData.filter(inv => inv.invoiceStatus === 'open');
    const payableInvoices = invoiceData.filter(inv => inv.invoiceStatus === 'payable');
    const closedInvoices = invoiceData.filter(inv => inv.invoiceStatus === 'closed');
    const overdueInvoices = invoiceData.filter(inv => inv.isOverdue);

    const totalOutstanding = [...openInvoices, ...payableInvoices]
      .reduce((sum, inv) => sum + parseFloat(inv.invoiceTotal || '0'), 0);

    const overdueAmount = overdueInvoices
      .reduce((sum, inv) => sum + parseFloat(inv.invoiceTotal || '0'), 0);

    const thisMonthClosed = closedInvoices.filter(inv => {
      const invoiceDate = parseISO(inv.invoiceDate || inv.treatmentDate || '');
      const monthStart = startOfMonth(new Date());
      const monthEnd = endOfMonth(new Date());
      return isAfter(invoiceDate, monthStart) && isBefore(invoiceDate, monthEnd);
    });

    const thisMonthPaid = thisMonthClosed
      .reduce((sum, inv) => sum + parseFloat(inv.invoiceTotal || '0'), 0);

    const avgDaysToPayment = closedInvoices.length > 0 
      ? closedInvoices.reduce((sum, inv) => sum + (inv.daysOutstanding || 0), 0) / closedInvoices.length
      : 0;

    return {
      totalOutstanding,
      overdueAmount,
      thisMonthPaid,
      avgDaysToPayment: Math.round(avgDaysToPayment),
      counts: {
        outstanding: openInvoices.length + payableInvoices.length,
        overdue: overdueInvoices.length,
        paidThisMonth: thisMonthClosed.length,
        total: invoiceData.length
      }
    };
  }, [invoiceData]);

  // Apply filters to commission reports data
  const filteredCommissionReports = useMemo(() => {
    let filtered = commissionReportsData;

    // Date range filtering
    if (commissionDateRange !== "all") {
      const now = new Date();
      let startDate = new Date();
      let endDate = new Date();

      switch (commissionDateRange) {
        case "current_month":
          startDate = startOfMonth(now);
          endDate = endOfMonth(now);
          break;
        case "last_month":
          const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
          startDate = startOfMonth(lastMonth);
          endDate = endOfMonth(lastMonth);
          break;
        case "last_3_months":
          startDate = new Date(now.getFullYear(), now.getMonth() - 3, 1);
          endDate = endOfMonth(now);
          break;
        case "last_6_months":
          startDate = new Date(now.getFullYear(), now.getMonth() - 6, 1);
          endDate = endOfMonth(now);
          break;
        case "custom":
          if (customStartDate && customEndDate) {
            startDate = parseISO(customStartDate);
            endDate = parseISO(customEndDate);
          }
          break;
      }

      if (commissionDateRange !== "custom" || (customStartDate && customEndDate)) {
        filtered = filtered.filter(report => {
          const paidDate = parseISO(report.paidAt);
          return paidDate >= startDate && paidDate <= endDate;
        });
      }
    }

    // Sales rep filtering
    if (selectedSalesRep !== "all") {
      filtered = filtered.filter(report => report.repName === selectedSalesRep);
    }

    return filtered.sort((a, b) => new Date(b.paidAt).getTime() - new Date(a.paidAt).getTime());
  }, [commissionReportsData, commissionDateRange, selectedSalesRep, customStartDate, customEndDate]);

  // Calculate commission summary
  const commissionSummary = useMemo(() => {
    const totalCommission = filteredCommissionReports.reduce((sum, report) => sum + report.commissionAmount, 0);
    const totalInvoices = filteredCommissionReports.length;
    const uniqueReps = new Set(filteredCommissionReports.map(report => report.repName)).size;
    
    const repSummary = filteredCommissionReports.reduce((acc, report) => {
      if (!acc[report.repName]) {
        acc[report.repName] = { total: 0, count: 0 };
      }
      acc[report.repName].total += report.commissionAmount;
      acc[report.repName].count += 1;
      return acc;
    }, {} as Record<string, { total: number; count: number }>);

    return {
      totalCommission,
      totalInvoices,
      uniqueReps,
      repSummary
    };
  }, [filteredCommissionReports]);

  // Update invoice status mutation
  const updateInvoiceStatusMutation = useMutation({
    mutationFn: async ({ id, status, paymentDate }: { id: number; status: string; paymentDate?: string }) => {
      const payload: any = { invoiceStatus: status };
      if (paymentDate && status === 'closed') {
        payload.paymentDate = paymentDate;
      }
      const response = await apiRequest("PATCH", `/api/treatments/${id}/invoice-status`, payload);
      if (!response.ok) throw new Error("Failed to update invoice status");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/treatments/all"] });
      queryClient.invalidateQueries({ queryKey: ["/api/commission-reports"] });
      queryClient.invalidateQueries({ queryKey: ["commissionReports"] });
      toast({ title: "Success", description: "Invoice status updated successfully" });
      setIsPaymentDialogOpen(false);
      setSelectedInvoice(null);
      setPaymentDate("");
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update invoice status",
        variant: "destructive",
      });
    },
  });

  const handleStatusChange = (invoice: InvoiceData, newStatus: string) => {
    if (newStatus === 'closed') {
      // Open payment date dialog for "paid" status
      setSelectedInvoice(invoice);
      setPaymentDate(format(new Date(), 'yyyy-MM-dd')); // Default to today
      setIsPaymentDialogOpen(true);
    } else {
      // Direct update for other statuses
      updateInvoiceStatusMutation.mutate({ id: invoice.id, status: newStatus });
    }
  };

  const confirmPayment = () => {
    if (selectedInvoice && paymentDate) {
      updateInvoiceStatusMutation.mutate({ 
        id: selectedInvoice.id, 
        status: 'closed',
        paymentDate: paymentDate
      });
    }
  };

  const getStatusBadge = (status: string, isOverdue: boolean) => {
    if (isOverdue && status !== 'closed') {
      return <Badge variant="destructive">Overdue</Badge>;
    }
    
    switch (status) {
      case 'open':
        return <Badge variant="secondary">Open</Badge>;
      case 'payable':
        return <Badge variant="default">Payable</Badge>;
      case 'closed':
        return <Badge variant="outline" className="border-green-500 text-green-700">Paid</Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  const exportCommissionReport = () => {
    // Create detailed CSV with commission reports
    const csvRows = [
      'Sales Rep,Invoice No.,Paid Date,Commission Rate,Commission Amount,Type'
    ];
    
    filteredCommissionReports.forEach(report => {
      csvRows.push([
        `"${report.repName}"`,
        `"${report.invoiceNo}"`,
        `"${format(parseISO(report.paidAt), 'yyyy-MM-dd')}"`,
        `"${report.commissionRate.toFixed(2)}%"`,
        `"$${report.commissionAmount.toFixed(2)}"`,
        `"${report.isLegacy ? 'Legacy' : 'Multi-Rep'}"`
      ].join(','));
    });

    const csvContent = csvRows.join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `commission-report-${format(new Date(), 'yyyy-MM-dd')}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  if (isLoading || isLoadingTreatments) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <div>Please log in to access this page.</div>;
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <Navigation />
      <div className="container mx-auto px-4 py-8">
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Invoice Management</h1>
            <p className="text-gray-600 dark:text-gray-400 mt-2">Track invoice status and manage commission payments</p>
          </div>
        </div>

        <Tabs defaultValue="invoices" className="space-y-6">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="invoices">Invoice Tracking</TabsTrigger>
            <TabsTrigger value="commissions">Commission Reports</TabsTrigger>
          </TabsList>

          <TabsContent value="invoices" className="space-y-6">
            {/* Dashboard Metrics */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Outstanding</CardTitle>
                  <DollarSign className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">${metrics.totalOutstanding.toLocaleString()}</div>
                  <p className="text-xs text-muted-foreground">{metrics.counts.outstanding} invoices</p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Overdue</CardTitle>
                  <AlertTriangle className="h-4 w-4 text-red-500" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-red-600">${metrics.overdueAmount.toLocaleString()}</div>
                  <p className="text-xs text-muted-foreground">{metrics.counts.overdue} invoices</p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Paid This Month</CardTitle>
                  <CheckCircle className="h-4 w-4 text-green-500" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-green-600">${metrics.thisMonthPaid.toLocaleString()}</div>
                  <p className="text-xs text-muted-foreground">{metrics.counts.paidThisMonth} invoices</p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Avg Days to Payment</CardTitle>
                  <Clock className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{metrics.avgDaysToPayment}</div>
                  <p className="text-xs text-muted-foreground">days average</p>
                </CardContent>
              </Card>
            </div>

            {/* Filters */}
            <Card>
              <CardHeader>
                <CardTitle>Filters</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-4">
                  <div className="relative">
                    <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                    <Input
                      placeholder="Search invoices..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="pl-10"
                    />
                  </div>

                  <Select value={statusFilter} onValueChange={setStatusFilter}>
                    <SelectTrigger>
                      <SelectValue placeholder="All Statuses" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Statuses</SelectItem>
                      <SelectItem value="open">Open</SelectItem>
                      <SelectItem value="payable">Payable</SelectItem>
                      <SelectItem value="closed">Paid</SelectItem>
                      <SelectItem value="overdue">Overdue</SelectItem>
                    </SelectContent>
                  </Select>

                  <Select value={salesRepFilter} onValueChange={setSalesRepFilter}>
                    <SelectTrigger>
                      <SelectValue placeholder="All Sales Reps" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Sales Reps</SelectItem>
                      {salesReps.map((rep) => (
                        <SelectItem key={rep.id} value={rep.name}>
                          {rep.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  <Select value={providerFilter} onValueChange={setProviderFilter}>
                    <SelectTrigger>
                      <SelectValue placeholder="All Providers" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Providers</SelectItem>
                      {Array.from(new Set(invoiceData.map(invoice => invoice.actingProvider).filter(Boolean))).map((provider) => (
                        <SelectItem key={provider} value={provider}>
                          {provider}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  <Button
                    onClick={() => {
                      setSearchTerm("");
                      setStatusFilter("all");
                      setSalesRepFilter("all");
                      setProviderFilter("all");
                      setDateRange("all");
                      setCustomStartDate("");
                      setCustomEndDate("");
                    }}
                    variant="outline"
                  >
                    Clear Filters
                  </Button>

                  <Button
                    onClick={() => {
                      const csvContent = [
                        'Invoice No,Patient Name,Provider,Sales Rep,Invoice Date,Due Date,Amount,Status,Days Outstanding',
                        ...filteredInvoices.map(inv => 
                          `"${inv.invoiceNo || ''}","${inv.patientName}","${inv.actingProvider || ''}","${inv.salesRep}","${inv.invoiceDate || ''}","${inv.payableDate || ''}","$${parseFloat(inv.invoiceTotal || '0').toFixed(2)}","${inv.invoiceStatus}","${inv.daysOutstanding || 0}"`
                        )
                      ].join('\n');

                      const blob = new Blob([csvContent], { type: 'text/csv' });
                      const url = URL.createObjectURL(blob);
                      const a = document.createElement('a');
                      a.href = url;
                      a.download = `invoices-${format(new Date(), 'yyyy-MM-dd')}.csv`;
                      a.click();
                      URL.revokeObjectURL(url);
                    }}
                    variant="outline"
                  >
                    <Download className="h-4 w-4 mr-2" />
                    Export CSV
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* Invoice Table */}
            <Card>
              <CardHeader>
                <CardTitle>Invoices ({filteredInvoices.length})</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Invoice #</TableHead>
                        <TableHead>Patient</TableHead>
                        <TableHead>Provider</TableHead>
                        <TableHead>Sales Rep</TableHead>
                        <TableHead>Date</TableHead>
                        <TableHead>Due Date</TableHead>
                        <TableHead>Amount</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Days Out</TableHead>
                        <TableHead>Commission</TableHead>
                        <TableHead>Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredInvoices.map((invoice) => (
                        <TableRow key={invoice.id}>
                          <TableCell className="font-medium">{invoice.invoiceNo || `INV-${invoice.id}`}</TableCell>
                          <TableCell>{invoice.patientName}</TableCell>
                          <TableCell>{invoice.actingProvider || 'N/A'}</TableCell>
                          <TableCell>{invoice.salesRep}</TableCell>
                          <TableCell>
                            {invoice.invoiceDate ? format(parseISO(invoice.invoiceDate), 'MMM dd, yyyy') : 'N/A'}
                          </TableCell>
                          <TableCell>
                            {invoice.payableDate ? format(parseISO(invoice.payableDate), 'MMM dd, yyyy') : 'N/A'}
                          </TableCell>
                          <TableCell>${parseFloat(invoice.invoiceTotal || '0').toLocaleString()}</TableCell>
                          <TableCell>{getStatusBadge(invoice.invoiceStatus, invoice.isOverdue || false)}</TableCell>
                          <TableCell>
                            <span className={invoice.isOverdue ? 'text-red-600 font-semibold' : ''}>
                              {invoice.daysOutstanding || 0}
                            </span>
                          </TableCell>
                          <TableCell>
                            {invoice.invoiceStatus === 'closed' ? (
                              <Badge variant="outline" className="border-green-500 text-green-700 whitespace-nowrap">
                                In Reports
                              </Badge>
                            ) : (
                              <Badge variant="secondary" className="whitespace-nowrap">
                                Pending
                              </Badge>
                            )}
                          </TableCell>
                          <TableCell>
                            <Select
                              value={invoice.invoiceStatus}
                              onValueChange={(status) => handleStatusChange(invoice, status)}
                            >
                              <SelectTrigger className="w-24">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="open">Open</SelectItem>
                                <SelectItem value="payable">Payable</SelectItem>
                                <SelectItem value="closed">Paid</SelectItem>
                              </SelectContent>
                            </Select>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="commissions" className="space-y-6">
            {/* Commission Dashboard */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Total Commission</CardTitle>
                  <DollarSign className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-green-600">
                    ${commissionSummary.totalCommission.toLocaleString()}
                  </div>
                  <p className="text-xs text-muted-foreground">{commissionSummary.totalInvoices} invoices</p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Sales Reps</CardTitle>
                  <Users className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{commissionSummary.uniqueReps}</div>
                  <p className="text-xs text-muted-foreground">with commissions</p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Multi-Rep</CardTitle>
                  <TrendingUp className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    {filteredCommissionReports.filter(r => !r.isLegacy).length}
                  </div>
                  <p className="text-xs text-muted-foreground">new system</p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Legacy</CardTitle>
                  <FileText className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    {filteredCommissionReports.filter(r => r.isLegacy).length}
                  </div>
                  <p className="text-xs text-muted-foreground">historical</p>
                </CardContent>
              </Card>
            </div>

            {/* Filters */}
            <Card>
              <CardHeader>
                <CardTitle>Commission Filters</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  <div>
                    <Label>Date Range</Label>
                    <Select value={commissionDateRange} onValueChange={setCommissionDateRange}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select date range" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Time</SelectItem>
                        <SelectItem value="current_month">Current Month</SelectItem>
                        <SelectItem value="last_month">Last Month</SelectItem>
                        <SelectItem value="last_3_months">Last 3 Months</SelectItem>
                        <SelectItem value="last_6_months">Last 6 Months</SelectItem>
                        <SelectItem value="custom">Custom Range</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label>Sales Rep</Label>
                    <Select value={selectedSalesRep} onValueChange={setSelectedSalesRep}>
                      <SelectTrigger>
                        <SelectValue placeholder="All Sales Reps" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Sales Reps</SelectItem>
                        {salesReps.map((rep) => (
                          <SelectItem key={rep.id} value={rep.name || ''}>
                            {rep.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {commissionDateRange === "custom" && (
                    <>
                      <div>
                        <Label>Start Date</Label>
                        <Input
                          type="date"
                          value={customStartDate}
                          onChange={(e) => setCustomStartDate(e.target.value)}
                        />
                      </div>
                      <div>
                        <Label>End Date</Label>
                        <Input
                          type="date"
                          value={customEndDate}
                          onChange={(e) => setCustomEndDate(e.target.value)}
                        />
                      </div>
                    </>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Commission Reports */}
            <Card>
              <CardHeader>
                <div className="flex justify-between items-center">
                  <CardTitle>Commission Reports</CardTitle>
                  <Button onClick={exportCommissionReport} variant="outline">
                    <Download className="h-4 w-4 mr-2" />
                    Export CSV
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {isLoadingCommissions ? (
                  <div className="flex items-center justify-center py-8">
                    <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
                  </div>
                ) : filteredCommissionReports.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    No commission data found for the selected filters.
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Sales Rep</TableHead>
                          <TableHead>Invoice No.</TableHead>
                          <TableHead>Paid Date</TableHead>
                          <TableHead>Commission Rate</TableHead>
                          <TableHead>Commission Amount</TableHead>
                          <TableHead>Type</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filteredCommissionReports.map((report, index) => (
                          <TableRow key={index}>
                            <TableCell className="font-medium">{report.repName}</TableCell>
                            <TableCell>
                              <Badge variant="outline">
                                {report.invoiceNo}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              {format(parseISO(report.paidAt), 'MMM dd, yyyy')}
                            </TableCell>
                            <TableCell>{report.commissionRate.toFixed(2)}%</TableCell>
                            <TableCell className="font-semibold text-green-600">
                              ${report.commissionAmount.toLocaleString()}
                            </TableCell>
                            <TableCell>
                              <Badge variant={report.isLegacy ? "secondary" : "default"}>
                                {report.isLegacy ? 'Legacy' : 'Multi-Rep'}
                              </Badge>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* Payment Date Dialog */}
        <Dialog open={isPaymentDialogOpen} onOpenChange={setIsPaymentDialogOpen}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Mark Invoice as Paid</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label className="text-sm font-medium">Invoice Details</Label>
                <div className="text-sm text-muted-foreground mt-1">
                  {selectedInvoice && (
                    <>
                      <div>Invoice #{selectedInvoice.invoiceNo || `INV-${selectedInvoice.id}`}</div>
                      <div>Patient: {selectedInvoice.patientName}</div>
                      <div>Amount: ${parseFloat(selectedInvoice.invoiceTotal || '0').toLocaleString()}</div>
                    </>
                  )}
                </div>
              </div>
              <div>
                <Label htmlFor="payment-date" className="text-sm font-medium">
                  Payment Date
                </Label>
                <Input
                  id="payment-date"
                  type="date"
                  value={paymentDate}
                  onChange={(e) => setPaymentDate(e.target.value)}
                  className="mt-1"
                />
                <div className="text-xs text-muted-foreground mt-1">
                  This date determines which commission payment period the invoice belongs to
                </div>
              </div>
            </div>
            <DialogFooter className="flex gap-2">
              <Button 
                variant="outline" 
                onClick={() => setIsPaymentDialogOpen(false)}
              >
                Cancel
              </Button>
              <Button 
                onClick={confirmPayment}
                disabled={!paymentDate || updateInvoiceStatusMutation.isPending}
              >
                {updateInvoiceStatusMutation.isPending ? "Processing..." : "Confirm Payment"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}