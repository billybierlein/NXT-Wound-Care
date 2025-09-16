import { useState, useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Plus, Trash2, GripVertical, Calculator } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface PipelineNote {
  id: number;
  userId: number;
  ptName: string | null;
  rep: string | null;
  woundSize: string | null; // Decimal comes as string from database
  notes: string | null;
  sortOrder: number;
  createdAt: string | Date;
  updatedAt: string | Date;
}

interface EditingCell {
  noteId: number;
  field: keyof PipelineNote;
}

export function PipelineNotesWidget() {
  const [editingCell, setEditingCell] = useState<EditingCell | null>(null);
  const [editValue, setEditValue] = useState<string>("");
  const [draggedRow, setDraggedRow] = useState<number | null>(null);
  const queryClient = useQueryClient();
  const { toast } = useToast();

  // Fetch pipeline notes
  const { data: notes = [], isLoading } = useQuery<PipelineNote[]>({
    queryKey: ['/api/pipeline-notes'],
  });

  // Mutations for CRUD operations
  const createNoteMutation = useMutation({
    mutationFn: (data: Partial<PipelineNote>) => 
      apiRequest('POST', '/api/pipeline-notes', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/pipeline-notes'] });
      toast({ title: "Note added successfully" });
    },
    onError: () => {
      toast({ title: "Failed to add note", variant: "destructive" });
    }
  });

  const updateNoteMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: Partial<PipelineNote> }) =>
      apiRequest('PUT', `/api/pipeline-notes/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/pipeline-notes'] });
    },
    onError: () => {
      toast({ title: "Failed to update note", variant: "destructive" });
    }
  });

  const deleteNoteMutation = useMutation({
    mutationFn: (id: number) => 
      apiRequest('DELETE', `/api/pipeline-notes/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/pipeline-notes'] });
      toast({ title: "Note deleted successfully" });
    },
    onError: () => {
      toast({ title: "Failed to delete note", variant: "destructive" });
    }
  });

  const reorderMutation = useMutation({
    mutationFn: (noteUpdates: Array<{ id: number; sortOrder: number }>) =>
      apiRequest('POST', '/api/pipeline-notes/reorder', { noteUpdates }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/pipeline-notes'] });
    }
  });

  // Calculate total wound size
  const totalWoundSize = notes
    .filter((note: PipelineNote) => note.woundSize !== null)
    .reduce((sum: number, note: PipelineNote) => sum + (parseFloat(note.woundSize || '0')), 0);

  // Handle cell editing
  const startEditing = (noteId: number, field: keyof PipelineNote, currentValue: any) => {
    setEditingCell({ noteId, field });
    setEditValue(currentValue?.toString() || "");
  };

  const saveEdit = async () => {
    if (!editingCell) return;
    
    const { noteId, field } = editingCell;
    let value: any = editValue;

    // Convert types based on field
    if (field === 'woundSize') {
      value = editValue === "" ? null : editValue;
    }

    updateNoteMutation.mutate({ 
      id: noteId, 
      data: { [field]: value } 
    });
    
    setEditingCell(null);
  };

  const cancelEdit = () => {
    setEditingCell(null);
    setEditValue("");
  };

  const addNewNote = () => {
    const maxSortOrder = notes.length > 0 ? Math.max(...notes.map((n: PipelineNote) => n.sortOrder)) : 0;
    createNoteMutation.mutate({
      ptName: "New Patient",
      rep: "Rep Name", 
      woundSize: null,
      notes: "",
      sortOrder: maxSortOrder + 1
    });
  };

  // Handle drag and drop reordering
  const handleDragStart = (noteId: number) => {
    setDraggedRow(noteId);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = (e: React.DragEvent, targetNoteId: number) => {
    e.preventDefault();
    if (!draggedRow || draggedRow === targetNoteId) {
      setDraggedRow(null);
      return;
    }

    const sortedNotes = [...notes].sort((a, b) => a.sortOrder - b.sortOrder);
    const draggedIndex = sortedNotes.findIndex(n => n.id === draggedRow);
    const targetIndex = sortedNotes.findIndex(n => n.id === targetNoteId);
    
    if (draggedIndex === -1 || targetIndex === -1) return;

    // Reorder the notes
    const reorderedNotes = [...sortedNotes];
    const [draggedNote] = reorderedNotes.splice(draggedIndex, 1);
    reorderedNotes.splice(targetIndex, 0, draggedNote);

    // Update sort orders
    const noteUpdates = reorderedNotes.map((note, index) => ({
      id: note.id,
      sortOrder: index + 1
    }));

    reorderMutation.mutate(noteUpdates);
    setDraggedRow(null);
  };

  const renderEditableCell = (note: PipelineNote, field: keyof PipelineNote, value: any) => {
    const isEditing = editingCell?.noteId === note.id && editingCell?.field === field;
    
    if (isEditing) {
      if (field === 'notes') {
        return (
          <Textarea
            value={editValue}
            onChange={(e) => setEditValue(e.target.value)}
            onBlur={saveEdit}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                saveEdit();
              } else if (e.key === 'Escape') {
                cancelEdit();
              }
            }}
            className="min-h-[60px] text-xs"
            autoFocus
          />
        );
      } else {
        return (
          <Input
            value={editValue}
            onChange={(e) => setEditValue(e.target.value)}
            onBlur={saveEdit}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                saveEdit();
              } else if (e.key === 'Escape') {
                cancelEdit();
              }
            }}
            className="text-xs"
            type={field === 'woundSize' ? 'number' : 'text'}
            step={field === 'woundSize' ? '0.01' : undefined}
            autoFocus
          />
        );
      }
    }

    // Render display value
    const handleClick = () => startEditing(note.id, field, value);
    
    if (field === 'woundSize') {
      return (
        <div 
          className="cursor-pointer hover:bg-muted p-1 rounded text-xs text-center"
          onClick={handleClick}
        >
          {value !== null && value !== "" ? `${value} cm²` : "-"}
        </div>
      );
    } else if (field === 'notes') {
      return (
        <div 
          className="cursor-pointer hover:bg-muted p-1 rounded text-xs max-w-[150px] overflow-hidden text-ellipsis text-center"
          onClick={handleClick}
        >
          {value || "Click to add notes..."}
        </div>
      );
    }

    return (
      <div 
        className="cursor-pointer hover:bg-muted p-1 rounded text-xs"
        onClick={handleClick}
      >
        {value}
      </div>
    );
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg">Pipeline Notes</CardTitle>
          <CardDescription>Loading...</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-lg flex items-center gap-2">
              Pipeline Notes
              {totalWoundSize > 0 && (
                <Badge variant="outline" className="text-xs">
                  <Calculator className="w-3 h-3 mr-1" />
                  Total: {totalWoundSize.toFixed(1)} cm²
                </Badge>
              )}
            </CardTitle>
            <CardDescription>
              Track patients and organize your follow-up actions
            </CardDescription>
          </div>
          <Button
            size="sm"
            onClick={addNewNote}
            disabled={createNoteMutation.isPending}
          >
            <Plus className="w-4 h-4 mr-1" />
            Add Note
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-8 text-center"></TableHead>
                <TableHead className="text-xs text-center">Patient</TableHead>
                <TableHead className="text-xs text-center">Rep</TableHead>
                <TableHead className="text-xs text-center">Wound Size</TableHead>
                <TableHead className="text-xs min-w-[150px] text-center">Notes</TableHead>
                <TableHead className="w-8 text-center"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {notes.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-6 text-muted-foreground text-sm">
                    No notes yet. Click "Add Note" to get started.
                  </TableCell>
                </TableRow>
              ) : (
                [...notes]
                  .sort((a: PipelineNote, b: PipelineNote) => a.sortOrder - b.sortOrder)
                  .map((note: PipelineNote, index: number) => (
                    <TableRow
                      key={note.id}
                      draggable
                      onDragStart={() => handleDragStart(note.id)}
                      onDragOver={handleDragOver}
                      onDrop={(e) => handleDrop(e, note.id)}
                      className={`${draggedRow === note.id ? 'opacity-50' : ''} hover:bg-muted/50 ${index % 2 === 0 ? 'bg-white dark:bg-gray-900' : 'bg-gray-50 dark:bg-gray-800'}`}
                    >
                      <TableCell className="text-center">
                        <GripVertical className="w-4 h-4 text-muted-foreground cursor-grab mx-auto" />
                      </TableCell>
                      <TableCell className="py-2 text-center">
                        {renderEditableCell(note, 'ptName', note.ptName)}
                      </TableCell>
                      <TableCell className="py-2 text-center">
                        {renderEditableCell(note, 'rep', note.rep)}
                      </TableCell>
                      <TableCell className="py-2 text-center">
                        {renderEditableCell(note, 'woundSize', note.woundSize)}
                      </TableCell>
                      <TableCell className="py-2 text-center min-w-[150px]">
                        {renderEditableCell(note, 'notes', note.notes)}
                      </TableCell>
                      <TableCell className="text-center">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => deleteNoteMutation.mutate(note.id)}
                          disabled={deleteNoteMutation.isPending}
                          className="text-red-600 hover:text-red-700 hover:bg-red-50 mx-auto"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
              )}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}