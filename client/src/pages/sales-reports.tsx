import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAuth } from "@/hooks/useAuth";
import { Loader2, DollarSign, FileText, CheckCircle, XCircle, Users, TrendingUp, Calendar } from "lucide-react";
import { Bar, BarChart, ResponsiveContainer, XAxis, YAxis, CartesianGrid, Tooltip } from "recharts";
import Navigation from "@/components/ui/navigation";
import { format, parseISO, isAfter, isBefore } from "date-fns";
import { Link } from "wouter";

interface Treatment {
  id: number;
  patientId: number;
  userId: number;
  treatmentNumber: number;
  woundSizeAtTreatment: string;
  skinGraftType: string;
  qCode: string;
  pricePerSqCm: string;
  totalRevenue: string;
  invoiceTotal: string;
  nxtCommission: string;
  salesRepCommissionRate: string;
  salesRepCommission: string;
  treatmentDate: string;
  status: string;
  actingProvider: string;
  notes: string;
  invoiceStatus: string;
  invoiceDate: string | null;
  invoiceNo: string | null;
  payableDate: string | null;
  totalCommission: number | null;
  createdAt: string;
  updatedAt: string;
  patientName?: string;
  salesRepName?: string;
}

interface Patient {
  id: number;
  firstName: string;
  lastName: string;
  patientStatus: string;
  woundSize: string | null;
  salesRep: string;
  createdAt: string;
  woundType: string;
  insurance: string;
  customInsurance: string | null;
  referralSource: string;
  provider: string;
}

