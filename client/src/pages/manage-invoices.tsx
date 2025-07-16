import { useAuth } from "@/hooks/useAuth";
import { useEffect, useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Link } from "wouter";
import { 
  Plus, 
  Edit, 
  Trash2, 
  FileText,
  Calendar,
  DollarSign,
  User,
  Building
} from "lucide-react";
import Navigation from "@/components/ui/navigation";
import { isUnauthorizedError } from "@/lib/authUtils";
import { apiRequest } from "@/lib/queryClient";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Check, ChevronsUpDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { insertInvoiceSchema, type Invoice, type InsertInvoice, type Patient, type SalesRep, type Provider } from "@shared/schema";
import { format } from "date-fns";

export default function ManageInvoices() {
  const { user, isAuthenticated, isLoading } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingInvoice, setEditingInvoice] = useState<Invoice | null>(null);
  const [patientSearchOpen, setPatientSearchOpen] = useState(false);

  // Graft options with ASP pricing
  const graftOptions = [
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

  const form = useForm<InsertInvoice>({
    resolver: zodResolver(insertInvoiceSchema),
    defaultValues: {
      invoiceDate: new Date(),
      invoiceNo: "",
      payableDate: new Date(),
      treatmentStartDate: new Date(),
      patientName: "",
      salesRep: "",
      provider: "",
      graft: "",
      productCode: "",
      size: "0",
      totalBillable: "0",
      totalInvoice: "0",
      totalCommission: "0",
      repCommission: "0",
      nxtCommission: "0",
    },
  });

  // Redirect to login if not authenticated
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

  // Query to fetch invoices
  const { data: invoices = [], isLoading: invoicesLoading } = useQuery<Invoice[]>({
    queryKey: ["/api/invoices"],
    staleTime: 5 * 60 * 1000, // 5 minutes
    enabled: isAuthenticated,
  });

  // Query to fetch patients
  const { data: patients = [] } = useQuery<Patient[]>({
    queryKey: ["/api/patients"],
    enabled: isAuthenticated,
  });

  // Query to fetch sales reps
  const { data: salesReps = [] } = useQuery<SalesRep[]>({
    queryKey: ["/api/sales-reps"],
    enabled: isAuthenticated,
  });

  // Query to fetch providers
  const { data: providers = [] } = useQuery<Provider[]>({
    queryKey: ["/api/providers"],
    enabled: isAuthenticated,
  });

  // Create invoice mutation
  const createMutation = useMutation({
    mutationFn: async (invoice: InsertInvoice) => {
      const res = await apiRequest("POST", "/api/invoices", invoice);
      return await res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/invoices"] });
      setIsDialogOpen(false);
      form.reset();
      toast({
        title: "Success",
        description: "Invoice created successfully",
      });
    },
    onError: (error: Error) => {
      if (isUnauthorizedError(error)) {
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
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Update invoice mutation
  const updateMutation = useMutation({
    mutationFn: async ({ id, invoice }: { id: number; invoice: InsertInvoice }) => {
      const res = await apiRequest("PUT", `/api/invoices/${id}`, invoice);
      return await res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/invoices"] });
      setIsDialogOpen(false);
      setEditingInvoice(null);
      form.reset();
      toast({
        title: "Success",
        description: "Invoice updated successfully",
      });
    },
    onError: (error: Error) => {
      if (isUnauthorizedError(error)) {
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
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Delete invoice mutation
  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest("DELETE", `/api/invoices/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/invoices"] });
      toast({
        title: "Success",
        description: "Invoice deleted successfully",
      });
    },
    onError: (error: Error) => {
      if (isUnauthorizedError(error)) {
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
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleSubmit = (data: InsertInvoice) => {
    // Ensure all date fields are properly formatted for database (YYYY-MM-DD)
    const invoiceData = {
      ...data,
      invoiceDate: data.invoiceDate instanceof Date ? data.invoiceDate.toISOString().split('T')[0] : data.invoiceDate,
      payableDate: data.payableDate instanceof Date ? data.payableDate.toISOString().split('T')[0] : data.payableDate,
      treatmentStartDate: data.treatmentStartDate instanceof Date ? data.treatmentStartDate.toISOString().split('T')[0] : data.treatmentStartDate,
    };
    
    console.log('Frontend invoice data being sent:', invoiceData);
    
    if (editingInvoice) {
      updateMutation.mutate({ id: editingInvoice.id, invoice: invoiceData });
    } else {
      createMutation.mutate(invoiceData);
    }
  };

  // Calculate financial fields automatically
  const calculateFinancials = (size: string, graft: string, salesRep: string) => {
    const sizeNum = parseFloat(size) || 0;
    const selectedGraft = graftOptions.find(g => g.name === graft);
    const selectedSalesRep = salesReps.find(sr => sr.name === salesRep);
    
    if (!selectedGraft || !selectedSalesRep) return;
    
    // Calculate total billable (size * ASP)
    const totalBillable = sizeNum * selectedGraft.asp;
    
    // Calculate total invoice (60% of total billable)
    const totalInvoice = totalBillable * 0.6;
    
    // Calculate total commission (30% of invoice)
    const totalCommission = totalInvoice * 0.3;
    
    // Calculate rep commission (invoice * rep commission rate)
    const repCommission = totalInvoice * (selectedSalesRep.commissionRate / 100);
    
    // Calculate NXT commission (Total commission - Rep commission)
    const nxtCommission = totalCommission - repCommission;
    
    // Update form values
    form.setValue('totalBillable', totalBillable.toFixed(2));
    form.setValue('totalInvoice', totalInvoice.toFixed(2));
    form.setValue('totalCommission', totalCommission.toFixed(2));
    form.setValue('repCommission', repCommission.toFixed(2));
    form.setValue('nxtCommission', nxtCommission.toFixed(2));
  };

  // Watch for changes in size, graft, or sales rep to trigger calculations
  const watchedSize = form.watch('size');
  const watchedGraft = form.watch('graft');
  const watchedSalesRep = form.watch('salesRep');
  const watchedInvoiceDate = form.watch('invoiceDate');

  useEffect(() => {
    if (watchedSize && watchedGraft && watchedSalesRep) {
      calculateFinancials(watchedSize, watchedGraft, watchedSalesRep);
    }
  }, [watchedSize, watchedGraft, watchedSalesRep]);

  // Auto-calculate payable date when invoice date changes
  useEffect(() => {
    if (watchedInvoiceDate) {
      const invoiceDate = watchedInvoiceDate instanceof Date ? watchedInvoiceDate : new Date(watchedInvoiceDate);
      const payableDate = new Date(invoiceDate);
      payableDate.setDate(payableDate.getDate() + 30);
      form.setValue('payableDate', payableDate);
    }
  }, [watchedInvoiceDate]);

  // Handle graft selection and auto-populate product code
  const handleGraftChange = (graftName: string) => {
    const selectedGraft = graftOptions.find(g => g.name === graftName);
    if (selectedGraft) {
      form.setValue('graft', graftName);
      form.setValue('productCode', selectedGraft.qCode);
    }
  };

  const handleEdit = (invoice: Invoice) => {
    setEditingInvoice(invoice);
    form.reset({
      invoiceDate: invoice.invoiceDate ? new Date(invoice.invoiceDate) : new Date(),
      invoiceNo: invoice.invoiceNo,
      payableDate: invoice.payableDate ? new Date(invoice.payableDate) : new Date(),
      treatmentStartDate: invoice.treatmentStartDate ? new Date(invoice.treatmentStartDate) : new Date(),
      patientName: invoice.patientName,
      salesRep: invoice.salesRep,
      provider: invoice.provider,
      graft: invoice.graft,
      productCode: invoice.productCode,
      size: invoice.size,
      totalBillable: invoice.totalBillable,
      totalInvoice: invoice.totalInvoice,
      totalCommission: invoice.totalCommission,
      repCommission: invoice.repCommission,
      nxtCommission: invoice.nxtCommission,
    });
    setIsDialogOpen(true);
  };

  const handleDelete = (id: number) => {
    if (confirm("Are you sure you want to delete this invoice?")) {
      deleteMutation.mutate(id);
    }
  };

  const formatDate = (date: string | Date) => {
    if (!date) return '';
    const d = new Date(date);
    if (isNaN(d.getTime())) return '';
    return format(d, "MM/dd/yyyy");
  };

  const formatCurrency = (amount: string) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
    }).format(parseFloat(amount));
  };

  if (isLoading || invoicesLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Navigation />
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Manage Invoices</h1>
          <p className="text-gray-600 mt-2">Track and manage invoice records</p>
        </div>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Invoices ({invoices.length})
            </CardTitle>
            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
              <DialogTrigger asChild>
                <Button 
                  onClick={() => {
                    setEditingInvoice(null);
                    form.reset();
                  }}
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Add Invoice
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-2xl">
                <DialogHeader>
                  <DialogTitle>
                    {editingInvoice ? "Edit Invoice" : "Add New Invoice"}
                  </DialogTitle>
                </DialogHeader>
                <Form {...form}>
                  <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <FormField
                        control={form.control}
                        name="invoiceDate"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Invoice Date</FormLabel>
                            <FormControl>
                              <Input
                                type="date"
                                {...field}
                                value={field.value instanceof Date ? field.value.toISOString().split('T')[0] : field.value}
                                onChange={(e) => field.onChange(new Date(e.target.value))}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="invoiceNo"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Invoice Number</FormLabel>
                            <FormControl>
                              <Input placeholder="INV-001" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <FormField
                        control={form.control}
                        name="payableDate"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Payable Date</FormLabel>
                            <FormControl>
                              <Input
                                type="date"
                                {...field}
                                value={field.value instanceof Date ? field.value.toISOString().split('T')[0] : field.value}
                                onChange={(e) => field.onChange(new Date(e.target.value))}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="treatmentStartDate"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Treatment Start Date</FormLabel>
                            <FormControl>
                              <Input
                                type="date"
                                {...field}
                                value={field.value instanceof Date ? field.value.toISOString().split('T')[0] : field.value}
                                onChange={(e) => field.onChange(new Date(e.target.value))}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <FormField
                        control={form.control}
                        name="patientName"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Patient Name</FormLabel>
                            <Popover open={patientSearchOpen} onOpenChange={setPatientSearchOpen}>
                              <PopoverTrigger asChild>
                                <FormControl>
                                  <Button
                                    variant="outline"
                                    role="combobox"
                                    className="w-full justify-between"
                                  >
                                    {field.value || "Select patient"}
                                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                                  </Button>
                                </FormControl>
                              </PopoverTrigger>
                              <PopoverContent className="w-full p-0">
                                <Command>
                                  <CommandInput placeholder="Search patients..." />
                                  <CommandList>
                                    <CommandEmpty>No patient found.</CommandEmpty>
                                    <CommandGroup>
                                      {patients.map((patient) => (
                                        <CommandItem
                                          key={patient.id}
                                          onSelect={() => {
                                            const fullName = `${patient.firstName} ${patient.lastName}`;
                                            field.onChange(fullName);
                                            setPatientSearchOpen(false);
                                          }}
                                        >
                                          <Check
                                            className={`mr-2 h-4 w-4 ${
                                              field.value === `${patient.firstName} ${patient.lastName}`
                                                ? "opacity-100"
                                                : "opacity-0"
                                            }`}
                                          />
                                          {patient.firstName} {patient.lastName}
                                        </CommandItem>
                                      ))}
                                    </CommandGroup>
                                  </CommandList>
                                </Command>
                              </PopoverContent>
                            </Popover>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="salesRep"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Sales Rep</FormLabel>
                            <Select onValueChange={field.onChange} value={field.value}>
                              <FormControl>
                                <SelectTrigger>
                                  <SelectValue placeholder="Select sales rep" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                {salesReps.map((salesRep) => (
                                  <SelectItem key={salesRep.id} value={salesRep.name}>
                                    {salesRep.name} ({salesRep.commissionRate}%)
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <FormField
                        control={form.control}
                        name="provider"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Provider</FormLabel>
                            <Select onValueChange={field.onChange} value={field.value}>
                              <FormControl>
                                <SelectTrigger>
                                  <SelectValue placeholder="Select provider" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                {providers.map((provider) => (
                                  <SelectItem key={provider.id} value={provider.name}>
                                    {provider.name}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="graft"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Graft</FormLabel>
                            <Select onValueChange={handleGraftChange} value={field.value}>
                              <FormControl>
                                <SelectTrigger>
                                  <SelectValue placeholder="Select graft type" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                {graftOptions.map((graft) => (
                                  <SelectItem key={graft.name} value={graft.name}>
                                    {graft.name} (${graft.asp.toFixed(2)})
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <FormField
                        control={form.control}
                        name="productCode"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Product Code</FormLabel>
                            <FormControl>
                              <Input placeholder="Q4205-Q3" {...field} readOnly className="bg-gray-50" />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="size"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Size (sq cm)</FormLabel>
                            <FormControl>
                              <Input
                                type="number"
                                step="0.01"
                                placeholder="0.00"
                                {...field}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <FormField
                        control={form.control}
                        name="totalBillable"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Total Billable (Auto-calculated)</FormLabel>
                            <FormControl>
                              <Input
                                type="number"
                                step="0.01"
                                placeholder="0.00"
                                {...field}
                                readOnly
                                className="bg-gray-50"
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="totalInvoice"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Total Invoice (Auto-calculated)</FormLabel>
                            <FormControl>
                              <Input
                                type="number"
                                step="0.01"
                                placeholder="0.00"
                                {...field}
                                readOnly
                                className="bg-purple-50 text-purple-600 font-medium"
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>

                    <div className="grid grid-cols-3 gap-4">
                      <FormField
                        control={form.control}
                        name="totalCommission"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Total Commission (Auto-calculated)</FormLabel>
                            <FormControl>
                              <Input
                                type="number"
                                step="0.01"
                                placeholder="0.00"
                                {...field}
                                readOnly
                                className="bg-green-50 text-green-600 font-medium"
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="repCommission"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Rep Commission (Auto-calculated)</FormLabel>
                            <FormControl>
                              <Input
                                type="number"
                                step="0.01"
                                placeholder="0.00"
                                {...field}
                                readOnly
                                className="bg-green-50 text-green-600 font-medium"
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="nxtCommission"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>NXT Commission (Auto-calculated)</FormLabel>
                            <FormControl>
                              <Input
                                type="number"
                                step="0.01"
                                placeholder="0.00"
                                {...field}
                                readOnly
                                className="bg-orange-50 text-orange-600 font-medium"
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>

                    <div className="flex justify-end space-x-2">
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => setIsDialogOpen(false)}
                      >
                        Cancel
                      </Button>
                      <Button 
                        type="submit" 
                        disabled={createMutation.isPending || updateMutation.isPending}
                      >
                        {editingInvoice ? "Update Invoice" : "Create Invoice"}
                      </Button>
                    </div>
                  </form>
                </Form>
              </DialogContent>
            </Dialog>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Invoice Date</TableHead>
                    <TableHead>Invoice No.</TableHead>
                    <TableHead>Payable Date</TableHead>
                    <TableHead>Treatment Start</TableHead>
                    <TableHead>Patient Name</TableHead>
                    <TableHead>Sales Rep</TableHead>
                    <TableHead>Provider</TableHead>
                    <TableHead>Graft</TableHead>
                    <TableHead>Product Code</TableHead>
                    <TableHead>Size</TableHead>
                    <TableHead>Total Billable</TableHead>
                    <TableHead>Total Invoice</TableHead>
                    <TableHead>Total Commission</TableHead>
                    <TableHead>Rep Commission</TableHead>
                    {user?.role === 'admin' && <TableHead>NXT Commission</TableHead>}
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {invoices.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={user?.role === 'admin' ? 16 : 15} className="text-center py-8">
                        No invoices found
                      </TableCell>
                    </TableRow>
                  ) : (
                    invoices.map((invoice) => (
                      <TableRow key={invoice.id}>
                        <TableCell>{formatDate(invoice.invoiceDate)}</TableCell>
                        <TableCell className="font-medium">{invoice.invoiceNo}</TableCell>
                        <TableCell>{formatDate(invoice.payableDate)}</TableCell>
                        <TableCell>{formatDate(invoice.treatmentStartDate)}</TableCell>
                        <TableCell>{invoice.patientName}</TableCell>
                        <TableCell>{invoice.salesRep}</TableCell>
                        <TableCell>{invoice.provider}</TableCell>
                        <TableCell>{invoice.graft}</TableCell>
                        <TableCell>{invoice.productCode}</TableCell>
                        <TableCell>{invoice.size} sq cm</TableCell>
                        <TableCell>{formatCurrency(invoice.totalBillable)}</TableCell>
                        <TableCell className="text-purple-600 font-medium">{formatCurrency(invoice.totalInvoice)}</TableCell>
                        <TableCell className="text-green-600 font-medium">{formatCurrency(invoice.totalCommission)}</TableCell>
                        <TableCell className="text-green-600">{formatCurrency(invoice.repCommission)}</TableCell>
                        {user?.role === 'admin' && (
                          <TableCell className="text-orange-600">{formatCurrency(invoice.nxtCommission)}</TableCell>
                        )}
                        <TableCell>
                          <div className="flex space-x-2">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleEdit(invoice)}
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleDelete(invoice.id)}
                              disabled={deleteMutation.isPending}
                            >
                              <Trash2 className="h-4 w-4" />
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