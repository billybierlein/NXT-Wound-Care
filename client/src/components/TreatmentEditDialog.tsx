import { useState, useEffect, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { CalendarIcon, Plus, Trash2 } from "lucide-react";
import { format } from "date-fns";

const treatmentFormSchema = z.object({
  patientId: z.number().optional(),
  providerId: z.number().optional(),
  treatmentNumber: z.string().optional(),
  skinGraftType: z.string().optional(),
  qCode: z.string().optional(),
  woundSizeAtTreatment: z.string().optional(),
  pricePerSqCm: z.string().optional(),
  treatmentDate: z.date(),
  status: z.string(),
  notes: z.string().optional(),
  invoiceStatus: z.string(),
  invoiceDate: z.string().optional(),
  invoiceNo: z.string().optional(),
  payableDate: z.string().optional(),
  paymentDate: z.string().optional(),
  invoiceTotal: z.string().optional(),
  referralSourceId: z.number().optional(),
  commissions: z.array(z.object({
    salesRepId: z.number(),
    salesRepName: z.string(),
    commissionRate: z.string(),
    commissionAmount: z.string(),
  })).optional(),
});

type TreatmentFormData = z.infer<typeof treatmentFormSchema>;

interface TreatmentEditDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  treatmentId?: number;
  onSaved?: () => void;
}

// Normalize treatment payload helper
const normalizeTreatmentPayload = (raw: any) => {
  const toNum = (v: any) => (v === "" || v == null ? null : Number(v));
  const toStr = (v: any) => (v === "" ? null : v);
  const toDate = (v: any) => (v ? v : null);

  return {
    patientId: toNum(raw.patientId),
    providerId: toNum(raw.providerId),
    actingProvider: undefined, // Use provider ID instead
    invoiceStatus: toStr(raw.invoiceStatus),
    paymentDate: toDate(raw.paymentDate),
    treatmentNumber: toStr(raw.treatmentNumber),
    skinGraftType: toStr(raw.skinGraftType),
    qCode: toStr(raw.qCode),
    woundSizeAtTreatment: toStr(raw.woundSizeAtTreatment),
    pricePerSqCm: toNum(raw.pricePerSqCm),
    treatmentDate: raw.treatmentDate,
    status: toStr(raw.status),
    notes: toStr(raw.notes),
    invoiceDate: toDate(raw.invoiceDate),
    invoiceNo: toStr(raw.invoiceNo),
    payableDate: toDate(raw.payableDate),
    invoiceTotal: toNum(raw.invoiceTotal),
    referralSourceId: toNum(raw.referralSourceId),
    commissions: Array.isArray(raw.commissions)
      ? raw.commissions
          .filter((c: any) => c && c.salesRepId && (Number(c.commissionRate) || 0) >= 0)
          .map((c: any) => ({
            salesRepId: Number(c.salesRepId),
            salesRepName: c.salesRepName,
            commissionRate: Number(c.commissionRate),
            commissionAmount: c.commissionAmount != null ? Number(c.commissionAmount) : null,
          }))
      : undefined,
  };
};

