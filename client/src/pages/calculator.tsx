import { useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import Navigation from '@/components/ui/navigation';
import { Calculator as CalculatorIcon, DollarSign, TrendingUp, Info } from 'lucide-react';

// Graft options with ASP pricing
const GRAFT_OPTIONS = [
  { name: "Membrane Wrap", asp: 1190.44, qCode: "Q4205-Q3" },
  { name: "Dermabind Q2", asp: 3337.23, qCode: "Q4313-Q2" },
  { name: "Dermabind Q3", asp: 3520.69, qCode: "Q4313-Q3" },
  { name: "AmchoPlast", asp: 4415.97, qCode: "Q4215-Q4" },
  { name: "Corplex P", asp: 2893.42, qCode: "Q4246-Q2" },
  { name: "Corplex", asp: 2578.13, qCode: "Q4237-Q2" },
  { name: "Neoform", asp: 2456.78, qCode: "Q4234-Q2" },
  { name: "Neox Cord 1K", asp: 1876.54, qCode: "Q4148-Q1" },
  { name: "Neox Flo", asp: 2234.89, qCode: "Q4155-Q2" },
  { name: "Clarix FLO", asp: 2987.65, qCode: "Q4156-Q3" },
];

export default function Calculator() {
  const { user, isAuthenticated, isLoading } = useAuth();
  const [selectedGraft, setSelectedGraft] = useState<string>("");
  const [woundSize, setWoundSize] = useState<string>("");
  const [treatmentCount, setTreatmentCount] = useState<string>("1");

  // Redirect to login if not authenticated
  if (!isLoading && !isAuthenticated) {
    window.location.href = "/api/login";
    return null;
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  const selectedGraftData = GRAFT_OPTIONS.find(g => g.name === selectedGraft);
  const woundSizeNum = parseFloat(woundSize) || 0;
  const treatmentCountNum = parseInt(treatmentCount) || 1;
  
  // Calculations
  const pricePerSqCm = selectedGraftData?.asp || 0;
  const totalBillablePerTreatment = woundSizeNum * pricePerSqCm;
  const totalInvoicePerTreatment = totalBillablePerTreatment * 0.6; // 60% of billable
  const totalBillableAllTreatments = totalBillablePerTreatment * treatmentCountNum;
  const totalInvoiceAllTreatments = totalInvoicePerTreatment * treatmentCountNum;

  return (
    <div className="min-h-screen bg-gray-50">
      <Navigation />
      
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-4xl mx-auto">
          {/* Header */}
          <div className="mb-8">
            <div className="flex items-center gap-3 mb-4">
              <CalculatorIcon className="h-8 w-8 text-blue-600" />
              <h1 className="text-3xl font-bold text-gray-900">Provider Revenue Calculator</h1>
            </div>
            <p className="text-gray-600">
              Calculate potential revenue for providers based on wound care treatments. 
              Use this tool to demonstrate the financial benefits during provider presentations.
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* Input Section */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Info className="h-5 w-5" />
                  Treatment Parameters
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Graft Selection */}
                <div>
                  <Label htmlFor="graft" className="text-sm font-medium text-gray-700">
                    Skin Graft Product
                  </Label>
                  <Select value={selectedGraft} onValueChange={setSelectedGraft}>
                    <SelectTrigger className="mt-1">
                      <SelectValue placeholder="Select a graft product..." />
                    </SelectTrigger>
                    <SelectContent>
                      {GRAFT_OPTIONS.map((graft) => (
                        <SelectItem key={graft.name} value={graft.name}>
                          {graft.name} - ${graft.asp.toLocaleString()}/sq cm
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {selectedGraftData && (
                    <p className="mt-2 text-sm text-gray-600">
                      Q Code: {selectedGraftData.qCode} | ASP Price: ${selectedGraftData.asp.toLocaleString()}/sq cm
                    </p>
                  )}
                </div>

                {/* Wound Size */}
                <div>
                  <Label htmlFor="woundSize" className="text-sm font-medium text-gray-700">
                    Wound Size (sq cm)
                  </Label>
                  <Input
                    id="woundSize"
                    type="number"
                    step="0.1"
                    min="0"
                    value={woundSize}
                    onChange={(e) => setWoundSize(e.target.value)}
                    placeholder="Enter wound size..."
                    className="mt-1"
                  />
                </div>

                {/* Treatment Count */}
                <div>
                  <Label htmlFor="treatmentCount" className="text-sm font-medium text-gray-700">
                    Number of Treatments
                  </Label>
                  <Input
                    id="treatmentCount"
                    type="number"
                    min="1"
                    value={treatmentCount}
                    onChange={(e) => setTreatmentCount(e.target.value)}
                    placeholder="Enter number of treatments..."
                    className="mt-1"
                  />
                </div>
              </CardContent>
            </Card>

            {/* Results Section */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <DollarSign className="h-5 w-5" />
                  Revenue Calculations
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Per Treatment Results */}
                <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
                  <h3 className="font-semibold text-blue-900 mb-3">Per Treatment Revenue</h3>
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <span className="text-gray-700">Total Billable:</span>
                      <span className="font-semibold text-lg">
                        ${totalBillablePerTreatment.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-700">Provider Invoice (60%):</span>
                      <span className="font-semibold text-lg text-purple-600">
                        ${totalInvoicePerTreatment.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Total Results */}
                {treatmentCountNum > 1 && (
                  <div className="bg-green-50 p-4 rounded-lg border border-green-200">
                    <h3 className="font-semibold text-green-900 mb-3">
                      Total Revenue ({treatmentCountNum} treatments)
                    </h3>
                    <div className="space-y-2">
                      <div className="flex justify-between">
                        <span className="text-gray-700">Total Billable:</span>
                        <span className="font-semibold text-xl">
                          ${totalBillableAllTreatments.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-700">Provider Invoice (60%):</span>
                        <span className="font-semibold text-xl text-purple-600">
                          ${totalInvoiceAllTreatments.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </span>
                      </div>
                    </div>
                  </div>
                )}

                {/* Info Section */}
                <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
                  <h4 className="font-medium text-gray-900 mb-2">Revenue Model</h4>
                  <ul className="text-sm text-gray-600 space-y-1">
                    <li>• Total Billable = Wound Size × ASP Price per sq cm</li>
                    <li>• Provider Invoice = 60% of Total Billable amount</li>
                    <li>• ASP prices are based on current market rates</li>
                    <li>• Q codes included for billing reference</li>
                  </ul>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Summary Card */}
          {selectedGraft && woundSize && (
            <Card className="mt-8 bg-gradient-to-r from-blue-50 to-purple-50 border-blue-200">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-blue-900">
                  <TrendingUp className="h-5 w-5" />
                  Provider Presentation Summary
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="bg-white p-6 rounded-lg shadow-sm">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">Revenue Opportunity</h3>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-center">
                    <div className="bg-blue-50 p-4 rounded-lg">
                      <div className="text-2xl font-bold text-blue-600">
                        ${totalInvoicePerTreatment.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                      </div>
                      <div className="text-sm text-gray-600 mt-1">Per Treatment Invoice</div>
                    </div>
                    <div className="bg-purple-50 p-4 rounded-lg">
                      <div className="text-2xl font-bold text-purple-600">
                        {selectedGraftData?.qCode}
                      </div>
                      <div className="text-sm text-gray-600 mt-1">Q Code for Billing</div>
                    </div>
                    <div className="bg-green-50 p-4 rounded-lg">
                      <div className="text-2xl font-bold text-green-600">
                        {woundSizeNum.toFixed(1)} sq cm
                      </div>
                      <div className="text-sm text-gray-600 mt-1">Treatment Size</div>
                    </div>
                  </div>
                  <div className="mt-4 text-center">
                    <p className="text-gray-600">
                      Using <strong>{selectedGraft}</strong> for wound care treatment
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}