export default function SalesReports() {
  const { user } = useAuth();
  const [activeDateRange, setActiveDateRange] = useState({
    startDate: '',
    endDate: ''
  });
  const [completedDateRange, setCompletedDateRange] = useState({
    startDate: '',
    endDate: ''
  });
  const [chartDateRange, setChartDateRange] = useState({
    startDate: '',
    endDate: ''
  });
  const [selectedSalesRep, setSelectedSalesRep] = useState<string>('all');
  
  const { data: treatments = [], isLoading: treatmentsLoading } = useQuery<Treatment[]>({
    queryKey: ["/api/treatments/all"],
    refetchInterval: 10000,
  });

  const { data: patients = [], isLoading: patientsLoading } = useQuery<Patient[]>({
    queryKey: ["/api/patients"],
    refetchInterval: 10000,
  });

  // Fetch sales reps for admin filter
  const { data: salesReps = [] } = useQuery({
    queryKey: ["/api/sales-reps"],
    enabled: true  // Always fetch, but only use for admin
  });

  if (treatmentsLoading || patientsLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-border" />
      </div>
    );
  }

  // Filter treatments based on user role and selected sales rep
  const userTreatments = treatments.filter(treatment => {
    if ((user as any)?.role === 'admin') {
      if (selectedSalesRep === 'all') {
        return true; // Admin sees all treatments when 'all' selected
      } else {
        // Admin sees treatments for selected sales rep only
        const salesRepPatients = patients.filter(p => p.salesRep === selectedSalesRep);
        const salesRepPatientIds = salesRepPatients.map(p => p.id);
        return salesRepPatientIds.includes(treatment.patientId);
      }
    } else {
      // Sales rep sees treatments for their patients only (backend filtering applies)
      return true;
    }
  });

  // Filter patients based on user role and selected sales rep
  const userPatients = (user as any)?.role === 'admin' 
    ? (selectedSalesRep === 'all' 
        ? patients 
        : patients.filter(patient => patient.salesRep === selectedSalesRep))
    : patients.filter(patient => patient.salesRep === (user as any)?.salesRepName || patient.salesRep === `${(user as any)?.firstName} ${(user as any)?.lastName}`);

  // Calculate Patient Pipeline metrics for Evaluation Stage patients
  const evaluationStagePatients = userPatients.filter(patient => patient.patientStatus === 'Evaluation Stage');
  const evaluationStageCount = evaluationStagePatients.length;
  const evaluationStageTotalWoundSize = evaluationStagePatients.reduce((sum, patient) => {
    return sum + (parseFloat(patient.woundSize || '0') || 0);
  }, 0);

  // Helper function to check if treatment date is within range for active treatments
  const isWithinActiveDateRange = (treatmentDate: string) => {
    if (!activeDateRange.startDate && !activeDateRange.endDate) return true;
    
    // Extract just the date part for comparison (YYYY-MM-DD format)
    const treatmentDateString = treatmentDate.split('T')[0]; // Get date part only
    const startDateString = activeDateRange.startDate;
    const endDateString = activeDateRange.endDate;
    
    if (startDateString && treatmentDateString < startDateString) return false;
    if (endDateString && treatmentDateString > endDateString) return false;
    
    return true;
  };

  // Helper function to check if treatment date is within range for completed treatments
  const isWithinCompletedDateRange = (treatmentDate: string) => {
    if (!completedDateRange.startDate && !completedDateRange.endDate) return true;
    
    // Extract just the date part for comparison (YYYY-MM-DD format)
    const treatmentDateString = treatmentDate.split('T')[0]; // Get date part only
    const startDateString = completedDateRange.startDate;
    const endDateString = completedDateRange.endDate;
    
    if (startDateString && treatmentDateString < startDateString) return false;
    if (endDateString && treatmentDateString > endDateString) return false;
    
    return true;
  };

  // Calculate Active Treatments metrics with date filtering
  const filteredActiveTreatments = userTreatments.filter(treatment => 
    treatment.status === 'active' && isWithinActiveDateRange(treatment.treatmentDate)
  );
  const activeTreatmentsCount = filteredActiveTreatments.length;
  const activeTreatmentsTotalWoundSize = filteredActiveTreatments.reduce((sum, treatment) => {
    return sum + (parseFloat(treatment.woundSizeAtTreatment) || 0);
  }, 0);
  const activeTreatmentsTotalInvoiceAmount = filteredActiveTreatments.reduce((sum, treatment) => {
    return sum + (parseFloat(treatment.invoiceTotal) || 0);
  }, 0);
  const activeTreatmentsTotalCommission = filteredActiveTreatments.reduce((sum, treatment) => {
    if ((user as any)?.role === 'admin') {
      return sum + (parseFloat(treatment.nxtCommission) || 0);
    } else {
      return sum + (parseFloat(treatment.salesRepCommission) || 0);
    }
  }, 0);

  // Calculate Completed Treatments metrics with date filtering
  const filteredCompletedTreatments = userTreatments.filter(treatment => 
    treatment.status === 'completed' && isWithinCompletedDateRange(treatment.treatmentDate)
  );
  const completedTreatmentsCount = filteredCompletedTreatments.length;
  const completedTreatmentsTotalWoundSize = filteredCompletedTreatments.reduce((sum, treatment) => {
    return sum + (parseFloat(treatment.woundSizeAtTreatment) || 0);
  }, 0);
  const completedTreatmentsTotalInvoiceAmount = filteredCompletedTreatments.reduce((sum, treatment) => {
    return sum + (parseFloat(treatment.invoiceTotal) || 0);
  }, 0);
  const completedTreatmentsTotalCommission = filteredCompletedTreatments.reduce((sum, treatment) => {
    if ((user as any)?.role === 'admin') {
      return sum + (parseFloat(treatment.nxtCommission) || 0);
    } else {
      return sum + (parseFloat(treatment.salesRepCommission) || 0);
    }
  }, 0);

  // Calculate total squares (active + completed)
  const totalSquares = activeTreatmentsTotalWoundSize + completedTreatmentsTotalWoundSize;

  // Clear date range functions
  const clearActiveDateRange = () => {
    setActiveDateRange({ startDate: '', endDate: '' });
  };

  const clearCompletedDateRange = () => {
    setCompletedDateRange({ startDate: '', endDate: '' });
  };

  const clearChartDateRange = () => {
    setChartDateRange({ startDate: '', endDate: '' });
  };

  // Calculate invoice status counts
  const openInvoices = userTreatments.filter(t => t.invoiceStatus === 'open').length;
  const payableInvoices = userTreatments.filter(t => t.invoiceStatus === 'payable').length;
  const closedInvoices = userTreatments.filter(t => t.invoiceStatus === 'closed').length;

  // Calculate total invoice amounts by status
  const openInvoiceAmount = userTreatments
    .filter(t => t.invoiceStatus === 'open')
    .reduce((sum, t) => sum + (parseFloat(t.invoiceTotal) || 0), 0);
  
  const payableInvoiceAmount = userTreatments
    .filter(t => t.invoiceStatus === 'payable')
    .reduce((sum, t) => sum + (parseFloat(t.invoiceTotal) || 0), 0);
  
  const closedInvoiceAmount = userTreatments
    .filter(t => t.invoiceStatus === 'closed')
    .reduce((sum, t) => sum + (parseFloat(t.invoiceTotal) || 0), 0);

  // Helper function to check if treatment date is within chart date range
  const isWithinChartDateRange = (treatmentDate: string) => {
    if (!chartDateRange.startDate && !chartDateRange.endDate) return true;
    
    const treatmentDateObj = new Date(treatmentDate);
    const startDateObj = chartDateRange.startDate ? new Date(chartDateRange.startDate) : null;
    const endDateObj = chartDateRange.endDate ? new Date(chartDateRange.endDate) : null;
    
    if (startDateObj && treatmentDateObj < startDateObj) return false;
    if (endDateObj && treatmentDateObj > endDateObj) return false;
    
    return true;
  };

  // Create chart data for treatment sizes with active vs completed breakdown
  const sizeRanges = ['0-5 sq cm', '6-10 sq cm', '11-20 sq cm', '21-50 sq cm', '50+ sq cm'];
  
  const treatmentSizeData = sizeRanges.map(range => {
    const rangeMin = range === '0-5 sq cm' ? 0 : 
                    range === '6-10 sq cm' ? 6 :
                    range === '11-20 sq cm' ? 11 :
                    range === '21-50 sq cm' ? 21 : 51;
    const rangeMax = range === '0-5 sq cm' ? 5 : 
                    range === '6-10 sq cm' ? 10 :
                    range === '11-20 sq cm' ? 20 :
                    range === '21-50 sq cm' ? 50 : 999;

    const activeTreatments = userTreatments.filter(treatment => {
      const woundSize = parseFloat(treatment.woundSizeAtTreatment) || 0;
      return treatment.status === 'active' && 
             woundSize >= rangeMin && 
             woundSize <= rangeMax &&
             isWithinChartDateRange(treatment.treatmentDate);
    });

    const completedTreatments = userTreatments.filter(treatment => {
      const woundSize = parseFloat(treatment.woundSizeAtTreatment) || 0;
      return treatment.status === 'completed' && 
             woundSize >= rangeMin && 
             woundSize <= rangeMax &&
             isWithinChartDateRange(treatment.treatmentDate);
    });

    return {
      range,
      active: activeTreatments.length,
      completed: completedTreatments.length
    };
  });

  // Create monthly data for squares
  const monthlySquaresData = (() => {
    const monthlyData: { [key: string]: number } = {};
    
    userTreatments.forEach(treatment => {
      const treatmentDate = new Date(treatment.treatmentDate);
      const monthKey = treatmentDate.toLocaleDateString('en-US', { 
        year: 'numeric', 
        month: 'short' 
      });
      const woundSize = parseFloat(treatment.woundSizeAtTreatment) || 0;
      
      if (!monthlyData[monthKey]) {
        monthlyData[monthKey] = 0;
      }
      monthlyData[monthKey] += woundSize;
    });
    
    return Object.entries(monthlyData)
      .map(([month, squares]) => ({ month, squares }))
      .sort((a, b) => new Date(a.month + ' 1, 2000').getTime() - new Date(b.month + ' 1, 2000').getTime())
      .slice(-12); // Show last 12 months
  })();

  return (
    <div className="min-h-screen bg-gray-50">
      <Navigation />
      
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Sales Reports</h1>
              <p className="text-gray-600 mt-2">View your sales performance and invoice analytics</p>
            </div>
            
            {/* Admin Sales Rep Filter */}
            {(user as any)?.role === 'admin' && (
              <div className="mt-4 sm:mt-0">
                <div className="flex items-center gap-2">
                  <Label htmlFor="salesRepFilter" className="text-sm font-medium whitespace-nowrap">View Sales Rep:</Label>
                  <Select value={selectedSalesRep} onValueChange={setSelectedSalesRep}>
                    <SelectTrigger className="w-48">
                      <SelectValue placeholder="Select sales rep" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Sales Reps</SelectItem>
                      {(salesReps as any[]).map((rep: any) => (
                        <SelectItem key={rep.id} value={rep.name}>
                          {rep.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Total Squares Summary - Admin Only */}
        {(user as any)?.role === 'admin' && (
          <Card className="mb-8">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5" />
                Overall Squares Summary
              </CardTitle>
              <p className="text-sm text-muted-foreground">
                Combined active and completed treatment squares
              </p>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-6">
                <div className="flex items-center justify-between p-4 border rounded-lg bg-green-50 border-green-200">
                  <div className="flex items-center">
                    <TrendingUp className="h-8 w-8 text-green-600 mr-3" />
                    <div>
                      <p className="text-sm font-medium text-green-600">Total Squares</p>
                      <p className="text-2xl font-bold text-green-900">{totalSquares.toFixed(1)} sq cm</p>
                    </div>
                  </div>
                </div>
                
                <div className="flex items-center justify-between p-4 border rounded-lg bg-blue-50 border-blue-200">
                  <div className="flex items-center">
                    <FileText className="h-8 w-8 text-blue-600 mr-3" />
                    <div>
                      <p className="text-sm font-medium text-blue-600">Active Squares</p>
                      <p className="text-2xl font-bold text-blue-900">{activeTreatmentsTotalWoundSize.toFixed(1)} sq cm</p>
                    </div>
                  </div>
                </div>
                
                <div className="flex items-center justify-between p-4 border rounded-lg bg-gray-50 border-gray-200">
                  <div className="flex items-center">
                    <CheckCircle className="h-8 w-8 text-gray-600 mr-3" />
                    <div>
                      <p className="text-sm font-medium text-gray-600">Completed Squares</p>
                      <p className="text-2xl font-bold text-gray-900">{completedTreatmentsTotalWoundSize.toFixed(1)} sq cm</p>
                    </div>
                  </div>
                </div>
                
                <div className="flex items-center justify-between p-4 border rounded-lg bg-purple-50 border-purple-200">
                  <div className="flex items-center">
                    <DollarSign className="h-8 w-8 text-purple-600 mr-3" />
                    <div>
                      <p className="text-sm font-medium text-purple-600">Total Revenue</p>
                      <p className="text-2xl font-bold text-purple-900">${(activeTreatmentsTotalInvoiceAmount + completedTreatmentsTotalInvoiceAmount).toLocaleString()}</p>
                    </div>
                  </div>
                </div>
              </div>
              
              {/* Monthly Squares Bar Chart */}
              <div className="mt-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Squares by Month (Last 12 Months)</h3>
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={monthlySquaresData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis 
                        dataKey="month" 
                        tick={{ fontSize: 12 }}
                        angle={-45}
                        textAnchor="end"
                        height={60}
                      />
                      <YAxis 
                        tick={{ fontSize: 12 }}
                        label={{ value: 'Square cm', angle: -90, position: 'insideLeft' }}
                      />
                      <Tooltip 
                        formatter={(value: any) => [`${value.toFixed(1)} sq cm`, 'Squares']}
                        labelFormatter={(label) => `Month: ${label}`}
                      />
                      <Bar 
                        dataKey="squares" 
                        fill="#10b981" 
                        name="Squares"
                        radius={[4, 4, 0, 0]}
                      />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Active Treatments Section */}
        <Card className="mb-8">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5" />
              Active Treatments
            </CardTitle>
            <p className="text-sm text-muted-foreground">
              Summary of ongoing treatments for your patients
            </p>
            
            {/* Date Range Filter */}
            <div className="flex flex-col sm:flex-row gap-4 mt-4 p-4 bg-gray-50 rounded-lg">
              <div className="flex-1">
                <Label htmlFor="activeStartDate" className="text-sm font-medium">Start Date</Label>
                <Input
                  id="activeStartDate"
                  type="date"
                  value={activeDateRange.startDate}
                  onChange={(e) => setActiveDateRange(prev => ({ ...prev, startDate: e.target.value }))}
                  className="mt-1"
                />
              </div>
              <div className="flex-1">
                <Label htmlFor="activeEndDate" className="text-sm font-medium">End Date</Label>
                <Input
                  id="activeEndDate"
                  type="date"
                  value={activeDateRange.endDate}
                  onChange={(e) => setActiveDateRange(prev => ({ ...prev, endDate: e.target.value }))}
                  className="mt-1"
                />
              </div>
              <div className="flex items-end">
                <Button 
                  variant="outline" 
                  onClick={clearActiveDateRange}
                  className="text-sm"
                >
                  Clear Filter
                </Button>
              </div>
            </div>
            
            {activeDateRange.startDate || activeDateRange.endDate ? (
              <div className="text-sm text-blue-600 mt-2">
                Filtered by treatment date: {activeDateRange.startDate || 'Any'} to {activeDateRange.endDate || 'Any'}
              </div>
            ) : null}
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              <div className="flex items-center justify-between p-4 border rounded-lg bg-blue-50 border-blue-200">
                <div className="flex items-center">
                  <FileText className="h-8 w-8 text-blue-600 mr-3" />
                  <div>
                    <p className="text-sm font-medium text-blue-600">Active Treatments</p>
                    <p className="text-2xl font-bold text-blue-900">{activeTreatmentsCount}</p>
                  </div>
                </div>
              </div>
              
              <div className="flex items-center justify-between p-4 border rounded-lg bg-orange-50 border-orange-200">
                <div className="flex items-center">
                  <TrendingUp className="h-8 w-8 text-orange-600 mr-3" />
                  <div>
                    <p className="text-sm font-medium text-orange-600">Total Wound Size</p>
                    <p className="text-2xl font-bold text-orange-900">{activeTreatmentsTotalWoundSize.toFixed(1)} sq cm</p>
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-between p-4 border rounded-lg bg-purple-50 border-purple-200">
                <div className="flex items-center">
                  <DollarSign className="h-8 w-8 text-purple-600 mr-3" />
                  <div>
                    <p className="text-sm font-medium text-purple-600">Estimated Invoice Amount</p>
                    <p className="text-2xl font-bold text-purple-900">${activeTreatmentsTotalInvoiceAmount.toLocaleString()}</p>
                  </div>
                </div>
              </div>

              <div className={`flex items-center justify-between p-4 border rounded-lg ${(user as any)?.role === 'admin' ? 'bg-orange-50 border-orange-200' : 'bg-blue-50 border-blue-200'}`}>
                <div className="flex items-center">
                  <DollarSign className={`h-8 w-8 mr-3 ${(user as any)?.role === 'admin' ? 'text-orange-600' : 'text-blue-600'}`} />
                  <div>
                    <p className={`text-sm font-medium ${(user as any)?.role === 'admin' ? 'text-orange-600' : 'text-blue-600'}`}>
                      {(user as any)?.role === 'admin' ? 'Est. NXT Commission' : 'Est. Your Commission'}
                    </p>
                    <p className={`text-2xl font-bold ${(user as any)?.role === 'admin' ? 'text-orange-900' : 'text-blue-900'}`}>
                      ${activeTreatmentsTotalCommission.toLocaleString()}
                    </p>
                  </div>
                </div>
              </div>
            </div>
            
            {/* Active Treatments Table */}
            {filteredActiveTreatments.length > 0 && (
              <div className="mt-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Active Treatment Details</h3>
                <div className="border rounded-lg overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Patient</TableHead>
                        <TableHead>Treatment Date</TableHead>
                        <TableHead>Wound Size</TableHead>
                        <TableHead>Graft Type</TableHead>
                        <TableHead>Q Code</TableHead>
                        <TableHead>Price/sq cm</TableHead>
                        <TableHead>Invoice Total</TableHead>
                        <TableHead>{(user as any)?.role === 'admin' ? 'NXT Commission' : 'Your Commission'}</TableHead>
                        {(user as any)?.role === 'admin' && <TableHead>Sales Rep</TableHead>}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredActiveTreatments.map((treatment) => {
                        const patient = (patients as any[]).find(p => p.id === treatment.patientId);
                        return (
                          <TableRow key={treatment.id}>
                            <TableCell>
                              <div className="font-medium">
                                <Link href={`/patient-profile/${treatment.patientId}`} className="text-blue-600 hover:text-blue-800">
                                  {treatment.patientName || `${patient?.firstName || ''} ${patient?.lastName || ''}`.trim() || 'Unknown Patient'}
                                </Link>
                              </div>
                            </TableCell>
                            <TableCell>{format(parseISO(treatment.treatmentDate), "MM/dd/yyyy")}</TableCell>
                            <TableCell>{treatment.woundSizeAtTreatment ? `${treatment.woundSizeAtTreatment} sq cm` : 'Not specified'}</TableCell>
                            <TableCell>
                              <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">
                                {treatment.skinGraftType || 'Not specified'}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              <Badge variant="outline" className="bg-purple-50 text-purple-700 border-purple-200">
                                {treatment.qCode || 'Not assigned'}
                              </Badge>
                            </TableCell>
                            <TableCell className="font-medium text-green-600">
                              ${(Number(treatment.pricePerSqCm) || 0).toFixed(2)}
                            </TableCell>
                            <TableCell className="font-medium text-purple-600">
                              ${(Number(treatment.invoiceTotal) || 0).toFixed(2)}
                            </TableCell>
                            <TableCell className={`font-medium ${(user as any)?.role === 'admin' ? 'text-orange-600' : 'text-blue-600'}`}>
                              ${(user as any)?.role === 'admin' 
                                ? (Number(treatment.nxtCommission) || 0).toFixed(2)
                                : (Number(treatment.salesRepCommission) || 0).toFixed(2)
                              }
                            </TableCell>
                            {(user as any)?.role === 'admin' && (
                              <TableCell>
                                <span className="text-sm text-gray-900 font-medium">
                                  {patient?.salesRep || 'Not assigned'}
                                </span>
                              </TableCell>
                            )}
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Completed Treatments Section */}
        <Card className="mb-8">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CheckCircle className="h-5 w-5" />
              Completed Treatments
            </CardTitle>
            <p className="text-sm text-muted-foreground">
              Summary of completed treatments for your patients
            </p>
            
            {/* Date Range Filter */}
            <div className="flex flex-col sm:flex-row gap-4 mt-4 p-4 bg-gray-50 rounded-lg">
              <div className="flex-1">
                <Label htmlFor="completedStartDate" className="text-sm font-medium">Start Date</Label>
                <Input
                  id="completedStartDate"
                  type="date"
                  value={completedDateRange.startDate}
                  onChange={(e) => setCompletedDateRange(prev => ({ ...prev, startDate: e.target.value }))}
                  className="mt-1"
                />
              </div>
              <div className="flex-1">
                <Label htmlFor="completedEndDate" className="text-sm font-medium">End Date</Label>
                <Input
                  id="completedEndDate"
                  type="date"
                  value={completedDateRange.endDate}
                  onChange={(e) => setCompletedDateRange(prev => ({ ...prev, endDate: e.target.value }))}
                  className="mt-1"
                />
              </div>
              <div className="flex items-end">
                <Button 
                  variant="outline" 
                  onClick={clearCompletedDateRange}
                  className="text-sm"
                >
                  Clear Filter
                </Button>
              </div>
            </div>
            
            {completedDateRange.startDate || completedDateRange.endDate ? (
              <div className="text-sm text-green-600 mt-2">
                Filtered by treatment date: {completedDateRange.startDate || 'Any'} to {completedDateRange.endDate || 'Any'}
              </div>
            ) : null}
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              <div className="flex items-center justify-between p-4 border rounded-lg bg-green-50 border-green-200">
                <div className="flex items-center">
                  <CheckCircle className="h-8 w-8 text-green-600 mr-3" />
                  <div>
                    <p className="text-sm font-medium text-green-600">Completed Treatments</p>
                    <p className="text-2xl font-bold text-green-900">{completedTreatmentsCount}</p>
                  </div>
                </div>
              </div>
              
              <div className="flex items-center justify-between p-4 border rounded-lg bg-orange-50 border-orange-200">
                <div className="flex items-center">
                  <TrendingUp className="h-8 w-8 text-orange-600 mr-3" />
                  <div>
                    <p className="text-sm font-medium text-orange-600">Total Wound Size</p>
                    <p className="text-2xl font-bold text-orange-900">{completedTreatmentsTotalWoundSize.toFixed(1)} sq cm</p>
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-between p-4 border rounded-lg bg-purple-50 border-purple-200">
                <div className="flex items-center">
                  <DollarSign className="h-8 w-8 text-purple-600 mr-3" />
                  <div>
                    <p className="text-sm font-medium text-purple-600">Estimated Invoice Amount</p>
                    <p className="text-2xl font-bold text-purple-900">${completedTreatmentsTotalInvoiceAmount.toLocaleString()}</p>
                  </div>
                </div>
              </div>

              <div className={`flex items-center justify-between p-4 border rounded-lg ${(user as any)?.role === 'admin' ? 'bg-orange-50 border-orange-200' : 'bg-blue-50 border-blue-200'}`}>
                <div className="flex items-center">
                  <DollarSign className={`h-8 w-8 mr-3 ${(user as any)?.role === 'admin' ? 'text-orange-600' : 'text-blue-600'}`} />
                  <div>
                    <p className={`text-sm font-medium ${(user as any)?.role === 'admin' ? 'text-orange-600' : 'text-blue-600'}`}>
                      {(user as any)?.role === 'admin' ? 'Est. NXT Commission' : 'Est. Your Commission'}
                    </p>
                    <p className={`text-2xl font-bold ${(user as any)?.role === 'admin' ? 'text-orange-900' : 'text-blue-900'}`}>
                      ${completedTreatmentsTotalCommission.toLocaleString()}
                    </p>
                  </div>
                </div>
              </div>
            </div>
            
            {/* Completed Treatments Table */}
            {filteredCompletedTreatments.length > 0 && (
              <div className="mt-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Completed Treatment Details</h3>
                <div className="border rounded-lg overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Patient</TableHead>
                        <TableHead>Treatment Date</TableHead>
                        <TableHead>Wound Size</TableHead>
                        <TableHead>Graft Type</TableHead>
                        <TableHead>Q Code</TableHead>
                        <TableHead>Price/sq cm</TableHead>
                        <TableHead>Invoice Total</TableHead>
                        <TableHead>{(user as any)?.role === 'admin' ? 'NXT Commission' : 'Your Commission'}</TableHead>
                        {(user as any)?.role === 'admin' && <TableHead>Sales Rep</TableHead>}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredCompletedTreatments.map((treatment) => {
                        const patient = (patients as any[]).find(p => p.id === treatment.patientId);
                        return (
                          <TableRow key={treatment.id}>
                            <TableCell>
                              <div className="font-medium">
                                <Link href={`/patient-profile/${treatment.patientId}`} className="text-blue-600 hover:text-blue-800">
                                  {treatment.patientName || `${patient?.firstName || ''} ${patient?.lastName || ''}`.trim() || 'Unknown Patient'}
                                </Link>
                              </div>
                            </TableCell>
                            <TableCell>{format(parseISO(treatment.treatmentDate), "MM/dd/yyyy")}</TableCell>
                            <TableCell>{treatment.woundSizeAtTreatment ? `${treatment.woundSizeAtTreatment} sq cm` : 'Not specified'}</TableCell>
                            <TableCell>
                              <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">
                                {treatment.skinGraftType || 'Not specified'}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              <Badge variant="outline" className="bg-purple-50 text-purple-700 border-purple-200">
                                {treatment.qCode || 'Not assigned'}
                              </Badge>
                            </TableCell>
                            <TableCell className="font-medium text-green-600">
                              ${(Number(treatment.pricePerSqCm) || 0).toFixed(2)}
                            </TableCell>
                            <TableCell className="font-medium text-purple-600">
                              ${(Number(treatment.invoiceTotal) || 0).toFixed(2)}
                            </TableCell>
                            <TableCell className={`font-medium ${(user as any)?.role === 'admin' ? 'text-orange-600' : 'text-blue-600'}`}>
                              ${(user as any)?.role === 'admin' 
                                ? (Number(treatment.nxtCommission) || 0).toFixed(2)
                                : (Number(treatment.salesRepCommission) || 0).toFixed(2)
                              }
                            </TableCell>
                            {(user as any)?.role === 'admin' && (
                              <TableCell>
                                <span className="text-sm text-gray-900 font-medium">
                                  {patient?.salesRep || 'Not assigned'}
                                </span>
                              </TableCell>
                            )}
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Invoice Status Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <Card className="border-l-4 border-l-yellow-500">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Open Invoices</CardTitle>
              <FileText className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{openInvoices}</div>
              <p className="text-xs text-muted-foreground">
                ${openInvoiceAmount.toLocaleString()} total
              </p>
            </CardContent>
          </Card>

          <Card className="border-l-4 border-l-blue-500">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Payable Invoices</CardTitle>
              <DollarSign className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{payableInvoices}</div>
              <p className="text-xs text-muted-foreground">
                ${payableInvoiceAmount.toLocaleString()} total
              </p>
            </CardContent>
          </Card>

          <Card className="border-l-4 border-l-green-500">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Closed Invoices</CardTitle>
              <CheckCircle className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{closedInvoices}</div>
              <p className="text-xs text-muted-foreground">
                ${closedInvoiceAmount.toLocaleString()} total
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Treatment Size Distribution Chart */}
        <Card className="mb-8">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5" />
              Treatment Size Distribution
            </CardTitle>
            <p className="text-sm text-muted-foreground">
              Compare active vs completed treatments by wound size
            </p>
            
            {/* Date Range Filter */}
            <div className="flex flex-col sm:flex-row gap-4 mt-4 p-4 bg-gray-50 rounded-lg">
              <div className="flex-1">
                <Label htmlFor="chartStartDate" className="text-sm font-medium">Start Date</Label>
                <Input
                  id="chartStartDate"
                  type="date"
                  value={chartDateRange.startDate}
                  onChange={(e) => setChartDateRange(prev => ({ ...prev, startDate: e.target.value }))}
                  className="mt-1"
                />
              </div>
              <div className="flex-1">
                <Label htmlFor="chartEndDate" className="text-sm font-medium">End Date</Label>
                <Input
                  id="chartEndDate"
                  type="date"
                  value={chartDateRange.endDate}
                  onChange={(e) => setChartDateRange(prev => ({ ...prev, endDate: e.target.value }))}
                  className="mt-1"
                />
              </div>
              <div className="flex items-end">
                <Button 
                  variant="outline" 
                  onClick={clearChartDateRange}
                  className="text-sm"
                >
                  Clear Filter
                </Button>
              </div>
            </div>
            
            {chartDateRange.startDate || chartDateRange.endDate ? (
              <div className="text-sm text-purple-600 mt-2">
                Filtered by treatment date: {chartDateRange.startDate || 'Any'} to {chartDateRange.endDate || 'Any'}
              </div>
            ) : null}
          </CardHeader>
          <CardContent>
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={treatmentSizeData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis 
                    dataKey="range" 
                    fontSize={12}
                    tickLine={false}
                    axisLine={false}
                  />
                  <YAxis
                    fontSize={12}
                    tickLine={false}
                    axisLine={false}
                  />
                  <Tooltip 
                    formatter={(value: number, name: string) => [
                      `${value} treatments`, 
                      name === 'active' ? 'Active' : 'Completed'
                    ]}
                    labelFormatter={(label) => `Size: ${label}`}
                  />
                  <Bar 
                    dataKey="active" 
                    fill="#3b82f6"
                    name="active"
                    radius={[2, 2, 0, 0]}
                  />
                  <Bar 
                    dataKey="completed" 
                    fill="#10b981"
                    name="completed"
                    radius={[2, 2, 0, 0]}
                  />
                </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

        {/* Patient Pipeline Section */}
        <Card className="mb-8">
          <CardHeader>
            <CardTitle>Patient Pipeline</CardTitle>
            <p className="text-sm text-muted-foreground">
              Evaluation stage patients in your pipeline
            </p>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="flex items-center justify-between p-4 border rounded-lg bg-blue-50 border-blue-200">
                <div className="flex items-center">
                  <Users className="h-8 w-8 text-blue-600 mr-3" />
                  <div>
                    <p className="text-sm font-medium text-blue-600">Evaluation Stage Patients</p>
                    <p className="text-2xl font-bold text-blue-900">{evaluationStageCount}</p>
                  </div>
                </div>
              </div>
              
              <div className="flex items-center justify-between p-4 border rounded-lg bg-green-50 border-green-200">
                <div className="flex items-center">
                  <TrendingUp className="h-8 w-8 text-green-600 mr-3" />
                  <div>
                    <p className="text-sm font-medium text-green-600">Total Initial Wound Size</p>
                    <p className="text-2xl font-bold text-green-900">{evaluationStageTotalWoundSize.toFixed(1)} sq cm</p>
                  </div>
                </div>
              </div>
            </div>
            
            {/* Patient Pipeline Line Items */}
            {evaluationStagePatients.length > 0 && (
              <div className="mt-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Pipeline Details</h3>
                <div className="border rounded-lg overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Patient</TableHead>
                        <TableHead>Patient Status</TableHead>
                        <TableHead>Date Added</TableHead>
                        <TableHead>Wound Type</TableHead>
                        <TableHead>Initial Wound Size</TableHead>
                        <TableHead>Insurance</TableHead>
                        <TableHead>Referral Source</TableHead>
                        <TableHead>Provider</TableHead>
                        {(user as any)?.role === 'admin' && <TableHead>Sales Rep</TableHead>}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {evaluationStagePatients.map((patient) => {
                        const getStatusBadge = (status: string) => {
                          const statusColors = {
                            'evaluation': 'bg-yellow-100 text-yellow-800 border-yellow-300',
                            'ivr_requested': 'bg-blue-100 text-blue-800 border-blue-300',
                            'ivr_denied': 'bg-red-100 text-red-800 border-red-300',
                            'ivr_approved': 'bg-green-100 text-green-800 border-green-300'
                          };
                          
                          const statusLabels = {
                            'evaluation': 'Evaluation Stage',
                            'ivr_requested': 'IVR Requested',
                            'ivr_denied': 'IVR Denied',
                            'ivr_approved': 'IVR Approved'
                          };
                          
                          const colorClass = statusColors[status as keyof typeof statusColors] || statusColors.evaluation;
                          const label = statusLabels[status as keyof typeof statusLabels] || status;
                          
                          return (
                            <Badge className={`${colorClass} border text-xs`}>
                              {label}
                            </Badge>
                          );
                        };

                        return (
                          <TableRow key={patient.id} className="hover:bg-gray-50">
                            <TableCell className="font-medium">
                              <Link href={`/patient-profile/${patient.id}`} className="text-blue-600 hover:text-blue-800 hover:underline">
                                {patient.firstName} {patient.lastName}
                              </Link>
                            </TableCell>
                            <TableCell>{getStatusBadge(patient.patientStatus || 'evaluation')}</TableCell>
                            <TableCell>{format(parseISO(patient.createdAt || ''), "MM/dd/yyyy")}</TableCell>
                            <TableCell>{patient.woundType || 'Not specified'}</TableCell>
                            <TableCell>{patient.woundSize ? `${patient.woundSize} sq cm` : 'Not specified'}</TableCell>
                            <TableCell>{patient.customInsurance || patient.insurance || 'Not specified'}</TableCell>
                            <TableCell>{patient.referralSource || 'Not specified'}</TableCell>
                            <TableCell>{patient.provider || 'Not specified'}</TableCell>
                            {(user as any)?.role === 'admin' && (
                              <TableCell>
                                <span className="text-sm text-gray-900 font-medium">
                                  {patient.salesRep || 'Not assigned'}
                                </span>
                              </TableCell>
                            )}
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
        </div>
      </div>
    );
  }
