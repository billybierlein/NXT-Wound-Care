import { useEffect, useState } from "react";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { CalendarIcon, Plus, Trash2, Edit3 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { format } from "date-fns";

interface PipelineNote {
  id: number;
  patient: string;
  assignedSalesRepId: number | null;
  assignedSalesRepName?: string;
  providerId: number | null;
  providerName?: string;
  woundSize: string | null;
  nextUpdate: string | null; // yyyy-mm-dd
  notes: string | null;
  createdByUserId: number;
  sortOrder?: number;
  createdAt: string;
  updatedAt: string;
}

interface Option {
  id: number;
  name: string;
}

interface PipelineNotesTableProps {
  userRole: "admin" | "sales_rep";
  meUserId: number;
  mySalesRepId: number | null;
  reps: Option[];
  providers: Option[];
}

export function PipelineNotesTable({
  userRole,
  meUserId,
  mySalesRepId,
  reps,
  providers
}: PipelineNotesTableProps) {
  const isAdmin = userRole === "admin";
  const { toast } = useToast();
  
  // Data state
  const [rows, setRows] = useState<PipelineNote[]>([]);
  const [loading, setLoading] = useState(true);

  // Admin filters
  const [filterRepId, setFilterRepId] = useState<number | "">("");
  const [filterProviderId, setFilterProviderId] = useState<number | "">("");

  // Draft row for new entries
  const [draft, setDraft] = useState<Partial<PipelineNote>>({});

  // Inline editing states
  const [editingField, setEditingField] = useState<{ id: number; field: string } | null>(null);
  const [editValue, setEditValue] = useState<string>("");
  
  // Date picker states
  const [editingDate, setEditingDate] = useState<number | null>(null);
  const [tempDate, setTempDate] = useState<Date | undefined>();

  // Load data
  async function loadData() {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (isAdmin && filterRepId !== "" && filterRepId !== "all") params.set("repId", String(filterRepId));
      if (isAdmin && filterProviderId !== "" && filterProviderId !== "all") params.set("providerId", String(filterProviderId));
      
      const url = `/api/pipeline-notes${params.toString() ? `?${params.toString()}` : ''}`;
      const response = await apiRequest("GET", url);
      const data = await response.json();
      if (data.ok) {
        setRows(data.data || []);
      } else {
        toast({
          title: "Error",
          description: data.message || "Failed to load pipeline notes",
          variant: "destructive",
        });
      }
    } catch (error: any) {
      toast({
        title: "Error",
        description: "Failed to load pipeline notes",
        variant: "destructive",
      });
    }
    setLoading(false);
  }

  useEffect(() => {
    loadData();
  }, [filterRepId, filterProviderId]);

  // Create new note
  async function createNote() {
    if (!draft.patient?.trim()) {
      toast({
        title: "Error",
        description: "Patient name is required",
        variant: "destructive",
      });
      return;
    }

    try {
      const payload = {
        patient: draft.patient.trim(),
        assignedSalesRepId: isAdmin ? (draft.assignedSalesRepId ?? null) : (mySalesRepId ?? null),
        providerId: draft.providerId ?? null,
        woundSize: draft.woundSize ?? null,
        nextUpdate: draft.nextUpdate ?? null,
        notes: draft.notes ?? null,
      };

      const response = await apiRequest("POST", "/api/pipeline-notes", payload);
      const data = await response.json();

      if (data.ok) {
        toast({
          title: "Success",
          description: "Pipeline note added successfully",
        });
        setDraft({});
        loadData(); // Reload to get fresh data
      } else {
        toast({
          title: "Error",
          description: data.message || "Failed to create note",
          variant: "destructive",
        });
      }
    } catch (error: any) {
      toast({
        title: "Error",
        description: "Failed to create note",
        variant: "destructive",
      });
    }
  }

  // Update note field
  async function updateField(id: number, field: string, value: any) {
    try {
      const payload = { [field]: value };
      const response = await apiRequest("PATCH", `/api/pipeline-notes/${id}`, payload);
      const data = await response.json();

      if (data.ok) {
        setRows(prevRows => prevRows.map(row => 
          row.id === id ? { ...row, [field]: value } : row
        ));
        toast({
          title: "Success",
          description: "Updated successfully",
        });
      } else {
        toast({
          title: "Error",
          description: data.message || "Failed to update",
          variant: "destructive",
        });
      }
    } catch (error: any) {
      toast({
        title: "Error",
        description: "Failed to update",
        variant: "destructive",
      });
    }
  }

  // Delete note
  async function deleteNote(id: number) {
    if (!confirm("Are you sure you want to delete this note?")) return;

    try {
      const response = await apiRequest("DELETE", `/api/pipeline-notes/${id}`);
      const data = await response.json();

      if (data.ok) {
        setRows(prevRows => prevRows.filter(row => row.id !== id));
        toast({
          title: "Success",
          description: "Note deleted successfully",
        });
      } else {
        toast({
          title: "Error",
          description: data.message || "Failed to delete",
          variant: "destructive",
        });
      }
    } catch (error: any) {
      toast({
        title: "Error",
        description: "Failed to delete",
        variant: "destructive",
      });
    }
  }

  // Inline editing helpers
  const startEdit = (id: number, field: string, currentValue: string) => {
    setEditingField({ id, field });
    setEditValue(currentValue || "");
  };

  const saveEdit = () => {
    if (editingField) {
      updateField(editingField.id, editingField.field, editValue);
    }
    setEditingField(null);
    setEditValue("");
  };

  const cancelEdit = () => {
    setEditingField(null);
    setEditValue("");
  };

  // Date editing helpers
  const startDateEdit = (id: number, currentDate: string | null) => {
    setEditingDate(id);
    setTempDate(currentDate ? new Date(currentDate) : undefined);
  };

  const saveDateEdit = (id: number) => {
    const dateString = tempDate ? format(tempDate, 'yyyy-MM-dd') : null;
    updateField(id, 'nextUpdate', dateString);
    setEditingDate(null);
    setTempDate(undefined);
  };

  const cancelDateEdit = () => {
    setEditingDate(null);
    setTempDate(undefined);
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-8">
          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
          <span className="ml-2">Loading pipeline notes...</span>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Plus className="h-5 w-5" />
          Pipeline Notes
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          Track patients and organize your follow-up actions
        </p>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Admin Filters */}
        {isAdmin && (
          <div className="flex flex-wrap gap-4">
            <div className="flex flex-col space-y-1">
              <Label className="text-xs font-medium">Sales Rep</Label>
              <Select 
                value={filterRepId === "" ? "all" : String(filterRepId)}
                onValueChange={(value) => setFilterRepId(value === "all" ? "" : Number(value))}
              >
                <SelectTrigger className="w-48">
                  <SelectValue placeholder="All Sales Reps" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Sales Reps</SelectItem>
                  {reps.map(rep => (
                    <SelectItem key={rep.id} value={String(rep.id)}>{rep.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col space-y-1">
              <Label className="text-xs font-medium">Provider</Label>
              <Select 
                value={filterProviderId === "" ? "all" : String(filterProviderId)}
                onValueChange={(value) => setFilterProviderId(value === "all" ? "" : Number(value))}
              >
                <SelectTrigger className="w-48">
                  <SelectValue placeholder="All Providers" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Providers</SelectItem>
                  {providers.map(provider => (
                    <SelectItem key={provider.id} value={String(provider.id)}>{provider.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        )}

        {/* Create New Note */}
        <div className="rounded-lg border bg-muted/50 p-4">
          <h4 className="font-medium mb-3">Add New Note</h4>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-3">
            <Input
              placeholder="Patient"
              value={draft.patient || ""}
              onChange={(e) => setDraft(prev => ({ ...prev, patient: e.target.value }))}
            />
            <Select
              disabled={!isAdmin}
              value={draft.assignedSalesRepId ? String(draft.assignedSalesRepId) : ""}
              onValueChange={(value) => setDraft(prev => ({ 
                ...prev, 
                assignedSalesRepId: value ? Number(value) : undefined 
              }))}
            >
              <SelectTrigger>
                <SelectValue placeholder={isAdmin ? "Rep" : "Auto-assigned"} />
              </SelectTrigger>
              <SelectContent>
                {isAdmin && <SelectItem value="none">No Rep</SelectItem>}
                {(isAdmin ? reps : reps.filter(r => r.id === mySalesRepId)).map(rep => (
                  <SelectItem key={rep.id} value={String(rep.id)}>{rep.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select
              value={draft.providerId ? String(draft.providerId) : ""}
              onValueChange={(value) => setDraft(prev => ({ 
                ...prev, 
                providerId: value ? Number(value) : undefined 
              }))}
            >
              <SelectTrigger>
                <SelectValue placeholder="Provider" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">No Provider</SelectItem>
                {providers.map(provider => (
                  <SelectItem key={provider.id} value={String(provider.id)}>{provider.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Input
              placeholder="Wound Size"
              value={draft.woundSize || ""}
              onChange={(e) => setDraft(prev => ({ ...prev, woundSize: e.target.value }))}
            />
            <Input
              type="date"
              placeholder="Next Update"
              value={draft.nextUpdate || ""}
              onChange={(e) => setDraft(prev => ({ ...prev, nextUpdate: e.target.value }))}
            />
            <Input
              placeholder="Notes"
              value={draft.notes || ""}
              onChange={(e) => setDraft(prev => ({ ...prev, notes: e.target.value }))}
            />
          </div>
          <Button 
            onClick={createNote} 
            className="mt-3"
            disabled={!draft.patient?.trim()}
          >
            <Plus className="h-4 w-4 mr-2" />
            Add Note
          </Button>
        </div>

        {/* Notes Table */}
        <div className="rounded-lg border overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-muted">
                <tr>
                  <th className="text-left p-3 font-medium">Patient</th>
                  <th className="text-left p-3 font-medium">Rep</th>
                  <th className="text-left p-3 font-medium">Provider</th>
                  <th className="text-left p-3 font-medium">Wound Size</th>
                  <th className="text-left p-3 font-medium">Next Update</th>
                  <th className="text-left p-3 font-medium">Notes</th>
                  <th className="text-left p-3 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {rows.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="text-center p-8 text-muted-foreground">
                      No pipeline notes found. Add your first note above.
                    </td>
                  </tr>
                ) : (
                  rows.map((row) => (
                    <tr key={row.id} className="border-t hover:bg-muted/30">
                      {/* Patient */}
                      <td className="p-3">
                        {editingField?.id === row.id && editingField?.field === 'patient' ? (
                          <div className="flex gap-1">
                            <Input
                              value={editValue}
                              onChange={(e) => setEditValue(e.target.value)}
                              className="h-8"
                              autoFocus
                            />
                            <Button size="sm" onClick={saveEdit}>✓</Button>
                            <Button size="sm" variant="outline" onClick={cancelEdit}>✕</Button>
                          </div>
                        ) : (
                          <span 
                            className="cursor-pointer hover:bg-muted rounded px-1"
                            onClick={() => startEdit(row.id, 'patient', row.patient)}
                          >
                            {row.patient}
                          </span>
                        )}
                      </td>

                      {/* Rep */}
                      <td className="p-3">
                        {isAdmin ? (
                          <Select
                            value={row.assignedSalesRepId ? String(row.assignedSalesRepId) : ""}
                            onValueChange={(value) => updateField(row.id, 'assignedSalesRepId', value ? Number(value) : null)}
                          >
                            <SelectTrigger className="h-8">
                              <SelectValue placeholder="No Rep" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="none">No Rep</SelectItem>
                              {reps.map(rep => (
                                <SelectItem key={rep.id} value={String(rep.id)}>{rep.name}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        ) : (
                          <span className="text-sm">{row.assignedSalesRepName || "Unassigned"}</span>
                        )}
                      </td>

                      {/* Provider */}
                      <td className="p-3">
                        <Select
                          value={row.providerId ? String(row.providerId) : ""}
                          onValueChange={(value) => updateField(row.id, 'providerId', value ? Number(value) : null)}
                        >
                          <SelectTrigger className="h-8">
                            <SelectValue placeholder="No Provider" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="none">No Provider</SelectItem>
                            {providers.map(provider => (
                              <SelectItem key={provider.id} value={String(provider.id)}>{provider.name}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </td>

                      {/* Wound Size */}
                      <td className="p-3">
                        {editingField?.id === row.id && editingField?.field === 'woundSize' ? (
                          <div className="flex gap-1">
                            <Input
                              value={editValue}
                              onChange={(e) => setEditValue(e.target.value)}
                              className="h-8"
                              autoFocus
                            />
                            <Button size="sm" onClick={saveEdit}>✓</Button>
                            <Button size="sm" variant="outline" onClick={cancelEdit}>✕</Button>
                          </div>
                        ) : (
                          <span 
                            className="cursor-pointer hover:bg-muted rounded px-1"
                            onClick={() => startEdit(row.id, 'woundSize', row.woundSize || "")}
                          >
                            {row.woundSize || "Click to add"}
                          </span>
                        )}
                      </td>

                      {/* Next Update */}
                      <td className="p-3">
                        <Popover open={editingDate === row.id} onOpenChange={(open) => !open && cancelDateEdit()}>
                          <PopoverTrigger asChild>
                            <Button
                              variant="outline"
                              size="sm"
                              className="h-8 px-2"
                              onClick={() => startDateEdit(row.id, row.nextUpdate)}
                            >
                              <CalendarIcon className="h-3 w-3 mr-1" />
                              {row.nextUpdate ? format(new Date(row.nextUpdate), 'MMM dd') : "Set date"}
                            </Button>
                          </PopoverTrigger>
                          <PopoverContent className="w-auto p-0" align="start">
                            <Calendar
                              mode="single"
                              selected={tempDate}
                              onSelect={setTempDate}
                              initialFocus
                            />
                            <div className="p-3 border-t border-border">
                              <div className="flex gap-2">
                                <Button size="sm" onClick={() => saveDateEdit(row.id)}>
                                  Save
                                </Button>
                                <Button size="sm" variant="outline" onClick={cancelDateEdit}>
                                  Cancel
                                </Button>
                              </div>
                            </div>
                          </PopoverContent>
                        </Popover>
                      </td>

                      {/* Notes */}
                      <td className="p-3">
                        {editingField?.id === row.id && editingField?.field === 'notes' ? (
                          <div className="flex gap-1">
                            <Input
                              value={editValue}
                              onChange={(e) => setEditValue(e.target.value)}
                              className="h-8"
                              autoFocus
                            />
                            <Button size="sm" onClick={saveEdit}>✓</Button>
                            <Button size="sm" variant="outline" onClick={cancelEdit}>✕</Button>
                          </div>
                        ) : (
                          <span 
                            className="cursor-pointer hover:bg-muted rounded px-1"
                            onClick={() => startEdit(row.id, 'notes', row.notes || "")}
                          >
                            {row.notes || "Click to add"}
                          </span>
                        )}
                      </td>

                      {/* Actions */}
                      <td className="p-3">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => deleteNote(row.id)}
                          className="h-8 w-8 p-0"
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}