import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Calculator as CalculatorIcon, DollarSign, TrendingUp, Info, Activity, Target, Download } from 'lucide-react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

// Graft options with ASP pricing and manufacturers (matching internal calculator exactly)
const GRAFT_OPTIONS = [
  { manufacturer: "Biolab", name: "Membrane Wrap", asp: 1190.44, qCode: "Q4205-Q3" },
  { manufacturer: "Biolab", name: "Membrane Hydro", asp: 1864.71, qCode: "Q4290-Q3" },
  { manufacturer: "Biolab", name: "Membrane Tri Layer", asp: 2689.48, qCode: "Q4344-Q3" },
  { manufacturer: "Dermabind", name: "Dermabind Q2", asp: 3337.23, qCode: "Q4313-Q2" },
  { manufacturer: "Dermabind", name: "Dermabind Q3", asp: 3520.69, qCode: "Q4313-Q3" },
  { manufacturer: "Revogen", name: "Revoshield", asp: 1468.11, qCode: "Q4289-Q3" },
  { manufacturer: "Evolution", name: "Esano", asp: 2675.48, qCode: "Q4275-Q3" },
  { manufacturer: "Evolution", name: "Simplimax", asp: 3071.28, qCode: "Q4341-Q3" },
  { manufacturer: "AmchoPlast", name: "AmchoPlast", asp: 4415.97, qCode: "Q4316-Q3" },
  { manufacturer: "Encoll", name: "Helicoll", asp: 1640.93, qCode: "Q4164-Q3" },
];