export default function TreatmentEditDialog({
  open,
  onOpenChange,
  treatmentId,
  onSaved
}: TreatmentEditDialogProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  // Payment date popup state
  const [confirmDateOpen, setConfirmDateOpen] = useState(false);
  const [paymentDate, setPaymentDate] = useState("");
  const lastStatusRef = useRef<string | undefined>(undefined);

  // Commission state for multi-rep system
  const [treatmentCommissions, setTreatmentCommissions] = useState<Array<{
    salesRepId: number;
    salesRepName: string;
    commissionRate: string;
    commissionAmount: string;
  }>>([]);

  const form = useForm<TreatmentFormData>({
    resolver: zodResolver(treatmentFormSchema),
    defaultValues: {
      treatmentDate: new Date(),
      status: "active",
      invoiceStatus: "open",
      invoiceDate: "",
      payableDate: "",
      paymentDate: "",
      notes: "",
      commissions: [],
    }
  });

  // Fetch treatment data
  const { data: treatment, isLoading: treatmentLoading } = useQuery({
    queryKey: ["treatment", treatmentId],
    queryFn: async () => {
      if (!treatmentId) return null;
      const response = await fetch(`/api/treatments/${treatmentId}`);
      if (!response.ok) throw new Error("Failed to fetch treatment");
      return response.json();
    },
    enabled: !!treatmentId && open,
  });

  // Fetch providers
  const { data: providers = [] } = useQuery({
    queryKey: ["/api/providers"],
    enabled: open,
  });

  // Fetch patients
  const { data: patients = [] } = useQuery({
    queryKey: ["/api/patients"],
    enabled: open,
  });

  // Fetch referral sources  
  const { data: referralSources = [] } = useQuery({
    queryKey: ["/api/referral-sources"],
    enabled: open,
  });

  // Fetch sales reps
  const { data: salesReps = [] } = useQuery({
    queryKey: ["/api/sales-reps"],
    enabled: open,
  });

  // Fetch treatment commissions if editing
  const { data: existingCommissions = [] } = useQuery({
    queryKey: ["treatment-commissions", treatmentId],
    queryFn: async () => {
      if (!treatmentId) return [];
      const response = await fetch(`/api/treatment-commissions/${treatmentId}`);
      if (!response.ok) return [];
      return response.json();
    },
    enabled: !!treatmentId && open,
  });

  // Normalize providers data
  const normalizedProviders = (providers as any[]).map((p: any) => ({
    id: p.id,
    name: p.name || p.providerName || `Provider ${p.id}`,
  }));

  // Update treatment mutation
  const updateTreatmentMutation = useMutation({
    mutationFn: async ({ id, payload }: { id: number; payload: any }) => {
      const res = await fetch(`/api/treatments/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (!res.ok || json?.ok === false) throw new Error(json?.message || "Update failed");
      return json;
    },
    onSuccess: () => {
      toast({ title: "Success", description: "Treatment updated successfully" });
      onOpenChange(false);
      onSaved?.();
      queryClient.invalidateQueries({ queryKey: ["/api/treatments/all"] });
      queryClient.invalidateQueries({ queryKey: ["/api/patients"] });
      queryClient.invalidateQueries({ queryKey: ["/api/commission-reports"] });
    },
    onError: (err: any) => {
      toast({ 
        title: "Error", 
        description: String(err?.message || err), 
        variant: "destructive" 
      });
    },
  });

  // Create treatment mutation
  const createTreatmentMutation = useMutation({
    mutationFn: async (payload: any) => {
      const res = await fetch(`/api/treatments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (!res.ok || json?.ok === false) throw new Error(json?.message || "Create failed");
      return json;
    },
    onSuccess: () => {
      toast({ title: "Success", description: "Treatment created successfully" });
      onOpenChange(false);
      onSaved?.();
      queryClient.invalidateQueries({ queryKey: ["/api/treatments/all"] });
      queryClient.invalidateQueries({ queryKey: ["/api/patients"] });
    },
    onError: (err: any) => {
      toast({ 
        title: "Error", 
        description: String(err?.message || err), 
        variant: "destructive" 
      });
    },
  });

  // Reset form when opening with treatment data
  useEffect(() => {
    if (!open || !treatment || !normalizedProviders.length) return;

    let providerId: number | undefined = treatment.providerId ?? undefined;
    if (!providerId && treatment.actingProvider) {
      const match = normalizedProviders.find(
        p => p.name.trim().toLowerCase() === treatment.actingProvider!.trim().toLowerCase()
      );
      providerId = match?.id;
    }

    form.reset({
      patientId: treatment.patientId,
      providerId,
      treatmentNumber: treatment.treatmentNumber || "",
      skinGraftType: treatment.skinGraftType || "",
      qCode: treatment.qCode || "",
      woundSizeAtTreatment: treatment.woundSizeAtTreatment?.toString() || "",
      pricePerSqCm: treatment.pricePerSqCm?.toString() || "",
      treatmentDate: new Date(treatment.treatmentDate),
      status: treatment.status || "active",
      notes: treatment.notes || "",
      invoiceStatus: treatment.invoiceStatus || "open",
      invoiceDate: treatment.invoiceDate ? treatment.invoiceDate.toString().split('T')[0] : "",
      invoiceNo: treatment.invoiceNo || "",
      payableDate: treatment.payableDate ? treatment.payableDate.toString().split('T')[0] : "",
      paymentDate: treatment.paymentDate ? treatment.paymentDate.toString().split('T')[0] : "",
      invoiceTotal: treatment.invoiceTotal?.toString() || "",
      referralSourceId: treatment.referralSourceId || undefined,
    });

    lastStatusRef.current = treatment.invoiceStatus || "open";
  }, [open, treatment, normalizedProviders, form]);

  // Load existing commissions when editing
  useEffect(() => {
    if (!treatmentId || !existingCommissions.length || !(salesReps as any[]).length) return;

    const commissionData = existingCommissions.map((commission: any) => {
      const salesRep = (salesReps as any[]).find((rep: any) => rep.id === commission.salesRepId);
      return {
        salesRepId: commission.salesRepId,
        salesRepName: salesRep?.name || "Unknown Rep",
        commissionRate: commission.commissionRate?.toString() || "0",
        commissionAmount: commission.commissionAmount?.toString() || "0",
      };
    });

    setTreatmentCommissions(commissionData);
  }, [treatmentId, existingCommissions, salesReps]);

  // Watch invoice status for payment date popup
  const status = form.watch("invoiceStatus");
  useEffect(() => {
    if (!open) {
      lastStatusRef.current = undefined;
      return;
    }
    const prev = lastStatusRef.current;
    if (!prev) {
      lastStatusRef.current = status;
      return;
    }
    if (prev === "open" && status === "closed") {
      setConfirmDateOpen(true);
    }
    lastStatusRef.current = status;
  }, [status, open]);

  // Form submit handler
  const onSubmit = form.handleSubmit((raw) => {
    if (!treatmentId && !raw.patientId) {
      toast({ 
        title: "Error", 
        description: "Please select a patient", 
        variant: "destructive" 
      });
      return;
    }

    const payload = normalizeTreatmentPayload({
      ...raw,
      commissions: treatmentCommissions,
    });

    if (treatmentId) {
      updateTreatmentMutation.mutate({ id: treatmentId, payload });
    } else {
      createTreatmentMutation.mutate(payload);
    }
  });

  // Add commission assignment
  const addCommissionAssignment = () => {
    setTreatmentCommissions([...treatmentCommissions, {
      salesRepId: 0,
      salesRepName: "",
      commissionRate: "0",
      commissionAmount: "0",
    }]);
  };

  // Remove commission assignment
  const removeCommissionAssignment = (index: number) => {
    setTreatmentCommissions(treatmentCommissions.filter((_, i) => i !== index));
  };

  // Update commission assignment
  const updateCommissionAssignment = (index: number, field: string, value: any) => {
    const updated = [...treatmentCommissions];
    updated[index] = { ...updated[index], [field]: value };
    
    if (field === "salesRepId") {
      const salesRep = (salesReps as any[]).find((rep: any) => rep.id === Number(value));
      if (salesRep) {
        updated[index].salesRepName = salesRep.name;
      }
    }
    
    setTreatmentCommissions(updated);
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle data-testid="shared-treatment-dialog">
              {treatmentId ? "Edit Treatment" : "Add New Treatment"}
            </DialogTitle>
          </DialogHeader>
          
          {treatmentLoading ? (
            <div className="flex justify-center py-4">Loading...</div>
          ) : (
            <Form {...form}>
              <form id="treatment-form" onSubmit={onSubmit} className="space-y-6">
                {/* Invoice Status Row */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <FormField
                    control={form.control}
                    name="invoiceStatus"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Invoice Status</FormLabel>
                        <Select 
                          value={field.value || undefined} 
                          onValueChange={field.onChange}
                        >
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select status" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="open">Open</SelectItem>
                            <SelectItem value="payable">Payable</SelectItem>
                            <SelectItem value="closed">Closed</SelectItem>
                          </SelectContent>
                        </Select>
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
                          <Input {...field} placeholder="INV-001" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="invoiceTotal"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Invoice Total</FormLabel>
                        <FormControl>
                          <Input 
                            {...field} 
                            type="number" 
                            step="0.01" 
                            placeholder="0.00" 
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                {/* Patient Selection for new treatments */}
                {!treatmentId && (
                  <FormField
                    control={form.control}
                    name="patientId"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Patient *</FormLabel>
                        <Select
                          value={field.value ? String(field.value) : undefined}
                          onValueChange={(v) => field.onChange(v ? Number(v) : undefined)}
                        >
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select patient" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {(patients as any[]).map((patient: any) => (
                              <SelectItem key={patient.id} value={String(patient.id)}>
                                {patient.firstName} {patient.lastName}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                )}

                {/* Provider Selection - Fixed to use undefined for placeholder */}
                <FormField
                  control={form.control}
                  name="providerId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Acting Provider</FormLabel>
                      <Select
                        value={field.value ? String(field.value) : undefined}
                        onValueChange={(v) => field.onChange(v ? Number(v) : undefined)}
                        disabled={!normalizedProviders.length}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select provider" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {normalizedProviders.map((provider) => (
                            <SelectItem key={provider.id} value={String(provider.id)}>
                              {provider.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* Treatment Details */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="treatmentNumber"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Treatment Number</FormLabel>
                        <FormControl>
                          <Input {...field} placeholder="TXN-001" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="treatmentDate"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Treatment Date</FormLabel>
                        <Popover>
                          <PopoverTrigger asChild>
                            <FormControl>
                              <Button
                                variant={"outline"}
                                className={`w-full pl-3 text-left font-normal ${!field.value && "text-muted-foreground"}`}
                              >
                                {field.value ? format(field.value, "PPP") : "Pick a date"}
                                <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                              </Button>
                            </FormControl>
                          </PopoverTrigger>
                          <PopoverContent className="w-auto p-0" align="start">
                            <Calendar
                              mode="single"
                              selected={field.value}
                              onSelect={field.onChange}
                              disabled={(date) => date > new Date() || date < new Date("1900-01-01")}
                              initialFocus
                            />
                          </PopoverContent>
                        </Popover>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                {/* Graft Details */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <FormField
                    control={form.control}
                    name="skinGraftType"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Skin Graft Type</FormLabel>
                        <FormControl>
                          <Input {...field} placeholder="e.g. Apligraf" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="qCode"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Q Code</FormLabel>
                        <FormControl>
                          <Input {...field} placeholder="Q4101" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="woundSizeAtTreatment"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Wound Size (sq cm)</FormLabel>
                        <FormControl>
                          <Input {...field} type="number" placeholder="0" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                {/* Commission Assignments */}
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <FormLabel>Commission Assignments</FormLabel>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={addCommissionAssignment}
                    >
                      <Plus className="h-4 w-4 mr-2" />
                      Add Commission
                    </Button>
                  </div>

                  {treatmentCommissions.map((commission, index) => (
                    <div key={index} className="flex items-center space-x-2 p-4 border rounded">
                      <Select
                        value={commission.salesRepId ? String(commission.salesRepId) : undefined}
                        onValueChange={(value) => updateCommissionAssignment(index, "salesRepId", Number(value))}
                      >
                        <SelectTrigger className="flex-1">
                          <SelectValue placeholder="Select sales rep" />
                        </SelectTrigger>
                        <SelectContent>
                          {(salesReps as any[]).map((rep: any) => (
                            <SelectItem key={rep.id} value={String(rep.id)}>
                              {rep.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>

                      <Input
                        type="number"
                        placeholder="Rate %"
                        value={commission.commissionRate}
                        onChange={(e) => updateCommissionAssignment(index, "commissionRate", e.target.value)}
                        className="w-24"
                      />

                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => removeCommissionAssignment(index)}
                        className="text-red-600"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>

                {/* Notes */}
                <FormField
                  control={form.control}
                  name="notes"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Notes</FormLabel>
                      <FormControl>
                        <Textarea {...field} placeholder="Treatment notes..." />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* Submit Button */}
                <div className="flex justify-end space-x-2">
                  <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                    Cancel
                  </Button>
                  <Button 
                    type="submit" 
                    form="treatment-form"
                    disabled={updateTreatmentMutation.isPending || createTreatmentMutation.isPending}
                  >
                    {treatmentId ? "Update Treatment" : "Create Treatment"}
                  </Button>
                </div>
              </form>
            </Form>
          )}
        </DialogContent>
      </Dialog>

      {/* Payment Date Confirmation Dialog */}
      <Dialog open={confirmDateOpen} onOpenChange={setConfirmDateOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Set Payment Date</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-gray-600">
              Invoice status changed to "Closed". Would you like to set a payment date?
            </p>
            <Input
              type="date"
              value={paymentDate}
              onChange={(e) => setPaymentDate(e.target.value)}
              placeholder="Select payment date"
            />
            <div className="flex justify-end space-x-2">
              <Button
                variant="outline"
                onClick={() => {
                  setConfirmDateOpen(false);
                  setPaymentDate("");
                }}
              >
                Skip
              </Button>
              <Button
                onClick={() => {
                  if (paymentDate) {
                    form.setValue("paymentDate", paymentDate);
                  }
                  setConfirmDateOpen(false);
                  setPaymentDate("");
                }}
              >
                Set Date
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}