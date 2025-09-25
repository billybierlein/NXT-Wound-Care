import { useAuth } from "@/hooks/useAuth";
import { useEffect } from "react";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { 
  Plus, 
  Users, 
  FileSpreadsheet, 
  TrendingUp, 
  DollarSign, 
  Clock, 
  AlertTriangle, 
  PieChart,
  BarChart3,
  Activity 
} from "lucide-react";
import Navigation from "@/components/ui/navigation";
import { isUnauthorizedError } from "@/lib/authUtils";
import { PipelineNotesTable } from "@/components/PipelineNotesTable";
import type { Patient, SalesRep, Provider } from "@shared/schema";
// Dashboard metrics interface - matching server response
interface DashboardMetrics {
  treatmentPipeline: {
    totalTreatments: number;
    activeTreatments: number;
    completedTreatments: number;
    totalRevenue: number;
    averageRevenuePerTreatment: number;
    monthlyTrends: any[];
  };
  commissionSummary: {
    totalCommissionsPaid: number;
    totalCommissionsPending: number;
  };
  monthlyTrends: any[];
  topReferralSources: any[];
  graftAnalysis: any[];
  pendingActions: {
    pendingInvoices: number;
    overdueInvoices: number;
    pendingCommissionPayments: number;
    newPatients: number;
    activeTreatments: number;
  };
  lastUpdated: Date;
}
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart as RechartsPieChart, Cell, Pie, BarChart, Bar } from 'recharts';