export default function PublicCalculator() {
  const [selectedGraft, setSelectedGraft] = useState<string>("");
  const [woundSize, setWoundSize] = useState<string>("");
  const [treatmentCount, setTreatmentCount] = useState<string>("1");
  const [showProgression, setShowProgression] = useState<boolean>(false);
  const [closureRate, setClosureRate] = useState<string>("15");
  const [billingFee, setBillingFee] = useState<string>("6");

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
    const billingFeeNum = parseFloat(billingFee) || 0; // Get billing fee number
    
    for (let treatment = 1; treatment <= treatmentCountNum; treatment++) {
      const totalBillable = currentWoundSize * pricePerSqCm;
      const reimbursedByMedicare = totalBillable * 0.8; // 80% Medicare reimbursement
      const costPerGraft = totalBillable * 0.6; // 60% cost
      const billingFeePerTreatment = totalBillable * (billingFeeNum / 100); // Billing fee
      const profitPerGraft = reimbursedByMedicare - costPerGraft;
      const netProfitPerGraft = profitPerGraft - billingFeePerTreatment; // Net profit after billing fee
      
      progressionData.push({
        treatment,
        qCode: selectedGraftData.qCode,
        product: `${selectedGraftData.manufacturer} ${selectedGraftData.name}`,
        units: parseFloat(currentWoundSize.toFixed(1)),
        pricePerSqCm,
        totalBillable,
        reimbursedByMedicare,
        costPerGraft,
        billingFee: billingFeePerTreatment,
        profitPerGraft,
        netProfitPerGraft
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
  const totalBillingFeeSum = progressionData.reduce((sum, row) => sum + row.billingFee, 0);
  const totalProfitSum = progressionData.reduce((sum, row) => sum + row.profitPerGraft, 0);
  const totalNetProfitSum = progressionData.reduce((sum, row) => sum + row.netProfitPerGraft, 0);

  // Use progression data for multi-treatment calculations when available
  const totalBillableAllTreatments = treatmentCountNum > 1 && progressionData.length > 0 
    ? totalBillableSum 
    : totalBillablePerTreatment * treatmentCountNum;
  const totalInvoiceAllTreatments = treatmentCountNum > 1 && progressionData.length > 0 
    ? totalBillableSum * 0.6 
    : totalInvoicePerTreatment * treatmentCountNum;
  
  // Calculate billing fee and net clinic profit
  const billingFeeNum = parseFloat(billingFee) || 0;
  const billingFeeAmount = totalBillableAllTreatments * (billingFeeNum / 100);
  
  // Calculate clinic profit (Medicare reimbursement 80% - Cost 60% - Billing Fee = Net profit)
  const grossClinicProfit = treatmentCountNum > 1 && progressionData.length > 0 
    ? totalProfitSum 
    : totalBillableAllTreatments * 0.2;
  const netClinicProfit = grossClinicProfit - billingFeeAmount;

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
      'Total Billable', 'Reimbursed by Medicare', 'Cost Per Graft', 'Billing Fee', 'Gross Profit', 'Net Profit'
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
      `$${row.billingFee.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
      `$${row.profitPerGraft.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
      `$${row.netProfitPerGraft.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
    ]);
    
    // Add totals row
    tableData.push([
      '', '', 'Total:', totalUnits.toFixed(0), '',
      `$${totalBillableSum.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
      `$${totalReimbursedSum.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
      `$${totalCostSum.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
      `$${totalBillingFeeSum.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
      `$${totalProfitSum.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
      `$${totalNetProfitSum.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
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
        0: { fontStyle: 'bold', cellWidth: 20 }, // Code column
        1: { fontStyle: 'bold', cellWidth: 30 }, // Product column
        2: { halign: 'center', cellWidth: 18 }, // Treatment column
        3: { halign: 'center', cellWidth: 20 }, // Units column
        4: { halign: 'right', cellWidth: 25 }, // Price column
        5: { halign: 'right', cellWidth: 25 }, // Total Billable column
        6: { halign: 'right', cellWidth: 30 }, // Reimbursed column
        7: { halign: 'right', cellWidth: 25 }, // Cost column
        8: { halign: 'right', cellWidth: 25, textColor: [239, 68, 68] }, // Billing Fee column in red
        9: { halign: 'right', cellWidth: 25, textColor: [59, 130, 246] }, // Gross Profit column in blue
        10: { halign: 'right', cellWidth: 25, textColor: [34, 197, 94] } // Net Profit column in green
      },
      didParseCell: function(data: any) {
        // Style the totals row
        if (data.row.index === tableData.length - 1) {
          data.cell.styles.fillColor = [59, 130, 246]; // Blue-500
          data.cell.styles.textColor = [255, 255, 255]; // White text
          data.cell.styles.fontStyle = 'bold';
          data.cell.styles.fontSize = 10;
        }
        // Style billing fee column in red for all rows except header
        if (data.column.index === 8 && data.row.index < tableData.length - 1) {
          data.cell.styles.textColor = [239, 68, 68]; // Red-500
          data.cell.styles.fontStyle = 'bold';
        }
        // Style gross profit column in blue for all rows except header
        if (data.column.index === 9 && data.row.index < tableData.length - 1) {
          data.cell.styles.textColor = [59, 130, 246]; // Blue-500
          data.cell.styles.fontStyle = 'bold';
        }
        // Style net profit column in green for all rows except header
        if (data.column.index === 10 && data.row.index < tableData.length - 1) {
          data.cell.styles.textColor = [34, 197, 94]; // Green-500
          data.cell.styles.fontStyle = 'bold';
        }
      }
    });

    // Footer
    const finalY = (doc as any).lastAutoTable.finalY || 200;
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.text('Generated by NXT Medical Provider Revenue Calculator', 20, finalY + 20);
    doc.text(`Report generated on ${new Date().toLocaleDateString()}`, 20, finalY + 30);

    doc.save(`wound-progression-analysis-${new Date().toISOString().split('T')[0]}.pdf`);
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="p-8">
        <div className="max-w-7xl mx-auto">
          <div className="mb-8">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 bg-primary rounded-lg flex items-center justify-center">
                <CalculatorIcon className="h-6 w-6 text-white" />
              </div>
              <h1 className="text-3xl font-bold">Provider Revenue Calculator</h1>
            </div>
            <p className="text-gray-600">Calculate potential revenue from wound care treatments</p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Treatment Parameters */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Info className="h-5 w-5" />
                  Treatment Parameters
                </CardTitle>
                <p className="text-sm text-gray-500">Enter treatment details to calculate potential revenue</p>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label htmlFor="graft">Graft Product *</Label>
                  <Select value={selectedGraft} onValueChange={setSelectedGraft}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select graft product" />
                    </SelectTrigger>
                    <SelectContent>
                      {GRAFT_OPTIONS.map((graft) => (
                        <SelectItem key={`${graft.manufacturer}-${graft.name}`} value={`${graft.manufacturer} - ${graft.name} (${graft.qCode})`}>
                          {graft.name} - ${graft.asp.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label htmlFor="woundSize">Wound Size (sq cm) *</Label>
                  <Input
                    id="woundSize"
                    type="number"
                    placeholder="25"
                    value={woundSize}
                    onChange={(e) => setWoundSize(e.target.value)}
                    min="0"
                    step="0.1"
                  />
                </div>

                <div>
                  <Label htmlFor="treatmentCount">Number of Treatments</Label>
                  <Input
                    id="treatmentCount"
                    type="number"
                    placeholder="1"
                    value={treatmentCount}
                    onChange={(e) => setTreatmentCount(e.target.value)}
                    min="1"
                    max="10"
                  />
                </div>

                <div>
                  <Label htmlFor="closureRate">Wound Closure Rate % per Treatment</Label>
                  <Select value={closureRate} onValueChange={setClosureRate}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select closure rate" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="5">5% - Conservative</SelectItem>
                      <SelectItem value="10">10% - Average</SelectItem>
                      <SelectItem value="15">15% - Best Case</SelectItem>
                      <SelectItem value="20">20% - Optimal</SelectItem>
                      <SelectItem value="25">25% - Exceptional</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label htmlFor="billingFee">Practice Billing Fee (%)</Label>
                  <Input
                    id="billingFee"
                    type="number"
                    placeholder="5"
                    value={billingFee}
                    onChange={(e) => setBillingFee(e.target.value)}
                    min="0"
                    max="20"
                    step="0.1"
                  />
                </div>

                {treatmentCountNum > 1 && (
                  <div className="flex items-center space-x-2">
                    <input
                      type="checkbox"
                      id="showProgression"
                      checked={showProgression}
                      onChange={(e) => setShowProgression(e.target.checked)}
                      className="rounded border-gray-300"
                    />
                    <Label htmlFor="showProgression" className="text-sm">
                      Show Wound Healing Progression
                    </Label>
                  </div>
                )}

                <Button 
                  onClick={downloadProgressionPDF} 
                  className="w-full"
                  disabled={!selectedGraft || !woundSize}
                >
                  <Download className="h-4 w-4 mr-2" />
                  Export PDF Report
                </Button>
              </CardContent>
            </Card>

          {/* Summary Cards */}
          <div className="lg:col-span-2 space-y-6">
            {/* Financial Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Total Billable</CardTitle>
                  <DollarSign className="h-4 w-4 text-primary" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-primary">
                    ${totalBillableAllTreatments.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Provider Invoice (60%)</CardTitle>
                  <DollarSign className="h-4 w-4 text-purple-500" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-purple-600">
                    ${totalInvoiceAllTreatments.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Gross Clinic Profit</CardTitle>
                  <TrendingUp className="h-4 w-4 text-orange-500" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-orange-600">
                    ${grossClinicProfit.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Billing Fee</CardTitle>
                  <DollarSign className="h-4 w-4 text-red-500" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-red-600">
                    -${billingFeeAmount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Net Clinic Profit</CardTitle>
                  <TrendingUp className="h-4 w-4 text-green-500" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-green-600">
                    ${netClinicProfit.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Revenue Model Explanation */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Activity className="h-5 w-5" />
                  Revenue Model Explanation
                </CardTitle>
                <p className="text-sm text-gray-500">Understanding the wound care revenue calculation</p>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <h4 className="font-semibold mb-2">How It Works</h4>
                    <ul className="text-sm space-y-1">
                      <li>• Total Billable = ASP Price × Wound Size × Treatments</li>
                      <li>• Provider Invoice = 60% of Total Billable</li>
                      <li>• Gross Profit = Invoice × Closure Rate</li>
                      <li>• Net Profit = Gross Profit - Billing Fees</li>
                    </ul>
                  </div>
                  <div>
                    <h4 className="font-semibold mb-2">Key Benefits</h4>
                    <ul className="text-sm space-y-1">
                      <li>• Predictable revenue stream</li>
                      <li>• Improved patient outcomes</li>
                      <li>• Advanced wound care capabilities</li>
                      <li>• Insurance reimbursement support</li>
                    </ul>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Wound Healing Progression Table */}
            {showProgression && treatmentCountNum > 1 && progressionData.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Target className="h-5 w-5" />
                    Wound Healing Progression
                  </CardTitle>
                  <p className="text-sm text-gray-500">
                    Treatment-by-treatment breakdown with {closureRate}% wound closure rate
                  </p>
                </CardHeader>
                <CardContent>
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Code</TableHead>
                          <TableHead>Product</TableHead>
                          <TableHead>Treatment</TableHead>
                          <TableHead>Units (sq cm)</TableHead>
                          <TableHead>Price Per sq cm</TableHead>
                          <TableHead>Total Billable</TableHead>
                          <TableHead>Reimbursed by Medicare</TableHead>
                          <TableHead>Cost Per Graft</TableHead>
                          <TableHead className="text-red-600">Billing Fee</TableHead>
                          <TableHead className="text-blue-600">Gross Profit</TableHead>
                          <TableHead className="text-green-600">Net Profit</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {progressionData.map((row, index) => (
                          <TableRow key={index}>
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
                            <TableCell className="text-right text-red-600 font-semibold">
                              ${row.billingFee.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </TableCell>
                            <TableCell className="text-right text-blue-600 font-semibold">
                              ${row.profitPerGraft.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </TableCell>
                            <TableCell className="text-right text-green-600 font-semibold">
                              ${row.netProfitPerGraft.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </TableCell>
                          </TableRow>
                        ))}
                        {/* Totals Row */}
                        <TableRow className="bg-blue-50 font-bold">
                          <TableCell></TableCell>
                          <TableCell></TableCell>
                          <TableCell className="text-center">Total:</TableCell>
                          <TableCell className="text-center">{totalUnits.toFixed(0)}</TableCell>
                          <TableCell></TableCell>
                          <TableCell className="text-right">
                            ${totalBillableSum.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </TableCell>
                          <TableCell className="text-right">
                            ${totalReimbursedSum.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </TableCell>
                          <TableCell className="text-right">
                            ${totalCostSum.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </TableCell>
                          <TableCell className="text-right text-red-600">
                            ${totalBillingFeeSum.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </TableCell>
                          <TableCell className="text-right text-blue-600">
                            ${totalProfitSum.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </TableCell>
                          <TableCell className="text-right text-green-600">
                            ${totalNetProfitSum.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </TableCell>
                        </TableRow>
                      </TableBody>
                    </Table>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </div>
    </div>
  </div>
  );
}