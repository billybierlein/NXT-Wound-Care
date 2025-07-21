import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useAuth } from "@/hooks/useAuth";
import { Loader2, DollarSign, FileText, CheckCircle, XCircle } from "lucide-react";
import { Bar, BarChart, ResponsiveContainer, XAxis, YAxis, CartesianGrid, Tooltip } from "recharts";

interface Treatment {
  id: number;
  patientId: number;
  userId: number;
  treatmentNumber: string;
  treatmentDate: string;
  treatmentStatus: string;
  graftType: string;
  unitsUsed: number;
  pricePerSqCm: number;
  totalBillable: number;
  totalRevenue: number;
  totalInvoice: number;
  salesRepCommission: number;
  nxtCommission: number;
  totalCommission: number;
  invoiceStatus: string;
  invoiceDate: string | null;
  invoiceNo: string | null;
  payableDate: string | null;
  createdAt: string;
  updatedAt: string;
  patientName: string;
  salesRepName: string;
}

export default function SalesReports() {
  const { user } = useAuth();
  
  const { data: treatments = [], isLoading } = useQuery<Treatment[]>({
    queryKey: ["/api/treatments/all"],
    refetchInterval: 10000,
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-border" />
      </div>
    );
  }

  // Filter treatments for sales rep
  const userTreatments = user?.role === 'admin' 
    ? treatments 
    : treatments.filter(treatment => treatment.salesRepName === user?.salesRepName);

  // Calculate invoice status counts
  const openInvoices = userTreatments.filter(t => t.invoiceStatus === 'Open').length;
  const payableInvoices = userTreatments.filter(t => t.invoiceStatus === 'Payable').length;
  const closedInvoices = userTreatments.filter(t => t.invoiceStatus === 'Closed').length;

  // Calculate total invoice amounts by status
  const openInvoiceAmount = userTreatments
    .filter(t => t.invoiceStatus === 'Open')
    .reduce((sum, t) => sum + (t.totalInvoice || 0), 0);
  
  const payableInvoiceAmount = userTreatments
    .filter(t => t.invoiceStatus === 'Payable')
    .reduce((sum, t) => sum + (t.totalInvoice || 0), 0);
  
  const closedInvoiceAmount = userTreatments
    .filter(t => t.invoiceStatus === 'Closed')
    .reduce((sum, t) => sum + (t.totalInvoice || 0), 0);

  // Create chart data for treatment sizes
  const treatmentSizeData = userTreatments.reduce((acc, treatment) => {
    const sizeRange = treatment.unitsUsed <= 5 ? '0-5 sq cm' :
                     treatment.unitsUsed <= 10 ? '6-10 sq cm' :
                     treatment.unitsUsed <= 20 ? '11-20 sq cm' :
                     treatment.unitsUsed <= 50 ? '21-50 sq cm' : '50+ sq cm';
    
    const existing = acc.find(item => item.range === sizeRange);
    if (existing) {
      existing.count += 1;
      existing.revenue += treatment.totalInvoice || 0;
    } else {
      acc.push({
        range: sizeRange,
        count: 1,
        revenue: treatment.totalInvoice || 0
      });
    }
    return acc;
  }, [] as { range: string; count: number; revenue: number }[]);

  return (
    <div className="container mx-auto p-6 space-y-8">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold text-gray-900">Sales Reports</h1>
      </div>

      {/* Invoice Status Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
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
      <Card>
        <CardHeader>
          <CardTitle>Treatment Size Distribution</CardTitle>
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
                  formatter={[(value: number) => [value, "Treatments"]]}
                  labelFormatter={(label) => `Size: ${label}`}
                />
                <Bar 
                  dataKey="count" 
                  fill="#3b82f6"
                  radius={[4, 4, 0, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}