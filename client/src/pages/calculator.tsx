import { useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import Navigation from '@/components/ui/navigation';
import { Calculator as CalculatorIcon, DollarSign, TrendingUp, Info, Activity, Target, Download } from 'lucide-react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

// Graft options with ASP pricing and manufacturers
const GRAFT_OPTIONS = [
  { manufacturer: "Biolab", name: "Membrane Wrap", asp: 1190.44, qCode: "Q4205-Q3" },
  { manufacturer: "Biolab", name: "Membrane Hydro", asp: 1864.71, qCode: "Q4290-Q3" },
  { manufacturer: "Biolab", name: "Membrane Tri Layer", asp: 2689.48, qCode: "Q4344-Q3" },
  { manufacturer: "Dermabind", name: "Dermabind", asp: 3337.23, qCode: "Q4313-Q2" },
  { manufacturer: "Dermabind", name: "Dermabind", asp: 3520.69, qCode: "Q4313-Q3" },
  { manufacturer: "Revogen", name: "Revoshield", asp: 1468.11, qCode: "Q4289-Q3" },
  { manufacturer: "Evolution", name: "Esano", asp: 2675.48, qCode: "Q4275-Q3" },
  { manufacturer: "Evolution", name: "Simplimax", asp: 3071.28, qCode: "Q4341-Q3" },
  { manufacturer: "AmchoPlast", name: "AmchoPlast", asp: 4415.97, qCode: "Q4316-Q3" },
  { manufacturer: "Encoll", name: "Helicoll", asp: 1640.93, qCode: "Q4164-Q3" },
];

export default function Calculator() {
  const { user, isAuthenticated, isLoading } = useAuth();
  const [selectedGraft, setSelectedGraft] = useState<string>("");
  const [woundSize, setWoundSize] = useState<string>("");
  const [treatmentCount, setTreatmentCount] = useState<string>("1");
  const [showProgression, setShowProgression] = useState<boolean>(false);
  const [closureRate, setClosureRate] = useState<string>("15");

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

  const selectedGraftData = GRAFT_OPTIONS.find(g => `${g.manufacturer} - ${g.name} (${g.qCode})` === selectedGraft);
  const woundSizeNum = parseFloat(woundSize) || 0;
  const treatmentCountNum = parseInt(treatmentCount) || 1;
  
  // Calculations
  const pricePerSqCm = selectedGraftData?.asp || 0;
  const totalBillablePerTreatment = woundSizeNum * pricePerSqCm;
  const totalInvoicePerTreatment = totalBillablePerTreatment * 0.6; // 60% of billable

  // Generate wound healing progression data
  const generateWoundProgression = () => {
    if (!selectedGraftData || !woundSizeNum || treatmentCountNum < 1) return [];
    
    const progressionData = [];
    let currentWoundSize = woundSizeNum;
    const closureRateNum = parseFloat(closureRate) || 15;
    const healingRate = 1 - (closureRateNum / 100); // Convert percentage to healing rate
    
    for (let treatment = 1; treatment <= treatmentCountNum; treatment++) {
      const totalBillable = currentWoundSize * pricePerSqCm;
      const reimbursedByMedicare = totalBillable * 0.8; // 80% Medicare reimbursement
      const costPerGraft = totalBillable * 0.6; // 60% cost
      const profitPerGraft = reimbursedByMedicare - costPerGraft;
      
      progressionData.push({
        treatment,
        qCode: selectedGraftData.qCode,
        product: `${selectedGraftData.manufacturer} ${selectedGraftData.name}`,
        units: parseFloat(currentWoundSize.toFixed(1)),
        pricePerSqCm,
        totalBillable,
        reimbursedByMedicare,
        costPerGraft,
        profitPerGraft
      });
      
      // Reduce wound size for next treatment (healing progression)
      currentWoundSize = currentWoundSize * healingRate;
      if (currentWoundSize < 1) currentWoundSize = 1; // Minimum wound size
    }
    
    return progressionData;
  };

  const progressionData = generateWoundProgression();
  const totalUnits = progressionData.reduce((sum, row) => sum + row.units, 0);
  const totalBillableSum = progressionData.reduce((sum, row) => sum + row.totalBillable, 0);
  const totalReimbursedSum = progressionData.reduce((sum, row) => sum + row.reimbursedByMedicare, 0);
  const totalCostSum = progressionData.reduce((sum, row) => sum + row.costPerGraft, 0);
  const totalProfitSum = progressionData.reduce((sum, row) => sum + row.profitPerGraft, 0);

  // Use progression data for multi-treatment calculations when available
  const totalBillableAllTreatments = treatmentCountNum > 1 && progressionData.length > 0 
    ? totalBillableSum 
    : totalBillablePerTreatment * treatmentCountNum;
  const totalInvoiceAllTreatments = treatmentCountNum > 1 && progressionData.length > 0 
    ? totalBillableSum * 0.6 
    : totalInvoicePerTreatment * treatmentCountNum;
  
  // Calculate clinic profit (Medicare reimbursement 80% - Cost 60% = 20% profit)
  const clinicProfitAllTreatments = treatmentCountNum > 1 && progressionData.length > 0 
    ? totalProfitSum 
    : totalBillableAllTreatments * 0.2;

  // PDF Download Function
  const downloadProgressionPDF = () => {
    if (!progressionData.length || !selectedGraftData) return;

    const doc = new jsPDF('landscape');
    const pageWidth = doc.internal.pageSize.width;
    
    // Title
    doc.setFontSize(20);
    doc.setFont('helvetica', 'bold');
    doc.text('Wound Healing Progression Analysis', pageWidth / 2, 20, { align: 'center' });
    
    // Subtitle
    doc.setFontSize(12);
    doc.setFont('helvetica', 'normal');
    const closureRateNum = parseFloat(closureRate) || 15;
    doc.text(`${selectedGraftData.manufacturer} ${selectedGraftData.name} - ${closureRateNum}% closure rate per treatment`, pageWidth / 2, 30, { align: 'center' });
    
    // Table headers
    const headers = [
      'Code', 'Product', 'Treatment', 'Units - sq cm', 'Price Per sq cm',
      'Total Billable', 'Reimbursed by Medicare', 'Cost Per Graft', 'Profit Per Graft'
    ];
    
    // Table data
    const tableData = progressionData.map(row => [
      row.qCode,
      row.product,
      row.treatment.toString(),
      row.units.toString(),
      `$${row.pricePerSqCm.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
      `$${row.totalBillable.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
      `$${row.reimbursedByMedicare.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
      `$${row.costPerGraft.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
      `$${row.profitPerGraft.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
    ]);
    
    // Add totals row
    tableData.push([
      '', '', 'Total:', totalUnits.toFixed(0), '',
      `$${totalBillableSum.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
      `$${totalReimbursedSum.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
      `$${totalCostSum.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
      `$${totalProfitSum.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
    ]);

    // AutoTable plugin with enhanced styling
    autoTable(doc, {
      head: [headers],
      body: tableData,
      startY: 40,
      theme: 'grid',
      headStyles: { 
        fillColor: [75, 85, 99], // Gray-600 
        textColor: 255,
        fontSize: 10,
        fontStyle: 'bold'
      },
      bodyStyles: { 
        fontSize: 9,
        textColor: [31, 41, 55] // Gray-800
      },
      alternateRowStyles: {
        fillColor: [249, 250, 251] // Gray-50
      },
      columnStyles: {
        0: { fontStyle: 'bold', cellWidth: 25 }, // Code column
        1: { fontStyle: 'bold', cellWidth: 35 }, // Product column
        2: { halign: 'center', cellWidth: 20 }, // Treatment column
        3: { halign: 'center', cellWidth: 25 }, // Units column
        4: { halign: 'right', cellWidth: 30 }, // Price column
        5: { halign: 'right', cellWidth: 30 }, // Total Billable column
        6: { halign: 'right', cellWidth: 35 }, // Reimbursed column
        7: { halign: 'right', cellWidth: 30 }, // Cost column
        8: { halign: 'right', cellWidth: 30, textColor: [34, 197, 94] } // Profit column in green
      },
      didParseCell: function(data: any) {
        // Style the totals row
        if (data.row.index === tableData.length - 1) {
          data.cell.styles.fillColor = [59, 130, 246]; // Blue-500
          data.cell.styles.textColor = [255, 255, 255]; // White text
          data.cell.styles.fontStyle = 'bold';
          data.cell.styles.fontSize = 10;
        }
        // Style profit column in green for all rows except header
        if (data.column.index === 8 && data.row.index < tableData.length - 1) {
          data.cell.styles.textColor = [34, 197, 94]; // Green-500
          data.cell.styles.fontStyle = 'bold';
        }
      }
    });

    // Color-coded summary boxes (matching webpage design)
    const finalY = (doc as any).lastAutoTable.finalY + 20;
    const boxWidth = 65;
    const boxHeight = 25;
    const boxSpacing = 5;
    const startX = 20;
    
    // Box 1: Total Billable (Blue)
    doc.setFillColor(219, 234, 254); // Blue-100
    doc.rect(startX, finalY, boxWidth, boxHeight, 'F');
    doc.setDrawColor(59, 130, 246); // Blue-500
    doc.rect(startX, finalY, boxWidth, boxHeight);
    
    doc.setTextColor(59, 130, 246); // Blue-600
    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.text('Total Billable', startX + 3, finalY + 7);
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(30, 58, 138); // Blue-900
    doc.text(`$${totalBillableSum.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`, startX + 3, finalY + 17);
    
    // Box 2: Medicare Reimbursement (Green)
    const box2X = startX + boxWidth + boxSpacing;
    doc.setFillColor(220, 252, 231); // Green-100
    doc.rect(box2X, finalY, boxWidth, boxHeight, 'F');
    doc.setDrawColor(34, 197, 94); // Green-500
    doc.rect(box2X, finalY, boxWidth, boxHeight);
    
    doc.setTextColor(34, 197, 94); // Green-600
    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.text('Medicare Reimbursement', box2X + 3, finalY + 7);
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(20, 83, 45); // Green-900
    doc.text(`$${totalReimbursedSum.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`, box2X + 3, finalY + 17);
    
    // Box 3: Total Cost (Orange)
    const box3X = box2X + boxWidth + boxSpacing;
    doc.setFillColor(254, 237, 220); // Orange-100
    doc.rect(box3X, finalY, boxWidth, boxHeight, 'F');
    doc.setDrawColor(249, 115, 22); // Orange-500
    doc.rect(box3X, finalY, boxWidth, boxHeight);
    
    doc.setTextColor(249, 115, 22); // Orange-600
    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.text('Total Cost', box3X + 3, finalY + 7);
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(154, 52, 18); // Orange-900
    doc.text(`$${totalCostSum.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`, box3X + 3, finalY + 17);
    
    // Box 4: Total Profit (Emerald)
    const box4X = box3X + boxWidth + boxSpacing;
    doc.setFillColor(209, 250, 229); // Emerald-100
    doc.rect(box4X, finalY, boxWidth, boxHeight, 'F');
    doc.setDrawColor(16, 185, 129); // Emerald-500
    doc.rect(box4X, finalY, boxWidth, boxHeight);
    
    doc.setTextColor(16, 185, 129); // Emerald-600
    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.text('Total Profit', box4X + 3, finalY + 7);
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(6, 78, 59); // Emerald-900
    doc.text(`$${totalProfitSum.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`, box4X + 3, finalY + 17);
    
    // Save the PDF
    const today = new Date().toLocaleDateString('en-US').replace(/\//g, '-');
    doc.save(`Wound-Healing-Progression-${selectedGraftData.manufacturer}-${today}.pdf`);
  };

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
                      {GRAFT_OPTIONS.map((graft, index) => {
                        const optionValue = `${graft.manufacturer} - ${graft.name} (${graft.qCode})`;
                        const displayName = graft.name === "Dermabind" 
                          ? `${graft.manufacturer} - ${graft.name} (${graft.qCode})`
                          : `${graft.manufacturer} - ${graft.name}`;
                        return (
                          <SelectItem key={index} value={optionValue}>
                            {displayName} - ${graft.asp.toLocaleString()}/sq cm
                          </SelectItem>
                        );
                      })}
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
                    max="12"
                    value={treatmentCount}
                    onChange={(e) => setTreatmentCount(e.target.value)}
                    placeholder="Enter number of treatments..."
                    className="mt-1"
                  />
                  <p className="mt-1 text-xs text-gray-500">
                    For wound healing progression (2-12 treatments recommended)
                  </p>
                </div>

                {/* Closure Rate */}
                {treatmentCountNum > 1 && (
                  <div>
                    <Label htmlFor="closureRate" className="text-sm font-medium text-gray-700">
                      Wound Closure Rate (% per treatment)
                    </Label>
                    <Select value={closureRate} onValueChange={setClosureRate}>
                      <SelectTrigger className="mt-1">
                        <SelectValue placeholder="Select closure rate..." />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="10">10% - Slow healing</SelectItem>
                        <SelectItem value="15">15% - Standard healing</SelectItem>
                        <SelectItem value="20">20% - Good healing</SelectItem>
                        <SelectItem value="25">25% - Excellent healing</SelectItem>
                        <SelectItem value="30">30% - Optimal healing</SelectItem>
                      </SelectContent>
                    </Select>
                    <p className="mt-1 text-xs text-gray-500">
                      Higher rates show faster wound closure between treatments
                    </p>
                  </div>
                )}

                {/* Show Progression Toggle */}
                {selectedGraft && woundSize && treatmentCountNum > 1 && (
                  <div className="flex items-center space-x-2">
                    <Button
                      type="button"
                      variant={showProgression ? "default" : "outline"}
                      onClick={() => setShowProgression(!showProgression)}
                      className="flex items-center gap-2"
                    >
                      <Activity className="h-4 w-4" />
                      {showProgression ? "Hide" : "Show"} Wound Healing Progression
                    </Button>
                  </div>
                )}
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
                      <div className="flex justify-between border-t pt-2 mt-2">
                        <span className="text-gray-700">Clinic Profit (20%):</span>
                        <span className="font-semibold text-xl text-green-600">
                          ${clinicProfitAllTreatments.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
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
                      Using <strong>{selectedGraftData?.manufacturer} {selectedGraftData?.name}</strong> for wound care treatment
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Wound Healing Progression Table */}
          {showProgression && progressionData.length > 0 && (
            <Card className="mt-8">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      <Target className="h-5 w-5" />
                      Wound Healing Progression Analysis
                    </CardTitle>
                    <p className="text-sm text-gray-600">
                      Projected wound healing over {treatmentCountNum} treatments with {closureRate}% closure rate per treatment
                    </p>
                  </div>
                  <Button
                    onClick={downloadProgressionPDF}
                    className="flex items-center gap-2 bg-green-600 hover:bg-green-700"
                  >
                    <Download className="h-4 w-4" />
                    Download PDF
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-gray-50">
                        <TableHead className="font-semibold">Code</TableHead>
                        <TableHead className="font-semibold">Product</TableHead>
                        <TableHead className="font-semibold text-center">Treatment</TableHead>
                        <TableHead className="font-semibold text-center">Units - sq cm</TableHead>
                        <TableHead className="font-semibold text-right">Price Per sq cm</TableHead>
                        <TableHead className="font-semibold text-right">Total Billable</TableHead>
                        <TableHead className="font-semibold text-right">Reimbursed by Medicare</TableHead>
                        <TableHead className="font-semibold text-right">Cost Per Graft</TableHead>
                        <TableHead className="font-semibold text-right">Profit Per Graft</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {progressionData.map((row, index) => (
                        <TableRow key={index} className="hover:bg-gray-50">
                          <TableCell className="font-medium">{row.qCode}</TableCell>
                          <TableCell className="font-medium">{row.product}</TableCell>
                          <TableCell className="text-center">{row.treatment}</TableCell>
                          <TableCell className="text-center">{row.units}</TableCell>
                          <TableCell className="text-right">
                            ${row.pricePerSqCm.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </TableCell>
                          <TableCell className="text-right">
                            ${row.totalBillable.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </TableCell>
                          <TableCell className="text-right">
                            ${row.reimbursedByMedicare.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </TableCell>
                          <TableCell className="text-right">
                            ${row.costPerGraft.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </TableCell>
                          <TableCell className="text-right font-semibold text-green-600">
                            ${row.profitPerGraft.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </TableCell>
                        </TableRow>
                      ))}
                      {/* Total Row */}
                      <TableRow className="bg-blue-50 border-t-2 border-blue-200 font-bold">
                        <TableCell colSpan={3} className="text-right font-bold">Total:</TableCell>
                        <TableCell className="text-center font-bold">{totalUnits.toFixed(0)}</TableCell>
                        <TableCell></TableCell>
                        <TableCell className="text-right font-bold">
                          ${totalBillableSum.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </TableCell>
                        <TableCell className="text-right font-bold">
                          ${totalReimbursedSum.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </TableCell>
                        <TableCell className="text-right font-bold">
                          ${totalCostSum.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </TableCell>
                        <TableCell className="text-right font-bold text-green-600">
                          ${totalProfitSum.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </TableCell>
                      </TableRow>
                    </TableBody>
                  </Table>
                </div>
                
                {/* Summary Cards */}
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mt-6">
                  <Card className="bg-blue-50 border-blue-200">
                    <CardContent className="p-4">
                      <div className="text-sm text-blue-600 font-medium">Total Billable</div>
                      <div className="text-xl font-bold text-blue-900">
                        ${totalBillableSum.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </div>
                    </CardContent>
                  </Card>
                  <Card className="bg-green-50 border-green-200">
                    <CardContent className="p-4">
                      <div className="text-sm text-green-600 font-medium">Medicare Reimbursement</div>
                      <div className="text-xl font-bold text-green-900">
                        ${totalReimbursedSum.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </div>
                    </CardContent>
                  </Card>
                  <Card className="bg-orange-50 border-orange-200">
                    <CardContent className="p-4">
                      <div className="text-sm text-orange-600 font-medium">Total Cost</div>
                      <div className="text-xl font-bold text-orange-900">
                        ${totalCostSum.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </div>
                    </CardContent>
                  </Card>
                  <Card className="bg-emerald-50 border-emerald-200">
                    <CardContent className="p-4">
                      <div className="text-sm text-emerald-600 font-medium">Total Profit</div>
                      <div className="text-xl font-bold text-emerald-900">
                        ${totalProfitSum.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </div>
                    </CardContent>
                  </Card>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}