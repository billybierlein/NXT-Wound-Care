import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { 
  Plus, 
  Edit, 
  Trash2, 
  DollarSign,
  Calendar,
  FileText,
  Download,
  Upload
} from "lucide-react";
import Navigation from "@/components/ui/navigation";
import { format } from "date-fns";

interface SurgicalCommission {
  id: string;
  orderDate: string;
  dateDue: string;
  datePaid: string;
  invoiceNumber: string;
  orderNumber: string;
  facility: string;
  contact: string;
  itemSku: string;
  quantity: number;
  sale: number;
  commission: number;
  commissionPaid: string;
}

export default function SurgicalCommissions() {
  const { user } = useAuth();
  const { toast } = useToast();
  
  // State management
  const [commissions, setCommissions] = useState<SurgicalCommission[]>([]);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingCommission, setEditingCommission] = useState<SurgicalCommission | null>(null);
  const [formData, setFormData] = useState<Partial<SurgicalCommission>>({
    orderDate: '',
    dateDue: '',
    datePaid: '',
    invoiceNumber: '',
    orderNumber: '',
    facility: '',
    contact: '',
    itemSku: '',
    quantity: 0,
    sale: 0,
    commission: 0,
    commissionPaid: ''
  });

  // Check if user is admin
  if ((user as any)?.role !== 'admin') {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900 mb-4">Access Denied</h1>
          <p className="text-gray-600">This page is only accessible to administrators.</p>
        </div>
      </div>
    );
  }

  // Load data from localStorage on component mount
  useEffect(() => {
    const savedCommissions = localStorage.getItem('surgicalCommissions');
    if (savedCommissions) {
      try {
        setCommissions(JSON.parse(savedCommissions));
      } catch (error) {
        console.error('Error loading surgical commissions:', error);
      }
    }
  }, []);

  // Save data to localStorage whenever commissions change
  useEffect(() => {
    localStorage.setItem('surgicalCommissions', JSON.stringify(commissions));
  }, [commissions]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.orderDate || !formData.facility || !formData.contact) {
      toast({
        title: "Error",
        description: "Please fill in all required fields",
        variant: "destructive"
      });
      return;
    }

    if (editingCommission) {
      // Update existing commission
      setCommissions(prev => prev.map(comm => 
        comm.id === editingCommission.id 
          ? { ...comm, ...formData } as SurgicalCommission
          : comm
      ));
      toast({ title: "Success", description: "Commission updated successfully" });
    } else {
      // Add new commission
      const newCommission: SurgicalCommission = {
        id: Date.now().toString(),
        ...formData
      } as SurgicalCommission;
      
      setCommissions(prev => [...prev, newCommission]);
      toast({ title: "Success", description: "Commission added successfully" });
    }

    // Reset form and close dialog
    setFormData({
      orderDate: '',
      dateDue: '',
      datePaid: '',
      invoiceNumber: '',
      orderNumber: '',
      facility: '',
      contact: '',
      itemSku: '',
      quantity: 0,
      sale: 0,
      commission: 0,
      commissionPaid: ''
    });
    setEditingCommission(null);
    setIsDialogOpen(false);
  };

  const handleEdit = (commission: SurgicalCommission) => {
    setEditingCommission(commission);
    setFormData(commission);
    setIsDialogOpen(true);
  };

  const handleDelete = (id: string) => {
    if (window.confirm('Are you sure you want to delete this commission record?')) {
      setCommissions(prev => prev.filter(comm => comm.id !== id));
      toast({ title: "Success", description: "Commission deleted successfully" });
    }
  };

  const exportToCSV = () => {
    const csvContent = [
      'Order Date,Date Due,Date Paid,Invoice #,Order #,Facility,Contact,Item SKU,Quantity,Sale,Commission,Commission Paid',
      ...commissions.map(comm => 
        `"${comm.orderDate}","${comm.dateDue}","${comm.datePaid}","${comm.invoiceNumber}","${comm.orderNumber}","${comm.facility}","${comm.contact}","${comm.itemSku}","${comm.quantity}","$${comm.sale.toFixed(2)}","$${comm.commission.toFixed(2)}","${comm.commissionPaid}"`
      )
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `surgical-commissions-${format(new Date(), 'yyyy-MM-dd')}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImportCSV = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const text = e.target?.result as string;
        const lines = text.split('\n').filter(line => line.trim());
        
        if (lines.length < 2) {
          toast({
            title: "Error",
            description: "CSV file appears to be empty or invalid",
            variant: "destructive"
          });
          return;
        }

        // Skip header row and parse data
        const importedCommissions: SurgicalCommission[] = [];
        
        for (let i = 1; i < lines.length; i++) {
          const line = lines[i];
          // Parse CSV line handling quoted fields
          const fields = [];
          let current = '';
          let inQuotes = false;
          
          for (let j = 0; j < line.length; j++) {
            const char = line[j];
            if (char === '"') {
              inQuotes = !inQuotes;
            } else if (char === ',' && !inQuotes) {
              fields.push(current.trim());
              current = '';
            } else {
              current += char;
            }
          }
          fields.push(current.trim()); // Add the last field

          if (fields.length >= 12) {
            // Clean up currency symbols and parse numbers
            const cleanSale = fields[9]?.replace(/[$,]/g, '') || '0';
            const cleanCommission = fields[10]?.replace(/[$,]/g, '') || '0';
            
            const commission: SurgicalCommission = {
              id: Date.now().toString() + '-' + i,
              orderDate: fields[0] || '',
              dateDue: fields[1] || '',
              datePaid: fields[2] || '',
              invoiceNumber: fields[3] || '',
              orderNumber: fields[4] || '',
              facility: fields[5] || '',
              contact: fields[6] || '',
              itemSku: fields[7] || '',
              quantity: parseInt(fields[8]) || 0,
              sale: parseFloat(cleanSale) || 0,
              commission: parseFloat(cleanCommission) || 0,
              commissionPaid: fields[11] || ''
            };
            
            importedCommissions.push(commission);
          }
        }

        if (importedCommissions.length > 0) {
          setCommissions(prev => [...prev, ...importedCommissions]);
          toast({
            title: "Success",
            description: `Imported ${importedCommissions.length} commission records`
          });
        } else {
          toast({
            title: "Warning",
            description: "No valid records found in CSV file",
            variant: "destructive"
          });
        }
      } catch (error) {
        toast({
          title: "Error",
          description: "Failed to parse CSV file. Please check the format.",
          variant: "destructive"
        });
        console.error('CSV import error:', error);
      }
    };

    reader.readAsText(file);
    // Reset the input value so the same file can be selected again if needed
    event.target.value = '';
  };

  // Calculate totals
  const totalSales = commissions.reduce((sum, comm) => sum + comm.sale, 0);
  const totalCommissions = commissions.reduce((sum, comm) => sum + comm.commission, 0);

  return (
    <div className="min-h-screen bg-gray-50">
      <Navigation />
      
      <div className="container mx-auto px-4 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Surgical Commissions</h1>
          <p className="text-gray-600 mt-2">Track surgical commission data and payments</p>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <Card>
            <CardContent className="flex items-center justify-between p-6">
              <div className="flex items-center">
                <FileText className="h-8 w-8 text-blue-600 mr-3" />
                <div>
                  <p className="text-sm font-medium text-blue-600">Total Records</p>
                  <p className="text-2xl font-bold text-blue-900">{commissions.length}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="flex items-center justify-between p-6">
              <div className="flex items-center">
                <DollarSign className="h-8 w-8 text-green-600 mr-3" />
                <div>
                  <p className="text-sm font-medium text-green-600">Total Sales</p>
                  <p className="text-2xl font-bold text-green-900">${totalSales.toLocaleString()}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="flex items-center justify-between p-6">
              <div className="flex items-center">
                <DollarSign className="h-8 w-8 text-purple-600 mr-3" />
                <div>
                  <p className="text-sm font-medium text-purple-600">Total Commissions</p>
                  <p className="text-2xl font-bold text-purple-900">${totalCommissions.toLocaleString()}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Actions */}
        <div className="flex justify-between items-center mb-6">
          <div className="flex gap-2">
            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
              <DialogTrigger asChild>
                <Button onClick={() => {
                  setEditingCommission(null);
                  setFormData({
                    orderDate: '',
                    dateDue: '',
                    datePaid: '',
                    invoiceNumber: '',
                    orderNumber: '',
                    facility: '',
                    contact: '',
                    itemSku: '',
                    quantity: 0,
                    sale: 0,
                    commission: 0,
                    commissionPaid: ''
                  });
                }}>
                  <Plus className="h-4 w-4 mr-2" />
                  Add Commission
                </Button>
              </DialogTrigger>
            
            <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>
                  {editingCommission ? 'Edit Commission' : 'Add New Commission'}
                </DialogTitle>
              </DialogHeader>
              
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="orderDate">Order Date *</Label>
                    <Input
                      id="orderDate"
                      type="date"
                      value={formData.orderDate}
                      onChange={(e) => setFormData(prev => ({ ...prev, orderDate: e.target.value }))}
                      required
                    />
                  </div>
                  
                  <div>
                    <Label htmlFor="dateDue">Date Due</Label>
                    <Input
                      id="dateDue"
                      type="date"
                      value={formData.dateDue}
                      onChange={(e) => setFormData(prev => ({ ...prev, dateDue: e.target.value }))}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="datePaid">Date Paid</Label>
                    <Input
                      id="datePaid"
                      type="date"
                      value={formData.datePaid}
                      onChange={(e) => setFormData(prev => ({ ...prev, datePaid: e.target.value }))}
                    />
                  </div>
                  
                  <div>
                    <Label htmlFor="invoiceNumber">Invoice #</Label>
                    <Input
                      id="invoiceNumber"
                      value={formData.invoiceNumber}
                      onChange={(e) => setFormData(prev => ({ ...prev, invoiceNumber: e.target.value }))}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="orderNumber">Order #</Label>
                    <Input
                      id="orderNumber"
                      value={formData.orderNumber}
                      onChange={(e) => setFormData(prev => ({ ...prev, orderNumber: e.target.value }))}
                    />
                  </div>
                  
                  <div>
                    <Label htmlFor="facility">Facility *</Label>
                    <Input
                      id="facility"
                      value={formData.facility}
                      onChange={(e) => setFormData(prev => ({ ...prev, facility: e.target.value }))}
                      required
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="contact">Contact *</Label>
                    <Input
                      id="contact"
                      value={formData.contact}
                      onChange={(e) => setFormData(prev => ({ ...prev, contact: e.target.value }))}
                      required
                    />
                  </div>
                  
                  <div>
                    <Label htmlFor="itemSku">Item SKU</Label>
                    <Input
                      id="itemSku"
                      value={formData.itemSku}
                      onChange={(e) => setFormData(prev => ({ ...prev, itemSku: e.target.value }))}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="quantity">Quantity</Label>
                    <Input
                      id="quantity"
                      type="number"
                      value={formData.quantity}
                      onChange={(e) => setFormData(prev => ({ ...prev, quantity: Number(e.target.value) }))}
                    />
                  </div>
                  
                  <div>
                    <Label htmlFor="sale">Sale Amount ($)</Label>
                    <Input
                      id="sale"
                      type="number"
                      step="0.01"
                      value={formData.sale}
                      onChange={(e) => setFormData(prev => ({ ...prev, sale: Number(e.target.value) }))}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="commission">Commission ($)</Label>
                    <Input
                      id="commission"
                      type="number"
                      step="0.01"
                      value={formData.commission}
                      onChange={(e) => setFormData(prev => ({ ...prev, commission: Number(e.target.value) }))}
                    />
                  </div>
                  
                  <div>
                    <Label htmlFor="commissionPaid">Commission Paid Date</Label>
                    <Input
                      id="commissionPaid"
                      value={formData.commissionPaid}
                      onChange={(e) => setFormData(prev => ({ ...prev, commissionPaid: e.target.value }))}
                      placeholder="e.g., 11/15/2024"
                    />
                  </div>
                </div>

                <DialogFooter>
                  <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>
                    Cancel
                  </Button>
                  <Button type="submit">
                    {editingCommission ? 'Update' : 'Add'} Commission
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
            </Dialog>

            <div className="relative">
              <input
                type="file"
                accept=".csv"
                onChange={handleImportCSV}
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                id="csv-import"
              />
              <Button variant="outline" asChild>
                <label htmlFor="csv-import" className="cursor-pointer">
                  <Upload className="h-4 w-4 mr-2" />
                  Import CSV
                </label>
              </Button>
            </div>
          </div>

          <Button onClick={exportToCSV} variant="outline">
            <Download className="h-4 w-4 mr-2" />
            Export CSV
          </Button>
        </div>

        {/* Commission Table */}
        <Card>
          <CardHeader>
            <CardTitle>Commission Records ({commissions.length})</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Order Date</TableHead>
                    <TableHead>Date Due</TableHead>
                    <TableHead>Date Paid</TableHead>
                    <TableHead>Invoice #</TableHead>
                    <TableHead>Order #</TableHead>
                    <TableHead>Facility</TableHead>
                    <TableHead>Contact</TableHead>
                    <TableHead>Item SKU</TableHead>
                    <TableHead>Qty</TableHead>
                    <TableHead>Sale</TableHead>
                    <TableHead>Commission</TableHead>
                    <TableHead>Comm. Paid</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {commissions.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={13} className="text-center py-8 text-gray-500">
                        No commission records found. Click "Add Commission" to get started.
                      </TableCell>
                    </TableRow>
                  ) : (
                    commissions.map((commission) => (
                      <TableRow key={commission.id}>
                        <TableCell>{commission.orderDate}</TableCell>
                        <TableCell>{commission.dateDue || '-'}</TableCell>
                        <TableCell>{commission.datePaid || '-'}</TableCell>
                        <TableCell>{commission.invoiceNumber || '-'}</TableCell>
                        <TableCell>{commission.orderNumber || '-'}</TableCell>
                        <TableCell>{commission.facility}</TableCell>
                        <TableCell>{commission.contact}</TableCell>
                        <TableCell>{commission.itemSku || '-'}</TableCell>
                        <TableCell>{commission.quantity}</TableCell>
                        <TableCell className="font-medium text-green-600">
                          ${commission.sale.toFixed(2)}
                        </TableCell>
                        <TableCell className="font-medium text-purple-600">
                          ${commission.commission.toFixed(2)}
                        </TableCell>
                        <TableCell>
                          {commission.commissionPaid ? (
                            <Badge variant="outline" className="border-green-500 text-green-700">
                              {commission.commissionPaid}
                            </Badge>
                          ) : (
                            <Badge variant="secondary">Pending</Badge>
                          )}
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleEdit(commission)}
                            >
                              <Edit className="h-3 w-3" />
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleDelete(commission.id)}
                            >
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}