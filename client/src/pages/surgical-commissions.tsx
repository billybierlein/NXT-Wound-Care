import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
  Upload,
  ChevronUp,
  ChevronDown,
  Check,
  X
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
  commissionRate: number;
  commissionPaid: string;
  commissionPaidDate: string;
  status: 'paid' | 'owed';
}

export default function SurgicalCommissions() {
  const { user } = useAuth();
  const { toast } = useToast();
  
  // State management
  const [commissions, setCommissions] = useState<SurgicalCommission[]>([]);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingCommission, setEditingCommission] = useState<SurgicalCommission | null>(null);
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [editingField, setEditingField] = useState<{id: string, field: string} | null>(null);
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
    commissionRate: 0,
    commissionPaid: '',
    commissionPaidDate: '',
    status: 'owed' as const
  });

  // Check if user is admin or Nash
  const isAuthorized = (user as any)?.role === 'admin' || (user as any)?.email === 'nash@nxtmedical.us';
  if (!isAuthorized) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900 mb-4">Access Denied</h1>
          <p className="text-gray-600">This page is only accessible to administrators and Nash.</p>
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
      commissionRate: 0,
      commissionPaid: '',
      commissionPaidDate: '',
      status: 'owed' as const
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
      'Order Date,Date Due,Date Paid,Invoice #,Order #,Facility,Contact,Item SKU,Quantity,Sale,Commission Rate,Commission Paid,Comm. Paid Date,Status',
      ...commissions.map(comm => 
        `"${comm.orderDate}","${comm.dateDue}","${comm.datePaid}","${comm.invoiceNumber}","${comm.orderNumber}","${comm.facility}","${comm.contact}","${comm.itemSku}","${comm.quantity}","$${comm.sale.toFixed(2)}","${comm.commissionRate.toFixed(2)}%","${comm.commissionPaid}","${comm.commissionPaidDate}","${comm.status}"`
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
            const cleanCommissionRate = fields[10]?.replace(/[%$,]/g, '') || '0';
            
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
              commissionRate: parseFloat(cleanCommissionRate) || 0,
              commissionPaid: fields[11] || '',
              commissionPaidDate: fields[12] || '',
              status: (fields[13]?.toLowerCase() === 'paid' ? 'paid' : 'owed') as 'paid' | 'owed'
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
  const paidCommissions = commissions.reduce((sum, comm) => {
    if (comm.status === 'paid') {
      return sum + (comm.sale * comm.commissionRate / 100);
    }
    return sum;
  }, 0);
  const owedCommissions = commissions.reduce((sum, comm) => {
    if (comm.status === 'owed') {
      return sum + (comm.sale * comm.commissionRate / 100);
    }
    return sum;
  }, 0);

  // Sort commissions by order date
  const sortedCommissions = [...commissions].sort((a, b) => {
    const dateA = new Date(a.orderDate);
    const dateB = new Date(b.orderDate);
    return sortOrder === 'asc' ? dateA.getTime() - dateB.getTime() : dateB.getTime() - dateA.getTime();
  });

  const toggleSortOrder = () => {
    setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc');
  };

  const handleInlineEdit = (id: string, field: string, value: any) => {
    setCommissions(prev => prev.map(comm => 
      comm.id === id ? { ...comm, [field]: value } : comm
    ));
    setEditingField(null);
    
    // Save to localStorage
    const updatedCommissions = commissions.map(comm => 
      comm.id === id ? { ...comm, [field]: value } : comm
    );
    localStorage.setItem('surgicalCommissions', JSON.stringify(updatedCommissions));
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <Navigation />
      
      <div className="container mx-auto px-4 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Surgical Commissions</h1>
          <p className="text-gray-600 mt-2">Track surgical commission data and payments</p>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
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
                <DollarSign className="h-8 w-8 text-green-600 mr-3" />
                <div>
                  <p className="text-sm font-medium text-green-600">Paid Commissions</p>
                  <p className="text-2xl font-bold text-green-900">${paidCommissions.toLocaleString()}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="flex items-center justify-between p-6">
              <div className="flex items-center">
                <DollarSign className="h-8 w-8 text-red-600 mr-3" />
                <div>
                  <p className="text-sm font-medium text-red-600">Owed Commissions</p>
                  <p className="text-2xl font-bold text-red-900">${owedCommissions.toLocaleString()}</p>
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
                    commissionRate: 0,
                    commissionPaid: '',
                    commissionPaidDate: '',
                    status: 'owed' as const
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
                    <Label htmlFor="commissionRate">Commission Rate (%)</Label>
                    <Input
                      id="commissionRate"
                      type="number"
                      step="0.01"
                      value={formData.commissionRate}
                      onChange={(e) => setFormData(prev => ({ ...prev, commissionRate: Number(e.target.value) }))}
                    />
                  </div>
                  
                  <div>
                    <Label htmlFor="status">Status</Label>
                    <Select value={formData.status} onValueChange={(value: 'paid' | 'owed') => setFormData(prev => ({ ...prev, status: value }))}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select status" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="owed">Owed</SelectItem>
                        <SelectItem value="paid">Paid</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="commissionPaid">Commission Paid</Label>
                    <Input
                      id="commissionPaid"
                      value={formData.commissionPaid}
                      onChange={(e) => setFormData(prev => ({ ...prev, commissionPaid: e.target.value }))}
                      placeholder="e.g., Check #1234"
                    />
                  </div>
                  
                  <div>
                    <Label htmlFor="commissionPaidDate">Comm. Paid Date</Label>
                    <Input
                      id="commissionPaidDate"
                      type="date"
                      value={formData.commissionPaidDate}
                      onChange={(e) => setFormData(prev => ({ ...prev, commissionPaidDate: e.target.value }))}
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
              <Table className="min-w-full table-fixed">
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-24">
                      <Button 
                        variant="ghost" 
                        onClick={toggleSortOrder}
                        className="p-0 h-auto font-semibold hover:bg-transparent text-xs"
                      >
                        Order Date
                        {sortOrder === 'asc' ? (
                          <ChevronUp className="ml-1 h-3 w-3" />
                        ) : (
                          <ChevronDown className="ml-1 h-3 w-3" />
                        )}
                      </Button>
                    </TableHead>
                    <TableHead className="w-20">Date Due</TableHead>
                    <TableHead className="w-20">Date Paid</TableHead>
                    <TableHead className="w-16">Invoice #</TableHead>
                    <TableHead className="w-16">Order #</TableHead>
                    <TableHead className="w-32">Facility</TableHead>
                    <TableHead className="w-24">Contact</TableHead>
                    <TableHead className="w-20">Item SKU</TableHead>
                    <TableHead className="w-12">Qty</TableHead>
                    <TableHead className="w-20">Sale</TableHead>
                    <TableHead className="w-20">Comm. Rate</TableHead>
                    <TableHead className="w-20">Comm. Paid</TableHead>
                    <TableHead className="w-24">Paid Date</TableHead>
                    <TableHead className="w-16">Status</TableHead>
                    <TableHead className="w-20">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {commissions.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={15} className="text-center py-8 text-gray-500">
                        No commission records found. Click "Add Commission" to get started.
                      </TableCell>
                    </TableRow>
                  ) : (
                    sortedCommissions.map((commission) => (
                      <TableRow key={commission.id}>
                        <TableCell className="text-xs">
                          {commission.orderDate ? format(new Date(commission.orderDate), 'MM/dd/yyyy') : '-'}
                        </TableCell>
                        <TableCell className="text-xs">
                          {commission.dateDue ? format(new Date(commission.dateDue), 'MM/dd/yyyy') : '-'}
                        </TableCell>
                        <TableCell className="text-xs">
                          {commission.datePaid ? format(new Date(commission.datePaid), 'MM/dd/yyyy') : '-'}
                        </TableCell>
                        <TableCell className="text-xs">{commission.invoiceNumber || '-'}</TableCell>
                        <TableCell className="text-xs">{commission.orderNumber || '-'}</TableCell>
                        <TableCell className="text-xs truncate" title={commission.facility}>
                          {commission.facility}
                        </TableCell>
                        <TableCell className="text-xs truncate" title={commission.contact}>
                          {commission.contact}
                        </TableCell>
                        <TableCell className="text-xs">{commission.itemSku || '-'}</TableCell>
                        <TableCell className="text-xs">{commission.quantity}</TableCell>
                        <TableCell className="font-medium text-green-600 text-xs">
                          ${commission.sale.toFixed(2)}
                        </TableCell>
                        <TableCell className="font-medium text-purple-600 text-xs">
                          {commission.commissionRate.toFixed(2)}%
                        </TableCell>
                        <TableCell>
                          {commission.commissionPaid ? (
                            <Badge variant="outline" className="border-green-500 text-green-700 text-xs whitespace-nowrap">
                              {commission.commissionPaid}
                            </Badge>
                          ) : (
                            <Badge variant="secondary" className="text-xs">Pending</Badge>
                          )}
                        </TableCell>
                        <TableCell>
                          {editingField?.id === commission.id && editingField?.field === 'commissionPaidDate' ? (
                            <div className="flex items-center gap-2">
                              <Input
                                type="date"
                                defaultValue={commission.commissionPaidDate}
                                onBlur={(e) => handleInlineEdit(commission.id, 'commissionPaidDate', e.target.value)}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') {
                                    handleInlineEdit(commission.id, 'commissionPaidDate', (e.target as HTMLInputElement).value);
                                  } else if (e.key === 'Escape') {
                                    setEditingField(null);
                                  }
                                }}
                                className="w-24 text-xs"
                                autoFocus
                              />
                              <Button 
                                size="sm" 
                                variant="ghost"
                                onClick={() => setEditingField(null)}
                              >
                                <X className="h-3 w-3" />
                              </Button>
                            </div>
                          ) : (
                            <div 
                              onClick={() => setEditingField({id: commission.id, field: 'commissionPaidDate'})}
                              className="cursor-pointer hover:bg-gray-50 p-1 rounded text-xs"
                            >
                              {commission.commissionPaidDate ? (
                                <span className="text-gray-700 whitespace-nowrap">
                                  {format(new Date(commission.commissionPaidDate), 'MM/dd/yy')}
                                </span>
                              ) : (
                                <span className="text-gray-400">Add date</span>
                              )}
                            </div>
                          )}
                        </TableCell>
                        <TableCell>
                          {editingField?.id === commission.id && editingField?.field === 'status' ? (
                            <Select 
                              defaultValue={commission.status} 
                              onValueChange={(value: 'paid' | 'owed') => handleInlineEdit(commission.id, 'status', value)}
                            >
                              <SelectTrigger className="w-16 h-6 text-xs">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="owed">Owed</SelectItem>
                                <SelectItem value="paid">Paid</SelectItem>
                              </SelectContent>
                            </Select>
                          ) : (
                            <div 
                              onClick={() => setEditingField({id: commission.id, field: 'status'})}
                              className="cursor-pointer hover:bg-gray-50 p-1 rounded inline-block"
                            >
                              <Badge variant={commission.status === 'paid' ? 'default' : 'destructive'} className="text-xs">
                                {commission.status === 'paid' ? 'Paid' : 'Owed'}
                              </Badge>
                            </div>
                          )}
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-1">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleEdit(commission)}
                              className="h-6 w-6 p-0"
                            >
                              <Edit className="h-3 w-3" />
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleDelete(commission.id)}
                              className="h-6 w-6 p-0"
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