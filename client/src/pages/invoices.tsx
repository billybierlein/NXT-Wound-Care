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
    invoiceTotal: string;
    invoiceDate: string;
    treatmentDate: string;
    payableDate: string;
    salesRepId: number;
    salesRepName: string;
    commissionRate: string;
    commissionAmount: string;
    createdAt: string;
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
        ? differenceInDays(new Date(), parseISO(typeof treatment.payableDate === 'string' ? treatment.payableDate : treatment.payableDate.toISOString()))
        : 0;
      
      const isOverdue = treatment.payableDate 
        ? isAfter(new Date(), parseISO(typeof treatment.payableDate === 'string' ? treatment.payableDate : treatment.payableDate.toISOString())) && treatment.invoiceStatus !== 'closed'
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
        const invoiceDate = parseISO(invoice.invoiceDate || invoice.treatmentDate);
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
      const invoiceDate = parseISO(inv.invoiceDate || inv.treatmentDate);
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

  // Generate commission payment periods using the new multi-rep commission reports data
  const commissionPeriods = useMemo(() => {
    const periods: CommissionPaymentPeriod[] = [];
    
    if (!commissionReportsData || commissionReportsData.length === 0) {
      return periods;
    }
    
    // Group commission reports by sales rep
    const salesRepGroups = commissionReportsData.reduce((groups, report) => {
      if (!groups[report.salesRepName]) {
        groups[report.salesRepName] = [];
      }
      groups[report.salesRepName].push(report);
      return groups;
    }, {} as Record<string, CommissionReport[]>);

    // Generate periods for each sales rep
    Object.entries(salesRepGroups).forEach(([salesRep, reports]) => {
      // Current month periods
      const currentMonth = new Date();
      const monthStart = startOfMonth(currentMonth);
      const monthMid = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), 15);
      const monthEnd = endOfMonth(currentMonth);

      // First period: 1st to 15th (paid on 15th)
      const firstPeriodReports = reports.filter(report => {
        const referenceDate = parseISO(report.invoiceDate || report.treatmentDate);
        return isAfter(referenceDate, monthStart) && isBefore(referenceDate, addDays(monthMid, 1));
      });

      if (firstPeriodReports.length > 0) {
        // Create mock invoice objects for the period
        const mockInvoices = firstPeriodReports.map(report => ({
          ...report,
          salesRepCommission: report.commissionAmount,
          salesRepCommissionRate: report.commissionRate,
          salesRep: report.salesRepName
        }));

        periods.push({
          periodStart: monthStart,
          periodEnd: monthMid,
          paymentDate: monthMid,
          salesRep,
          totalCommission: firstPeriodReports.reduce((sum, report) => sum + parseFloat(report.commissionAmount), 0),
          invoiceCount: firstPeriodReports.length,
          invoices: mockInvoices
        });
      }

      // Second period: 16th to end of month (paid on last day)
      const secondPeriodReports = reports.filter(report => {
        const referenceDate = parseISO(report.invoiceDate || report.treatmentDate);
        return isAfter(referenceDate, monthMid) && isBefore(referenceDate, addDays(monthEnd, 1));
      });

      if (secondPeriodReports.length > 0) {
        // Create mock invoice objects for the period
        const mockInvoices = secondPeriodReports.map(report => ({
          ...report,
          salesRepCommission: report.commissionAmount,
          salesRepCommissionRate: report.commissionRate,
          salesRep: report.salesRepName
        }));

        periods.push({
          periodStart: addDays(monthMid, 1),
          periodEnd: monthEnd,
          paymentDate: monthEnd,
          salesRep,
          totalCommission: secondPeriodReports.reduce((sum, report) => sum + parseFloat(report.commissionAmount), 0),
          invoiceCount: secondPeriodReports.length,
          invoices: mockInvoices
        });
      }
    });

    return periods.sort((a, b) => b.paymentDate.getTime() - a.paymentDate.getTime());
  }, [commissionReportsData]);

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

  const exportCommissionReport = (period?: CommissionPaymentPeriod) => {
    const dataToExport = period ? [period] : commissionPeriods;
    
    // Create detailed CSV with individual invoice line items
    const csvRows = [
      'Sales Rep,Payment Date,Period Start,Period End,Invoice No.,Invoice Amount,Commission Rate,Commission Amount'
    ];
    
    dataToExport.forEach(period => {
      period.invoices.forEach(invoice => {
        const commissionRate = parseFloat(invoice.salesRepCommissionRate || '0');
        const commissionAmount = parseFloat(invoice.salesRepCommission || '0');
        const invoiceAmount = parseFloat(invoice.invoiceTotal || '0');
        
        csvRows.push([
          `"${period.salesRep}"`,
          `"${format(period.paymentDate, 'yyyy-MM-dd')}"`,
          `"${format(period.periodStart, 'yyyy-MM-dd')}"`,
          `"${format(period.periodEnd, 'yyyy-MM-dd')}"`,
          `"${invoice.invoiceNo || 'N/A'}"`,
          `"$${invoiceAmount.toFixed(2)}"`,
          `"${commissionRate.toFixed(2)}%"`,
          `"$${commissionAmount.toFixed(2)}"`
        ].join(','));
      });
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
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Next Payment (15th)</CardTitle>
                  <Calendar className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    {format(new Date(new Date().getFullYear(), new Date().getMonth(), 15), 'MMM dd')}
                  </div>
                  <p className="text-xs text-muted-foreground">Mid-month payment</p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Next Payment (End)</CardTitle>
                  <Calendar className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    {format(endOfMonth(new Date()), 'MMM dd')}
                  </div>
                  <p className="text-xs text-muted-foreground">Month-end payment</p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Total Periods</CardTitle>
                  <Banknote className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{commissionPeriods.length}</div>
                  <p className="text-xs text-muted-foreground">Payment periods</p>
                </CardContent>
              </Card>
            </div>

            {/* Commission Export */}
            <Card>
              <CardHeader>
                <div className="flex justify-between items-center">
                  <CardTitle>Commission Payment Periods</CardTitle>
                  <Button onClick={() => exportCommissionReport()} variant="outline">
                    <Download className="h-4 w-4 mr-2" />
                    Export All
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Sales Rep</TableHead>
                        <TableHead>Payment Date</TableHead>
                        <TableHead>Period</TableHead>
                        <TableHead>Commission</TableHead>
                        <TableHead>Invoices</TableHead>
                        <TableHead>Date Paid</TableHead>
                        <TableHead>Reference</TableHead>
                        <TableHead>Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {commissionPeriods.map((period, index) => {
                        const periodKey = `${period.salesRep}-${format(period.paymentDate, 'yyyy-MM-dd')}`;
                        const paymentInfo = commissionPayments[periodKey] || { datePaid: '', reference: '' };
                        
                        return (
                          <TableRow key={index}>
                            <TableCell className="font-medium">{period.salesRep}</TableCell>
                            <TableCell>
                              <Badge variant="outline">
                                {format(period.paymentDate, 'MMM dd, yyyy')}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              {format(period.periodStart, 'MMM dd')} - {format(period.periodEnd, 'MMM dd')}
                            </TableCell>
                            <TableCell className="font-semibold text-green-600">
                              ${period.totalCommission.toLocaleString()}
                            </TableCell>
                            <TableCell>{period.invoiceCount}</TableCell>
                            <TableCell>
                              <Input
                                type="date"
                                value={paymentInfo.datePaid}
                                onChange={(e) => setCommissionPayments(prev => ({
                                  ...prev,
                                  [periodKey]: { ...paymentInfo, datePaid: e.target.value }
                                }))}
                                placeholder="Date paid"
                                className="w-32 text-xs"
                              />
                            </TableCell>
                            <TableCell>
                              <Input
                                value={paymentInfo.reference}
                                onChange={(e) => setCommissionPayments(prev => ({
                                  ...prev,
                                  [periodKey]: { ...paymentInfo, reference: e.target.value }
                                }))}
                                placeholder="Check/Bank ref"
                                className="w-28 text-xs"
                              />
                            </TableCell>
                            <TableCell>
                              <Button
                                onClick={() => exportCommissionReport(period)}
                                variant="outline"
                                size="sm"
                              >
                                <Download className="h-4 w-4" />
                              </Button>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
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