export default function Home() {
  const { isAuthenticated, isLoading, user } = useAuth();
  const { toast } = useToast();

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

  const { data: patients = [] } = useQuery<Patient[]>({
    queryKey: ["/api/patients"],
    retry: false,
    enabled: isAuthenticated,
  });

  // Sales reps and providers data for PipelineNotesTable
  const { data: salesReps = [] } = useQuery<SalesRep[]>({
    queryKey: ["/api/sales-reps"],
    retry: false,
    enabled: isAuthenticated,
  });

  const { data: providers = [] } = useQuery<Provider[]>({
    queryKey: ["/api/providers"],
    retry: false,
    enabled: isAuthenticated,
  });

  // Dashboard metrics query
  const { data: dashboardMetrics, isLoading: metricsLoading } = useQuery<DashboardMetrics>({
    queryKey: ["/api/dashboard/metrics"],
    retry: false,
    enabled: isAuthenticated,
  });

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

  const totalPatients = patients?.length || 0;
  const recentPatients = patients?.slice(0, 5) || [];
  
  // Color scheme for charts
  const chartColors = ['#8884d8', '#82ca9d', '#ffc658', '#ff7c7c', '#8dd1e1', '#d084d0'];

  const formatCurrency = (value: number | string) => {
    const numValue = typeof value === 'string' ? parseFloat(value) : value;
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(numValue || 0);
  };

  const formatPercentage = (value: number) => {
    return `${value.toFixed(1)}%`;
  };

  if (metricsLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-gray-600">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Navigation />
      
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-gray-900">
            Welcome back, {(user as any)?.firstName || (user as any)?.salesRepName?.split(' ')[0] || (user as any)?.email}
          </h1>
          <p className="text-gray-600 mt-1">
            Your comprehensive healthcare management dashboard
          </p>
        </div>

        {/* Pipeline Notes Widget */}
        <PipelineNotesTable 
          userRole={(user as any)?.role === 'admin' ? 'admin' : 'sales_rep'}
          meUserId={(user as any)?.id || 0}
          mySalesRepId={(user as any)?.salesRepId || null}
          reps={salesReps.map((rep: SalesRep) => ({ id: rep.id, name: rep.name }))}
          providers={providers.map((provider: Provider) => ({ id: provider.id, name: provider.name }))}
        />

        {/* Key Metrics Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <div className="flex items-center justify-between p-4 border rounded-lg bg-green-50 border-green-200">
            <div className="flex items-center">
              <Activity className="h-8 w-8 text-green-600 mr-3" />
              <div>
                <p className="text-sm font-medium text-green-600">Total Treatments</p>
                <p className="text-2xl font-bold text-green-900">{dashboardMetrics?.treatmentPipeline?.totalTreatments || 0}</p>
                <p className="text-xs text-green-700">{dashboardMetrics?.treatmentPipeline?.activeTreatments || 0} active</p>
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between p-4 border rounded-lg bg-blue-50 border-blue-200">
            <div className="flex items-center">
              <DollarSign className="h-8 w-8 text-blue-600 mr-3" />
              <div>
                <p className="text-sm font-medium text-blue-600">Total Invoice Amount</p>
                <p className="text-2xl font-bold text-blue-900">
                  {formatCurrency((dashboardMetrics?.monthlyTrends || []).reduce((sum: number, trend: any) => sum + trend.totalInvoices, 0))}
                </p>
                <p className="text-xs text-blue-700">Active & completed treatments</p>
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between p-4 border rounded-lg bg-gray-50 border-gray-200">
            <div className="flex items-center">
              <TrendingUp className="h-8 w-8 text-gray-600 mr-3" />
              <div>
                <p className="text-sm font-medium text-gray-600">Commissions Paid</p>
                <p className="text-2xl font-bold text-gray-900">{formatCurrency(dashboardMetrics?.commissionSummary?.totalCommissionsPaid || 0)}</p>
                <p className="text-xs text-gray-700">{formatCurrency(dashboardMetrics?.commissionSummary?.totalCommissionsPending || 0)} pending</p>
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between p-4 border rounded-lg bg-orange-50 border-orange-200">
            <div className="flex items-center">
              <DollarSign className="h-8 w-8 text-orange-600 mr-3" />
              <div>
                <p className="text-sm font-medium text-orange-600">NXT Commissions</p>
                <p className="text-2xl font-bold text-orange-900">
                  {formatCurrency((() => {
                    const totalInvoices = (dashboardMetrics?.monthlyTrends || []).reduce((sum: number, trend: any) => sum + trend.totalInvoices, 0);
                    const totalCommissionPool = totalInvoices * 0.4;
                    const repCommissions = (dashboardMetrics?.commissionSummary?.totalCommissionsPaid || 0) + (dashboardMetrics?.commissionSummary?.totalCommissionsPending || 0);
                    return Math.max(0, totalCommissionPool - repCommissions);
                  })())}
                </p>
                <p className="text-xs text-orange-700">NXT's portion earned</p>
              </div>
            </div>
          </div>
        </div>

        {/* Charts Row */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          {/* Monthly Billable vs Invoices */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BarChart3 className="h-5 w-5" />
                Monthly Billable vs Invoices
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={dashboardMetrics?.monthlyTrends || []}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis 
                    dataKey="month" 
                    tickFormatter={(value) => {
                      const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
                                      'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
                      return months[value - 1] || value;
                    }}
                  />
                  <YAxis tickFormatter={(value) => formatCurrency(value)} tick={{ fontSize: 12 }} />
                  <Tooltip 
                    formatter={(value: number, name: string) => {
                      if (name === 'totalBillable' || name === 'totalInvoices') {
                        return [formatCurrency(value), name === 'totalBillable' ? 'Total Billable' : 'Total Invoices'];
                      }
                      return [formatCurrency(value), name];
                    }}
                  />
                  <Legend />
                  <Line type="monotone" dataKey="totalBillable" stroke="#8884d8" name="Total Billable" />
                  <Line type="monotone" dataKey="totalInvoices" stroke="#82ca9d" name="Total Invoices" />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* Graft Distribution */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <PieChart className="h-5 w-5" />
                Graft Distribution
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <RechartsPieChart>
                  <Pie
                    data={dashboardMetrics?.graftAnalysis || []}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={(entry) => `${entry.graftType}: ${formatPercentage(entry.percentage)}`}
                    outerRadius={80}
                    fill="#8884d8"
                    dataKey="patientCount"
                  >
                    {(dashboardMetrics?.graftAnalysis || []).map((entry: any, index: number) => (
                      <Cell key={`cell-${index}`} fill={chartColors[index % chartColors.length]} />
                    ))}
                  </Pie>
                  <Tooltip 
                    formatter={(value: number, name: string, props: any) => [
                      `${value} patients (${formatPercentage(props.payload.percentage)})`,
                      props.payload.graftType
                    ]}
                  />
                </RechartsPieChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </div>

        {/* Bottom Row - Performance Tables and Actions */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          {/* Top Referral Sources */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5" />
                Top Referral Sources
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {dashboardMetrics?.topReferralSources?.slice(0, 5).map((source: any, index: number) => (
                  <div key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                    <div>
                      <h4 className="font-medium text-gray-900">{source.facilityName}</h4>
                      <p className="text-sm text-gray-600">{source.patientCount} patients, {source.treatmentCount} treatments</p>
                    </div>
                    <div className="text-right">
                      <div className="font-bold text-green-600">{formatCurrency(source.totalRevenue)}</div>
                      <div className="text-sm text-gray-500">
                        {formatCurrency(source.averageRevenuePerPatient)}/patient
                      </div>
                    </div>
                  </div>
                )) || (
                  <div className="text-center py-8 text-gray-500">
                    No referral source data available
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Pending Actions & Quick Links */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Clock className="h-5 w-5" />
                Pending Actions & Quick Access
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="p-3 bg-yellow-50 rounded-lg border border-yellow-200">
                    <div className="font-bold text-yellow-800">{dashboardMetrics?.pendingActions?.pendingInvoices || 0}</div>
                    <div className="text-sm text-yellow-600">Pending Invoices</div>
                  </div>
                  <div className="p-3 bg-red-50 rounded-lg border border-red-200">
                    <div className="font-bold text-red-800">{dashboardMetrics?.pendingActions?.overdueInvoices || 0}</div>
                    <div className="text-sm text-red-600">Overdue Invoices</div>
                  </div>
                  <div className="p-3 bg-blue-50 rounded-lg border border-blue-200">
                    <div className="font-bold text-blue-800">{dashboardMetrics?.pendingActions?.newPatients || 0}</div>
                    <div className="text-sm text-blue-600">New Patients</div>
                  </div>
                  <div className="p-3 bg-green-50 rounded-lg border border-green-200">
                    <div className="font-bold text-green-800">{dashboardMetrics?.pendingActions?.activeTreatments || 0}</div>
                    <div className="text-sm text-green-600">Active Treatments</div>
                  </div>
                </div>
                
                <div className="space-y-2 pt-4 border-t">
                  <Link href="/add-patient">
                    <Button size="sm" className="w-full justify-start">
                      <Plus className="h-4 w-4 mr-2" />
                      Add New Patient
                    </Button>
                  </Link>
                  <Link href="/patient-treatments">
                    <Button variant="outline" size="sm" className="w-full justify-start">
                      <Activity className="h-4 w-4 mr-2" />
                      View All Treatments
                    </Button>
                  </Link>
                  {(user as any)?.role === 'admin' && (
                    <Link href="/sales-reports">
                      <Button variant="outline" size="sm" className="w-full justify-start">
                        <FileSpreadsheet className="h-4 w-4 mr-2" />
                        Sales Reports
                      </Button>
                    </Link>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Recent Patients - Condensed */}
        {recentPatients.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span className="flex items-center gap-2">
                  <Users className="h-5 w-5" />
                  Recent Patients
                </span>
                <Link href="/manage-patients">
                  <Button variant="outline" size="sm">View All</Button>
                </Link>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {recentPatients.map((patient) => (
                  <div key={patient.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                    <div>
                      <h4 className="font-medium text-gray-900">
                        <Link 
                          href={`/patient-profile/${patient.id}`}
                          className="text-blue-600 hover:text-blue-800 hover:underline"
                        >
                          {patient.firstName} {patient.lastName}
                        </Link>
                      </h4>
                      <p className="text-sm text-gray-600">
                        {patient.referralSource} • {patient.insurance === "other" && patient.customInsurance ? patient.customInsurance : patient.insurance}
                      </p>
                    </div>
                    <div className="text-right">
                      <div className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getPatientStatusBadgeColor(patient.patientStatus || '')}`}>
                        {patient.patientStatus || 'Evaluation Stage'}
                      </div>
                      <div className="text-sm text-gray-500 mt-1">
                        {(() => {
                          const dateStr = patient.createdAt || '';
                          const date = new Date(dateStr);
                          return date.toLocaleDateString('en-US');
                        })()}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

      </div>
    </div>
  );
}
